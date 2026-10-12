const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.join(__dirname, '..');
const inputPath = path.resolve(process.argv[2] || path.join(rootDir, 'docs', 'eman-admin-user-documentation.md'));
const outputPath = path.resolve(process.argv[3] || path.join(rootDir, 'docs', 'eman-admin-user-documentation.pdf'));

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 54;
const MARGIN_RIGHT = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const pages = [];
const imageAssets = [];
let page = null;
let y = 0;

function newPage() {
  page = [];
  page.images = [];
  pages.push(page);
  y = PAGE_HEIGHT - MARGIN_TOP;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function readPngRgb(filename) {
  const png = fs.readFileSync(filename);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error(`Invalid PNG screenshot: ${filename}`);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitDepth = png[dataStart + 8];
      colorType = png[dataStart + 9];
      interlace = png[dataStart + 12];
    } else if (type === 'IDAT') {
      idat.push(png.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(`Unsupported PNG format in screenshot: ${filename}`);
  }

  const sourceChannels = colorType === 6 ? 4 : 3;
  const sourceStride = width * sourceChannels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rgb = Buffer.alloc(width * height * 3);
  let sourceOffset = 0;
  let rgbOffset = 0;
  let previousRow = Buffer.alloc(sourceStride);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[sourceOffset++];
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + sourceStride));
    sourceOffset += sourceStride;

    for (let column = 0; column < sourceStride; column += 1) {
      const left = column >= sourceChannels ? row[column - sourceChannels] : 0;
      const above = previousRow[column];
      const upperLeft = column >= sourceChannels ? previousRow[column - sourceChannels] : 0;
      if (filter === 1) row[column] = (row[column] + left) & 0xff;
      else if (filter === 2) row[column] = (row[column] + above) & 0xff;
      else if (filter === 3) row[column] = (row[column] + Math.floor((left + above) / 2)) & 0xff;
      else if (filter === 4) row[column] = (row[column] + paethPredictor(left, above, upperLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG scanline filter ${filter}: ${filename}`);
    }

    for (let column = 0; column < width; column += 1) {
      const inputOffset = column * sourceChannels;
      rgb[rgbOffset++] = row[inputOffset];
      rgb[rgbOffset++] = row[inputOffset + 1];
      rgb[rgbOffset++] = row[inputOffset + 2];
    }
    previousRow = row;
  }

  return { width, height, compressed: zlib.deflateSync(rgb) };
}

function addImage(filename, caption) {
  const absolutePath = path.resolve(path.dirname(inputPath), filename);
  const asset = readPngRgb(absolutePath);
  const index = imageAssets.push(asset) - 1;
  const maxHeight = asset.width <= 800 ? 430 : 320;
  const scale = Math.min(CONTENT_WIDTH / asset.width, maxHeight / asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  ensureSpace(height + 30);
  const image = {
    type: 'image',
    assetIndex: index,
    resource: `Im${page.images.length + 1}`,
    x: MARGIN_LEFT + (CONTENT_WIDTH - width) / 2,
    y: y - height,
    width,
    height,
  };
  page.images.push(image);
  page.push(image);
  y -= height + 7;
  if (caption) addWrapped(caption, { size: 8.2, font: 'F1', color: '0.36 0.40 0.44', lineHeight: 10.5, after: 3 });
}

function estimateWidth(text, size) {
  let width = 0;
  for (const char of String(text)) {
    if (char === ' ') width += size * 0.28;
    else if ('ilI.,:;!|\''.includes(char)) width += size * 0.25;
    else if ('mwMW@#%&'.includes(char)) width += size * 0.78;
    else width += size * 0.52;
  }
  return width;
}

function splitLongWord(word, maxWidth, size) {
  const chunks = [];
  let current = '';
  for (const char of word) {
    if (current && estimateWidth(current + char, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrap(text, maxWidth, size) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const parts = estimateWidth(word, size) > maxWidth ? splitLongWord(word, maxWidth, size) : [word];
    for (const part of parts) {
      const attempt = current ? `${current} ${part}` : part;
      if (current && estimateWidth(attempt, size) > maxWidth) {
        lines.push(current);
        current = part;
      } else {
        current = attempt;
      }
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function ensureSpace(height) {
  if (!page) newPage();
  if (y - height < MARGIN_BOTTOM) newPage();
}

function normalizeText(text) {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[\u2012-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00D7/g, 'x')
    .replace(/\u2192/g, 'to')
    .replace(/\u20B9/g, 'Rs.')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');
}

function addLine(text, options = {}) {
  const size = options.size || 10;
  const font = options.font || 'F1';
  const indent = options.indent || 0;
  const color = options.color || '0 0 0';
  const lineHeight = options.lineHeight || size * 1.32;
  ensureSpace(lineHeight);
  page.push({ type: 'text', text: normalizeText(text), x: MARGIN_LEFT + indent, y, size, font, color });
  y -= lineHeight;
}

function addWrapped(text, options = {}) {
  const size = options.size || 10;
  const indent = options.indent || 0;
  const hang = options.hang || indent;
  const font = options.font || 'F1';
  const color = options.color || '0 0 0';
  const lineHeight = options.lineHeight || size * 1.36;
  const firstWidth = CONTENT_WIDTH - indent;
  const nextWidth = CONTENT_WIDTH - hang;
  const firstLines = wrap(normalizeText(text), firstWidth, size);

  firstLines.forEach((line, index) => {
    addLine(line, { size, font, indent: index === 0 ? indent : hang, color, lineHeight });
  });

  if (options.after) y -= options.after;
}

function addGap(points) {
  ensureSpace(points);
  y -= points;
}

function addRule() {
  ensureSpace(16);
  page.push({ type: 'rule', x1: MARGIN_LEFT, x2: PAGE_WIDTH - MARGIN_RIGHT, y: y - 4, color: '0.80 0.80 0.80' });
  y -= 18;
}

function renderMarkdown(markdown) {
  newPage();
  const lines = markdown.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      addGap(5);
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      addImage(imageMatch[2], imageMatch[1]);
      continue;
    }

    if (trimmed === '---') {
      addRule();
      continue;
    }

    if (trimmed.startsWith('# ')) {
      addGap(pages.length === 1 && page.length === 0 ? 0 : 12);
      addWrapped(trimmed.slice(2), { size: 22, font: 'F2', color: '0.05 0.08 0.12', lineHeight: 28, after: 8 });
      addRule();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      addGap(10);
      addWrapped(trimmed.slice(3), { size: 15, font: 'F2', color: '0.08 0.10 0.14', lineHeight: 20, after: 4 });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      let imageCount = 0;
      for (let lookahead = lineIndex + 1; lookahead < lines.length; lookahead += 1) {
        const nextLine = lines[lookahead].trim();
        if (!nextLine) continue;
        if (!/^!\[[^\]]*\]\([^)]+\)$/.test(nextLine)) break;
        imageCount += 1;
      }
      if (imageCount) ensureSpace(28 + imageCount * 447);
      addGap(7);
      addWrapped(trimmed.slice(4), { size: 12.5, font: 'F2', color: '0.10 0.12 0.16', lineHeight: 17, after: 2 });
      continue;
    }

    if (trimmed.startsWith('- ')) {
      addWrapped(`- ${trimmed.slice(2)}`, { size: 9.6, indent: 10, hang: 22, lineHeight: 13.2, after: 1 });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      addWrapped(trimmed, { size: 9.6, indent: 10, hang: 28, lineHeight: 13.2, after: 1 });
      continue;
    }

    addWrapped(trimmed, { size: 10, lineHeight: 13.8, after: 2 });
  }
}

function pdfEscape(text) {
  return String(text)
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function num(value) {
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function contentStream(items, pageNumber, totalPages) {
  let out = '';

  for (const item of items) {
    if (item.type === 'rule') {
      out += `${item.color} RG\n${num(item.x1)} ${num(item.y)} m ${num(item.x2)} ${num(item.y)} l S\n`;
      continue;
    }

    if (item.type === 'image') {
      out += `q\n${num(item.width)} 0 0 ${num(item.height)} ${num(item.x)} ${num(item.y)} cm\n/${item.resource} Do\nQ\n`;
      continue;
    }

    out += `${item.color} rg\nBT\n/${item.font} ${num(item.size)} Tf\n1 0 0 1 ${num(item.x)} ${num(item.y)} Tm\n(${pdfEscape(item.text)}) Tj\nET\n`;
  }

  const footer = `Page ${pageNumber} of ${totalPages}`;
  out += `0.45 0.45 0.45 rg\nBT\n/F1 8 Tf\n1 0 0 1 ${num(PAGE_WIDTH - MARGIN_RIGHT - 60)} ${num(28)} Tm\n(${pdfEscape(footer)}) Tj\nET\n`;
  return out;
}

function buildPdf() {
  const objects = [];
  const kids = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  let objectId = 5;
  pages.forEach((items, index) => {
    const pageId = objectId++;
    const contentId = objectId++;
    const imageIds = items.images.map(() => objectId++);
    kids.push(`${pageId} 0 R`);
    const stream = contentStream(items, index + 1, pages.length);
    const xObjects = items.images.map((image, imageIndex) => `/${image.resource} ${imageIds[imageIndex]} 0 R`).join(' ');
    const xObjectResource = xObjects ? ` /XObject << ${xObjects} >>` : '';
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjectResource} >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    items.images.forEach((image, imageIndex) => {
      const asset = imageAssets[image.assetIndex];
      const header = `<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${asset.compressed.length} >>\nstream\n`;
      objects[imageIds[imageIndex]] = Buffer.concat([
        Buffer.from(header, 'latin1'),
        asset.compressed,
        Buffer.from('\nendstream', 'latin1'),
      ]);
    });
  });

  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [0];
  let currentOffset = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = currentOffset;
    const body = Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id], 'latin1');
    const object = Buffer.concat([Buffer.from(`${id} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
    chunks.push(object);
    currentOffset += object.length;
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length}\n`;
  xref += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

const markdown = fs.readFileSync(inputPath, 'utf8');
renderMarkdown(markdown);
fs.writeFileSync(outputPath, buildPdf());
console.log(`Generated ${path.relative(rootDir, outputPath)} with ${pages.length} pages.`);
