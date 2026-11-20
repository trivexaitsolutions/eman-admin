'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const crypto = require('node:crypto');

const original = Module._load;
let row = null;
let pendingCount = 0;
const db = {
    apiIntegrationSetting: {
        findUnique: async () => row,
        upsert: async ({ create, update }) => { row = { ...(row || create), ...update }; return row; },
    },
    booking: { count: async () => pendingCount }
};
class FakePrismaClient { constructor() { return db; } }
class FakeRazorpay { constructor(options) { this.options = options; } }
Module._load = function (name, ...rest) {
    if (name === '@prisma/client') return { PrismaClient: FakePrismaClient };
    if (name === 'razorpay') return FakeRazorpay;
    return original.call(this, name, ...rest);
};
const service = require('../src/services/apiIntegrations');
Module._load = original;
process.env.API_SETTINGS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

test('AES-GCM encrypt/decrypt stores no plaintext keys', () => {
    const sample = { otpProvider: 'MAIL', mailAppPassword: 'SUPER-SECRET-OTP-KEY' };
    const encrypted = service.encryptSettings(sample);
    assert.ok(!encrypted.includes('SUPER-SECRET-OTP-KEY'));
    assert.deepEqual(service.decryptSettings(encrypted), sample);
    assert.throws(() => service.decryptSettings(encrypted.slice(0, -1) + '!'));
});
test('Saving secrets masks them and retains blank replacement', async () => {
    row = null;
    const values = { otpProvider: 'MSG91_SMS', smsAuthKey: 'API-KEY-123', smsTemplateId: 'TEMPLATE-123', whatsappReuseSmsKey: 'on' };
    const saved = await service.saveSettings(values, 1);
    assert.equal(saved.otpProvider, 'MSG91_SMS');
    assert.equal(saved.smsAuthKeyConfigured, true);
    assert.equal(Object.prototype.hasOwnProperty.call(saved,'smsAuthKey'), false);
    const ciphertext = row.encryptedPayload;
    assert.ok(!ciphertext.includes('API-KEY-123'));
    await service.saveSettings({ otpProvider:'MSG91_SMS', smsAuthKey:'', smsTemplateId:'TEMPLATE-123', whatsappReuseSmsKey:'on' }, 1);
    assert.equal((await service.getSettings()).smsAuthKey, 'API-KEY-123');
});
test('Admin cannot activate missing WhatsApp credentials', async () => {
    await assert.rejects(service.saveSettings({ otpProvider:'MSG91_WHATSAPP', whatsappSenderNumber:'919999999999', whatsappTemplateName:'', whatsappReuseSmsKey:'on' }, 1), /template/);
});
test('Pending payments prevent changing active Razorpay merchant keys', async () => {
    row=null; pendingCount=0;
    await service.saveSettings({otpProvider:'MSG91_SMS',smsAuthKey:'KEY1',smsTemplateId:'TEMP1',razorpayKeyId:'rzp_test_first',razorpayKeySecret:'SECRET1',whatsappReuseSmsKey:'on'},1);
    pendingCount=2;
    await assert.rejects(service.saveSettings({otpProvider:'MSG91_SMS',smsAuthKey:'',smsTemplateId:'TEMP1',razorpayKeyId:'rzp_test_second',razorpayKeySecret:'SECRET2',whatsappReuseSmsKey:'on'},1), /2 pending bookings/);
    assert.equal((await service.getSettings()).razorpayKeyId, 'rzp_test_first');
    pendingCount=0;
    await service.saveSettings({otpProvider:'MSG91_SMS',smsAuthKey:'',smsTemplateId:'TEMP1',razorpayKeyId:'rzp_test_second',razorpayKeySecret:'SECRET2',whatsappReuseSmsKey:'on'},1);
    const gateway = await service.getRazorpayGateway();
    assert.equal(gateway.options.key_id, 'rzp_test_second');
});
