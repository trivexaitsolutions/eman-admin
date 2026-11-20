'use strict';
const { PrismaClient } = require('@prisma/client');
const { getRazorpayGateway } = require('./apiIntegrations');
const { reconcileStaleReservations } = require('../utils/bookingReservation');
const { sendPushNotification } = require('../utils/sendNotification');
const prisma = new PrismaClient();
let isRunning = false;
let started = false;


async function notifyRecoveredBooking(bookingId) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { workers: { select: { name: true, pushToken: true } } },
    });
    if (!booking || booking.status !== 'ASSIGNED') return;
    for (const worker of booking.workers) {
        if (!worker.pushToken) continue;
        try {
            await sendPushNotification(worker.pushToken, '🎉 NAYA KAAM MIL GAYA!',
                'Customer payment confirm ho gaya hai. Apni duty check karein.',
                { bookingId, action: 'OPEN_ACTIVE_DUTY' });
        } catch (error) {
            console.warn('Recovered booking push failed:', error?.message || error);
        }
    }
}

async function reconcile() {
    if (isRunning) return;
    isRunning = true;
    try {
        const gateway = await getRazorpayGateway();
        const result = await reconcileStaleReservations(prisma, gateway, { onConfirmed: notifyRecoveredBooking });
        if (result.released || result.confirmed || result.uncertain) {
            console.log('[Booking reservation recovery]', result);
        }
    } catch (error) {
        console.error('[Booking reservation recovery] Failed:', error);
    } finally {
        isRunning = false;
    }
}

function startBookingReservationWatcher() {
    if (started) return;
    started = true;
    // Recovery on restart and every minute; default payment hold is 15 minutes.
    void reconcile();
    const interval = setInterval(() => { void reconcile(); }, 60_000);
    interval.unref?.();
}

module.exports = { startBookingReservationWatcher, reconcile };
