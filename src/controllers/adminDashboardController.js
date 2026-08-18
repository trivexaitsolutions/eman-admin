const { PrismaClient } = require('@prisma/client');
const { getTodayDateOnly } = require('../services/conflictAssignmentService');
const { processCurrentMitraLeaveReassignments } = require('../services/leaveService');

const prisma = new PrismaClient();
const VERIFIED_STATUS = 'VERIFIED';
const OPEN_CONFLICT_STATUSES = ['PENDING', 'IN_PROGRESS'];
const ACTIVE_BOOKING_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];

function subtractCalendarMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
}

function safeName(value, fallback = 'Unknown') {
    const text = String(value || '').trim();
    return text || fallback;
}

function formatDate(date) {
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
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
        timeZone: 'Asia/Kolkata',
    }).format(new Date(date));
}

const showDashboard = async (req, res) => {
    const now = new Date();
    const today = getTodayDateOnly();
    const verificationCutoff = subtractCalendarMonths(now, 6);

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
        await processCurrentMitraLeaveReassignments();

        const [
            totalNakas,
            verifiedNakas,
            attentionNakasCount,
            totalWorkers,
            availableWorkers,
            activeMitras,
            activeBookings,
            openConflicts,
            unassignedConflicts,
            pendingLeaves,
            onLeaveToday,
            upcomingLeaves,
            queuedNakas,
            pendingLeaveRows,
        ] = await Promise.all([
            prisma.naka.count(),
            prisma.naka.count({ where: operationalNakaWhere }),
            prisma.naka.count({ where: attentionNakaWhere }),
            prisma.worker.count({ where: { isActive: true } }),
            prisma.worker.count({ where: { isActive: true, isAvailable: true } }),
            prisma.mitra.count({ where: { isActive: true } }),
            prisma.booking.count({ where: { status: { in: ACTIVE_BOOKING_STATUSES } } }),
            prisma.conflict.count({ where: { status: { in: OPEN_CONFLICT_STATUSES } } }),
            prisma.conflict.count({ where: { status: { in: OPEN_CONFLICT_STATUSES }, mitraId: null } }),
            prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
            prisma.leaveRequest.count({
                where: {
                    status: 'APPROVED',
                    fromDate: { lte: today },
                    returnedAt: null,
                    OR: [
                        { toDate: null },
                        { toDate: { gte: today } },
                    ],
                },
            }),
            prisma.leaveRequest.count({
                where: {
                    status: 'APPROVED',
                    fromDate: { gt: today },
                },
            }),
            prisma.naka.findMany({
                where: attentionNakaWhere,
                include: {
                    city: { include: { state: { select: { name: true } } } },
                },
                orderBy: { createdAt: 'asc' },
                take: 4,
            }),
            prisma.leaveRequest.findMany({
                where: { status: 'PENDING' },
                include: {
                    employee: { select: { name: true, role: true } },
                    mitra: { select: { name: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 4,
            }),
        ]);

        const verificationHealthPercent = totalNakas > 0
            ? Math.round((verifiedNakas / totalNakas) * 100)
            : 0;

        const role = String(req.user?.role || '').toLowerCase();
        const canManage = ['superadmin', 'admin'].includes(role);

        return res.render('admin/dashboard', {
            dashboard: {
                generatedAt: formatDateTime(now),
                permissions: { canManage },
                metrics: {
                    totalNakas,
                    verifiedNakas,
                    attentionNakasCount,
                    verificationHealthPercent,
                    totalWorkers,
                    availableWorkers,
                    activeMitras,
                    activeBookings,
                    openConflicts,
                    unassignedConflicts,
                    pendingLeaves,
                    onLeaveToday,
                    upcomingLeaves,
                },
                nakaQueue: queuedNakas.map((naka) => ({
                    id: naka.id,
                    name: safeName(naka.name),
                    location: [naka.city?.name, naka.city?.state?.name].filter(Boolean).join(', ') || 'Location not set',
                })),
                leaveQueue: pendingLeaveRows.map((leave) => ({
                    id: leave.id,
                    name: leave.subjectType === 'MITRA'
                        ? safeName(leave.mitra?.name, 'Mitra')
                        : safeName(leave.employee?.name, 'Employee'),
                    subjectType: leave.subjectType,
                    leaveType: leave.leaveType,
                    dates: `${formatDate(leave.fromDate)} – ${leave.toDate ? formatDate(leave.toDate) : 'Until returned'}`,
                })),
            },
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        return res.status(500).render('admin/dashboard', {
            dashboard: {
                generatedAt: formatDateTime(new Date()),
                permissions: { canManage: false },
                metrics: {
                    totalNakas: 0,
                    verifiedNakas: 0,
                    attentionNakasCount: 0,
                    verificationHealthPercent: 0,
                    totalWorkers: 0,
                    availableWorkers: 0,
                    activeMitras: 0,
                    activeBookings: 0,
                    openConflicts: 0,
                    unassignedConflicts: 0,
                    pendingLeaves: 0,
                    onLeaveToday: 0,
                    upcomingLeaves: 0,
                },
                nakaQueue: [],
                leaveQueue: [],
                loadError: 'Dashboard data could not be loaded.',
            },
        });
    }
};

module.exports = { showDashboard };
