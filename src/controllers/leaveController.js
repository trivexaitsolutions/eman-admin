const { PrismaClient } = require('@prisma/client');
const { getTodayDateOnly } = require('../services/conflictAssignmentService');
const {
  processCurrentMitraLeaveReassignments,
} = require('../services/leaveService');

const prisma = new PrismaClient();

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EMERGENCY', 'PAID', 'UNPAID', 'OTHER'];
const DAY_TYPES = ['FULL_DAY', 'HALF_DAY'];
const DECISION_STATUSES = ['APPROVED', 'REJECTED'];
const OPEN_LEAVE_STATUSES = ['PENDING', 'APPROVED'];
const WORK_HANDLING_OPTIONS = ['KEEP', 'REASSIGN_SELECTED'];

function isLeaveManager(req) {
  return ['superadmin', 'admin'].includes(String(req.user?.role || '').toLowerCase());
}

function parseDateOnly(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInput(date) {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
}

function formatDateLabel(date) {
  if (!date) return 'Open-ended';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

function normalizeDates(dayType, fromDate, toDate) {
  if (dayType === 'HALF_DAY' && fromDate) {
    return { fromDate, toDate: fromDate };
  }
  return { fromDate, toDate: toDate || null };
}

function calculateDays(fromDate, toDate, dayType) {
  if (!fromDate) return null;
  if (dayType === 'HALF_DAY') return 0.5;
  if (!toDate) return null;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
}

function getDisplayState(leave, today = getTodayDateOnly()) {
  if (leave.status === 'PENDING') return 'PENDING';
  if (leave.status === 'REJECTED') return 'REJECTED';
  if (leave.status === 'CANCELLED') return 'CANCELLED';

  if (leave.status === 'APPROVED') {
    if (leave.returnedAt) return 'COMPLETED';

    const from = new Date(leave.fromDate);
    const to = leave.toDate ? new Date(leave.toDate) : null;

    if (from > today) return 'UPCOMING';
    if (to && to < today) return 'COMPLETED';
    return 'ON_LEAVE';
  }

  return leave.status;
}

function isCurrentLeave(leave, today = getTodayDateOnly()) {
  return getDisplayState(leave, today) === 'ON_LEAVE';
}

function decorateLeave(leave, today = getTodayDateOnly()) {
  const days = calculateDays(
    new Date(leave.fromDate),
    leave.toDate ? new Date(leave.toDate) : null,
    leave.dayType
  );

  return {
    ...leave,
    displayState: getDisplayState(leave, today),
    fromDateInput: formatDateInput(leave.fromDate),
    toDateInput: formatDateInput(leave.toDate),
    fromDateLabel: formatDateLabel(leave.fromDate),
    toDateLabel: formatDateLabel(leave.toDate),
    days,
    isOpenEnded: !leave.toDate && !leave.returnedAt,
    personName: leave.subjectType === 'MITRA'
      ? leave.mitra?.name || 'Mitra'
      : leave.employee?.name || 'Employee',
  };
}

function redirectWithMessage(res, path, type, message) {
  const separator = path.includes('?') ? '&' : '?';
  return res.redirect(`${path}${separator}${type}=${encodeURIComponent(message)}`);
}

async function validateLeaveRequest({
  subjectType,
  subjectId,
  leaveType,
  dayType,
  fromDate,
  toDate,
  reason,
  excludeLeaveId = null,
}) {
  if (!['EMPLOYEE', 'MITRA'].includes(subjectType)) return 'Invalid staff type.';
  if (!LEAVE_TYPES.includes(leaveType)) return 'Please select a valid leave type.';
  if (!DAY_TYPES.includes(dayType)) return 'Please select a valid day type.';
  if (!fromDate) return 'From date is required.';
  if (toDate && toDate < fromDate) return 'To date cannot be before From date.';
  if (dayType === 'HALF_DAY' && toDate && fromDate.getTime() !== toDate.getTime()) {
    return 'Half day leave can be for one date only.';
  }
  if (!String(reason || '').trim()) return 'Reason is required.';

  const relationWhere = subjectType === 'MITRA'
    ? { mitraId: Number(subjectId) }
    : { employeeId: Number(subjectId) };

  const overlapWhere = {
    subjectType,
    ...relationWhere,
    status: { in: OPEN_LEAVE_STATUSES },
    returnedAt: null,
    AND: [
      {
        OR: [
          { toDate: null },
          { toDate: { gte: fromDate } },
        ],
      },
    ],
  };

  if (toDate) {
    overlapWhere.AND.push({ fromDate: { lte: toDate } });
  }

  if (excludeLeaveId) {
    overlapWhere.id = { not: Number(excludeLeaveId) };
  }

  const overlap = await prisma.leaveRequest.findFirst({
    where: overlapWhere,
    select: { id: true, status: true },
  });

  if (overlap) {
    return `An existing ${String(overlap.status).toLowerCase()} leave overlaps these dates.`;
  }

  return null;
}

async function getManagedStaffOptions() {
  const [employees, mitras] = await Promise.all([
    prisma.employee.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.mitra.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { employees, mitras };
}

async function validateReassignmentTarget(sourceMitraId, targetMitraId) {
  const sourceId = Number(sourceMitraId);
  const targetId = Number(targetMitraId);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    return 'Please select the Mitra who should receive the existing conflicts.';
  }
  if (sourceId === targetId) {
    return 'Existing conflicts cannot be reassigned to the same Mitra.';
  }

  const target = await prisma.mitra.findFirst({
    where: { id: targetId, isActive: true },
    select: { id: true },
  });

  if (!target) return 'Selected reassignment Mitra was not found or is inactive.';
  return null;
}

function readWorkHandover(subjectType, sourceMitraId, body, fallbackHandling = 'KEEP', fallbackTargetId = null) {
  if (subjectType !== 'MITRA') {
    return { workHandling: 'KEEP', reassignToMitraId: null };
  }

  const requested = String(body.workHandling || fallbackHandling || 'KEEP').toUpperCase();
  const workHandling = WORK_HANDLING_OPTIONS.includes(requested) ? requested : 'KEEP';
  if (workHandling !== 'REASSIGN_SELECTED') {
    return { workHandling: 'KEEP', reassignToMitraId: null };
  }

  const rawTarget = Object.prototype.hasOwnProperty.call(body, 'reassignToMitraId')
    ? body.reassignToMitraId
    : fallbackTargetId;

  return {
    workHandling,
    reassignToMitraId: Number(rawTarget),
  };
}

async function listLeaves(req, res) {
  if (!isLeaveManager(req)) {
    return res.redirect('/admin/leaves/my');
  }

  try {
    // This only executes handovers to the exact target Mitra selected by Admin.
    await processCurrentMitraLeaveReassignments();

    const today = getTodayDateOnly();
    const staffType = String(req.query.staffType || 'ALL').toUpperCase();
    const status = String(req.query.status || 'ALL').toUpperCase();
    const search = String(req.query.search || '').trim();
    const fromDate = parseDateOnly(req.query.fromDate);
    const toDate = parseDateOnly(req.query.toDate);

    const where = {};

    if (['EMPLOYEE', 'MITRA'].includes(staffType)) where.subjectType = staffType;

    if (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      where.status = status;
    } else if (status === 'ON_LEAVE') {
      where.status = 'APPROVED';
      where.fromDate = { lte: today };
      where.returnedAt = null;
      where.AND = where.AND || [];
      where.AND.push({ OR: [{ toDate: null }, { toDate: { gte: today } }] });
    } else if (status === 'UPCOMING') {
      where.status = 'APPROVED';
      where.fromDate = { gt: today };
      where.returnedAt = null;
    } else if (status === 'COMPLETED') {
      where.status = 'APPROVED';
      where.OR = [
        { returnedAt: { not: null } },
        { toDate: { lt: today } },
      ];
    } else if (status === 'OPEN_ENDED') {
      where.status = 'APPROVED';
      where.toDate = null;
      where.returnedAt = null;
    }

    if (fromDate || toDate) {
      where.AND = where.AND || [];
      if (fromDate) {
        where.AND.push({ OR: [{ toDate: null }, { toDate: { gte: fromDate } }] });
      }
      if (toDate) where.AND.push({ fromDate: { lte: toDate } });
    }

    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { employee: { is: { name: { contains: search } } } },
          { employee: { is: { email: { contains: search } } } },
          { mitra: { is: { name: { contains: search } } } },
          { mitra: { is: { phone: { contains: search } } } },
          { mitra: { is: { email: { contains: search } } } },
        ],
      });
    }

    const currentLeaveWhere = {
      status: 'APPROVED',
      fromDate: { lte: today },
      returnedAt: null,
      AND: [{ OR: [{ toDate: null }, { toDate: { gte: today } }] }],
    };

    const [
      leaves,
      pendingCount,
      onLeaveCount,
      upcomingCount,
      openEndedCount,
      unassignedConflicts,
      staff,
    ] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, email: true, role: true } },
          mitra: { select: { id: true, name: true, phone: true, email: true } },
          decidedByEmployee: { select: { id: true, name: true } },
          createdByEmployee: { select: { id: true, name: true } },
          returnedByEmployee: { select: { id: true, name: true } },
          reassignToMitra: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: currentLeaveWhere }),
      prisma.leaveRequest.count({
        where: { status: 'APPROVED', fromDate: { gt: today }, returnedAt: null },
      }),
      prisma.leaveRequest.count({
        where: { status: 'APPROVED', toDate: null, returnedAt: null },
      }),
      prisma.conflict.count({
        where: { mitraId: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      getManagedStaffOptions(),
    ]);

    return res.render('admin/leaves/index', {
      mode: 'manage',
      leaves: leaves.map((leave) => decorateLeave(leave, today)),
      stats: { pendingCount, onLeaveCount, upcomingCount, openEndedCount, unassignedConflicts },
      filters: {
        staffType: ['EMPLOYEE', 'MITRA'].includes(staffType) ? staffType : 'ALL',
        status,
        search,
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || '',
      },
      staff,
      todayInput: formatDateInput(today),
      leaveTypes: LEAVE_TYPES,
      success_msg: req.query.success || null,
      error_msg: req.query.error || null,
    });
  } catch (error) {
    console.error('Leave Management List Error:', error);
    return res.status(500).send('Leave Management could not be loaded. Run the latest leave migration and try again.');
  }
}

