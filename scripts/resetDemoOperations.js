/**
 * Operational reset for a DISPOSABLE E-MAN STAGING database. Default DRY RUN.
 * Keeps cities, states, Nakas (+ verification records), skills/rates, employees,
 * booking/pool settings. Deletes all bookings, customers, workers, Mitras and
 * their operational history, not just demo accounts.
 *
 * Before executing: make a complete database backup and verify restoration.
 *   DEMO_DATA_RESET_ALLOWED=YES NODE_ENV=development node scripts/resetDemoOperations.js --execute --backup-confirmed --confirm=DELETE-ALL-OPERATIONAL-DATA
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const counts = [
    ['simulatorInstance', 'simulatorInstance'],
    ['simulatorCampaign', 'simulatorCampaign'],
    ['conflictTimeline', 'conflictTimeline'],
    ['conflict', 'conflict'],
    ['rating', 'rating'],
    ['workerClientRating', 'workerClientRating'],
    ['booking', 'booking'],
    ['customerAddress', 'customerAddress'],
    ['customer', 'customer'],
    ['worker', 'worker'],
    ['mitra', 'mitra'],
];
async function main() {
    const db = new URL(process.env.DATABASE_URL || 'mysql://localhost/unknown');
    console.log('E-MAN operational reset', { database: db.pathname.slice(1), host: db.hostname, mode: execute ? 'EXECUTE' : 'DRY RUN' });
    for (const [name, model] of counts) console.log(`${name}: ${await prisma[model].count()}`);
    console.log('mitraLeaveRequests:', await prisma.leaveRequest.count({ where: { mitraId: { not: null } } }));
    console.log('Preserved: Employee/admin, State, City, Naka, NakaVerification, CityPincode, Skill, SkillRate, BookingSetting, PoolSlot, employee-only leaves, Prisma migrations.');
    if (!execute) { console.log('\nDRY RUN ONLY. Nothing deleted.'); return; }
    if (process.env.NODE_ENV === 'production' ||
        process.env.DEMO_DATA_RESET_ALLOWED !== 'YES' ||
        !args.includes('--backup-confirmed') ||
        !args.includes('--confirm=DELETE-ALL-OPERATIONAL-DATA')) {
        throw new Error('REFUSED: only disposable non-production DB; require DEMO_DATA_RESET_ALLOWED=YES, verified backup and confirmation flags.');
    }
    await prisma.$transaction(async tx => {
        await tx.simulatorInstance.deleteMany();
        await tx.simulatorCampaign.deleteMany();
        await tx.conflictTimeline.deleteMany();
        await tx.conflict.deleteMany();
        await tx.rating.deleteMany();
        await tx.workerClientRating.deleteMany();
        await tx.booking.deleteMany();
        await tx.customerAddress.deleteMany();
        await tx.customer.deleteMany();
        await tx.worker.deleteMany();
        await tx.leaveRequest.deleteMany({ where: { mitraId: { not: null } } });
        await tx.mitra.deleteMany();
    }, { timeout: 120000 });
    console.log('Operational data reset completed. Master data preserved.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
