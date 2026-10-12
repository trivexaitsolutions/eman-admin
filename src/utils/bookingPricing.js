// Read-only presentation of the amount captured for a booking. Never recalculate
// historical worker prices from today's pool configuration.
function finiteMoney(value) {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
function parsePriceSnapshot(raw) {
    if (!raw) return {};
    try {
        const map = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
    } catch { return {}; }
}
function bookingPricePresentation(booking) {
    const snapshots = parsePriceSnapshot(booking.workerPriceSnapshot);
    const workerCharges = (booking.workers || []).map((worker) => {
        const snapshot = snapshots[String(worker.id)];
        const valid = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
        const poolNumber = valid ? Number(snapshot.poolNumber) : NaN;
        return {
            workerId: worker.id,
            amount: valid ? finiteMoney(snapshot.amount) : null,
            baseRate: valid ? finiteMoney(snapshot.baseRate) : null,
            poolNumber: Number.isInteger(poolNumber) && poolNumber > 0 ? poolNumber : null,
        };
    });
    return { totalAmount: finiteMoney(booking.amount), workerCharges };
}
module.exports = { bookingPricePresentation, finiteMoney };