async function listMyEmployeeLeaves(req, res) {
  try {
    const employeeId = Number(req.user?.id);
    const today = getTodayDateOnly();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!employee) return res.status(404).send('Employee not found.');

    const leaves = await prisma.leaveRequest.findMany({
      where: { subjectType: 'EMPLOYEE', employeeId },
      include: {
        employee: { select: { id: true, name: true, email: true, role: true } },
        decidedByEmployee: { select: { id: true, name: true } },
        returnedByEmployee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.render('admin/leaves/index', {
      mode: 'my',
      employee,
      leaves: leaves.map((leave) => decorateLeave(leave, today)),
      stats: null,
      filters: {},
      staff: null,
      todayInput: formatDateInput(today),
      leaveTypes: LEAVE_TYPES,
      success_msg: req.query.success || null,
      error_msg: req.query.error || null,
    });
  } catch (error) {
    console.error('My Employee Leaves Error:', error);
    return res.status(500).send('Your leave requests could not be loaded.');
  }
}

async function applyEmployeeLeave(req, res) {
  try {
    const employeeId = Number(req.user?.id);
    const leaveType = String(req.body.leaveType || '').toUpperCase();
    const dayType = String(req.body.dayType || 'FULL_DAY').toUpperCase();
    const parsed = normalizeDates(
      dayType,
      parseDateOnly(req.body.fromDate),
      parseDateOnly(req.body.toDate)
    );
    const reason = String(req.body.reason || '').trim();

    const validationError = await validateLeaveRequest({
      subjectType: 'EMPLOYEE',
      subjectId: employeeId,
      leaveType,
      dayType,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      reason,
    });

    if (validationError) {
      return redirectWithMessage(res, '/admin/leaves/my', 'error', validationError);
    }

    await prisma.leaveRequest.create({
      data: {
        subjectType: 'EMPLOYEE',
        employeeId,
        leaveType,
        dayType,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        reason,
        entrySource: 'REQUEST',
        workHandling: 'KEEP',
      },
    });

    return redirectWithMessage(res, '/admin/leaves/my', 'success', 'Leave request submitted.');
  } catch (error) {
    console.error('Apply Employee Leave Error:', error);
    return redirectWithMessage(res, '/admin/leaves/my', 'error', 'Leave request could not be submitted.');
  }
}

async function cancelEmployeeLeave(req, res) {
  try {
    const employeeId = Number(req.user?.id);
    const leaveId = Number(req.params.id);

    const leave = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveId,
        subjectType: 'EMPLOYEE',
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (!leave) {
      return redirectWithMessage(res, '/admin/leaves/my', 'error', 'This leave cannot be cancelled.');
    }

    if (leave.status === 'APPROVED') {
      const displayState = getDisplayState(leave);
      if (displayState === 'COMPLETED') {
        return redirectWithMessage(res, '/admin/leaves/my', 'error', 'Completed leave cannot be cancelled.');
      }
      if (displayState === 'ON_LEAVE') {
        return redirectWithMessage(res, '/admin/leaves/my', 'error', 'Active leave can only be ended by Admin.');
      }
    }

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return redirectWithMessage(res, '/admin/leaves/my', 'success', 'Leave request cancelled.');
  } catch (error) {
    console.error('Cancel Employee Leave Error:', error);
    return redirectWithMessage(res, '/admin/leaves/my', 'error', 'Leave could not be cancelled.');
  }
}

async function createManagedLeave(req, res) {
  if (!isLeaveManager(req)) return res.status(403).send('Access denied.');

  try {
    const subjectType = String(req.body.subjectType || '').toUpperCase();
    const subjectId = subjectType === 'MITRA'
      ? Number(req.body.mitraId)
      : Number(req.body.employeeId);
    const leaveType = String(req.body.leaveType || '').toUpperCase();
    const dayType = String(req.body.dayType || 'FULL_DAY').toUpperCase();
    const parsed = normalizeDates(
      dayType,
      parseDateOnly(req.body.fromDate),
      parseDateOnly(req.body.toDate)
    );
    const reason = String(req.body.reason || '').trim();
    const handover = readWorkHandover(subjectType, subjectId, req.body);

    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Please select an Employee or Mitra.');
    }

    const subjectExists = subjectType === 'MITRA'
      ? await prisma.mitra.findFirst({ where: { id: subjectId, isActive: true }, select: { id: true } })
      : subjectType === 'EMPLOYEE'
        ? await prisma.employee.findUnique({ where: { id: subjectId }, select: { id: true } })
        : null;

    if (!subjectExists) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Selected staff member was not found or is inactive.');
    }

    const validationError = await validateLeaveRequest({
      subjectType,
      subjectId,
      leaveType,
      dayType,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      reason,
    });

    if (validationError) {
      return redirectWithMessage(res, '/admin/leaves', 'error', validationError);
    }

    if (handover.workHandling === 'REASSIGN_SELECTED') {
      const targetError = await validateReassignmentTarget(subjectId, handover.reassignToMitraId);
      if (targetError) return redirectWithMessage(res, '/admin/leaves', 'error', targetError);
    }

    const employeeId = Number(req.user.id);
    await prisma.leaveRequest.create({
      data: {
        subjectType,
        employeeId: subjectType === 'EMPLOYEE' ? subjectId : null,
        mitraId: subjectType === 'MITRA' ? subjectId : null,
        leaveType,
        dayType,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        reason,
        status: 'APPROVED',
        decisionNote: 'Leave entered directly by Admin.',
        entrySource: 'ADMIN',
        workHandling: handover.workHandling,
        reassignToMitraId: handover.reassignToMitraId,
        createdByEmployeeId: employeeId,
        decidedByEmployeeId: employeeId,
        decidedAt: new Date(),
      },
    });

    if (subjectType === 'MITRA' && handover.workHandling === 'REASSIGN_SELECTED') {
      await processCurrentMitraLeaveReassignments();
    }

    return redirectWithMessage(res, '/admin/leaves', 'success', 'Leave added successfully.');
  } catch (error) {
    console.error('Create Managed Leave Error:', error);
    return redirectWithMessage(res, '/admin/leaves', 'error', 'Leave could not be added.');
  }
}

