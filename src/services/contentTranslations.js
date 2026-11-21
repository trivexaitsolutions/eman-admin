'use strict';
const crypto = require('node:crypto');

// This registry is the single allow-list for fields that humans may translate.
// Credentials, phones, coordinates, IDs, pincode, GST etc. are never translated.
const ENTITY_DEFINITIONS = Object.freeze({
  CUSTOMER: {
    label: 'Customers', singular: 'Customer', model: 'customer',
    fields: { name: 'Customer name', businessName: 'Business name', siteAddress: 'Site address' },
    where: { isVerified: true }, title: (r) => r.name || `Customer #${r.id}`,
  },
  WORKER: {
    label: 'Workers', singular: 'Worker', model: 'worker',
    fields: { name: 'Worker name', address: 'Home address', qualification: 'Qualification' },
    title: (r) => r.name || `Worker #${r.id}`,
  },
  FIELD_AGENT: {
    label: 'Field Agents', singular: 'Field Agent', model: 'mitra',
    fields: { name: 'Field Agent name' }, title: (r) => r.name || `Field Agent #${r.id}`,
  },
  NAKA: {
    label: 'Nakas', singular: 'Naka', model: 'naka',
    fields: { name: 'Naka name', landmark: 'Landmark' }, title: (r) => r.name || `Naka #${r.id}`,
  },
  CITY: {
    label: 'Cities', singular: 'City', model: 'city',
    fields: { name: 'City name' }, title: (r) => r.name || `City #${r.id}`,
  },
  STATE: {
    label: 'States / UTs', singular: 'State / UT', model: 'state',
    fields: { name: 'State name' }, title: (r) => r.name || `State #${r.id}`,
  },
  SKILL: {
    label: 'Skills', singular: 'Skill', model: 'skill',
    fields: { name: 'Skill name', description: 'Skill description' }, title: (r) => r.name || `Skill #${r.id}`,
  },
  CUSTOMER_ADDRESS: {
    label: 'Work Addresses', singular: 'Work Address', model: 'customerAddress',
    fields: { title: 'Address title', addressLine: 'Address line', addressDetail: 'Address detail', landmark: 'Landmark' },
    title: (r) => r.title || r.addressLine || `Address #${r.id}`,
  },
});
const CHUNK_SIZE = 150;
const PAGE_SIZE = 20;
const normalizeSource = (v) => String(v ?? '').trim();
const sourceHash = (source) => crypto.createHash('sha256').update(normalizeSource(source), 'utf8').digest('hex');
const validEntity = (value) => Object.prototype.hasOwnProperty.call(ENTITY_DEFINITIONS, value);

function requiredFields(record, def) {
  return Object.keys(def.fields).filter((key) => normalizeSource(record[key]));
}
function statusOf(record, def, languageCode, translations) {
  const required = requiredFields(record, def);
  if (!required.length) return { state: 'EMPTY', completed: 0, total: 0, stale: 0, draft: 0 };
  let completed = 0, stale = 0, draft = 0;
  for (const key of required) {
    const saved = translations.get(`${languageCode}:${key}`);
    if (!saved) continue;
    const current = sourceHash(record[key]);
    if (saved.sourceHash !== current) stale++;
    else if (saved.status === 'PUBLISHED' && normalizeSource(saved.translatedValue)) completed++;
    else if (saved.status === 'DRAFT') draft++;
  }
  return { state: completed === required.length ? 'COMPLETE' : stale ? 'NEEDS_REVIEW' : 'PENDING', completed, total: required.length, stale, draft };
}
function translationMap(rows) {
  return new Map(rows.map((row) => [`${row.languageCode}:${row.fieldKey}`, row]));
}
function selectFields(def) {
  const select = { id: true };
  for (const key of Object.keys(def.fields)) select[key] = true;
  return select;
}

async function getEntity(prisma, entityType, id) {
  if (!validEntity(entityType) || !Number.isInteger(id) || id < 1) return null;
  const def = ENTITY_DEFINITIONS[entityType];
  const record = await prisma[def.model].findUnique({ where: { id }, select: selectFields(def) });
  return record ? { record, def } : null;
}

// Lazy queue: existing data as well as future Admin, Field Agent and app submissions
// appear without modifying any of those registration/save flows.
// Work Address records remain independent translations in storage, but are
// administered ONLY from their parent Customer. They must never appear as
// duplicate queue items or inflate the dashboard totals.
const QUEUE_ENTITY_TYPES = Object.freeze(
  Object.keys(ENTITY_DEFINITIONS).filter((type) => type !== 'CUSTOMER_ADDRESS')
);

function combinedLanguageStatus(parts) {
  const total = parts.reduce((sum, part) => sum + part.total, 0);
  const completed = parts.reduce((sum, part) => sum + part.completed, 0);
  const stale = parts.reduce((sum, part) => sum + part.stale, 0);
  const draft = parts.reduce((sum, part) => sum + part.draft, 0);
  return { total, completed, stale, draft,
    state: total === 0 ? 'EMPTY' : completed === total ? 'COMPLETE' : stale ? 'NEEDS_REVIEW' : 'PENDING' };
}

