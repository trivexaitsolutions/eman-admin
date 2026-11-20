const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let lastCreateData, lastUpdateData;
const address = { id: 20, customerId: 13, addressLine: 'Old Dombivli Street', cityId: 1, nakaId: 9, nakaName: 'Kopar', latitude: '19.2185', longitude: '73.0797', locationSource: 'MAP_PIN', isDefault: true };
const db = {
  customer: { findUnique: async () => ({ id: 13 }) },
  customerAddress: {
    count: async () => 0,
    findUnique: async () => address,
    updateMany: async () => ({ count: 1 }),
    findMany: async () => [],
    create: async ({ data }) => { lastCreateData = data; return { id: 30, ...data }; },
    update: async ({ data }) => { lastUpdateData = data; return { ...address, ...data }; },
  },
  $transaction: async (cb) => cb(db),
};
Module._load = function(name, parent, isMain) {
  if (name === '@prisma/client') return { PrismaClient: class { constructor() { return db; } } };
  return originalLoad.apply(this, arguments);
};
const controller = require('../src/controllers/customerAddressController');
Module._load = originalLoad;
const call = async (handler, req) => {
  let status = 200, body;
  const res = { status(code) { status = code; return this; }, json(data) { body = data; return this; } };
  await handler(req, res);
  return { status, body };
};

test('GPS customer address saves without any Naka selection', async () => {
  const result = await call(controller.addAddress, { body: {
    customerId: 13, addressLine: 'Plot 18, Sharvari Building',
    city: 'Dombivli', state: 'Maharashtra', pincode: '421202',
    latitude: 19.2185, longitude: 73.0797,
    locationSource: 'MAP_PIN', cityId: null, nakaId: null, nakaName: null,
  } });
  assert.equal(result.status, 200);
  assert.equal(lastCreateData.nakaId, null);
  assert.equal(lastCreateData.nakaName, null);
  assert.equal(lastCreateData.city, 'Dombivli');
  assert.equal(lastCreateData.latitude, '19.218500');
});

test('Editing GPS address clears legacy Naka association without changing schema', async () => {
  const result = await call(controller.updateAddress, { params:{ id: 20 }, body: {
    addressLine: 'Old Dombivli Street', city: 'Dombivli',
    latitude: 19.2185, longitude: 73.0797,
    cityId: null, nakaId: null, nakaName: null,
    locationSource: 'MAP_PIN',
  } });
  assert.equal(result.status, 200);
  assert.equal(lastUpdateData.nakaId, null);
  assert.equal(lastUpdateData.nakaName, null);
  assert.equal(lastUpdateData.cityId, null);
});

test('No location coordinates cannot be submitted as a MAP_PIN address', async () => {
  const result = await call(controller.addAddress, { body: {
    customerId: 13, addressLine:'Good address', locationSource:'MAP_PIN',
  } });
  assert.equal(result.status, 400);
  assert.match(result.body.message, /GPS coordinates/);
});