async function decideLeave(req, res) {
  if (!isLeaveManager(req)) return res.status(403).send('Access denied.');

  try {
    const leaveId = Number(req.params.id);
    const status = String(req.body.status || '').toUpperCase();
    const decisionNote = String(req.body.decisionNote || '').trim();

    if (!DECISION_STATUSES.includes(status)) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Invalid leave decision.');
    }

    if (!decisionNote) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Decision note is required.');
    }

    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave || leave.status !== 'PENDING') {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Only pending leave requests can be decided.');
    }

    let updatedDates = { fromDate: leave.fromDate, toDate: leave.toDate };
    let handover = { workHandling: 'KEEP', reassignToMitraId: null };

    if (status === 'APPROVED') {
      const dayType = leave.dayType;
      updatedDates = normalizeDates(
        dayType,
        parseDateOnly(req.body.fromDate) || new Date(leave.fromDate),
        Object.prototype.hasOwnProperty.call(req.body, 'toDate')
          ? parseDateOnly(req.body.toDate)
          : leave.toDate
      );

      const subjectId = leave.subjectType === 'MITRA' ? leave.mitraId : leave.employeeId;
      const validationError = await validateLeaveRequest({
        subjectType: leave.subjectType,
        subjectId,
        leaveType: leave.leaveType,
        dayType,
        fromDate: updatedDates.fromDate,
        toDate: updatedDates.toDate,
        reason: leave.reason,
        excludeLeaveId: leave.id,
      });

      if (validationError) {
        return redirectWithMessage(res, '/admin/leaves', 'error', validationError);
      }

      handover = readWorkHandover(leave.subjectType, leave.mitraId, req.body);
      if (handover.workHandling === 'REASSIGN_SELECTED') {
        const targetError = await validateReassignmentTarget(leave.mitraId, handover.reassignToMitraId);
        if (targetError) return redirectWithMessage(res, '/admin/leaves', 'error', targetError);
      }
    }

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status,
        decisionNote,
        fromDate: updatedDates.fromDate,
        toDate: updatedDates.toDate,
        workHandling: status === 'APPROVED' ? handover.workHandling : 'KEEP',
        reassignToMitraId: status === 'APPROVED' ? handover.reassignToMitraId : null,
        workReassignedAt: null,
        decidedByEmployeeId: Number(req.user.id),
        decidedAt: new Date(),
      },
    });

    if (status === 'APPROVED' && leave.subjectType === 'MITRA' && handover.workHandling === 'REASSIGN_SELECTED') {
      await processCurrentMitraLeaveReassignments();
    }

    return redirectWithMessage(
      res,
      '/admin/leaves',
      'success',
      status === 'APPROVED' ? 'Leave approved.' : 'Leave rejected.'
    );
  } catch (error) {
    console.error('Leave Decision Error:', error);
    return redirectWithMessage(res, '/admin/leaves', 'error', 'Leave decision could not be saved.');
  }
}

