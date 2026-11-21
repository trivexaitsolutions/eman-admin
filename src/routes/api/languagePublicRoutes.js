'use strict';

// Public Android i18n endpoint: ONLY translate non-private masters.
// Customer, Worker and Address translation rows must never be served in bulk.
const express = require('express');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { ENTITY_DEFINITIONS } = require('../../services/contentTranslations');

const PUBLIC_TYPES = Object.freeze(['SKILL', 'NAKA', 'CITY', 'STATE']);
const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const sha = value => crypto.createHash('sha256').update(String(value ?? '').trim(), 'utf8').digest('hex');

function versionFor(translations) {
  // Content-addressed version automatically changes when Admin publishes/edits,
  // removes a translation, or its original master value changes.
  const ordered = Object.keys(translations).sort().map(key => [key, translations[key]]);
  return crypto.createHash('sha256').update(JSON.stringify(ordered), 'utf8').digest('hex');
}

async function activeLanguage(language) {
  return prisma.appLanguage.findFirst({
    where: { code: language, isActive: true }, select: { code: true },
  });
}

async function publishedPublicCatalog(language) {
  if (language === 'en') return {};
  const rows = await prisma.contentTranslation.findMany({
    where: { languageCode: language, status: 'PUBLISHED', entityType: { in: PUBLIC_TYPES } },
    select: { entityType: true, entityId: true, fieldKey: true, sourceHash: true, translatedValue: true },
  });
  const translations = {};
  for (const type of PUBLIC_TYPES) {
    const def = ENTITY_DEFINITIONS[type];
    const typeRows = rows.filter(r => r.entityType === type && def.fields[r.fieldKey] && r.translatedValue?.trim());
    if (!typeRows.length) continue;
    const ids = [...new Set(typeRows.map(row => row.entityId))];
    const select = { id: true };
    for (const field of Object.keys(def.fields)) select[field] = true;
    const originals = await prisma[def.model].findMany({ where: { id: { in: ids } }, select });
    const byId = new Map(originals.map(original => [original.id, original]));
    for (const row of typeRows) {
      const original = byId.get(row.entityId);
      if (!original || !String(original[row.fieldKey] ?? '').trim()) continue;
      if (sha(original[row.fieldKey]) !== row.sourceHash) continue;
      translations[`${type}:${row.entityId}:${row.fieldKey}`] = row.translatedValue;
    }
  }
  return translations;
}

router.get('/languages', async (_req, res) => {
  try {
    const languages = await prisma.appLanguage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, nativeName: true, isDefault: true, isActive: true },
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, languages });
  } catch (error) {
    console.error('[i18n] languages:', error);
    return res.status(503).json({ success: false, message: 'Languages unavailable' });
  }
});

async function serveCatalog(req, res, includeTranslations) {
  const language = String(req.query.language || 'en');
  if (!LANGUAGE_CODE.test(language)) return res.status(400).json({ success: false, message: 'Invalid language' });
  try {
    if (!await activeLanguage(language)) return res.status(404).json({ success: false, message: 'Language not active' });
    const translations = await publishedPublicCatalog(language);
    const version = versionFor(translations);
    res.set('Cache-Control', 'no-store');
    if (includeTranslations) return res.json({ success: true, language, version, translations });
    // Only a short digest goes over the wire for unchanged catalogs.
    return res.json({ success: true, language, version });
  } catch (error) {
    console.error(includeTranslations ? '[i18n] catalog:' : '[i18n] version:', error);
    return res.status(503).json({ success: false, message: 'Translations unavailable' });
  }
}

router.get('/version', (req, res) => serveCatalog(req, res, false));
router.get('/catalog', (req, res) => serveCatalog(req, res, true));

module.exports = router;
