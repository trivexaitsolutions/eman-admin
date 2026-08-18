// src/controllers/adminConflictController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { currentLeaveFilter } = require("../services/conflictAssignmentService");

const getMitraMap = async (conflicts) => {
  const mitraIds = [
    ...new Set(
      conflicts
        .map((conflict) => conflict.mitraId)
        .filter((id) => id !== null && id !== undefined)
        .map(Number)
    ),
  ];

  if (mitraIds.length === 0) {
    return {};
  }

  const mitras = await prisma.mitra.findMany({
    where: {
      id: {
        in: mitraIds,
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isActive: true,
    },
  });

  const map = {};

  mitras.forEach((mitra) => {
    map[mitra.id] = mitra;
  });

  return map;
};

const calculateRefundData = (conflict) => {
  const booking = conflict.booking;
  const totalBookingAmount = Math.round(Number(booking?.amount || 0));

  const perWorkerAmount =
    booking?.amount && booking?.workerCount
      ? Math.round(Number(booking.amount) / Number(booking.workerCount))
      : 0;

  let suggestedRefundAmount = 0;

  if (conflict.requestedAction === "CANCEL_BOOKING") {
    suggestedRefundAmount = totalBookingAmount;
  }

  if (
    conflict.requestedAction === "CANCEL_WORKER" ||
    conflict.requestedAction === "CANCEL_DUTY"
  ) {
    suggestedRefundAmount = perWorkerAmount;
  }

  return {
    totalBookingAmount,
    perWorkerAmount,
    suggestedRefundAmount,
  };
};

const formatConflict = (conflict, mitraMap = {}) => {
  const booking = conflict.booking;
  const customer = booking?.customer || null;

  const worker =
    booking?.workers?.find(
      (w) => Number(w.id) === Number(conflict.workerId)
    ) || null;

  const refundData = calculateRefundData(conflict);

  const assignedMitra = conflict.mitraId
    ? mitraMap[Number(conflict.mitraId)] || null
    : null;

  const mitraTimeline = (conflict.timeline || []).filter(
    (item) => item.updatedByType === "MITRA"
  );

  const latestMitraUpdate =
    mitraTimeline && mitraTimeline.length > 0 ? mitraTimeline[0] : null;

  return {
    id: conflict.id,
    bookingId: conflict.bookingId,

    raisedByType: conflict.raisedByType,
    raisedById: conflict.raisedById,

    reason: conflict.reason,
    description: conflict.description,

    status: conflict.status,
    requestedAction: conflict.requestedAction,
    continueWork: conflict.continueWork,

    penaltyAmount:
      conflict.raisedByType === "WORKER" &&
      conflict.requestedAction === "CANCEL_DUTY" &&
      conflict.status !== "SOLVED"
        ? 0
        : conflict.penaltyAmount || 0,

    totalBookingAmount: refundData.totalBookingAmount,
    perWorkerAmount: refundData.perWorkerAmount,
    suggestedRefundAmount: refundData.suggestedRefundAmount,

    createdAt: conflict.createdAt,
    updatedAt: conflict.updatedAt,

    mitraId: conflict.mitraId,
    assignedMitra: assignedMitra
      ? {
          id: assignedMitra.id,
          name: assignedMitra.name,
          phone: assignedMitra.phone,
          email: assignedMitra.email,
          isActive: assignedMitra.isActive,
        }
      : null,

    latestMitraUpdate: latestMitraUpdate
      ? {
          oldStatus: latestMitraUpdate.oldStatus,
          newStatus: latestMitraUpdate.newStatus,
          note: latestMitraUpdate.note,
          createdAt: latestMitraUpdate.createdAt,
        }
      : null,

    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        }
      : null,

    worker: worker
      ? {
          id: worker.id,
          name: worker.name,
          phone: worker.phone,
          email: worker.email,
        }
      : null,

    booking,
    timeline: conflict.timeline || [],
  };
};

