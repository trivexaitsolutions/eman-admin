const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const VERIFIED_STATUS = 'VERIFIED';
const OPEN_CONFLICT_STATUSES = ['PENDING', 'IN_PROGRESS'];
const ACTIVE_BOOKING_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];
const ALLOWED_RANGE_DAYS = [7, 30, 90];

function getRangeDays(value) {
    const parsed = Number(value);
    return ALLOWED_RANGE_DAYS.includes(parsed) ? parsed : 30;
}

function subtractCalendarMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
}

function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function dateKey(date) {
    const value = new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function shortDateLabel(date) {
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
    }).format(new Date(date));
}

function formatDateTime(date) {
    if (!date) return '—';

    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}

function timeAgo(date) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 172800) return 'Yesterday';
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;

    return formatDateTime(date);
}

function safeName(value, fallback = 'Unknown') {
    const text = String(value || '').trim();
    return text || fallback;
}

function getNakaSource(naka) {
    if (naka.createdByType === 'MITRA' && naka.createdByMitra) {
        return `Mitra: ${safeName(naka.createdByMitra.name)}`;
    }

    if (naka.createdByType === 'ADMIN' && naka.createdByEmployee) {
        return `Admin: ${safeName(naka.createdByEmployee.name)}`;
    }

    return 'Legacy / existing record';
}

function getNakaAttentionLabel(naka, verificationCutoff) {
    if (naka.verificationStatus !== VERIFIED_STATUS) {
        return 'Pending approval';
    }

    if (!naka.lastVerifiedAt || new Date(naka.lastVerifiedAt) < verificationCutoff) {
        return 'Re-verification due';
    }

    return 'Verified';
}

function buildDailySeries(rows, days) {
    const dayMap = new Map();
    const chartStart = startOfDay(addDays(new Date(), -(days - 1)));

    for (let index = 0; index < days; index += 1) {
        const date = addDays(chartStart, index);
        dayMap.set(dateKey(date), {
            label: shortDateLabel(date),
            value: 0,
        });
    }

    rows.forEach((row) => {
        const key = dateKey(row.createdAt);
        const point = dayMap.get(key);
        if (point) point.value += 1;
    });

    return Array.from(dayMap.values());
}

function buildRecentActivity({ nakas, workers, mitras, bookings, conflicts }) {
    const entries = [];

    nakas.forEach((naka) => {
        entries.push({
            type: 'naka',
            title: `${safeName(naka.name)} Naka added`,
            description: `${naka.city?.state?.name ? `${naka.city.state.name} • ` : ''}${safeName(naka.city?.name, 'City not set')} • ${getNakaSource(naka)}`,
            createdAt: naka.createdAt,
            href: '/admin/nakas?filter=all',
        });
    });

    workers.forEach((worker) => {
        entries.push({
            type: 'worker',
            title: `${safeName(worker.name)} worker onboarded`,
            description: worker.mitra ? `Added by Mitra: ${safeName(worker.mitra.name)}` : 'Added from admin side',
            createdAt: worker.createdAt,
            href: '/admin/workers',
        });
    });

    mitras.forEach((mitra) => {
        entries.push({
            type: 'mitra',
            title: `${safeName(mitra.name)} Mitra added`,
            description: `${safeName(mitra.phone, 'No mobile')} • ${mitra.isActive ? 'Active' : 'Inactive'}`,
            createdAt: mitra.createdAt,
            href: '/admin/mitras',
        });
    });

    bookings.forEach((booking) => {
        entries.push({
            type: 'booking',
            title: `Booking #${booking.id} created`,
            description: `${safeName(booking.customer?.name, 'Customer')} • ${safeName(booking.status, 'PENDING')}`,
            createdAt: booking.createdAt,
            href: '/admin/dashboard',
        });
    });

    conflicts.forEach((conflict) => {
        entries.push({
            type: 'conflict',
            title: `Conflict #${conflict.id} raised`,
            description: `${safeName(conflict.status)} • ${safeName(conflict.reason, 'No reason entered')}`,
            createdAt: conflict.createdAt,
            href: `/admin/conflicts/${conflict.id}`,
        });
    });

    return entries
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
        .slice(0, 8)
        .map((entry) => ({
            ...entry,
            timeAgo: timeAgo(entry.createdAt),
            exactDateTime: formatDateTime(entry.createdAt),
        }));
}

