'use strict';

// A Razorpay order is only a payment request, not evidence of payment.
const HOLD_MINUTES = 15;
const LIVE_BOOKING_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'];

const paymentCheck = async (razorpay, orderId) => {
    if (!orderId) return { state: 'UNPAID' }; // No checkout order was ever created.
    if (!razorpay) return { state: 'UNKNOWN' };

    try {
        const result = await razorpay.orders.fetchPayments(orderId);
        const items = Array.isArray(result?.items) ? result.items : [];
        const captured = items.find((item) => item.status === 'captured');
        if (captured) return { state: 'CAPTURED', payment: captured };
        const authorized = items.find((item) => item.status === 'authorized');
        if (authorized) return { state: 'AUTHORIZED', payment: authorized };
        // A UPI/card payment can remain in a pending state after checkout closes.
        if (items.some((item) => ['created', 'pending', 'processing'].includes(item.status))) {
            return { state: 'UNKNOWN' };
        }
        // An order can be marked paid while its payment listing is delayed.
        const order = await razorpay.orders.fetch(orderId);
        if (order?.status === 'paid' || Number(order?.amount_paid || 0) > 0) {
            return { state: 'UNKNOWN' };
        }
        return { state: 'UNPAID' };
    } catch (error) {
        console.error('[Booking reservation] Gateway status unavailable:', error?.message || error);
        // Never release an uncertain payment hold on a network/gateway failure.
        return { state: 'UNKNOWN' };
    }
};

const releaseUnpaidBooking = async (prisma, bookingId, { customerId } = {}) => {
    const id = Number(bookingId);
    if (!Number.isInteger(id) || id <= 0) return { released: false, reason: 'INVALID_BOOKING' };

    return prisma.$transaction(async (tx) => {
        const where = {
            id,
            status: 'PENDING',
            razorpayPaymentId: null,
            ...(customerId !== undefined ? { customerId: Number(customerId) } : {}),
        };
        const booking = await tx.booking.findFirst({
            where,
            select: { id: true, workers: { select: { id: true } } },
        });
        if (!booking) return { released: false, reason: 'NOT_PENDING' };

        // CAS prevents cancelling a payment that concurrently became ASSIGNED.
        const changed = await tx.booking.updateMany({
            where,
            data: { status: 'CANCELLED' },
        });
        if (changed.count !== 1) return { released: false, reason: 'NOT_PENDING' };

        const workerIds = booking.workers.map((worker) => worker.id);
        let workerCount = 0;
        if (workerIds.length) {
            const releasedWorkers = await tx.worker.updateMany({
                where: {
                    id: { in: workerIds },
                    isActive: true,
                    isAvailable: false,
                    availabilityUntil: { gt: new Date() },
                    availabilityType: { not: null },
                    // Another live reservation must never be accidentally unlocked.
                    bookings: { none: { status: { in: LIVE_BOOKING_STATUSES } } },
                },
                data: { isAvailable: true },
            });
            workerCount = releasedWorkers.count;
        }
        // Keep a CANCELLED record for auditing; never delete payment history.
        return { released: true, workerCount };
    });
};

const confirmCapturedBooking = async (prisma, booking, payment) => {
    if (!payment || payment.status !== 'captured' ||
        payment.order_id !== booking.razorpayOrderId ||
        Number(payment.amount) !== Math.round(Number(booking.amount) * 100) ||
        String(payment.currency).toUpperCase() !== 'INR') {
        return { confirmed: false, reason: 'PAYMENT_MISMATCH' };
    }
    const changed = await prisma.booking.updateMany({
        where: { id: booking.id, razorpayOrderId: payment.order_id, razorpayPaymentId: null, status: 'PENDING' },
        data: { status: 'ASSIGNED', razorpayPaymentId: payment.id },
    });
    return { confirmed: changed.count === 1, reason: changed.count ? null : 'NOT_PENDING' };
};

// Crash/reload recovery. Never release a hold if Razorpay cannot rule out a payment.
const reconcileStaleReservations = async (prisma, razorpay, { now = new Date(), limit = 25, onConfirmed } = {}) => {
    const stale = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
            razorpayPaymentId: null,
            createdAt: { lt: new Date(now.getTime() - HOLD_MINUTES * 60 * 1000) },
        },
        select: { id: true, amount: true, razorpayOrderId: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
    });
    const summary = { checked: 0, released: 0, confirmed: 0, uncertain: 0 };
    for (const booking of stale) {
        summary.checked++;
        const payment = await paymentCheck(razorpay, booking.razorpayOrderId);
        if (payment.state === 'CAPTURED') {
            const result = await confirmCapturedBooking(prisma, booking, payment.payment);
            if (result.confirmed) {
                summary.confirmed++;
                if (onConfirmed) {
                    try { await onConfirmed(booking.id); }
                    catch (error) { console.error('[Booking reservation] Push failed:', error?.message || error); }
                }
            } else summary.uncertain++;
        } else if (payment.state === 'UNPAID') {
            const result = await releaseUnpaidBooking(prisma, booking.id);
            if (result.released) summary.released++;
        } else {
            summary.uncertain++;
            console.warn(`[Booking reservation] #${booking.id}: ${payment.state}, kept locked for payment reconciliation.`);
        }
    }
    return summary;
};

module.exports = {
    HOLD_MINUTES, paymentCheck, releaseUnpaidBooking,
    confirmCapturedBooking, reconcileStaleReservations,
};