const getAllConflicts = async (req, res) => {
  try {
    const { status, raisedByType, fromDate, toDate } = req.query;

    const now = new Date();

    const defaultFromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultToDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const finalFromDate =
      fromDate || defaultFromDate.toISOString().split("T")[0];

    const finalToDate = toDate || defaultToDate.toISOString().split("T")[0];

    const where = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (raisedByType && raisedByType !== "ALL") {
      where.raisedByType = raisedByType;
    }

    if (finalFromDate && finalToDate) {
      const start = new Date(finalFromDate);
      const end = new Date(finalToDate);
      end.setDate(end.getDate() + 1);

      where.createdAt = {
        gte: start,
        lt: end,
      };
    }

    const conflicts = await prisma.conflict.findMany({
      where,
      include: {
        booking: {
          include: {
            customer: true,
            workers: true,
          },
        },
        timeline: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const mitraMap = await getMitraMap(conflicts);

const formattedConflicts = conflicts.map((conflict) =>
  formatConflict(conflict, mitraMap)
);

    return res.render("admin/conflicts/index", {
      title: "Conflict Management",
      conflicts: formattedConflicts,
      filters: {
        status: status || "ALL",
        raisedByType: raisedByType || "ALL",
        fromDate: finalFromDate,
        toDate: finalToDate,
      },
    });
  } catch (error) {
    console.error("Get All Conflicts Error:", error);

    return res.status(500).send(`
      <h2>Server Error</h2>
      <p>Conflict list fetch karte waqt error aaya.</p>
      <pre>${error.message}</pre>
    `);
  }
};

const getConflictDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const conflict = await prisma.conflict.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        booking: {
          include: {
            customer: true,
            workers: true,
          },
        },
        timeline: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!conflict) {
      return res.status(404).send("Conflict not found");
    }

    const mitraMap = await getMitraMap([conflict]);
    const formattedConflict = formatConflict(conflict, mitraMap);

    let availableMitras = [];
    if (conflict.booking?.nakaId && ["PENDING", "IN_PROGRESS"].includes(conflict.status)) {
      availableMitras = await prisma.mitra.findMany({
        where: {
          isActive: true,
          nakas: { some: { id: Number(conflict.booking.nakaId) } },
          leaveRequests: { none: currentLeaveFilter() },
        },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
      });
    }

    return res.render("admin/conflicts/show", {
      title: `Conflict #${conflict.id}`,
      conflict: formattedConflict,
      availableMitras,
    });
  } catch (error) {
    console.error("Get Conflict Details Error:", error);

    return res.status(500).send(`
      <h2>Server Error</h2>
      <p>Conflict details fetch karte waqt error aaya.</p>
      <pre>${error.message}</pre>
    `);
  }
};

const updateConflictStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status || !["PENDING", "IN_PROGRESS", "SOLVED", "UNRESOLVED"].includes(status)) {
      return res.status(400).send("Invalid status");
    }

    if (!note || !note.trim()) {
      return res.status(400).send("Note is required");
    }

    const conflict = await prisma.conflict.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!conflict) {
      return res.status(404).send("Conflict not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.conflict.update({
        where: {
          id: parseInt(id),
        },
        data: {
          status,
        },
      });

      await tx.conflictTimeline.create({
        data: {
          conflictId: parseInt(id),
          updatedByType: "ADMIN",
          updatedById: req.user?.id ? Number(req.user.id) : null,
          oldStatus: conflict.status,
          newStatus: status,
          note: note.trim(),
        },
      });
    });

    return res.redirect(`/admin/conflicts/${id}`);
  } catch (error) {
    console.error("Update Conflict Status Error:", error);

    return res.status(500).send(`
      <h2>Server Error</h2>
      <p>Conflict status update karte waqt error aaya.</p>
      <pre>${error.message}</pre>
    `);
  }
};

const assignConflictMitra = async (req, res) => {
  try {
    const conflictId = Number(req.params.id);
    const mitraId = Number(req.body.mitraId);

    if (!Number.isInteger(mitraId) || mitraId <= 0) {
      return res.status(400).send("Please select a valid Mitra.");
    }

    const conflict = await prisma.conflict.findUnique({
      where: { id: conflictId },
      include: { booking: { select: { nakaId: true } } },
    });

    if (!conflict) return res.status(404).send("Conflict not found");
    if (!["PENDING", "IN_PROGRESS"].includes(conflict.status)) {
      return res.status(400).send("Only open conflicts can be reassigned.");
    }

    const mitra = await prisma.mitra.findFirst({
      where: {
        id: mitraId,
        isActive: true,
        nakas: { some: { id: Number(conflict.booking.nakaId) } },
        leaveRequests: { none: currentLeaveFilter() },
      },
      select: { id: true, name: true },
    });

    if (!mitra) {
      return res.status(400).send("Selected Mitra is unavailable, on leave, or not assigned to this Naka.");
    }

    const oldMitraId = conflict.mitraId;

    await prisma.$transaction(async (tx) => {
      await tx.conflict.update({
        where: { id: conflictId },
        data: { mitraId: mitra.id },
      });

      await tx.conflictTimeline.create({
        data: {
          conflictId,
          updatedByType: "ADMIN",
          updatedById: req.user?.id ? Number(req.user.id) : null,
          oldStatus: conflict.status,
          newStatus: conflict.status,
          note: `Conflict manually assigned ${oldMitraId ? `from Mitra #${oldMitraId}` : "from Admin queue"} to ${mitra.name} (Mitra #${mitra.id}).`,
        },
      });
    });

    return res.redirect(`/admin/conflicts/${conflictId}`);
  } catch (error) {
    console.error("Assign Conflict Mitra Error:", error);
    return res.status(500).send("Conflict could not be assigned to Mitra.");
  }
};

module.exports = {
  getAllConflicts,
  getConflictDetails,
  updateConflictStatus,
  assignConflictMitra,
};