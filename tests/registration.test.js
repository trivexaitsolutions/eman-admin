const test = require('node:test');
const assert = require('node:assert/strict');
const { uppercaseName, prorateWorkerAmount, dobFromAge } = require('../src/utils/registration');

test('all registrant names are normalized to uppercase', () => {
    assert.equal(uppercaseName('  rahul   sharma '), 'RAHUL SHARMA');
});

test('worker payout prorates an eight-hour day', () => {
    assert.equal(prorateWorkerAmount(1000, 'FULL_DAY', 8), 1000);
    assert.equal(prorateWorkerAmount(1000, 'SHORT_PERIOD', 2), 250);
    assert.equal(prorateWorkerAmount(1000, 'SHORT_PERIOD', 3), 375);
    assert.equal(prorateWorkerAmount(1000, 'SHORT_PERIOD', 4), 500);
    assert.equal(prorateWorkerAmount(1000, 'SHORT_PERIOD', 5), 0);
    assert.equal(prorateWorkerAmount(1000, 'SHORT_PERIOD', 0), 0);
});

test('age-only DOB always uses June 1 and preserves stated age', () => {
    assert.equal(dobFromAge(25, new Date('2026-11-10T09:00:00Z')), '2001-06-01');
    assert.equal(dobFromAge(25, new Date('2026-02-10T09:00:00Z')), '2000-06-01');
    assert.equal(dobFromAge(17, new Date()), null);
});
