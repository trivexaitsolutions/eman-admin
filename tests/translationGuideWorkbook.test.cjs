'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const files = require('../src/services/translationBulkFiles');
function getZipEntry(bytes, wanted) {
  let pos = 0;
  while (pos + 30 <= bytes.length && bytes.readUInt32LE(pos) === 0x04034b50) {
    const len = bytes.readUInt32LE(pos + 18);
    const nLen = bytes.readUInt16LE(pos + 26);
    const eLen = bytes.readUInt16LE(pos + 28);
    const name = bytes.toString('utf8', pos + 30, pos + 30 + nLen);
    const start = pos + 30 + nLen + eLen;
    if (name === wanted) return zlib.inflateRawSync(bytes.subarray(start, start + len)).toString('utf8');
    pos = start + len;
  }
  return null;
}
test('export includes an AI instruction sheet and leaves data sheet / import template intact', () => {
  const grid = [[...files.FIXED_HEADERS, 'Marathi [mr]', 'Hindi [hi]'], ['SKILL','1','','Plumbing','name','Plumbing','source-fingerprint','signed-token','','']];
  const out = files.toXLSX(grid);
  assert.deepEqual(files.fromXLSX(out), grid);
  const workbook = getZipEntry(out, 'xl/workbook.xml');
  const guide = getZipEntry(out, 'xl/worksheets/sheet2.xml');
  assert.ok(workbook?.includes('sheet name="Translations"'));
  assert.ok(workbook?.includes('sheet name="How to Translate"'));
  assert.ok(workbook?.includes('activeTab="1"'), 'open workbook on guide sheet');
  for (const keyword of ['HOW TO TRANSLATE', 'Marathi [mr]', 'Hindi [hi]', 'Original Text', 'Source Hash', 'Row Token', 'CUSTOMER', 'PRIVACY', 'SAME .xlsx']) {
    assert.ok(guide.includes(keyword), `guide lacks ${keyword}`);
  }
});
test('new target languages dynamically appear in guide instructions', () => {
  const grid = [[...files.FIXED_HEADERS, 'Marathi [mr]', 'Hindi [hi]', 'Gujarati [gu]']];
  const guide = getZipEntry(files.toXLSX(grid), 'xl/worksheets/sheet2.xml');
  assert.ok(guide?.includes('Gujarati [gu]'));
});
