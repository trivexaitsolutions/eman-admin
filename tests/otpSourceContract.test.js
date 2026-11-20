'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path => fs.readFileSync(require('node:path').join(root, path), 'utf8');
test('Customer App OTP uses central Admin-selected provider', () => {
  const code = file('src/controllers/userController.js');
  assert.match(code, /sendOtpViaConfiguredProvider/);
  assert.match(code, /const otpSettings = await getSettings\(\)/);
});
test('Field Agent uses central Admin-selected provider and server-side OTP proof', () => {
  const delivery = file('src/services/fieldAgentClientOtp.js');
  const create = file('src/controllers/mitraPortalController.js');
  const ui = file('views/mitra/add-client.ejs');
  assert.match(delivery, /sendOtpViaConfiguredProvider/);
  assert.match(create, /clientOtp\.getVerifiedChallenge\(tx/);
  assert.match(create, /tx\.fieldAgentClientOtp\.updateMany/);
  assert.doesNotMatch(ui, /otpInput\.value === "1234"|Testing ke liye OTP 1234/);
  assert.match(ui, /clients\/otp\/send/);
  assert.match(ui, /clients\/otp\/verify/);
});
