'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const serviceFile = require('node:path').resolve(__dirname, '../src/services/fieldAgentClientOtp.js');

function setup({ provider = 'MAIL', delivered = true, draftStep = 3 } = {}) {
    const otpRows = [];
    let draftIdentity = { phone: '9876543210', email: 'user@example.com' };
    let outgoing = [];
    const fakeDb = {
        fieldAgentClientOtp: {
            async deleteMany({ where }) {
                const existing = otpRows.filter(r => r.mitraId === where.mitraId && r.draftId === where.draftId);
                for (const record of existing) otpRows.splice(otpRows.indexOf(record), 1);
                return { count: existing.length };
            },
            async create({ data }) {
                const row = { id: otpRows.length + 1, attempts: 0, verifiedAt: null, consumedAt: null, createdAt: new Date(), ...data };
                otpRows.push(row); return row;
            },
            async findFirst({ where }) {
                return otpRows.filter(r => r.mitraId === where.mitraId && r.draftId === where.draftId && r.consumedAt === where.consumedAt)
                    .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
            },
            async update({ where, data }) {
                const record = otpRows.find(r => r.id === where.id);
                if (data.attempts?.increment) record.attempts += data.attempts.increment;
                if (data.verifiedAt) record.verifiedAt = data.verifiedAt;
                return record;
            },
        },
        customer: { async findFirst() { return null; } },
        async $transaction(task) { return task(fakeDb); },
    };
    const mocks = {
        '@prisma/client': { PrismaClient: class { constructor() { return fakeDb; } } },
        './apiIntegrations': { getSettings: async () => ({ otpProvider: provider }) },
        './otpDelivery': { sendOtpViaConfiguredProvider: async data => {
            outgoing.push(data); return { sent: delivered, channel: provider === 'MAIL' ? 'email' : 'sms', error: 'Provider failed' };
        } },
        '../utils/otpRateLimit': { reserveOtp: () => ({ allowed: true, finish() {} }) },
        '../controllers/fieldOfficerDraftController': {
            getOwnedDraft: async (_req, id) => Number(id) === 6 ? { id: 6, step: draftStep } : null,
            getSavedDraftData: () => draftIdentity,
        },
    };
    const original = Module._load;
    delete require.cache[serviceFile];
    Module._load = function(request, parent, isMain) {
        if (parent?.filename === serviceFile && Object.hasOwn(mocks, request)) return mocks[request];
        return original.apply(this, arguments);
    };
    let service;
    try { service = require(serviceFile); }
    finally { Module._load = original; }
    const req = (body, origin = 'http://localhost:4001') => ({ body, user: { id: 5 }, ip: '127.0.0.1', get: key => key === 'host' ? 'localhost:4001' : key === 'origin' ? origin : undefined });
    const res = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } });
    return { service, otpRows, outgoing, req, res, setDraftIdentity: data => { draftIdentity = data; } };
}

test('OTP uses Admin-selected MAIL provider, saved draft email and 6-digit code', async () => {
    const t = setup(); const result = t.res();
    await t.service.send(t.req({ draftId: 6 }), result);
    assert.equal(result.statusCode, 200);
    assert.equal(t.outgoing[0].email, 'user@example.com');
    assert.match(t.outgoing[0].otp, /^\d{6}$/);
    assert.ok(t.otpRows[0].codeHash !== t.outgoing[0].otp);
});
test('SMS mode follows same admin selected provider', async () => {
    const t = setup({ provider: 'MSG91_SMS' });
    await t.service.send(t.req({ draftId: 6 }), t.res());
    assert.equal(t.outgoing[0].settings.otpProvider, 'MSG91_SMS');
});
test('No OTP can be issued until draft reaches Step 3', async () => {
    const t = setup({ draftStep: 2 }); const result = t.res();
    await t.service.send(t.req({ draftId: 6 }), result);
    assert.equal(result.statusCode, 404); assert.equal(t.outgoing.length, 0);
});
test('Failed delivery never creates a verification challenge', async () => {
    const t = setup({ delivered: false }); const result = t.res();
    await t.service.send(t.req({ draftId: 6 }), result);
    assert.equal(result.statusCode, 503); assert.equal(t.otpRows.length, 0);
});
test('6-digit OTP is checked server-side and correct code verifies', async () => {
    const t = setup(); await t.service.send(t.req({ draftId: 6 }), t.res());
    const wrong = t.res(); await t.service.verify(t.req({ draftId: 6, otp: '000000' }), wrong);
    assert.equal(wrong.statusCode, 400); assert.equal(t.otpRows[0].attempts, 1);
    const correct = t.res(); await t.service.verify(t.req({ draftId: 6, otp: t.outgoing[0].otp }), correct);
    assert.equal(correct.statusCode, 200); assert.ok(t.otpRows[0].verifiedAt);
});
test('OTP is bound to original email and phone', async () => {
    const t = setup(); await t.service.send(t.req({ draftId: 6 }), t.res());
    t.setDraftIdentity({ phone: '9876543210', email: 'changed@example.com' });
    const result = t.res(); await t.service.verify(t.req({ draftId: 6, otp: t.outgoing[0].otp }), result);
    assert.equal(result.statusCode, 409);
});
test('Expired OTP cannot be verified', async () => {
    const t = setup(); await t.service.send(t.req({ draftId: 6 }), t.res());
    t.otpRows[0].expiresAt = new Date(Date.now() - 1);
    const result = t.res(); await t.service.verify(t.req({ draftId: 6, otp: t.outgoing[0].otp }), result);
    assert.equal(result.statusCode, 410);
});
test('Cross-origin browser OTP submission rejected', async () => {
    const t = setup(); const result = t.res();
    await t.service.send(t.req({ draftId: 6 }, 'https://evil.example'), result);
    assert.equal(result.statusCode, 403); assert.equal(t.outgoing.length, 0);
});
test('Hashes match with constant-time crypto verification and reject wrong codes', () => {
    const t = setup(); const hash = t.service.createHash('123456');
    assert.ok(t.service.matchesHash('123456', hash));
    assert.ok(!t.service.matchesHash('123457', hash));
    assert.equal(t.service.matchesHash('123456', 'invalid'), false);
});

test('After five incorrect attempts, even the correct code is rejected until resend', async () => {
    const t = setup(); await t.service.send(t.req({ draftId: 6 }), t.res());
    for (let i=0;i<5;i++) {
        const result = t.res(); await t.service.verify(t.req({ draftId: 6, otp: '000000' }), result);
        assert.equal(result.statusCode, 400);
    }
    const result = t.res(); await t.service.verify(t.req({ draftId: 6, otp: t.outgoing[0].otp }), result);
    assert.equal(result.statusCode, 429);
    assert.equal(t.otpRows[0].verifiedAt, null);
});
