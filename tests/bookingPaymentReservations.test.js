const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    paymentCheck, releaseUnpaidBooking, confirmCapturedBooking, reconcileStaleReservations,
} = require('../src/utils/bookingReservation');

function fakePrisma() {
    const state = { status: 'PENDING', releases: 0, writes: [], paid: false };
    const booking = { id: 68, customerId: 13, workers: [{ id: 17 }], amount: 100, razorpayOrderId: 'order_123' };
    const tx = {
        booking: {
            findFirst: async (args) => args.where.status === state.status ? booking : null,
            updateMany: async (args) => {
                if (args.where.status !== state.status || (args.where.razorpayPaymentId === null && state.paid)) return { count: 0 };
                state.status = args.data.status;
                state.paid = !!args.data.razorpayPaymentId;
                state.writes.push(args);
                return { count: 1 };
            },
            findMany: async () => [booking],
        },
        worker: { updateMany: async (args) => {
            assert.equal(state.status, 'CANCELLED');
            assert.deepEqual(args.where.bookings.none.status.in, ['PENDING', 'ASSIGNED', 'IN_PROGRESS']);
            state.releases += 1; return { count: 1 };
        }},
    };
    return { state, $transaction: async (cb) => cb(tx), booking: tx.booking, worker: tx.worker };
}
const gateway = (items, order = { status: 'created' }) => ({
    orders: { fetchPayments: async () => ({ items }), fetch: async () => order },
});

test('Refund-safe: a failed Razorpay attempt is UNPAID', async () => {
    assert.equal((await paymentCheck(gateway([{ status: 'failed' }]), 'order_123')).state, 'UNPAID');
    assert.equal((await paymentCheck(null, 'order_123')).state, 'UNKNOWN');
    assert.equal((await paymentCheck(gateway([{ status: 'created' }]), 'order_123')).state, 'UNKNOWN');
});
test('Never release an authorized or captured payment', async () => {
    assert.equal((await paymentCheck(gateway([{ status: 'authorized' }]), 'order_123')).state, 'AUTHORIZED');
    assert.equal((await paymentCheck(gateway([{ status: 'captured', id: 'pay_1' }]), 'order_123')).state, 'CAPTURED');
    assert.equal((await paymentCheck(gateway([] , { status: 'paid' }), 'order_123')).state, 'UNKNOWN');
});
test('Cancel unpaid booking atomically, unlock the worker, preserve audit record', async () => {
    const db = fakePrisma();
    assert.deepEqual(await releaseUnpaidBooking(db, 68, { customerId: 13 }), { released: true, workerCount: 1 });
    assert.equal(db.state.status, 'CANCELLED');
    assert.equal(db.state.releases, 1);
    assert.equal((await releaseUnpaidBooking(db, 68)).released, false);
});
test('Payment capture must match Razorpay order, amount and currency', async () => {
    const db = fakePrisma();
    const booking = { id: 68, amount: 100, razorpayOrderId: 'order_123' };
    assert.equal((await confirmCapturedBooking(db, booking, {
        id: 'pay_1', status: 'captured', order_id: 'order_999', amount: 10000, currency: 'INR',
    })).confirmed, false);
    assert.equal((await confirmCapturedBooking(db, booking, {
        id: 'pay_1', status: 'captured', order_id: 'order_123', amount: 10001, currency: 'INR',
    })).confirmed, false);
    assert.equal((await confirmCapturedBooking(db, booking, {
        id: 'pay_1', status: 'captured', order_id: 'order_123', amount: 10000, currency: 'INR',
    })).confirmed, true);
    assert.equal(db.state.status, 'ASSIGNED');
    assert.equal(db.state.releases, 0);
});
test('Expired unpaid reservation recovers automatically; never marks as booked', async () => {
    const db = fakePrisma();
    const result = await reconcileStaleReservations(db, gateway([]), { now: new Date() });
    assert.equal(result.released, 1);
    assert.equal(db.state.status, 'CANCELLED');
});
test('Gateway outage preserves hold for manual payment reconciliation', async () => {
    const db = fakePrisma();
    const result = await reconcileStaleReservations(db, null);
    assert.equal(result.uncertain, 1);
    assert.equal(db.state.status, 'PENDING');
});
