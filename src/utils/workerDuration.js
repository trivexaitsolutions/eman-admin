// Public booking contract: only matching worker availability can be booked.
const { prorateWorkerAmount } = require('./registration');
const DURATION_OPTIONS = Object.freeze(['FULL_DAY', '2', '3', '4']);
function normalizeDuration(value) {
    const duration = String(value == null ? 'FULL_DAY' : value).trim().toUpperCase();
    return DURATION_OPTIONS.includes(duration) ? duration : null;
}
function matchesWorkerDuration(worker, duration) {
    const selected = normalizeDuration(duration);
    if (!selected) return false;
    if (selected === 'FULL_DAY') return worker?.availabilityType === 'FULL_DAY';
    return worker?.availabilityType === 'SHORT_PERIOD' && Number(worker?.availabilityHours) === Number(selected);
}
// Exactly the base tariff used by the Worker's duration-price preview.
// Pool-number reductions are deliberately NOT included in customer charges.
function workerDayBaseRate(worker) {
    const rates = (worker?.skills || []).flatMap(skill => (skill?.rates || []).map(rate => Number(rate.rate)))
        .filter(rate => Number.isFinite(rate) && rate > 0);
    return rates.length ? Math.min(...rates) : null;
}
function durationRate(worker, duration) {
    const normalized = normalizeDuration(duration);
    const dayRate = workerDayBaseRate(worker);
    if (!normalized || dayRate == null) return null;
    return normalized === 'FULL_DAY'
        ? prorateWorkerAmount(dayRate, 'FULL_DAY', 8)
        : prorateWorkerAmount(dayRate, 'SHORT_PERIOD', Number(normalized));
}
module.exports = { DURATION_OPTIONS, normalizeDuration, matchesWorkerDuration, workerDayBaseRate, durationRate };
