'use strict';
// OTP challenge storage for Field Agent-created clients. The mobile app and this
// portal both use the same Admin-selected delivery provider.
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getSettings } = require('./apiIntegrations');
const { sendOtpViaConfiguredProvider } = require('./otpDelivery');
const { reserveOtp } = require('../utils/otpRateLimit');
const drafts = require('../controllers/fieldOfficerDraftController');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const cleanPhone = value => String(value || '').replace(/\D/g, '');
const cleanEmail = value => String(value || '').trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function createHash(code) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(code), salt, 32).toString('hex');
    return `${salt}.${hash}`;
}
function matchesHash(code, stored) {
    const [salt, hash] = String(stored || '').split('.');
    if (!/^[a-f\d]{32}$/i.test(salt || '') || !/^[a-f\d]{64}$/i.test(hash || '')) return false;
    const actual = crypto.scryptSync(String(code), salt, 32);
    return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
function sameOrigin(req) {
    const origin = req.get?.('origin');
    if (!origin) return true; // non-browser clients are protected by the Field Agent auth cookie
    try { return new URL(origin).host === req.get('host'); } catch { return false; }
}
function getDraftIdentity(draft) {
    const data = drafts.getSavedDraftData(draft);
    return { phone: cleanPhone(data.phone), email: cleanEmail(data.email) };
}
function errorResponse(res, status, message) { return res.status(status).json({ success: false, message }); }
function validDraftId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function send(req, res) {
    if (!sameOrigin(req)) return errorResponse(res, 403, 'Invalid request origin.');
    const draftId = validDraftId(req.body?.draftId);
    if (!draftId) return errorResponse(res, 400, 'Save client draft before requesting OTP.');
    try {
        const draft = await drafts.getOwnedDraft(req, draftId, 'CUSTOMER');
        if (!draft || draft.step < 3) return errorResponse(res, 404, 'Save & Next karke Step 3 par aaiye.');
        const { phone, email } = getDraftIdentity(draft);
        if (!/^[6-9]\d{9}$/.test(phone)) return errorResponse(res, 400, 'Valid 10-digit client mobile number required.');
        const cfg = await getSettings();
        if (cfg.otpProvider === 'MAIL' && !validEmail(email)) {
            return errorResponse(res, 400, 'MAIL OTP selected hai. Step 1 mein valid client email address daalein.');
        }
        if (email && !validEmail(email)) return errorResponse(res, 400, 'Client email address invalid hai.');
        const existing = await prisma.customer.findFirst({ where: { OR: [ { phone }, ...(email ? [{ email }] : []) ] }, select: { id: true } });
        if (existing) return errorResponse(res, 409, 'Ye phone ya email existing Client se linked hai. Naya account banane ke badle existing Client check karein.');
        const limit = reserveOtp(`field-agent:${req.user.id}:${phone}`, req.ip);
        if (!limit.allowed) return errorResponse(res, 429, limit.message);
        const code = String(crypto.randomInt(100000, 1000000));
        let delivery;
        try { delivery = await sendOtpViaConfiguredProvider({ phone, email, otp: code, settings: cfg }); }
        catch (e) { limit.finish(false); throw e; }
        if (!delivery?.sent) {
            limit.finish(false);
            return errorResponse(res, 503, delivery?.error || 'OTP delivery failed. Admin API Integrations settings check karein.');
        }
        // A successfully dispatched OTP must be verifiable. Do not retain old
        // challenges after a fresh request, including old verified proofs.
        try {
            await prisma.$transaction(async tx => {
                await tx.fieldAgentClientOtp.deleteMany({ where: { mitraId: req.user.id, draftId } });
                await tx.fieldAgentClientOtp.create({ data: {
                    mitraId: req.user.id, draftId, phone, email: email || null,
                    channel: delivery.channel, codeHash: createHash(code),
                    expiresAt: new Date(Date.now() + OTP_TTL_MS),
                } });
            });
        } catch (e) { limit.finish(false); throw e; }
        limit.finish(true);
        return res.json({ success: true, message: `6-digit OTP client ke ${delivery.channel} par bheja gaya. 10 minutes valid.`, channel: delivery.channel });
    } catch (error) {
        console.error('[Field Agent Client OTP] Send failed:', error?.message || error);
        return errorResponse(res, 503, 'OTP issue nahi ho paya. Migration/OTP settings check karein.');
    }
}

async function verify(req, res) {
    if (!sameOrigin(req)) return errorResponse(res, 403, 'Invalid request origin.');
    const draftId = validDraftId(req.body?.draftId);
    const otp = String(req.body?.otp || '').trim();
    if (!draftId || !/^\d{6}$/.test(otp)) return errorResponse(res, 400, '6-digit OTP daalein.');
    try {
        const draft = await drafts.getOwnedDraft(req, draftId, 'CUSTOMER');
        if (!draft) return errorResponse(res, 404, 'Client draft not found.');
        const { phone, email } = getDraftIdentity(draft);
        const challenge = await prisma.fieldAgentClientOtp.findFirst({
            where: { mitraId: req.user.id, draftId, consumedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        if (!challenge) return errorResponse(res, 400, 'Pehle Send OTP karein.');
        if (challenge.phone !== phone || cleanEmail(challenge.email) !== email) {
            return errorResponse(res, 409, 'Phone/Email badal gaya hai. Naya OTP bhejein.');
        }
        if (challenge.expiresAt <= new Date()) return errorResponse(res, 410, 'OTP expire ho chuka hai. Dobara bhejein.');
        if (challenge.attempts >= MAX_ATTEMPTS) return errorResponse(res, 429, 'Too many wrong OTPs. Dobara OTP request karein.');
        if (!matchesHash(otp, challenge.codeHash)) {
            await prisma.fieldAgentClientOtp.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
            return errorResponse(res, 400, 'Galat OTP. Dobara check karein.');
        }
        if (!challenge.verifiedAt) await prisma.fieldAgentClientOtp.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } });
        return res.json({ success: true, message: 'OTP successfully verified. Ab Save Client kar sakte hain.' });
    } catch (error) {
        console.error('[Field Agent Client OTP] Verify failed:', error?.message || error);
        return errorResponse(res, 503, 'OTP verify nahi ho paya. Database settings check karein.');
    }
}

async function getVerifiedChallenge(tx, { mitraId, draftId, phone, email }) {
    const draftNum = validDraftId(draftId);
    if (!draftNum) return null;
    return tx.fieldAgentClientOtp.findFirst({
        where: { mitraId, draftId: draftNum, phone, email: email || null,
            verifiedAt: { not: null }, consumedAt: null,
            expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: 'desc' },
    });
}

module.exports = { send, verify, getVerifiedChallenge, getDraftIdentity, cleanPhone, cleanEmail,
    createHash, matchesHash, OTP_TTL_MS, MAX_ATTEMPTS };
