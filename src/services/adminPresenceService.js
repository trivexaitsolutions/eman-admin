// Shared admin-list operational statuses. No login/booking data is guessed from push tokens.
const ACTIVE_BOOKING_STATUSES = ["ASSIGNED", "IN_PROGRESS"];
const ONLINE_GRACE_MS = 2 * 60 * 1000;

function jsonIdSet(raw) {
    try {
        const values = JSON.parse(raw || "[]");
        return new Set(Array.isArray(values) ? values.map(Number).filter(Number.isInteger) : []);
    } catch {
        return new Set();
    }
}

function activeBookingMaps(bookings) {
    const byCustomer = new Map();
    const byWorker = new Map();
    for (const booking of bookings) {
        if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) continue;
        const cancelled = jsonIdSet(booking.cancelledWorkerIds);
        const completed = jsonIdSet(booking.completedWorkerIds);
        const activeWorkers = (booking.workers || []).filter(
            (worker) => !cancelled.has(worker.id) && !completed.has(worker.id)
        );
        if (!activeWorkers.length) continue;
        if (!byCustomer.has(booking.customerId)) byCustomer.set(booking.customerId, booking.id);
        for (const worker of activeWorkers) {
            if (!byWorker.has(worker.id)) byWorker.set(worker.id, booking.id);
        }
    }
    return { byCustomer, byWorker };
}

async function getActiveBookingMaps(prisma) {
    const bookings = await prisma.booking.findMany({
        where: { status: { in: ACTIVE_BOOKING_STATUSES } },
        select: {
            id: true, customerId: true, status: true,
            cancelledWorkerIds: true, completedWorkerIds: true,
            workers: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    return activeBookingMaps(bookings);
}

function workerStatus(worker, bookingId, now = new Date()) {
    if (bookingId) return { label: "In Booking", state: "booking", bookingId };
    // Online here means genuinely available inside an unexpired admin pool.
    if (worker.isActive && worker.isAvailable && worker.availabilityUntil &&
        new Date(worker.availabilityUntil).getTime() > now.getTime()) {
        return { label: "Online", state: "online", bookingId: null };
    }
    return { label: "Offline", state: "offline", bookingId: null };
}

function customerStatus(customer, bookingId, now = new Date()) {
    if (bookingId) return { label: "In Booking", state: "booking", bookingId };
    const lastSeen = customer.lastSeenAt ? new Date(customer.lastSeenAt).getTime() : NaN;
    if (Number.isFinite(lastSeen) && lastSeen <= now.getTime() &&
        now.getTime() - lastSeen <= ONLINE_GRACE_MS) {
        return { label: "Online", state: "online", bookingId: null };
    }
    return { label: "Offline", state: "offline", bookingId: null };
}

module.exports = { activeBookingMaps, getActiveBookingMaps, workerStatus, customerStatus };
