const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.employee.upsert({
    where: { email: 'admin@eman.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@eman.com',
      password: hashedPassword,
      role: 'superadmin',
    },
  });
  
  console.log('✅ Default Admin Created! Email: admin@eman.com | Pass: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });