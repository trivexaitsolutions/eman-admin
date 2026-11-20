'use strict';
const { getSettings } = require('./apiIntegrations');
const { sendOtpEmail } = require('../utils/mailer');

function indianPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
    if (/^91[6-9]\d{9}$/.test(digits)) return digits;
    return null;
}
async function msg91Request(url, authKey, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'authkey': authKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(12000),
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = { type: 'error', message: 'Non-JSON provider response' }; }
    if (!response.ok || result.type === 'error' || result.status === 'error' || result.hasError === true ||
        (result.errors && (Array.isArray(result.errors) ? result.errors.length : true))) {
        throw new Error(`MSG91 API rejected request (HTTP ${response.status})`);
    }
    if (result.type !== 'success' && result.status !== 'success') {
        throw new Error('MSG91 did not confirm acceptance of OTP request.');
    }
    return result;
}
async function sendOtpViaConfiguredProvider({ email, phone, otp, settings }) {
    const cfg = settings || await getSettings();
    if (!/^\d{6}$/.test(String(otp))) throw new Error('Invalid OTP format.');
    if (cfg.otpProvider === 'MAIL') {
        return { sent: await sendOtpEmail(email, otp, cfg), channel: 'email' };
    }
    const mobile = indianPhone(phone);
    if (!mobile) return { sent: false, channel: 'mobile', error: 'Valid Indian mobile number required for SMS/WhatsApp OTP.' };
    try {
        if (cfg.otpProvider === 'MSG91_SMS') {
            if (!cfg.smsAuthKey || !cfg.smsTemplateId) return { sent: false, channel: 'sms', error: 'MSG91 SMS credentials not configured.' };
            const url = new URL('https://control.msg91.com/api/v5/otp');
            url.searchParams.set('template_id', cfg.smsTemplateId);
            url.searchParams.set('mobile', mobile);
            url.searchParams.set('otp', otp); // Locally verified 6-digit OTP, consistent with email flow.
            url.searchParams.set('otp_expiry', '10');
            await msg91Request(url.toString(), cfg.smsAuthKey, {});
            return { sent: true, channel: 'sms' };
        }
        if (cfg.otpProvider === 'MSG91_WHATSAPP') {
            const auth = cfg.whatsappReuseSmsKey ? cfg.smsAuthKey : cfg.whatsappAuthKey;
            if (!auth || !cfg.whatsappSenderNumber || !cfg.whatsappTemplateName) {
                return { sent: false, channel: 'whatsapp', error: 'MSG91 WhatsApp credentials/template not configured.' };
            }
            await msg91Request('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk', auth, {
                integrated_number: String(cfg.whatsappSenderNumber).replace(/\D/g, ''),
                content_type: 'template',
                payload: { type: 'template', template: {
                    name: cfg.whatsappTemplateName,
                    language: { code: cfg.whatsappLanguage || 'en', policy: 'deterministic' },
                    to_and_components: [{ to: [mobile], components: { body_1: { type: 'text', value: String(otp) } } }]
                } }
            });
            return { sent: true, channel: 'whatsapp' };
        }
        return { sent: false, channel: 'unknown', error: 'Unsupported OTP provider.' };
    } catch (error) {
        console.error(`[OTP ${cfg.otpProvider}] Delivery rejected:`, error?.message || error);
        return { sent: false, channel: cfg.otpProvider === 'MSG91_SMS' ? 'sms' : 'whatsapp', error: 'OTP provider unavailable. Check API settings and approved templates.' };
    }
}
module.exports = { indianPhone, sendOtpViaConfiguredProvider, msg91Request };
