/** Repair existing admin hash on STAGING only, without embedding a secret.
 * ADMIN_EMAIL=admin@example.test ADMIN_NEW_PASSWORD='strong password' \
 * NODE_ENV=development node scripts/resetAdminPassword.js --execute
 * Password is NOT included in the changed-files ZIP.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  if (process.env.NODE_ENV === 'production' || !process.argv.includes('--execute')) throw new Error('Only explicit staging reset allowed');
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_NEW_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_NEW_PASSWORD (12+ characters)');
  const hash = await bcrypt.hash(password, 12);
  const result = await prisma.employee.updateMany({ where: { email, role: { in: ['superadmin','admin'] } }, data: { password: hash } });
  if (result.count !== 1) throw new Error('Admin user not found');
  console.log('Admin password hash updated. Clear ADMIN_NEW_PASSWORD from environment.');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