const showDashboard = async (req, res) => {
    console.log("dahboard controller hit");
    const rangeDays = getRangeDays(req.query.range);
    const now = new Date();
    const verificationCutoff = subtractCalendarMonths(now, 6);
    const periodStart = startOfDay(addDays(now, -(rangeDays - 1)));
    const activityStart = startOfDay(addDays(now, -6));

    const operationalNakaWhere = {
        verificationStatus: VERIFIED_STATUS,
        lastVerifiedAt: { gte: verificationCutoff },
    };

    const attentionNakaWhere = {
        OR: [
            { verificationStatus: { not: VERIFIED_STATUS } },
            { lastVerifiedAt: null },
            { lastVerifiedAt: { lt: verificationCutoff } },
        ],
    };

    try {
        const [
            totalNakas,
            verifiedNakas,
            attentionNakasCount,
            totalWorkers,
            activeWorkers,
            availableWorkers,
            activeMitras,
            totalCustomers,
            activeBookings,
            openConflicts,
            periodWorkers,
            periodMitras,
            periodCustomers,
            periodBookings,
            queuedNakas,
            recentNakas,
            recentWorkers,
            recentMitras,
            recentBookings,
            recentConflicts,
            activityWorkers,
            activityBookings,
        ] = await Promise.all([
            prisma.naka.count(),
            prisma.naka.count({ where: operationalNakaWhere }),
            prisma.naka.count({ where: attentionNakaWhere }),
            prisma.worker.count(),
            prisma.worker.count({ where: { isActive: true } }),
            prisma.worker.count({ where: { isActive: true, isAvailable: true } }),
            prisma.mitra.count({ where: { isActive: true } }),
            prisma.customer.count(),
            prisma.booking.count({ where: { status: { in: ACTIVE_BOOKING_STATUSES } } }),
            prisma.conflict.count({ where: { status: { in: OPEN_CONFLICT_STATUSES } } }),
            prisma.worker.count({ where: { createdAt: { gte: periodStart } } }),
            prisma.mitra.count({ where: { createdAt: { gte: periodStart } } }),
            prisma.customer.count({ where: { createdAt: { gte: periodStart } } }),
            prisma.booking.count({ where: { createdAt: { gte: periodStart } } }),
            prisma.naka.findMany({
                where: attentionNakaWhere,
                include: {
                    city: {
                        include: {
                            state: { select: { name: true, code: true } },
                        },
                    },
                    createdByMitra: { select: { id: true, name: true, phone: true } },
                    createdByEmployee: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 5,
            }),
            prisma.naka.findMany({
                include: {
                    city: { include: { state: { select: { name: true } } } },
                    createdByMitra: { select: { name: true } },
                    createdByEmployee: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 4,
            }),
            prisma.worker.findMany({
                include: { mitra: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 4,
            }),
            prisma.mitra.findMany({
                orderBy: { createdAt: 'desc' },
                take: 4,
            }),
            prisma.booking.findMany({
                include: { customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 4,
            }),
            prisma.conflict.findMany({
                select: {
                    id: true,
                    reason: true,
                    status: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 4,
            }),
            prisma.worker.findMany({
                where: { createdAt: { gte: activityStart } },
                select: { createdAt: true },
            }),
            prisma.booking.findMany({
                where: { createdAt: { gte: activityStart } },
                select: { createdAt: true },
            }),
        ]);

        const verificationHealthPercent = totalNakas > 0
            ? Math.round((verifiedNakas / totalNakas) * 100)
            : 0;

        const queue = queuedNakas.map((naka) => ({
            id: naka.id,
            name: safeName(naka.name),
            city: safeName(naka.city?.name, 'City not set'),
            state: naka.city?.state?.name || null,
            pincode: naka.pincode || 'PIN not added',
            source: getNakaSource(naka),
            status: getNakaAttentionLabel(naka, verificationCutoff),
            submittedAt: timeAgo(naka.createdAt),
            submittedExact: formatDateTime(naka.createdAt),
            href: '/admin/nakas?filter=pending',
        }));

        const role = String(req.user?.role || '').toLowerCase();
        const canManageMasters = ['superadmin', 'admin'].includes(role);

        return res.render('admin/dashboard', {
            dashboard: {
                generatedAt: formatDateTime(now),
                rangeDays,
                rangeLabel: `Last ${rangeDays} days`,
                permissions: {
                    canManageMasters,
                    canManageMitras: canManageMasters,
                },
                metrics: {
                    totalNakas,
                    verifiedNakas,
                    attentionNakasCount,
                    verificationHealthPercent,
                    totalWorkers,
                    activeWorkers,
                    availableWorkers,
                    activeMitras,
                    totalCustomers,
                    activeBookings,
                    openConflicts,
                },
                period: {
                    workers: periodWorkers,
                    mitras: periodMitras,
                    customers: periodCustomers,
                    bookings: periodBookings,
                },
                attentionQueue: queue,
                activitySeries: {
                    workers: buildDailySeries(activityWorkers, 7),
                    bookings: buildDailySeries(activityBookings, 7),
                },
                recentActivity: buildRecentActivity({
                    nakas: recentNakas,
                    workers: recentWorkers,
                    mitras: recentMitras,
                    bookings: recentBookings,
                    conflicts: recentConflicts,
                }),
            },
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        return res.status(500).render('admin/dashboard', {
            dashboard: {
                generatedAt: formatDateTime(new Date()),
                rangeDays,
                rangeLabel: `Last ${rangeDays} days`,
                permissions: { canManageMasters: false, canManageMitras: false },
                metrics: {
                    totalNakas: 0,
                    verifiedNakas: 0,
                    attentionNakasCount: 0,
                    verificationHealthPercent: 0,
                    totalWorkers: 0,
                    activeWorkers: 0,
                    availableWorkers: 0,
                    activeMitras: 0,
                    totalCustomers: 0,
                    activeBookings: 0,
                    openConflicts: 0,
                },
                period: { workers: 0, mitras: 0, customers: 0, bookings: 0 },
                attentionQueue: [],
                activitySeries: { workers: [], bookings: [] },
                recentActivity: [],
                loadError: 'Dashboard data load nahi ho paya. Server logs check karein.',
            },
        });
    }
};

module.exports = {
    showDashboard,
};