async function updateManagedLeave(req, res) {
  if (!isLeaveManager(req)) return res.status(403).send('Access denied.');

  try {
    const leaveId = Number(req.params.id);
    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });

    if (!leave || !['PENDING', 'APPROVED'].includes(leave.status) || leave.returnedAt) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'This leave cannot be updated.');
    }

    const leaveType = String(req.body.leaveType || leave.leaveType).toUpperCase();
    const dayType = String(req.body.dayType || leave.dayType).toUpperCase();
    const parsed = normalizeDates(
      dayType,
      parseDateOnly(req.body.fromDate),
      parseDateOnly(req.body.toDate)
    );
    const reason = String(req.body.reason || '').trim();
    const subjectId = leave.subjectType === 'MITRA' ? leave.mitraId : leave.employeeId;

    let handover;
    if (leave.subjectType === 'MITRA' && leave.workReassignedAt) {
      handover = {
        workHandling: leave.workHandling,
        reassignToMitraId: leave.reassignToMitraId,
      };
    } else {
      handover = readWorkHandover(
        leave.subjectType,
        leave.mitraId,
        req.body,
        leave.workHandling,
        leave.reassignToMitraId
      );
    }

    const validationError = await validateLeaveRequest({
      subjectType: leave.subjectType,
      subjectId,
      leaveType,
      dayType,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      reason,
      excludeLeaveId: leave.id,
    });

    if (validationError) {
      return redirectWithMessage(res, '/admin/leaves', 'error', validationError);
    }

    if (handover.workHandling === 'REASSIGN_SELECTED' && !leave.workReassignedAt) {
      const targetError = await validateReassignmentTarget(leave.mitraId, handover.reassignToMitraId);
      if (targetError) return redirectWithMessage(res, '/admin/leaves', 'error', targetError);
    }

    const handoverChanged = leave.subjectType === 'MITRA'
      && !leave.workReassignedAt
      && (
        handover.workHandling !== leave.workHandling
        || Number(handover.reassignToMitraId || 0) !== Number(leave.reassignToMitraId || 0)
      );

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        leaveType,
        dayType,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        reason,
        workHandling: handover.workHandling,
        reassignToMitraId: handover.reassignToMitraId,
        ...(handoverChanged ? { workReassignedAt: null } : {}),
      },
    });

    if (leave.status === 'APPROVED' && leave.subjectType === 'MITRA' && handover.workHandling === 'REASSIGN_SELECTED' && !leave.workReassignedAt) {
      await processCurrentMitraLeaveReassignments();
    }

    return redirectWithMessage(res, '/admin/leaves', 'success', 'Leave updated.');
  } catch (error) {
    console.error('Update Managed Leave Error:', error);
    return redirectWithMessage(res, '/admin/leaves', 'error', 'Leave could not be updated.');
  }
}

