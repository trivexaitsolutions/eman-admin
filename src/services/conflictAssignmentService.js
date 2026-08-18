const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const OPEN_CONFLICT_STATUSES = ['PENDING', 'IN_PROGRESS'];

function getIndiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function getTodayDateOnly() {
  const { year, month, day } = getIndiaDateParts();
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

function currentLeaveFilter(today = getTodayDateOnly()) {
  return {
    status: 'APPROVED',
    fromDate: { lte: today },
    returnedAt: null,
    OR: [
      { toDate: null },
      { toDate: { gte: today } },
    ],
  };
}

async function findBestMitraForBooking(bookingId, options = {}) {
  const excludeMitraIds = (options.excludeMitraIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  const booking = await prisma.booking.findUnique({
    where: { id: Number(bookingId) },
    select: { id: true, nakaId: true },
  });

  if (!booking?.nakaId) return null;

  const where = {
    isActive: true,
    nakas: { some: { id: Number(booking.nakaId) } },
    leaveRequests: { none: currentLeaveFilter() },
  };

  if (excludeMitraIds.length > 0) {
    where.id = { notIn: excludeMitraIds };
  }

  const mitras = await prisma.mitra.findMany({
    where,
    select: { id: true, name: true, phone: true },
    orderBy: { id: 'asc' },
  });

  if (mitras.length === 0) return null;

  const mitraIds = mitras.map((mitra) => mitra.id);
  const conflictCounts = await prisma.conflict.groupBy({
    by: ['mitraId'],
    where: {
      mitraId: { in: mitraIds },
      status: { in: OPEN_CONFLICT_STATUSES },
    },
    _count: { id: true },
  });

  const counts = new Map(
    conflictCounts.map((row) => [Number(row.mitraId), row._count?.id || 0])
  );

  mitras.sort((first, second) => {
    const countDiff = (counts.get(first.id) || 0) - (counts.get(second.id) || 0);
    return countDiff !== 0 ? countDiff : first.id - second.id;
  });

  return mitras[0].id;
}

async function findFirstAvailableMitraByIds(candidateIds = []) {
  const orderedIds = [...new Set(candidateIds.map(Number))]
    .filter((id) => Number.isInteger(id) && id > 0);

  if (orderedIds.length === 0) return null;

  const available = await prisma.mitra.findMany({
    where: {
      id: { in: orderedIds },
      isActive: true,
      leaveRequests: { none: currentLeaveFilter() },
    },
    select: { id: true },
  });

  const availableIds = new Set(available.map((item) => item.id));
  return orderedIds.find((id) => availableIds.has(id)) || null;
}

async function reassignOpenConflictsForMitra(mitraId) {
  const sourceMitraId = Number(mitraId);
  if (!Number.isInteger(sourceMitraId) || sourceMitraId <= 0) return { moved: 0, unassigned: 0 };

  const conflicts = await prisma.conflict.findMany({
    where: {
      mitraId: sourceMitraId,
      status: { in: OPEN_CONFLICT_STATUSES },
    },
    select: {
      id: true,
      bookingId: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let moved = 0;
  let unassigned = 0;

  for (const conflict of conflicts) {
    const replacementMitraId = await findBestMitraForBooking(conflict.bookingId, {
      excludeMitraIds: [sourceMitraId],
    });

    await prisma.$transaction(async (tx) => {
      const result = await tx.conflict.updateMany({
        where: {
          id: conflict.id,
          mitraId: sourceMitraId,
          status: { in: OPEN_CONFLICT_STATUSES },
        },
        data: {
          mitraId: replacementMitraId || null,
        },
      });

      if (result.count !== 1) return;

      await tx.conflictTimeline.create({
        data: {
          conflictId: conflict.id,
          updatedByType: 'SYSTEM',
          updatedById: null,
          oldStatus: conflict.status,
          newStatus: conflict.status,
          note: replacementMitraId
            ? `Conflict reassigned from Mitra #${sourceMitraId} to Mitra #${replacementMitraId} because the assigned Mitra is on approved leave.`
            : `Conflict removed from Mitra #${sourceMitraId} because the assigned Mitra is on approved leave. No other available Mitra was found for this Naka; Admin action is required.`,
        },
      });

      if (replacementMitraId) moved += 1;
      else unassigned += 1;
    });
  }

  return { moved, unassigned };
}


async function reassignOpenConflictsToMitra(sourceMitraId, targetMitraId) {
  const sourceId = Number(sourceMitraId);
  const targetId = Number(targetMitraId);

  if (!Number.isInteger(sourceId) || sourceId <= 0 || !Number.isInteger(targetId) || targetId <= 0) {
    return { moved: 0, targetAvailable: false, reason: 'INVALID_MITRA' };
  }

  if (sourceId === targetId) {
    return { moved: 0, targetAvailable: false, reason: 'SAME_MITRA' };
  }

  const target = await prisma.mitra.findFirst({
    where: {
      id: targetId,
      isActive: true,
      leaveRequests: { none: currentLeaveFilter() },
    },
    select: { id: true, name: true },
  });

  if (!target) {
    return { moved: 0, targetAvailable: false, reason: 'TARGET_UNAVAILABLE' };
  }

  const conflicts = await prisma.conflict.findMany({
    where: {
      mitraId: sourceId,
      status: { in: OPEN_CONFLICT_STATUSES },
    },
    select: {
      id: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let moved = 0;

  for (const conflict of conflicts) {
    await prisma.$transaction(async (tx) => {
      const result = await tx.conflict.updateMany({
        where: {
          id: conflict.id,
          mitraId: sourceId,
          status: { in: OPEN_CONFLICT_STATUSES },
        },
        data: { mitraId: targetId },
      });

      if (result.count !== 1) return;

      await tx.conflictTimeline.create({
        data: {
          conflictId: conflict.id,
          updatedByType: 'SYSTEM',
          updatedById: null,
          oldStatus: conflict.status,
          newStatus: conflict.status,
          note: `Conflict reassigned from Mitra #${sourceId} to Mitra #${targetId} (${target.name}) as per Admin-selected leave handover.`,
        },
      });

      moved += 1;
    });
  }

  return { moved, targetAvailable: true, reason: null };
}

module.exports = {
  getTodayDateOnly,
  currentLeaveFilter,
  findBestMitraForBooking,
  findFirstAvailableMitraByIds,
  reassignOpenConflictsForMitra,
  reassignOpenConflictsToMitra,
};
