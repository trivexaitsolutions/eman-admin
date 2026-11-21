'use strict';
// Run from the E-MAN backend project root after copying the new route.
// Adds only one mount to the CURRENT emanserver.js; never replaces the file.
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const serverPath = path.join(root, 'emanserver.js');
const routePath = path.join(root, 'src/routes/api/languagePublicRoutes.js');
const mount = "app.use('/api/i18n', require('./src/routes/api/languagePublicRoutes'));";
if (!fs.existsSync(serverPath) || !fs.existsSync(routePath)) {
  console.error('Run from backend root and ensure languagePublicRoutes.js was copied.');
  process.exit(1);
}
const source = fs.readFileSync(serverPath, 'utf8');
if (source.includes("app.use('/api/i18n'")) {
  console.log('Phase 2 /api/i18n is already registered. No changes.');
  process.exit(0);
}
const anchor = "app.use('/api/user', require('./src/routes/api/userRoutes'));";
if (!source.includes(anchor)) {
  console.error('API route anchor missing. No changes made. Add this line manually: '+mount);
  process.exit(1);
}
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const backup = serverPath + '.before-phase2.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(serverPath, backup);
const updated = source.replace(anchor, anchor + newline + mount);
fs.writeFileSync(serverPath, updated);
console.log('Added /api/i18n; original backed up at '+backup);