async function reassignManagedLeave(req, res) {
  if (!isLeaveManager(req)) return res.status(403).send('Access denied.');

  try {
    const leaveId = Number(req.params.id);
    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });

    if (!leave || leave.status !== 'APPROVED' || leave.subjectType !== 'MITRA' || !leave.mitraId || leave.returnedAt || getDisplayState(leave) === 'COMPLETED') {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Work reassignment is not available for this leave.');
    }

    if (leave.workReassignedAt) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Existing conflicts for this leave were already reassigned.');
    }

    const targetMitraId = Number(req.body.reassignToMitraId);
    const targetError = await validateReassignmentTarget(leave.mitraId, targetMitraId);
    if (targetError) return redirectWithMessage(res, '/admin/leaves', 'error', targetError);

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        workHandling: 'REASSIGN_SELECTED',
        reassignToMitraId: targetMitraId,
        workReassignedAt: null,
      },
    });

    const current = isCurrentLeave(leave);
    if (current) await processCurrentMitraLeaveReassignments();

    return redirectWithMessage(
      res,
      '/admin/leaves',
      'success',
      current
        ? 'Handover target saved. Active conflicts are moved only to the Mitra selected by Admin; no automatic substitute is used.'
        : 'Handover target saved. Existing conflicts will move only to that selected Mitra when this leave starts.'
    );
  } catch (error) {
    console.error('Reassign Managed Leave Error:', error);
    return redirectWithMessage(res, '/admin/leaves', 'error', 'Work could not be reassigned.');
  }
}

