'use strict';
/** Small, dependency-free CSV/XLSX adapter for E-MAN's single-sheet translation grid.
 * XLSX is a standard OOXML spreadsheet with inline text cells; imported formulas
 * are rejected (AI-filled files should contain text only). No macros/external links.
 */
const zlib = require('node:zlib');
const MAX_ROWS = 20000;
const MAX_CELL = 12000;
const XML_MAX = 20 * 1024 * 1024;
const FIXED_HEADERS = ['Record Type', 'Record ID', 'Customer ID', 'Record', 'Field Key', 'Original Text', 'Source Hash', 'Row Token'];
const langHeader = (l) => `${l.name} [${l.code}]`;
const langCode = (header) => /\[([a-z]{2,12}(?:-[a-z0-9]{2,8})?)\]\s*$/i.exec(String(header || ''))?.[1]?.toLowerCase() || null;
function assertGrid(grid) {
  if (!Array.isArray(grid) || !grid.length || grid.length > MAX_ROWS + 1) throw new Error('Invalid spreadsheet or too many rows (maximum 20,000).');
  if (!Array.isArray(grid[0]) || grid[0].length > 64) throw new Error('Invalid columns (maximum 64).');
  for (const row of grid) {
    if (!Array.isArray(row) || row.length > 64) throw new Error('Invalid row width.');
    for (const value of row) if (String(value ?? '').length > MAX_CELL) throw new Error('Spreadsheet contains an unusually large cell.');
  }
}
function csvSafe(value) {
  const s = String(value ?? '');
  // Mitigate spreadsheet formula injection when opening the exported CSV.
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(s) ? "'" + s : s;
}
function toCSV(grid) {
  assertGrid(grid);
  return Buffer.from('\ufeff' + grid.map((row) => row.map((value) => {
    const s = csvSafe(value);
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n') + '\r\n', 'utf8');
}
function fromCSV(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 5 * 1024 * 1024) throw new Error('CSV file is too large.');
  let input = buffer.toString('utf8').replace(/^\ufeff/, '');
  if (input.includes('\ufffd')) throw new Error('CSV must be encoded as UTF-8.');
  const rows = [], row = []; let value = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"' && value === '') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\r' || char === '\n') {
      row.push(value); value = '';
      if (row.some((cell) => cell !== '')) rows.push([...row]);
      row.length = 0;
      if (char === '\r' && input[i + 1] === '\n') i++;
      if (rows.length > MAX_ROWS + 1) throw new Error('CSV exceeds 20,000 rows.');
    } else value += char;
  }
  if (quoted) throw new Error('Malformed CSV: unclosed quoted value.');
  if (row.length || value !== '') { row.push(value); if (row.some((s) => s !== '')) rows.push(row); }
  assertGrid(rows);
  return rows;
}
const escXml = (v) => String(v ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const unXml = (s) => String(s).replace(/&#x([0-9a-f]+);|&#([0-9]+);|&(?:lt|gt|quot|apos|amp);/gi, (value, hex, dec) => {
  if (hex || dec) { const num = parseInt(hex || dec, hex ? 16 : 10); return num <= 0x10ffff ? String.fromCodePoint(num) : ''; }
  return ({'&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&amp;':'&'})[value] || value;
});
function colName(i) { let n = i + 1, s = ''; while (n) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; }
// OOXML ZIP: local file headers plus central directory; CRC32 calculated for compatibility.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = (b) => { let v = 0xffffffff; for (const byte of b) v = CRC_TABLE[(v ^ byte) & 255] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0; };
function zipParts(parts) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, contents] of Object.entries(parts)) {
    const nameB = Buffer.from(name), raw = Buffer.from(contents, 'utf8'), compressed = zlib.deflateRawSync(raw), crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameB.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameB.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameB, compressed); centrals.push(central, nameB); offset += local.length + nameB.length + compressed.length;
  }
  const centralLen = centrals.reduce((n, b) => n + b.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(parts).length, 8); end.writeUInt16LE(Object.keys(parts).length, 10);
  end.writeUInt32LE(centralLen, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
function readZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length > 5 * 1024 * 1024 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid or oversized XLSX file.');
  const end = buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if (end < 0 || end + 22 > buf.length) throw new Error('Invalid XLSX central directory.');
  const count = buf.readUInt16LE(end + 10), start = buf.readUInt32LE(end + 16);
  if (count > 200 || start >= buf.length) throw new Error('Invalid XLSX archive entries.');
  const parts = {}; let pos = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Broken XLSX central directory.');
    const method = buf.readUInt16LE(pos + 10), size = buf.readUInt32LE(pos + 20), plainSize = buf.readUInt32LE(pos + 24);
    const len = buf.readUInt16LE(pos + 28), extra = buf.readUInt16LE(pos + 30), comment = buf.readUInt16LE(pos + 32);
    const name = buf.toString('utf8', pos + 46, pos + 46 + len), ptr = buf.readUInt32LE(pos + 42);
    pos += 46 + len + extra + comment;
    if (!name.startsWith('xl/worksheets/') && name !== 'xl/sharedStrings.xml' && name !== 'xl/workbook.xml' && name !== 'xl/_rels/workbook.xml.rels') continue;
    if (plainSize > XML_MAX || (total += plainSize) > XML_MAX || ![0, 8].includes(method)) throw new Error('Unsafe/unsupported XLSX content.');
    if (ptr + 30 > buf.length || buf.readUInt32LE(ptr) !== 0x04034b50) throw new Error('Broken XLSX entry.');
    const hLen = buf.readUInt16LE(ptr + 26), hExtra = buf.readUInt16LE(ptr + 28), offset = ptr + 30 + hLen + hExtra;
    if (offset + size > buf.length) throw new Error('Truncated XLSX file.');
    const raw = method === 8 ? zlib.inflateRawSync(buf.subarray(offset, offset + size), {maxOutputLength: XML_MAX}) : buf.subarray(offset, offset + size);
    if (raw.length !== plainSize) throw new Error('Invalid XLSX compression length.');
    parts[name] = raw.toString('utf8');
  }
  return parts;
}
// Excel instruction sheet: deliberately kept as worksheet #2 so the existing
// importer continues to parse worksheet #1 ("Translations") without changes.
// It is made the active sheet when Excel opens the workbook.
function guideSheetXml(grid) {
  const languageCols = grid[0].slice(FIXED_HEADERS.length).join(', ') || 'the language columns after Row Token';
  const sections = [
    ['title', '', 'HOW TO TRANSLATE — E-MAN Translation Workbook'],
    ['subtitle', '', 'For AI assistants and human translators • Follow these rules before editing the Translations tab.'],
    ['space', '', ''],
    ['section', '', 'YOUR TASK'],
    ['step', '01', 'Open the "Translations" sheet. Row 1 has column headers. Each subsequent row represents ONE source field to translate.'],
    ['step', '02', `Fill ONLY the target language columns: ${languageCols}. Their green cells are editable.`],
    ['step', '03', 'Use Original Text (column F) and Record Type / Field Key (columns A and E) to choose the correct translation.'],
    ['step', '04', 'Translate only rows where the original text is present. Leave empty source fields / unrequested language cells blank.'],
    ['step', '05', 'Preserve any existing translation unless explicitly instructed to revise it. Never erase an already-filled translation.'],
    ['step', '06', 'Write the translation as plain text in the same row and the matching target-language column; do not use formulas.'],
    ['space', '', ''],
    ['section', '', 'STRICTLY PROTECTED — DO NOT EDIT'],
    ['warning', 'A–H', 'NEVER change, delete, reorder, recalculate or reformat columns A–H: Record Type, Record ID, Customer ID, Record, Field Key, Original Text, Source Hash and Row Token.'],
    ['warning', 'ROWS', 'Never insert, delete, reorder, merge or split rows. Never change the column headers, worksheet names, workbook structure, source texts, IDs, fingerprints or tokens.'],
    ['warning', 'SAVE', 'Keep the file as .xlsx (not .xls). Preserve the complete workbook with both worksheets, cell contents and column order.'],
    ['space', '', ''],
    ['section', '', 'TRANSLATION QUALITY RULES'],
    ['rule', 'NAMES', 'PERSON / CUSTOMER / WORKER names: transliterate the original pronunciation into the target script; do not translate the person’s identity or guess spelling.'],
    ['rule', 'PLACES', 'NAKA / CITY / STATE names and landmarks: translate common directional words when appropriate; transliterate proper place names without inventing locations.'],
    ['rule', 'ADDRESS', 'Addresses: preserve building numbers, flat/room numbers, dates, PIN codes, landmarks and exact facts. Never invent missing information.'],
    ['rule', 'SKILLS', 'Skills and service descriptions: use clear, commonly understood terminology in the target language; keep the meaning accurate.'],
    ['rule', 'OTHER', 'Preserve numerical values, IDs, email addresses, phone numbers, URLs, units and codes exactly. Use native scripts for Hindi/Marathi.'],
    ['rule', 'UNCLEAR', 'If a source phrase is ambiguous and an accurate translation cannot be made, leave that target cell blank; do not guess.'],
    ['space', '', ''],
    ['section', '', 'EXAMPLES — FOR REFERENCE ONLY'],
    ['example', 'SKILL', 'Plumbing → Marathi: प्लंबिंग | Hindi: प्लंबिंग'],
    ['example', 'NAKA', 'Station East → Marathi: स्टेशन पूर्व | Hindi: स्टेशन पूर्व'],
    ['example', 'CITY', 'Dombivli → Marathi: डोंबिवली | Hindi: डोंबिवली'],
    ['space', '', ''],
    ['section', '', 'READY-TO-USE AI PROMPT'],
    ['prompt', 'PROMPT', 'You are translating an E-MAN admin bulk-translation Excel workbook. Read this "How to Translate" sheet completely. In the "Translations" sheet, fill ONLY blank target-language cells based on Original Text, Record Type and Field Key. Translate naturally into each language indicated by the column header, preserving exact meaning and names/addresses. Do not edit any cells in columns A–H, any existing translation, header, row order, sheet name, hash, row token or workbook structure. Do not add formulas, notes or extra sheets. Return the SAME .xlsx workbook with the translated language columns filled. If you cannot translate accurately, leave the target cell blank.'],
    ['space', '', ''],
    ['section', '', 'AFTER TRANSLATION'],
    ['step', '01', 'Review a few sample rows for spelling and accuracy. Save the completed Excel workbook without changing its structure.'],
    ['step', '02', 'In E-MAN Admin → Translation Management → Import Translations, upload this .xlsx file.'],
    ['step', '03', 'Use Save as Draft to review, or Publish completed records after checking all required fields.'],
    ['space', '', ''],
    ['privacy', 'PRIVACY', 'This export may contain real customer/worker names or addresses. Share with third-party AI services only if approved and privacy requirements allow it; prefer a trusted/private AI environment.'],
  ];
  let merged = '';
  const rows = sections.map(([kind, left, right], ix) => {
    const r = ix + 1;
    if (kind === 'space') return `<row r="${r}" ht="10" customHeight="1"/>`;
    const tall = kind === 'prompt' ? 142 : kind === 'warning' ? 60 : kind === 'rule' ? 49 : kind === 'step' ? 43 : kind === 'privacy' ? 62 : kind === 'example' ? 36 : kind === 'title' ? 40 : kind === 'subtitle' ? 34 : kind === 'section' ? 32 : 38;
    const style = ({ title: 3, subtitle: 4, section: 5, step: 6, warning: 7, rule: 6, example: 8, prompt: 9, privacy: 7 })[kind] || 6;
    if (kind === 'title' || kind === 'subtitle' || kind === 'section') {
      merged += `<mergeCell ref="A${r}:H${r}"/>`;
      return `<row r="${r}" ht="${tall}" customHeight="1"><c r="A${r}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escXml(right)}</t></is></c></row>`;
    }
    merged += `<mergeCell ref="B${r}:H${r}"/>`;
    return `<row r="${r}" ht="${tall}" customHeight="1"><c r="A${r}" t="inlineStr" s="${kind === 'warning' || kind === 'privacy' ? 7 : 5}"><is><t>${escXml(left)}</t></is></c><c r="B${r}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escXml(right)}</t></is></c></row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:H${sections.length}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="17" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="8" width="15" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="${(merged.match(/<mergeCell/g) || []).length}">${merged}</mergeCells><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/></worksheet>`;
}
function toXLSX(grid) {
  assertGrid(grid);
  const rows = grid.map((row, r) => `<row r="${r + 1}">${row.map((val, c) => {
    const txt = escXml(val);
    return `<c r="${colName(c)}${r + 1}" t="inlineStr" s="${r === 0 ? 1 : c >= FIXED_HEADERS.length ? 2 : 0}"><is><t xml:space="preserve">${txt}</t></is></c>`;
  }).join('')}</row>`).join('');
  const last = colName(grid[0].length - 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${grid.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${grid[0].map((_, c) => `<col min="${c + 1}" max="${c + 1}" width="${[19,12,16,26,20,43,40,42][c] || 27}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${last}${grid.length}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="11"/><color rgb="FF145A47"/><name val="Aptos"/></font><font><sz val="10"/><color rgb="FF1F2937"/><name val="Aptos"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF145A47"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5F4EA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F4EF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEDCC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf xfId="0" fontId="0" fillId="0" borderId="0"/><xf xfId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1"/><xf xfId="0" fontId="0" fillId="3" borderId="0" applyFill="1"/><xf xfId="0" fontId="2" fillId="2" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf xfId="0" fontId="4" fillId="6" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf xfId="0" fontId="3" fillId="4" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf xfId="0" fontId="4" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf xfId="0" fontId="4" fillId="5" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf xfId="0" fontId="3" fillId="6" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf xfId="0" fontId="4" fillId="4" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf></cellXfs></styleSheet>`;
  return zipParts({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="1"/></bookViews><sheets><sheet name="Translations" sheetId="1" r:id="rId1"/><sheet name="How to Translate" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/worksheets/sheet2.xml': guideSheetXml(grid),
  });
}
function parseAttrs(s) { const out = {}; for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)) out[m[1]] = unXml(m[3]); return out; }
function fromXLSX(buffer) {
  const parts = readZip(buffer);
  const xml = parts['xl/worksheets/sheet1.xml'] || Object.entries(parts).find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1];
  if (!xml) throw new Error('No worksheet found in XLSX. Use the exported E-MAN template.');
  const shared = [];
  for (const m of (parts['xl/sharedStrings.xml'] || '').matchAll(/<(?:[\w.-]+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?si>/g)) {
    shared.push(Array.from(m[1].matchAll(/<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)).map((v) => unXml(v[1])).join(''));
  }
  const rows = [];
  for (const r of xml.matchAll(/<(?:[\w.-]+:)?row\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?row>/g)) {
    const cells = [];
    for (const c of r[1].matchAll(/<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/g)) {
      const a = parseAttrs(c[1]); const col = /^([A-Z]+)/.exec(a.r || '')?.[1];
      if (!col) continue;
      let ix = 0; for (const ch of col) ix = ix * 26 + ch.charCodeAt(0) - 64; ix--;
      if (ix >= 64) throw new Error('Unsupported XLSX: too many columns.');
      const inside = c[2] || '';
      if (/<(?:[\w.-]+:)?f(?:\s|>)/.test(inside)) throw new Error('XLSX contains formulas. Paste values instead of formulas before import.');
      let text = '';
      if (a.t === 'inlineStr') text = Array.from(inside.matchAll(/<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)).map((m) => unXml(m[1])).join('');
      else { const raw = /<(?:[\w.-]+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?v>/.exec(inside)?.[1]; text = a.t === 's' ? shared[Number(raw)] ?? '' : unXml(raw || ''); }
      cells[ix] = text;
    }
    if (cells.some((s) => s !== undefined && s !== '')) rows.push(cells.map((x) => x ?? ''));
    if (rows.length > MAX_ROWS + 1) throw new Error('XLSX exceeds 20,000 rows.');
  }
  assertGrid(rows);
  return rows;
}
module.exports = { FIXED_HEADERS, langHeader, langCode, toCSV, fromCSV, toXLSX, fromXLSX };
