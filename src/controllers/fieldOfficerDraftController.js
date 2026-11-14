const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uppercaseName } = require('../utils/registration');
const { compressConsentVideo } = require('../utils/consentVideo');

const kinds = new Set(['WORKER', 'CUSTOMER']);

function encryptionKey() {
    // Never store a registrant's password/identity information in plaintext.
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
        throw new Error('Set a strong JWT_SECRET before enabling saved drafts.');
    }
    return crypto.createHash('sha256').update(`eman-drafts-v1:${process.env.JWT_SECRET}`).digest();
}

function encrypt(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

function decrypt(encoded) {
    const [iv, tag, encrypted] = String(encoded).split('.');
    if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted draft');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
}

async function getOwnedDraft(req, id, kind) {
    const parsed = Number(id);
    if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
    return prisma.fieldOfficerDraft.findFirst({
        where: { id: parsed, mitraId: req.user.id, ...(kind ? { kind } : {}) },
    });
}

function getSavedDraftData(draft) {
    return draft ? decrypt(draft.payload) : {};
}

const listDrafts = async (req, res) => {
    try {
        const drafts = await prisma.fieldOfficerDraft.findMany({
            where: { mitraId: req.user.id }, orderBy: { updatedAt: 'desc' }, take: 100,
        });
        return res.render('mitra/drafts', { layout: false, drafts });
    } catch (error) {
        console.error('Draft listing error:', error);
        return res.status(500).send('Saved registrations cannot be opened right now.');
    }
};

const saveDraft = async (req, res) => {
    try {
        const kind = String(req.body?.kind || '');
        if (!kinds.has(kind)) return res.status(400).json({ success: false, message: 'Invalid registration type.' });
        const step = Math.max(1, Math.min(kind === 'WORKER' ? 5 : 3, Number(req.body.step) || 1));
        const fields = req.body?.fields;
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
            return res.status(400).json({ success: false, message: 'Missing registration fields.' });
        }
        if (Buffer.byteLength(JSON.stringify(fields)) > 80_000) {
            return res.status(413).json({ success: false, message: 'Registration draft is too large.' });
        }

        // Limit persisted keys to the actual onboarding fields; no OTP or browser-specific state.
        const allowed = kind === 'WORKER'
            ? ['name','phone','email','password','dob','age','qualification','idProofType','idNumber','address','pincode','gender','heightCm','weightKg','bankDetails','upiId','upiNumber','skillIds','nakaIds']
            : ['clientType','contactName','phone','email','businessName','businessType','gstNumber','siteAddress','siteLatitude','siteLongitude','siteLocationSource'];
        const sanitized = {};
        for (const key of allowed) {
            const val = fields[key];
            if (typeof val === 'string' && val.length <= 5000) sanitized[key] = val;
            else if (Array.isArray(val)) sanitized[key] = val.filter(v => typeof v === 'string').slice(0, 100);
        }
        if (sanitized.name) sanitized.name = uppercaseName(sanitized.name);
        if (sanitized.contactName) sanitized.contactName = uppercaseName(sanitized.contactName);
        if (sanitized.businessName) sanitized.businessName = uppercaseName(sanitized.businessName);

        const label = (sanitized.name || sanitized.contactName || sanitized.phone || 'Untitled registration').slice(0, 120);
        const data = { kind, step, label, payload: encrypt(sanitized) };
        const draft = req.body.id ? await getOwnedDraft(req, req.body.id, kind) : null;
        if (req.body.id && !draft) return res.status(404).json({ success: false, message: 'Draft not found.' });
        const saved = draft
            ? await prisma.fieldOfficerDraft.update({ where: { id: draft.id }, data })
            : await prisma.fieldOfficerDraft.create({ data: { ...data, mitraId: req.user.id } });
        return res.json({ success: true, id: saved.id, step: saved.step, updatedAt: saved.updatedAt });
    } catch (error) {
        console.error('Draft save error:', error);
        return res.status(503).json({ success: false, message: error.message || 'Unable to save draft.' });
    }
};

const saveDraftVideo = async (req, res) => {
    try {
        const draft = await getOwnedDraft(req, req.body?.draftId, 'WORKER');
        if (!draft || !req.file) return res.status(400).json({ success: false, message: 'Save worker draft first.' });
        const compressed = await compressConsentVideo(req.file);
        const videoUrl = `/uploads/consents/${compressed.filename}`;
        await prisma.fieldOfficerDraft.update({ where: { id: draft.id }, data: { videoUrl } });
        return res.json({ success: true, videoUrl });
    } catch (error) {
        console.error('Draft video save error:', error);
        return res.status(500).json({ success: false, message: 'Video could not be saved.' });
    }
};

module.exports = { getOwnedDraft, getSavedDraftData, listDrafts, saveDraft, saveDraftVideo };