async function markReturned(req, res) {
  if (!isLeaveManager(req)) return res.status(403).send('Access denied.');

  try {
    const leaveId = Number(req.params.id);
    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    const today = getTodayDateOnly();
    const returnedDate = parseDateOnly(req.body.returnedDate) || today;

    if (!leave || leave.status !== 'APPROVED' || leave.returnedAt) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'This leave cannot be marked returned.');
    }

    if (new Date(leave.fromDate) > returnedDate) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Return date cannot be before leave start date.');
    }

    if (returnedDate > today) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Return date cannot be in the future.');
    }

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        toDate: returnedDate,
        returnedAt: new Date(),
        returnedByEmployeeId: Number(req.user.id),
      },
    });

    return redirectWithMessage(res, '/admin/leaves', 'success', 'Staff member marked returned and is available for new assignments.');
  } catch (error) {
    console.error('Mark Returned Error:', error);
    return redirectWithMessage(res, '/admin/leaves', 'error', 'Return could not be saved.');
  }
}

async function cancelManagedLeave(req, res) {
  if (!isLeaveManager(req)) return res.status(403).send('Access denied.');

  try {
    const leaveId = Number(req.params.id);
    const decisionNote = String(req.body.decisionNote || '').trim();

    if (!decisionNote) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Cancellation note is required.');
    }

    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave || leave.status !== 'APPROVED' || leave.returnedAt) {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Only active/upcoming approved leave can be cancelled by Admin.');
    }

    if (getDisplayState(leave) === 'COMPLETED') {
      return redirectWithMessage(res, '/admin/leaves', 'error', 'Completed leave cannot be cancelled.');
    }

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'CANCELLED',
        decisionNote: leave.decisionNote
          ? `${leave.decisionNote} | Cancelled: ${decisionNote}`
          : `Cancelled: ${decisionNote}`,
        decidedByEmployeeId: Number(req.user.id),
        decidedAt: new Date(),
        cancelledAt: new Date(),
      },
    });

    return redirectWithMessage(res, '/admin/leaves', 'success', 'Approved leave cancelled.');
  } catch (error) {
    console.error('Admin Cancel Leave Error:', error);
    return redirectWithMessage(res, '/admin/leaves', 'error', 'Leave could not be cancelled.');
  }
}

