const FULL_DAY_HOURS = 8;

function uppercaseName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-IN');
}

// All workers are priced against the same standard eight-hour workday.
function prorateWorkerAmount(dayAmount, availabilityType, availabilityHours) {
    const amount = Number(dayAmount);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    if (availabilityType !== 'SHORT_PERIOD') return Math.round(amount * 100) / 100;
    const hours = Number(availabilityHours);
    if (![2, 3, 4].includes(hours)) return 0;
    return Math.round((amount * hours / FULL_DAY_HOURS) * 100) / 100;
}

// The birthday for age-only registrations is always 1 June. The birth year
// respects whether this year's 1 June has already passed.
function dobFromAge(age, now = new Date()) {
    const parsed = Number(age);
    if (!Number.isInteger(parsed) || parsed < 18 || parsed > 100) return null;
    const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const part = name => Number(dateParts.find(item => item.type === name)?.value);
    const yearNow = part('year');
    const afterJuneFirst = part('month') >= 6;
    const year = yearNow - parsed - (afterJuneFirst ? 0 : 1);
    return `${year}-06-01`;
}

module.exports = { uppercaseName, prorateWorkerAmount, dobFromAge, FULL_DAY_HOURS };
