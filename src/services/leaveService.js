const { PrismaClient } = require('@prisma/client');
const {
  getTodayDateOnly,
  reassignOpenConflictsToMitra,
} = require('./conflictAssignmentService');

const prisma = new PrismaClient();
const WATCH_INTERVAL_MS = 5 * 60 * 1000;
let watcherStarted = false;

/**
 * Existing conflicts are never redistributed by load-balancing here.
 * This only executes a handover that Admin already configured by selecting
 * a specific target Mitra for the leave.
 */
async function processCurrentMitraLeaveReassignments() {
  const today = getTodayDateOnly();

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      subjectType: 'MITRA',
      status: 'APPROVED',
      mitraId: { not: null },
      workHandling: 'REASSIGN_SELECTED',
      reassignToMitraId: { not: null },
      workReassignedAt: null,
      returnedAt: null,
      fromDate: { lte: today },
      OR: [
        { toDate: null },
        { toDate: { gte: today } },
      ],
    },
    select: { id: true, mitraId: true, reassignToMitraId: true },
    orderBy: { fromDate: 'asc' },
  });

  const summary = { moved: 0, processedLeaves: 0, pendingTarget: 0 };

  for (const leave of leaves) {
    const result = await reassignOpenConflictsToMitra(
      leave.mitraId,
      leave.reassignToMitraId
    );

    // If the selected target became inactive/on-leave, do not silently choose
    // someone else. Keep the Admin decision pending so Admin can change target.
    if (!result.targetAvailable) {
      summary.pendingTarget += 1;
      continue;
    }

    await prisma.leaveRequest.updateMany({
      where: {
        id: leave.id,
        workHandling: 'REASSIGN_SELECTED',
        reassignToMitraId: leave.reassignToMitraId,
        workReassignedAt: null,
      },
      data: { workReassignedAt: new Date() },
    });

    summary.moved += result.moved;
    summary.processedLeaves += 1;
  }

  return summary;
}

function startLeaveReassignmentWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;

  const run = async () => {
    try {
      await processCurrentMitraLeaveReassignments();
    } catch (error) {
      // Keep server alive even if DB is temporarily unavailable during deploy/startup.
      console.error('Leave reassignment watcher error:', error.message);
    }
  };

  // Only executes Admin-selected target handovers when their leave is active.
  setTimeout(run, 5000).unref();
  setInterval(run, WATCH_INTERVAL_MS).unref();
}

module.exports = {
  processCurrentMitraLeaveReassignments,
  startLeaveReassignmentWatcher,
};