async function listMitraLeaves(req, res) {
  try {
    // Only Admin-selected target handovers are processed here.
    await processCurrentMitraLeaveReassignments();

    const mitraId = Number(req.user?.id);
    const today = getTodayDateOnly();

    const leaves = await prisma.leaveRequest.findMany({
      where: { subjectType: 'MITRA', mitraId },
      include: {
        mitra: { select: { id: true, name: true, phone: true, email: true } },
        decidedByEmployee: { select: { id: true, name: true } },
        returnedByEmployee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const decorated = leaves.map((leave) => decorateLeave(leave, today));
    const currentLeave = decorated.find((leave) => leave.displayState === 'ON_LEAVE') || null;
    const upcomingLeave = decorated.find((leave) => leave.displayState === 'UPCOMING') || null;

    return res.render('mitra/leaves', {
      layout: false,
      mitra: req.user,
      mitraName: req.user?.name || 'Mitra',
      activePage: 'leaves',
      leaves: decorated,
      currentLeave,
      upcomingLeave,
      leaveTypes: LEAVE_TYPES,
      success_msg: req.query.success || null,
      error_msg: req.query.error || null,
    });
  } catch (error) {
    console.error('Mitra Leaves Error:', error);
    return res.status(500).send('Leaves could not be loaded.');
  }
}

async function applyMitraLeave(req, res) {
  try {
    const mitraId = Number(req.user?.id);
    const leaveType = String(req.body.leaveType || '').toUpperCase();
    const dayType = String(req.body.dayType || 'FULL_DAY').toUpperCase();
    const parsed = normalizeDates(
      dayType,
      parseDateOnly(req.body.fromDate),
      parseDateOnly(req.body.toDate)
    );
    const reason = String(req.body.reason || '').trim();

    const validationError = await validateLeaveRequest({
      subjectType: 'MITRA',
      subjectId: mitraId,
      leaveType,
      dayType,
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
      reason,
    });

    if (validationError) {
      return redirectWithMessage(res, '/mitra/leaves', 'error', validationError);
    }

    await prisma.leaveRequest.create({
      data: {
        subjectType: 'MITRA',
        mitraId,
        leaveType,
        dayType,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        reason,
        entrySource: 'REQUEST',
        workHandling: 'KEEP',
      },
    });

    return redirectWithMessage(res, '/mitra/leaves', 'success', 'Leave request submitted for approval.');
  } catch (error) {
    console.error('Apply Mitra Leave Error:', error);
    return redirectWithMessage(res, '/mitra/leaves', 'error', 'Leave request could not be submitted.');
  }
}

async function cancelMitraLeave(req, res) {
  try {
    const mitraId = Number(req.user?.id);
    const leaveId = Number(req.params.id);

    const leave = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveId,
        subjectType: 'MITRA',
        mitraId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (!leave) {
      return redirectWithMessage(res, '/mitra/leaves', 'error', 'This leave cannot be cancelled.');
    }

    if (leave.status === 'APPROVED') {
      const displayState = getDisplayState(leave);
      if (displayState === 'COMPLETED') {
        return redirectWithMessage(res, '/mitra/leaves', 'error', 'Completed leave cannot be cancelled.');
      }
      if (displayState === 'ON_LEAVE') {
        return redirectWithMessage(res, '/mitra/leaves', 'error', 'Active leave can only be ended by Admin.');
      }
    }

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return redirectWithMessage(res, '/mitra/leaves', 'success', 'Leave request cancelled.');
  } catch (error) {
    console.error('Cancel Mitra Leave Error:', error);
    return redirectWithMessage(res, '/mitra/leaves', 'error', 'Leave could not be cancelled.');
  }
}

module.exports = {
  listLeaves,
  listMyEmployeeLeaves,
  applyEmployeeLeave,
  cancelEmployeeLeave,
  createManagedLeave,
  decideLeave,
  updateManagedLeave,
  reassignManagedLeave,
  markReturned,
  cancelManagedLeave,
  listMitraLeaves,
  applyMitraLeave,
  cancelMitraLeave,
};
