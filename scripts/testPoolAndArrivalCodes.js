// Run: node scripts/testPoolAndArrivalCodes.js (no database or npm install needed)
const assert = require('node:assert/strict');
const {
    issueArrivalCodes, verifyArrivalCode, CODE_LIFETIME_MS, CODE_GRACE_MS,
} = require('../src/utils/arrivalCodes');
const { getActivePoolContext, applyPoolReduction } = require('../src/utils/bookingSettings');

async function run() {
    const workers = [{ id: 12 }, { id: 14 }];
    const bucket = 250;
    const time = bucket * CODE_LIFETIME_MS + 1234;
    const { codes, expiresAt } = issueArrivalCodes(200, workers, time);
    assert.match(codes.get(12), /^\d{6}$/);
    assert.notEqual(codes.get(12), codes.get(14));
    assert.equal(verifyArrivalCode(200, workers, codes.get(12), time).workerId, 12);
    assert.equal(verifyArrivalCode(201, workers, codes.get(12), time).status, 'INVALID');
    assert.equal(verifyArrivalCode(200, [{ id: 99 }], codes.get(12), time).status, 'INVALID');
    assert.equal(verifyArrivalCode(200, workers, codes.get(12), (bucket + 1) * CODE_LIFETIME_MS + CODE_GRACE_MS - 1).status, 'VALID');
    assert.equal(verifyArrivalCode(200, workers, codes.get(12), (bucket + 1) * CODE_LIFETIME_MS + CODE_GRACE_MS + 1).status, 'EXPIRED');
    assert.equal(new Date(expiresAt).getTime(), (bucket + 1) * CODE_LIFETIME_MS);

    const todayAt1015IST = new Date('2026-10-11T04:45:00.000Z');
    const slots = ['08:00', '09:00', '10:00', '11:00'].map((startTime, sortOrder) => ({
        id: sortOrder + 1, startTime, sortOrder, isActive: true,
    }));
    const fakePrisma = {
        bookingSetting: {
            findUnique: async () => ({
                poolDayStart: '08:00', poolDayEnd: '20:00', poolSlots: slots,
                poolReductionType: 'FIXED', poolReductionValue: 100,
            }),
        },
    };
    const active = await getActivePoolContext(fakePrisma, todayAt1015IST);
    assert.equal(active.isOpen, true);
    assert.equal(active.activeSlot.startTime, '10:00');
    assert.equal(active.poolEnd.toISOString(), '2026-10-11T14:30:00.000Z');
    assert.equal(applyPoolReduction({ baseRate: 1000, poolSortOrder: 0, reductionValue: 100 }), 1000);
    assert.equal(applyPoolReduction({ baseRate: 1000, poolSortOrder: 2, reductionValue: 100 }), 800);
    assert.equal(applyPoolReduction({ baseRate: 1000, poolSortOrder: 3, reductionValue: 100 }), 700);
    assert.equal(applyPoolReduction({ baseRate: 1000, poolSortOrder: 2, reductionType: 'PERCENTAGE', reductionValue: 5 }), 900);
    assert.equal(applyPoolReduction({ baseRate: 1000, poolSortOrder: 20, reductionValue: 100 }), 0);
    console.log('PASS - arrival code uniqueness, booking/worker match, expiry, active pool, pricing');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
