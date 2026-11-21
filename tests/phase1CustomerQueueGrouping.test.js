'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/services/contentTranslations');

const languages = [
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', isDefault: false, isActive: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', isDefault: false, isActive: true },
];
const customer = { id: 13, isVerified: true, name: 'Demo Customer 1', businessName: null, siteAddress: null };
const addresses = [
  { id: 9, customerId: 13, title: 'Demo Work Site', addressLine: 'Chakki naka, Dombivli', addressDetail: null, landmark: 'Near station' },
  { id: 10, customerId: 13, title: 'Second Site', addressLine: 'Kalyan West', addressDetail: null, landmark: null },
  // Should NOT affect the status of Customer 13.
  { id: 11, customerId: 99, title: 'Unrelated Site', addressLine: 'Thane', addressDetail: null, landmark: null },
];
const translations = [];
const queries = [];
const store = {
  appLanguage: {
    findMany: async () => languages,
  },
  customer: {
    findMany: async ({where}) => where.id.gt >= 13 ? [] : [customer],
  },
  customerAddress: {
    findMany: async ({where,select}) => {
      queries.push({ model: 'customerAddress', where });
      return addresses.filter(a => where.customerId.in.includes(a.customerId)).map(a =>
        Object.fromEntries(Object.keys(select).map(k => [k, a[k] ?? null])));
    },
  },
  contentTranslation: {
    findMany: async ({where}) => translations.filter(t =>
      t.entityType === where.entityType &&
      where.entityId.in.includes(t.entityId) &&
      where.languageCode.in.includes(t.languageCode)),
  },
};
for (const name of ['worker', 'mitra', 'naka', 'city', 'state', 'skill']) {
  store[name] = { findMany: async () => [] };
}
function publish(entityType, entityId, source, fieldKey, languageCode) {
  translations.push({ entityType, entityId, fieldKey, languageCode,
    sourceHash: S.sourceHash(source[fieldKey]), translatedValue: `${languageCode} text`, status: 'PUBLISHED' });
}

test('Work Addresses disappear from queue categories and are grouped into the owning Customer', async () => {
  const q = await S.scanTranslationQueue(store);
  assert.equal(q.totalRecords, 1, 'address records must not inflate totals');
  assert.equal(q.pendingRecords, 1);
  assert.equal(q.items.length, 1);
  assert.equal(q.items[0].type, 'CUSTOMER');
  assert.equal(q.items[0].addressCount, 2);
  assert.equal(q.items[0].checks[0].total, 6, '1 customer name + 3 fields in address 9 + 2 fields in address 10');
  assert.equal('CUSTOMER_ADDRESS' in q.perType, false);
  assert.deepEqual(Object.keys(q.perType), S.QUEUE_ENTITY_TYPES);
  assert.ok(queries.some(x => x.where.customerId.in.includes(13)));
});

test('Publishing customer name does not complete customer until all linked addresses are translated', async () => {
  for (const lang of ['mr', 'hi']) publish('CUSTOMER', 13, customer, 'name', lang);
  const q = await S.scanTranslationQueue(store, {type:'CUSTOMER'});
  assert.equal(q.totalRecords, 1);
  assert.equal(q.pendingRecords, 1);
  assert.equal(q.items[0].checks[0].completed, 1);
});

test('Once customer and all linked addresses are published, one parent Customer becomes complete', async () => {
  for (const address of addresses.filter(x => x.customerId === 13)) {
    for (const key of S.requiredFields(address, S.ENTITY_DEFINITIONS.CUSTOMER_ADDRESS)) {
      for (const lang of ['mr','hi']) publish('CUSTOMER_ADDRESS', address.id, address, key, lang);
    }
  }
  const q = await S.scanTranslationQueue(store, {status:'COMPLETE'});
  assert.equal(q.totalRecords, 1);
  assert.equal(q.completedRecords, 1);
  assert.equal(q.pendingRecords, 0);
  assert.equal(q.items.length, 1);
  assert.equal(q.items[0].addressCount, 2);
});

test('Editing one saved address flags parent Customer as Needs Review without changing other translations', async () => {
  addresses[0].addressLine = 'Updated Dombivli Address';
  const q = await S.scanTranslationQueue(store);
  assert.equal(q.pendingRecords, 1);
  assert.equal(q.items[0].checks[0].state, 'NEEDS_REVIEW');
  assert.equal(q.items[0].checks[0].stale, 1);
  assert.equal(q.items[0].checks[1].stale, 1);
  assert.equal(q.items[0].addressCount, 2);
});

test('Adding an untranslated work address adds pending work only under its Customer', async () => {
  addresses[0].addressLine = 'Chakki naka, Dombivli';
  addresses.push({ id:12, customerId:13, title:'New site', addressLine:'New Address', addressDetail:null, landmark:null });
  const q = await S.scanTranslationQueue(store, {type:'CUSTOMER_ADDRESS'});
  assert.equal(q.selectedType, 'ALL', 'hidden legacy Work Address queue filter must not be available');
  assert.equal(q.totalRecords, 1);
  assert.equal(q.items[0].addressCount, 3);
  assert.equal(q.items[0].checks[0].state, 'PENDING');
  addresses.pop();
});

test('Naka landmark remains translatable when the Naka Master contains a source landmark', () => {
  const naka = {id:1,name:'Station East',landmark:'Near station gate'};
  const def = S.ENTITY_DEFINITIONS.NAKA;
  assert.deepEqual(S.requiredFields(naka,def),['name','landmark']);
  assert.equal(S.statusOf(naka,def,'mr',new Map()).total,2);
  assert.deepEqual(S.requiredFields({...naka,landmark:null},def),['name']);
});
