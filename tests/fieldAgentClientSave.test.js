'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const controllerFile = path.resolve(__dirname, '../src/controllers/mitraPortalController.js');

function makeController({ verified = false, duplicate = false } = {}) {
  let creates = 0, claims = 0;
  const db = {
    customer: {
      findFirst: async () => duplicate ? { id: 99 } : null,
      create: async () => { creates++; return { id: 55 }; },
    },
    customerAddress: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: async () => ({ id: 100 }),
    },
    fieldAgentClientOtp: { updateMany: async () => { claims++; return { count: 1 }; } },
    fieldOfficerDraft: { delete: async () => ({ id: 6 }) },
    async $transaction(task) { return task(db); },
  };
  const mocks = {
    '@prisma/client': { PrismaClient: class { constructor() { return db; } } },
    bcryptjs: {}, jsonwebtoken: {},
    '../services/leaveService': { processCurrentMitraLeaveReassignments: async () => {} },
    '../utils/registration': { uppercaseName: value => String(value || '').trim().toUpperCase() },
    './fieldOfficerDraftController': {
      getOwnedDraft: async () => ({ id: 6 }),
      getSavedDraftData: () => ({ phone: '9876543210', email: 'client@example.com' }),
    },
    '../services/fieldAgentClientOtp': {
      getDraftIdentity: () => ({ phone: '9876543210', email: 'client@example.com' }),
      getVerifiedChallenge: async () => verified ? { id: 101 } : null,
    },
  };
  const original = Module._load;
  delete require.cache[controllerFile];
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === controllerFile && Object.hasOwn(mocks, request)) return mocks[request];
    return original.apply(this, arguments);
  };
  let controller;
  try { controller = require(controllerFile); }
  finally { Module._load = original; }
  const req = { user: { id: 5 }, body: {
    draftId: '6', clientType: 'Individual', contactName: 'Client Test', phone: '9876543210',
    email: 'client@example.com', siteAddress: 'Shop 45, Main Industrial Road, Mumbai',
    siteLatitude: '19.2183', siteLongitude: '73.0867', siteLocationSource: 'CURRENT_LOCATION',
  } };
  const res = { redirect(url) { this.redirected = url; return this; } };
  return { controller, req, res, get creates() { return creates; }, get claims() { return claims; } };
}

test('POST Add Client refuses to create without verified server-side OTP', async () => {
  const t = makeController({ verified: false });
  await t.controller.postAddClient(t.req, t.res);
  assert.equal(t.creates, 0);
  assert.equal(t.claims, 0);
  assert.match(t.res.redirected, /draft=6&error=/);
  assert.match(decodeURIComponent(t.res.redirected), /OTP not verified/);
});
test('POST Add Client saves only after claiming verification atomically', async () => {
  const t = makeController({ verified: true });
  await t.controller.postAddClient(t.req, t.res);
  assert.equal(t.creates, 1);
  assert.equal(t.claims, 1);
  assert.match(t.res.redirected, /dashboard\?success=/);
});
test('POST Add Client never overwrites existing phone/email accounts', async () => {
  const t = makeController({ verified: true, duplicate: true });
  await t.controller.postAddClient(t.req, t.res);
  assert.equal(t.creates, 0);
  assert.match(decodeURIComponent(t.res.redirected), /existing Client/);
});
