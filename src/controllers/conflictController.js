// src/controllers/conflictController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { sendPushNotification } = require("../utils/sendNotification");
const {
  findBestMitraForBooking,
  findFirstAvailableMitraByIds,
} = require("../services/conflictAssignmentService");
const {
  processCurrentMitraLeaveReassignments,
} = require("../services/leaveService");

const createConflict = async (req, res) => {
  try {
    const {
      bookingId,
      raisedBy,
      reason,
      description,
      workerId,
      continueWork,
      requestedAction,
    } = req.body;

    if (!bookingId || !raisedBy || !reason) {
      return res.status(400).json({
        success: false,
        message: "bookingId, raisedBy and reason are required.",
      });
    }

    if (!["CLIENT", "WORKER"].includes(raisedBy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid raisedBy value.",
      });
    }

    // Keep future approved leaves effective even if no Admin page was opened.
    await processCurrentMitraLeaveReassignments();

    const shouldContinueWork =
      continueWork === false || continueWork === "false" ? false : true;

    let finalRequestedAction = requestedAction;

    if (!finalRequestedAction) {
      if (shouldContinueWork) {
        finalRequestedAction = "CONTINUE_WORK";
      } else {
        finalRequestedAction =
          raisedBy === "WORKER" ? "CANCEL_DUTY" : "CANCEL_BOOKING";
      }
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        customer: true,
        workers: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    let customerId = booking.customerId;
    let finalWorkerId = null;
    let mitraId = null;
    let raisedById = null;
    let finalPenaltyAmount = null;
    let cancelledWorkerInfo = null;
    let workersToNotify = [];

    const assignedMitraId = await findBestMitraForBooking(bookingId);

    if (raisedBy === "CLIENT") {
      raisedById = booking.customerId;
      customerId = booking.customerId;

      // Main assignment: booking ke naka ke best Mitra ko conflict assign karo
      // Fallback: customer ka mitra
      mitraId = assignedMitraId || await findFirstAvailableMitraByIds([
        booking.customer?.mitraId,
      ]);
      finalPenaltyAmount = null;

      // Case 1: Client specific worker ko cancel kar raha hai
      if (workerId) {
        const isWorkerInBooking = booking.workers.some(
          (w) => Number(w.id) === Number(workerId)
        );

        if (!isWorkerInBooking) {
          return res.status(400).json({
            success: false,
            message: "This worker is not assigned to this booking.",
          });
        }

        finalWorkerId = parseInt(workerId);

        const selectedWorker = booking.workers.find(
          (w) => Number(w.id) === Number(workerId)
        );

        mitraId = assignedMitraId || await findFirstAvailableMitraByIds([
          selectedWorker?.mitraId,
          booking.customer?.mitraId,
        ]);

        if (finalRequestedAction === "CANCEL_WORKER" && selectedWorker) {
          workersToNotify.push(selectedWorker);
        }
      }

      // Case 2: Client poori booking cancel kar raha hai
      if (finalRequestedAction === "CANCEL_BOOKING") {
        workersToNotify = booking.workers || [];
      }
    }

    if (raisedBy === "WORKER") {
      if (!workerId) {
        return res.status(400).json({
          success: false,
          message: "workerId is required when issue is raised by worker.",
        });
      }

      const worker = await prisma.worker.findUnique({
        where: { id: parseInt(workerId) },
      });

      if (!worker) {
        return res.status(404).json({
          success: false,
          message: "Worker not found.",
        });
      }

      const isWorkerInBooking = booking.workers.some(
        (w) => Number(w.id) === Number(workerId)
      );

      if (!isWorkerInBooking) {
        return res.status(400).json({
          success: false,
          message: "This worker is not assigned to this booking.",
        });
      }

      raisedById = parseInt(workerId);
      finalWorkerId = parseInt(workerId);

      // Main assignment: booking ke naka ka best Mitra
      // Fallback: worker ka onboarding Mitra
      mitraId = assignedMitraId || await findFirstAvailableMitraByIds([worker.mitraId]);

      // Worker penalty is decided by the assigned Mitra after reviewing the conflict.
      // Do not apply any automatic/client-supplied penalty when the issue is raised.
      finalPenaltyAmount = 0;

      const workerAmount =
        booking.amount && booking.workerCount
          ? Math.round(Number(booking.amount) / Number(booking.workerCount))
          : 0;

      cancelledWorkerInfo = {
        workerId: worker.id,
        workerName: worker.name,
        reason,
        amount: workerAmount,
      };
    }

    // Mobile retries or a repeated long-press must not create duplicate Mitra
    // requests for the same worker and booking.
    if (
      raisedBy === "WORKER" &&
      shouldContinueWork === false &&
      finalRequestedAction === "CANCEL_DUTY"
    ) {
      const existingCancelRequest = await prisma.conflict.findFirst({
        where: {
          bookingId: parseInt(bookingId),
          workerId: finalWorkerId,
          raisedByType: "WORKER",
          requestedAction: "CANCEL_DUTY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingCancelRequest) {
        return res.json({
          success: true,
          message: "Mitra request already exists.",
          conflict: existingCancelRequest,
          cancelledWorkerInfo,
          assignedMitraId: existingCancelRequest.mitraId,
          duplicate: true,
        });
      }
    }

    const conflict = await prisma.$transaction(async (tx) => {
      const createdConflict = await tx.conflict.create({
        data: {
          bookingId: parseInt(bookingId),
          raisedByType: raisedBy,
          raisedById,
          customerId,
          workerId: finalWorkerId,
          mitraId,
          reason,
          description: description || null,
          penaltyAmount: finalPenaltyAmount,
          status: "PENDING",
          continueWork: shouldContinueWork,
          requestedAction: finalRequestedAction,
        },
      });

      await tx.conflictTimeline.create({
        data: {
          conflictId: createdConflict.id,
          updatedByType: "SYSTEM",
          updatedById: null,
          oldStatus: null,
          newStatus: "PENDING",
          note: `Issue raised by ${raisedBy}. Reason: ${reason}. Action: ${finalRequestedAction}. Continue work: ${
            shouldContinueWork ? "Yes" : "No"
          }. Assigned Mitra ID: ${mitraId || "ADMIN_ONLY"}`,
        },
      });

      // Specific worker cancel / worker duty cancel
      if (
        finalWorkerId &&
        (
          (
            raisedBy === "WORKER" &&
            shouldContinueWork === false &&
            finalRequestedAction === "CANCEL_DUTY"
          ) ||
          (
            raisedBy === "CLIENT" &&
            finalRequestedAction === "CANCEL_WORKER"
          )
        )
      ) {
        let cancelledWorkerIds = [];

        try {
          cancelledWorkerIds = JSON.parse(booking.cancelledWorkerIds || "[]");
        } catch (e) {
          cancelledWorkerIds = [];
        }

        if (!cancelledWorkerIds.map(Number).includes(Number(finalWorkerId))) {
          cancelledWorkerIds.push(Number(finalWorkerId));
        }

        await tx.booking.update({
          where: { id: parseInt(bookingId) },
          data: {
            cancelledWorkerIds: JSON.stringify(cancelledWorkerIds),
          },
        });
      }

      // Whole booking cancel
      if (
        raisedBy === "CLIENT" &&
        shouldContinueWork === false &&
        finalRequestedAction === "CANCEL_BOOKING"
      ) {
        const allWorkerIds = booking.workers.map((worker) => Number(worker.id));

        await tx.booking.update({
          where: { id: parseInt(bookingId) },
          data: {
            status: "CANCELLED",
            cancelledWorkerIds: JSON.stringify(allWorkerIds),
          },
        });
      }

      return createdConflict;
    });

    // Worker ne duty cancel ki, to client ko notification bhejo
    if (
      raisedBy === "WORKER" &&
      shouldContinueWork === false &&
      finalRequestedAction === "CANCEL_DUTY" &&
      booking.customer?.pushToken &&
      cancelledWorkerInfo
    ) {
      await sendPushNotification(
        booking.customer.pushToken,
        "Worker Cancelled Duty ❌",
        `${cancelledWorkerInfo.workerName} ne duty cancel ki. Reason: ${reason}. Amount: ₹${cancelledWorkerInfo.amount}`,
        {
          action: "WORKER_CANCELLED_DUTY",
          bookingId: parseInt(bookingId),
          workerId: cancelledWorkerInfo.workerId,
          workerName: cancelledWorkerInfo.workerName,
          reason,
          amount: cancelledWorkerInfo.amount,
        }
      );
    }

    // Client ne worker ya poori booking cancel ki, to worker(s) ko notification bhejo
    if (
      raisedBy === "CLIENT" &&
      workersToNotify.length > 0 &&
      (
        finalRequestedAction === "CANCEL_WORKER" ||
        finalRequestedAction === "CANCEL_BOOKING"
      )
    ) {
      const workerAmount =
        booking.amount && booking.workerCount
          ? Math.round(Number(booking.amount) / Number(booking.workerCount))
          : 0;

      for (const worker of workersToNotify) {
        if (!worker.pushToken) continue;

        const title =
          finalRequestedAction === "CANCEL_BOOKING"
            ? "Booking Cancelled ❌"
            : "Your Duty Has Been Cancelled ❌";

        const body =
          finalRequestedAction === "CANCEL_BOOKING"
            ? `Customer ne poori booking cancel ki hai. Reason: ${reason}. Amount: ₹${workerAmount}`
            : `Customer ne aapki duty cancel ki hai. Reason: ${reason}. Amount: ₹${workerAmount}`;

        await sendPushNotification(worker.pushToken, title, body, {
          action:
            finalRequestedAction === "CANCEL_BOOKING"
              ? "BOOKING_CANCELLED_BY_CLIENT"
              : "WORKER_CANCELLED_BY_CLIENT",
          bookingId: parseInt(bookingId),
          workerId: worker.id,
          reason,
          amount: workerAmount,
        });
      }
    }

    return res.json({
      success: true,
      message: "Issue raised successfully.",
      conflict,
      cancelledWorkerInfo,
      assignedMitraId: mitraId,
    });
  } catch (error) {
    console.error("Create Conflict Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating conflict.",
      error: error.message,
    });
  }
};

module.exports = {
  createConflict,
};
