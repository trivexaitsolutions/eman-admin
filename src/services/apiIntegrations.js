'use strict';
// Encrypted singleton for Admin -> API Integrations. Keys are never returned to clients.
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const Razorpay = require('razorpay');
const prisma = new PrismaClient();

const SECRET_FIELDS = new Set(['smsAuthKey', 'whatsappAuthKey', 'mailAppPassword', 'razorpayKeySecret', 'razorpayxKeySecret']);
const EDITABLE_FIELDS = [
    'otpProvider', 'smsAuthKey', 'smsTemplateId', 'whatsappReuseSmsKey', 'whatsappAuthKey',
    'whatsappSenderNumber', 'whatsappTemplateName', 'whatsappLanguage', 'mailUser', 'mailAppPassword',
    'razorpayKeyId', 'razorpayKeySecret', 'razorpayxKeyId', 'razorpayxKeySecret', 'razorpayxSourceAccountNumber'
];
const INITIAL = () => ({
    otpProvider: 'MAIL',
    smsAuthKey: process.env.MSG91_SMS_AUTH_KEY || '',
    smsTemplateId: process.env.MSG91_SMS_TEMPLATE_ID || '',
    whatsappReuseSmsKey: true,
    whatsappAuthKey: process.env.MSG91_WHATSAPP_AUTH_KEY || '',
    whatsappSenderNumber: process.env.MSG91_WHATSAPP_SENDER || '',
    whatsappTemplateName: process.env.MSG91_WHATSAPP_TEMPLATE || '',
    whatsappLanguage: process.env.MSG91_WHATSAPP_LANGUAGE || 'en',
    mailUser: process.env.MAIL_USER || '',
    mailAppPassword: process.env.MAIL_APP_PASSWORD || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    razorpayxKeyId: process.env.RAZORPAYX_KEY_ID || '',
    razorpayxKeySecret: process.env.RAZORPAYX_KEY_SECRET || '',
    razorpayxSourceAccountNumber: process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER || ''
});
function encryptionKey() {
    const hex = String(process.env.API_SETTINGS_ENCRYPTION_KEY || '').trim();
    if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Set API_SETTINGS_ENCRYPTION_KEY to a persistent random 64-character hex key in .env');
    return Buffer.from(hex, 'hex');
}
function encryptSettings(settings) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(settings), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
function decryptSettings(value) {
    const parts = String(value).split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Invalid encrypted API integration settings');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[1], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8'));
}
async function getSettings() {
    const row = await prisma.apiIntegrationSetting.findUnique({ where: { id: 1 } });
    return { ...INITIAL(), ...(row ? decryptSettings(row.encryptedPayload) : {}) };
}
function uiSettings(settings) {
    const output = { ...settings };
    for (const field of SECRET_FIELDS) {
        output[`${field}Configured`] = Boolean(output[field]);
        delete output[field];
    }
    return output;
}
function required(value, message) { if (!String(value || '').trim()) throw new Error(message); }
function validateSettings(cfg) {
    if (!['MAIL','MSG91_SMS','MSG91_WHATSAPP'].includes(cfg.otpProvider)) throw new Error('Invalid OTP provider.');
    if (cfg.otpProvider === 'MAIL') {
        required(cfg.mailUser, 'MAIL OTP ke liye email address zaroori hai.');
        required(cfg.mailAppPassword, 'MAIL OTP ke liye app password zaroori hai.');
    }
    if (cfg.otpProvider === 'MSG91_SMS') {
        required(cfg.smsAuthKey, 'MSG91 SMS Auth Key required.');
        required(cfg.smsTemplateId, 'MSG91 SMS OTP Template ID required.');
    }
    if (cfg.otpProvider === 'MSG91_WHATSAPP') {
        required(cfg.whatsappReuseSmsKey ? cfg.smsAuthKey : cfg.whatsappAuthKey, 'MSG91 WhatsApp Auth Key required.');
        required(cfg.whatsappSenderNumber, 'WhatsApp integrated sender number required.');
        required(cfg.whatsappTemplateName, 'Approved WhatsApp template name required.');
        required(cfg.whatsappLanguage, 'WhatsApp template language required.');
    }
    if (Boolean(cfg.razorpayKeyId) !== Boolean(cfg.razorpayKeySecret)) throw new Error('Razorpay Key ID aur Key Secret dono required hain.');
    if (Boolean(cfg.razorpayxKeyId) !== Boolean(cfg.razorpayxKeySecret)) throw new Error('RazorpayX Key ID aur Secret dono required hain.');
    if (cfg.razorpayxKeyId && !cfg.razorpayxSourceAccountNumber) throw new Error('RazorpayX Source Account Number required.');
}
async function saveSettings(body, updaterId) {
    const current = await getSettings();
    const next = { ...current };
    for (const name of EDITABLE_FIELDS) {
        if (name === 'whatsappReuseSmsKey') { next[name] = body[name] === 'on'; continue; }
        if (!Object.prototype.hasOwnProperty.call(body, name)) continue;
        const value = String(body[name] ?? '').trim();
        // Empty masked password input means keep saved secret, not erase it.
        if (SECRET_FIELDS.has(name)) {
            if (body[`clear_${name}`] === 'on') next[name] = '';
            else if (value) next[name] = value;
        } else next[name] = value;
    }
    validateSettings(next);
    // Protect in-flight transactions from becoming orphaned after changing merchant keys.
    const razorpayChanged = current.razorpayKeyId !== next.razorpayKeyId || current.razorpayKeySecret !== next.razorpayKeySecret;
    if (razorpayChanged) {
        const pending = await prisma.booking.count({ where: { status: 'PENDING' } });
        if (pending) throw new Error(`${pending} pending bookings hain. Unke payment reconcile/cancel karne ke baad Razorpay keys change karein.`);
    }
    // Compute encryption first; a missing key must never cause plaintext persistence.
    const encryptedPayload = encryptSettings(next);
    await prisma.apiIntegrationSetting.upsert({
        where: { id: 1 },
        create: { id: 1, encryptedPayload, updatedById: Number(updaterId) || null },
        update: { encryptedPayload, updatedById: Number(updaterId) || null }
    });
    return uiSettings(next);
}
async function getRazorpayGateway() {
    const { razorpayKeyId, razorpayKeySecret } = await getSettings();
    return razorpayKeyId && razorpayKeySecret
        ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret }) : null;
}
async function getRazorpayCredentials() {
    const { razorpayKeyId, razorpayKeySecret } = await getSettings();
    return { keyId: razorpayKeyId, keySecret: razorpayKeySecret };
}
module.exports = { getSettings, saveSettings, uiSettings, getRazorpayGateway, getRazorpayCredentials,
    encryptSettings, decryptSettings, validateSettings, SECRET_FIELDS };
