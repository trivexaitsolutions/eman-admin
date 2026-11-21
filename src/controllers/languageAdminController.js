'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const csrf = require('../utils/translationAdminCsrf');

const norm = (v, limit = 80) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, limit + 1);
const CODE_RE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const go = (res, key, message) => res.redirect(`/admin/languages?${key}=${encodeURIComponent(message)}`);

async function index(req, res) {
  try {
    const languages = await prisma.appLanguage.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
    return res.render('admin/languages/index', { languages, csrf: csrf.token(req),
      success: req.query.success || null, error: req.query.error || null });
  } catch (error) {
    console.error('[Language Admin] list:', error);
    return res.status(503).send('Unable to load Language Master. Run Prisma migration and generate.');
  }
}

async function create(req, res) {
  if (!csrf.valid(req)) return res.status(403).send('Invalid form token. Reload the Language Master page.');
  const code = String(req.body.code || '').trim();
  const name = norm(req.body.name);
  const nativeName = norm(req.body.nativeName);
  const sortOrder = Number(req.body.sortOrder || 100);
  if (!CODE_RE.test(code)) return go(res, 'error', 'Invalid language code. Use en, hi, mr, gu or pt-BR style code.');
  if (!name || name.length > 80 || !nativeName || nativeName.length > 80) return go(res, 'error', 'Language and native names must be 1–80 characters.');
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return go(res, 'error', 'Sort order must be between 0 and 9999.');
  if (code === 'en') return go(res, 'error', 'English already exists as the fixed default language.');
  try {
    await prisma.appLanguage.create({ data: { code, name, nativeName, sortOrder,
      isActive: req.body.isActive === 'on', isDefault: false } });
    return go(res, 'success', `Language ${name} created. Existing records now appear in its translation queue.`);
  } catch (error) {
    if (error.code === 'P2002') return go(res, 'error', 'This language code already exists.');
    console.error('[Language Admin] create:', error);
    return go(res, 'error', 'Unable to create language.');
  }
}

async function update(req, res) {
  if (!csrf.valid(req)) return res.status(403).send('Invalid form token. Reload the Language Master page.');
  const code = String(req.params.code || '');
  if (!CODE_RE.test(code)) return go(res, 'error', 'Invalid language code.');
  const name = norm(req.body.name), nativeName = norm(req.body.nativeName);
  const sortOrder = Number(req.body.sortOrder || 100);
  if (!name || name.length > 80 || !nativeName || nativeName.length > 80) return go(res, 'error', 'Language and native names must be 1–80 characters.');
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return go(res, 'error', 'Invalid sort order.');
  try {
    const previous = await prisma.appLanguage.findUnique({ where: { code } });
    if (!previous) return go(res, 'error', 'Language not found.');
    await prisma.appLanguage.update({ where: { code }, data: {
      name: code === 'en' ? 'English' : name,
      nativeName: code === 'en' ? 'English' : nativeName,
      sortOrder: code === 'en' ? 1 : sortOrder,
      isDefault: code === 'en',
      isActive: code === 'en' ? true : req.body.isActive === 'on',
    } });
    return go(res, 'success', `${previous.name} updated.`);
  } catch (error) {
    console.error('[Language Admin] update:', error);
    return go(res, 'error', 'Unable to update language.');
  }
}
module.exports = { index, create, update };