// For Customer chunks, fetch their child work addresses in bulk, including
// every address's translations. No extra query per Customer is needed.
async function customerAddressStatusById(prisma, records, chosen) {
  const byCustomer = new Map();
  if (!records.length) return byCustomer;
  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: { in: records.map((r) => r.id) } },
    select: { customerId: true, ...selectFields(ENTITY_DEFINITIONS.CUSTOMER_ADDRESS) },
  });
  if (!addresses.length) return byCustomer;
  const translationRows = chosen.length ? await prisma.contentTranslation.findMany({
    where: {
      entityType: 'CUSTOMER_ADDRESS',
      entityId: { in: addresses.map((a) => a.id) },
      languageCode: { in: chosen.map((l) => l.code) },
    },
    select: { entityId: true, languageCode: true, fieldKey: true,
      translatedValue: true, sourceHash: true, status: true },
  }) : [];
  const translationsByAddress = new Map();
  for (const row of translationRows) {
    if (!translationsByAddress.has(row.entityId)) translationsByAddress.set(row.entityId, []);
    translationsByAddress.get(row.entityId).push(row);
  }
  for (const address of addresses) {
    if (!byCustomer.has(address.customerId)) byCustomer.set(address.customerId, []);
    const translations = translationMap(translationsByAddress.get(address.id) || []);
    byCustomer.get(address.customerId).push({
      record: address,
      checks: new Map(chosen.map((l) => [l.code,
        statusOf(address, ENTITY_DEFINITIONS.CUSTOMER_ADDRESS, l.code, translations)])),
    });
  }
  return byCustomer;
}

// Lazy queue: existing data as well as future Admin, Field Agent and app
// submissions appear without modifying registration or address save flows.
async function scanTranslationQueue(prisma, { type = 'ALL', language = 'ALL', status = 'PENDING', page = 1 } = {}) {
  const languages = await prisma.appLanguage.findMany({
    where: { isDefault: false }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
  const chosen = language === 'ALL' ? languages : languages.filter((l) => l.code === language);
  // CUSTOMER_ADDRESS is a valid translation entity for saving old records,
  // but no longer an independently filterable queue category.
  const selectedType = QUEUE_ENTITY_TYPES.includes(type) ? type : 'ALL';
  const selectedStatus = ['ALL', 'COMPLETE', 'PENDING'].includes(status) ? status : 'PENDING';
  const pageNum = Number.isInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
  const start = (pageNum - 1) * PAGE_SIZE;
  const items = [], perType = {};
  let totalRecords = 0, completedRecords = 0, pendingRecords = 0, displayedTotal = 0;
  for (const entityType of QUEUE_ENTITY_TYPES) {
    const def = ENTITY_DEFINITIONS[entityType];
    perType[entityType] = { label: def.label, total: 0, pending: 0 };
    let lastId = 0;
    while (true) {
      const records = await prisma[def.model].findMany({
        where: { ...(def.where || {}), id: { gt: lastId } },
        select: selectFields(def), orderBy: { id: 'asc' }, take: CHUNK_SIZE,
      });
      if (!records.length) break;
      lastId = records[records.length - 1].id;
      const rows = chosen.length ? await prisma.contentTranslation.findMany({
        where: { entityType, entityId: { in: records.map((r) => r.id) },
          languageCode: { in: chosen.map((l) => l.code) } },
        select: { entityId: true, languageCode: true, fieldKey: true,
          translatedValue: true, sourceHash: true, status: true },
      }) : [];
      const byEntity = new Map();
      for (const row of rows) {
        if (!byEntity.has(row.entityId)) byEntity.set(row.entityId, []);
        byEntity.get(row.entityId).push(row);
      }
      const addressesByCustomer = entityType === 'CUSTOMER'
        ? await customerAddressStatusById(prisma, records, chosen) : new Map();
      for (const record of records) {
        const addresses = addressesByCustomer.get(record.id) || [];
        const totalFields = requiredFields(record, def).length + addresses.reduce(
          (sum, address) => sum + requiredFields(address.record, ENTITY_DEFINITIONS.CUSTOMER_ADDRESS).length, 0
        );
        if (!totalFields) continue;
        const local = translationMap(byEntity.get(record.id) || []);
        const checks = chosen.map((l) => ({
          code: l.code, label: l.name, nativeName: l.nativeName, isActive: l.isActive,
          ...combinedLanguageStatus([
            statusOf(record, def, l.code, local),
            ...addresses.map((a) => a.checks.get(l.code)),
          ]),
        }));
        const done = checks.every((c) => c.state === 'COMPLETE' || c.state === 'EMPTY');
        perType[entityType].total++;
        totalRecords++;
        if (done) { perType[entityType].completed = (perType[entityType].completed || 0) + 1; completedRecords++; }
        else { perType[entityType].pending++; pendingRecords++; }
        if (selectedType !== 'ALL' && selectedType !== entityType) continue;
        if (selectedStatus === 'PENDING' && done) continue;
        if (selectedStatus === 'COMPLETE' && !done) continue;
        if (displayedTotal >= start && items.length < PAGE_SIZE) {
          items.push({ id: record.id, type: entityType, label: def.singular,
            title: def.title(record), checks, done, requiredCount: totalFields,
            addressCount: addresses.length });
        }
        displayedTotal++;
      }
      if (records.length < CHUNK_SIZE) break;
    }
  }
  return { items, languages, perType, page: pageNum, pageSize: PAGE_SIZE,
    selectedType, selectedStatus, selectedLanguage: language,
    totalRecords, pendingRecords, completedRecords, displayedTotal,
    pageCount: Math.max(1, Math.ceil(displayedTotal / PAGE_SIZE)),
  };
}

module.exports = { ENTITY_DEFINITIONS, sourceHash, normalizeSource, requiredFields, statusOf,
  translationMap, getEntity, scanTranslationQueue, validEntity, QUEUE_ENTITY_TYPES,
  combinedLanguageStatus, PAGE_SIZE };
