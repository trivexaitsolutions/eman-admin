'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const csrf = require('../utils/translationAdminCsrf');
const bulk = require('../services/translationBulk');
const bulkFiles = require('../services/translationBulkFiles');
const { ENTITY_DEFINITIONS, sourceHash, normalizeSource, requiredFields,
  getEntity, scanTranslationQueue, statusOf, translationMap, validEntity, QUEUE_ENTITY_TYPES } = require('../services/contentTranslations');

const go = (res, url, key, message) => res.redirect(`${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message)}`);
function validId(value) {
  const text = String(value);
  const n = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function index(req, res) {
  try {
    const results = await scanTranslationQueue(prisma, {
      type: String(req.query.type || 'ALL'),
      language: String(req.query.language || 'ALL'),
      status: String(req.query.status || 'PENDING'),
      page: Number(req.query.page || 1),
    });
    return res.render('admin/translations/index', {
      ...results, entities: Object.fromEntries(QUEUE_ENTITY_TYPES.map((type) => [type, ENTITY_DEFINITIONS[type]])),
      success: req.query.success || null, error: req.query.error || null, csrf: csrf.token(req),
    });
  } catch (error) {
    console.error('[Translation Admin] queue:', error);
    return res.status(503).send('Cannot load Translation Queue. Check Prisma migration and database connectivity.');
  }
}

async function editor(req, res) {
  const entityType = String(req.params.type || '').toUpperCase();
  const id = validId(req.params.id);
  if (!validEntity(entityType) || !id) return res.status(404).send('Unknown translation record.');
  try {
    const [entity, languages, translations] = await Promise.all([
      getEntity(prisma, entityType, id),
      prisma.appLanguage.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      prisma.contentTranslation.findMany({ where: { entityType, entityId: id } }),
    ]);
    if (!entity) return res.status(404).send('Original record was not found.');
    const { record, def } = entity;
    const local = translationMap(translations);
    const required = requiredFields(record, def);

    // Customer profile address (siteAddress) and saved work addresses are different
    // tables in E-MAN. Show BOTH in the customer editor without copying source data
    // or adding extra columns to the customer table.
    const addressDef = ENTITY_DEFINITIONS.CUSTOMER_ADDRESS;
    const addressSources = entityType === 'CUSTOMER'
      ? await prisma.customerAddress.findMany({
          where: { customerId: id },
          select: {
            id: true, isDefault: true, city: true, pincode: true, nakaName: true,
            ...Object.fromEntries(Object.keys(addressDef.fields).map((key) => [key, true])),
          },
          orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        })
      : [];
    const addressRows = addressSources.length
      ? await prisma.contentTranslation.findMany({
          where: { entityType: 'CUSTOMER_ADDRESS', entityId: { in: addressSources.map((a) => a.id) } },
        })
      : [];
    const addressTranslations = new Map();
    for (const row of addressRows) {
      if (!addressTranslations.has(row.entityId)) addressTranslations.set(row.entityId, []);
      addressTranslations.get(row.entityId).push(row);
    }
    // A Naka can exist with no landmark yet. Keep the Landmark visible in the
    // editor so admins know it is not forgotten, but do not allow a translation
    // for a blank source field. Add the original landmark in Naka Master first.
    const makeFields = (source, definition, languageCode, map) =>
      (entityType === 'NAKA' && definition === def
        ? Object.keys(definition.fields)
        : requiredFields(source, definition)).map((key) => {
      const original = normalizeSource(source[key]);
      const saved = map.get(`${languageCode}:${key}`);
      return { key, label: definition.fields[key], original, sourceEmpty: !original, hash: sourceHash(original),
        value: saved?.translatedValue || '', savedStatus: saved?.status || null,
        stale: Boolean(saved && saved.sourceHash !== sourceHash(original)) };
    });
    const targets = languages.filter((l) => !l.isDefault).map((l) => {
      const customerCheck = statusOf(record, def, l.code, local);
      const addresses = addressSources.map((address) => {
        const map = translationMap(addressTranslations.get(address.id) || []);
        return { record: address, check: statusOf(address, addressDef, l.code, map),
          fields: makeFields(address, addressDef, l.code, map) };
      });
      const all = [customerCheck, ...addresses.map((a) => a.check)];
      const completed = all.reduce((n, check) => n + check.completed, 0);
      const total = all.reduce((n, check) => n + check.total, 0);
      const stale = all.reduce((n, check) => n + check.stale, 0);
      return { ...l, customerCheck, addresses, fields: makeFields(record, def, l.code, local),
        check: { completed, total, stale,
          state: total === completed ? 'COMPLETE' : stale ? 'NEEDS_REVIEW' : 'PENDING' } };
    });
    return res.render('admin/translations/editor', {
      entityType, id, record, def, required, targets, languages, addressSources,
      csrf: csrf.token(req), success: req.query.success || null, error: req.query.error || null,
    });
  } catch (error) {
    console.error('[Translation Admin] editor:', error);
    return res.status(503).send('Translation editor could not be loaded.');
  }
}

async function save(req, res) {
  if (!csrf.valid(req)) return res.status(403).send('Invalid form token. Reload translation editor.');
  const entityType = String(req.params.type || '').toUpperCase();
  const id = validId(req.params.id);
  if (!validEntity(entityType) || !id) return res.status(404).send('Unknown translation record.');
  const languageCode = String(req.body.languageCode || '');
  const originalUrl = `/admin/translations/${entityType}/${id}`;
  let url = `${originalUrl}?tab=${encodeURIComponent(languageCode)}`;
  // When saving an address from its owner's Customer screen, return to that
  // screen only after validating the child really belongs to that Customer.
  if (entityType === 'CUSTOMER_ADDRESS' && validId(req.body.returnCustomerId)) {
    try {
      const parent = await prisma.customerAddress.findUnique({
        where: { id }, select: { customerId: true },
      });
      if (parent?.customerId === validId(req.body.returnCustomerId)) {
        url = `/admin/translations/CUSTOMER/${parent.customerId}?tab=${encodeURIComponent(languageCode)}`;
      }
    } catch (error) {
      console.error('[Translation Admin] address parent lookup:', error);
    }
  }
  const action = String(req.body.action || 'draft');
  if (!['draft', 'publish'].includes(action)) return go(res, url, 'error', 'Invalid translation action.');
  try {
    const [language, entity] = await Promise.all([
      prisma.appLanguage.findUnique({ where: { code: languageCode } }),
      getEntity(prisma, entityType, id),
    ]);
    if (!language || language.isDefault) return go(res, url, 'error', 'Select a valid non-default language.');
    if (!entity) return go(res, '/admin/translations', 'error', 'Original record was deleted.');
    const { record, def } = entity;
    const required = requiredFields(record, def);
    const input = req.body.translations && typeof req.body.translations === 'object' ? req.body.translations : {};
    const hashes = req.body.sourceHashes && typeof req.body.sourceHashes === 'object' ? req.body.sourceHashes : {};
    const values = [];
    for (const key of required) {
      const currentHash = sourceHash(record[key]);
      if (hashes[key] !== currentHash) return go(res, url, 'error', 'Source data changed while editing. Reload and review latest English text.');
      const value = String(input[key] ?? '').trim();
      if (value.length > 2000) return go(res, url, 'error', `${def.fields[key]} is longer than 2000 characters.`);
      if (action === 'publish' && !value) return go(res, url, 'error', `Fill ${def.fields[key]} before publishing ${language.name}.`);
      values.push({ key, value, currentHash });
    }
    // No writes to original tables. Atomic save means a partially published language
    // cannot appear on the frontend during future Phase 2 reads.
    await prisma.$transaction(async (tx) => {
      for (const row of values) {
        const where = { entity_field_language: { entityType, entityId: id, fieldKey: row.key, languageCode } };
        if (!row.value) {
          await tx.contentTranslation.deleteMany({ where: { entityType, entityId: id, fieldKey: row.key, languageCode } });
          continue;
        }
        const data = { translatedValue: row.value, sourceHash: row.currentHash,
          status: action === 'publish' ? 'PUBLISHED' : 'DRAFT', updatedById: req.user?.id || null };
        await tx.contentTranslation.upsert({ where, create: {
          entityType, entityId: id, fieldKey: row.key, languageCode, ...data,
        }, update: data });
      }
    });
    return go(res, url, 'success', action === 'publish' ? `${language.name} translation published.` : `${language.name} draft saved.`);
  } catch (error) {
    console.error('[Translation Admin] save:', error);
    return go(res, url, 'error', 'Unable to save translation. Original data was not changed.');
  }
}

// Phase 4: both exports use the *entire* filtered translation queue, not only the current page.
async function exportTranslations(req,res) {
  try {
    const fmt=String(req.query.format||'xlsx').toLowerCase();
    if(!['xlsx','csv'].includes(fmt)) return res.status(400).send('Choose Excel or CSV.');
    const out=await bulk.exportGrid(prisma,{
      type:String(req.query.type||'ALL'),language:String(req.query.language||'ALL'),status:String(req.query.status||'PENDING'),
    });
    const buffer=fmt==='csv' ? bulkFiles.toCSV(out.grid):bulkFiles.toXLSX(out.grid);
    const date=new Date().toISOString().slice(0,10);
    const name=`EMAN-Translations-${date}.${fmt}`;
    res.set('Cache-Control','no-store');
    res.set('X-Content-Type-Options','nosniff');
    res.set('Content-Type',fmt==='csv'?'text/csv; charset=utf-8':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition',`attachment; filename="${name}"`);
    return res.send(buffer);
  }catch(err){console.error('[Translation Bulk Export]',err);
    return res.redirect(`/admin/translations?error=${encodeURIComponent(err.message||'Unable to export translations.')}`);
  }
}
async function importTranslations(req,res) {
  if(!csrf.valid(req)) return res.status(403).send('Invalid form token. Reload Translation Management.');
  try {
    if(!req.file || !req.file.buffer) throw new Error('Select a .xlsx or .csv file.');
    const filename=String(req.file.originalname||'').toLowerCase();
    let grid;
    if(filename.endsWith('.csv'))grid=bulkFiles.fromCSV(req.file.buffer);
    else if(filename.endsWith('.xlsx'))grid=bulkFiles.fromXLSX(req.file.buffer);
    else throw new Error('Unsupported format. Use Excel .xlsx or UTF-8 .csv.');
    const report=await bulk.importGrid(prisma,grid,{
      mode:req.body.action==='publish'?'publish':'draft',
      overwrite:req.body.overwriteExisting==='yes',adminId:req.user?.id||null,
    });
    res.set('Cache-Control','no-store');
    return res.render('admin/translations/import-result',{report,error:null});
  }catch(err){
    console.error('[Translation Bulk Import]',err);
    res.set('Cache-Control','no-store');
    return res.status(400).render('admin/translations/import-result',{report:null,error:err.message||'Unable to import translations.'});
  }
}

module.exports = { index, editor, save, exportTranslations, importTranslations };
