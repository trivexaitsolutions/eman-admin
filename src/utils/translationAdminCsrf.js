'use strict';
const crypto = require('node:crypto');
function token(req) {
  if (!req.session) throw new Error('Session is required for Admin translations.');
  if (!req.session.translationAdminCsrf) req.session.translationAdminCsrf = crypto.randomBytes(24).toString('hex');
  return req.session.translationAdminCsrf;
}
function valid(req) {
  const actual = String(req.body?._csrf || '');
  const expected = req.session?.translationAdminCsrf || '';
  if (!actual || !expected) return false;
  const a = Buffer.from(actual, 'utf8'), b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = { token, valid };
