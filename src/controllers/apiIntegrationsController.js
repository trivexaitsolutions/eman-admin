'use strict';
const crypto = require('node:crypto');
const { getSettings, saveSettings, uiSettings } = require('../services/apiIntegrations');

async function show(req, res) {
    if (!req.session.apiIntegrationCsrf) req.session.apiIntegrationCsrf = crypto.randomBytes(32).toString('hex');
    try {
        const config = uiSettings(await getSettings());
        return res.render('admin/api-integrations/index', {
            config, csrf: req.session.apiIntegrationCsrf,
            encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.API_SETTINGS_ENCRYPTION_KEY || ''),
            saved: req.query.saved === '1', errorText: null,
        });
    } catch (error) {
        console.error('[API Integrations] Cannot load settings:', error.message);
        return res.status(503).send('API settings load nahi hui. Server encryption key aur Prisma migration verify karein.');
    }
}
async function save(req, res) {
    const received = String(req.body?._csrf || '');
    const expected = String(req.session?.apiIntegrationCsrf || '');
    const a = Buffer.from(received, 'utf8'), b = Buffer.from(expected, 'utf8');
    if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).send('Session expired or invalid form token. Reload API Integrations page.');
    }
    try {
        await saveSettings(req.body || {}, req.user?.id);
        return res.redirect('/admin/api-integrations?saved=1');
    } catch (error) {
        const validationError = !/^(Prisma|P\d{4})/.test(String(error?.name || ''));
        console.error('[API Integrations] Save failed:', validationError ? error.message : error);
        try {
            const config = uiSettings(await getSettings());
            return res.status(400).render('admin/api-integrations/index', {
                config, csrf: expected, encryptionReady: /^[a-f0-9]{64}$/i.test(process.env.API_SETTINGS_ENCRYPTION_KEY || ''),
                saved: false, errorText: validationError ? error.message : 'Settings save nahi ho payi. Database configuration verify karein.',
            });
        } catch (_) { return res.status(503).send('API Settings save nahi ho payi. Migration/encryption key verify karein.'); }
    }
}
module.exports = { show, save };
