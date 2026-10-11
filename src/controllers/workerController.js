// src/controllers/workerController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { getActivePoolContext } = require('../utils/bookingSettings');
const { getActiveBookingMaps, workerStatus } = require('../services/adminPresenceService');
const { parseDobInput, formatDobInput } = require('../utils/workerDob');

const listWorkers = async (req, res) => {
    try {
        const [workers, activeBookings] = await Promise.all([
            prisma.worker.findMany({
                include: {
                    nakas: true,
                    skills: true,
                    mitra: { select: { id: true, name: true, phone: true } },
                },
                orderBy: { id: "desc" },
            }),
            getActiveBookingMaps(prisma),
        ]);
        const now = new Date();

        const workerIds = workers.map((worker) => worker.id);

        const ratingGroups = workerIds.length
            ? await prisma.rating.groupBy({
                  by: ["workerId"],
                  where: {
                      workerId: {
                          in: workerIds,
                      },
                  },
                  _avg: {
                      mehnat: true,
                      vyavhaar: true,
                  },
                  _count: {
                      _all: true,
                  },
              })
            : [];

        const ratingMap = new Map();

        ratingGroups.forEach((item) => {
            const mehnatRating = Number(item._avg.mehnat || 0);
            const vyavhaarRating = Number(item._avg.vyavhaar || 0);
            const averageRating = (mehnatRating + vyavhaarRating) / 2;

            ratingMap.set(item.workerId, {
                averageRating: Number(averageRating.toFixed(1)),
                ratingCount: Number(item._count._all || 0),
                mehnatRating: Number(mehnatRating.toFixed(1)),
                vyavhaarRating: Number(vyavhaarRating.toFixed(1)),
                isDefaultRating: false,
            });
        });

        const workersWithRatings = workers.map((worker) => ({
            ...worker,
            operationalStatus: workerStatus(worker, activeBookings.byWorker.get(worker.id), now),
            rating: ratingMap.get(worker.id) || {
                averageRating: Number(worker.baseRating || 3),
                ratingCount: 0,
                mehnatRating: Number(worker.baseRating || 3),
                vyavhaarRating: Number(worker.baseRating || 3),
                isDefaultRating: true,
            },
        }));

        res.render("admin/workers/index", {
            workers: workersWithRatings,
        });
    } catch (error) {
        console.error("Admin Worker List Error:", error);
        res.status(500).send("Server Error");
    }
};

const showForm = async (req, res) => {
    try {
        const skills = await prisma.skill.findMany({ where: { isActive: true } });
        let worker = { isActive: true, nakas: [], skills: [] };
        let isEdit = false;
        
        if (req.params.id) {
            worker = await prisma.worker.findUnique({ 
                where: { id: parseInt(req.params.id) },
                include: { nakas: true, skills: true }
            });
            isEdit = true;
        }
        res.render('admin/workers/form', { worker, skills, isEdit, error: null, formatDobInput });
    } catch (error) {
        res.redirect('/admin/workers');
    }
};
// src/controllers/workerController.js

const saveWorker = async (req, res) => {
    // 1. Add phone, email, and password to the destructured body
    const { 
        id, name, phone, email, password, dob, age, qualification, idProofType, idNumber, 
        address, pincode, bankDetails, upiId, upiNumber,
        nakaIds, skillIds 
    } = req.body;
    
    const isActive = req.body.isActive === 'on';

    try {
        const selectedNakas = [].concat(nakaIds || []).filter(id => id).map(nid => ({ id: parseInt(nid) }));
        const selectedSkills = [].concat(skillIds || []).filter(id => id).map(sid => ({ id: parseInt(sid) }));

        // 2. Add phone and email to workerData
        const workerData = {
            name,
            phone,
            email: email ? email.trim() : null, // Store null if left blank
            dob: parseDobInput(dob),
            age: parseInt(age, 10),
            qualification,
            idProofType,
            idNumber,
            address,
            pincode,
            bankDetails,
            upiId,
            upiNumber,
            isActive
        };

        if (!workerData.dob || !Number.isInteger(workerData.age) || workerData.age < 0) {
            const validationError = new Error("Please enter a valid Date of Birth.");
            validationError.isInputError = true;
            throw validationError;
        }

        // 3. Encrypt the password if one was provided
        if (password) {
            workerData.password = await bcrypt.hash(password, 10);
        }

        // Handle uploaded files
        if (req.files && req.files['photoUrl']) {
            workerData.photoUrl = '/uploads/photos/' + req.files['photoUrl'][0].filename;
        }
        if (req.files && req.files['consentVoiceUrl']) {
            workerData.consentVoiceUrl = '/uploads/voice/' + req.files['consentVoiceUrl'][0].filename;
        }

        if (id) {
            await prisma.worker.update({ 
                where: { id: parseInt(id) }, 
                data: { ...workerData, nakas: { set: selectedNakas }, skills: { set: selectedSkills } } 
            });
        } else {
            await prisma.worker.create({
                data: {
                    ...workerData,
                    baseRating: 3,
                    nakas: { connect: selectedNakas },
                    skills: { connect: selectedSkills },
                },
            });
        }
        
        res.redirect('/admin/workers');
    } catch (error) {
        console.error(error);
        if (error.isInputError || error.code === 'P2002') {
            const skills = await prisma.skill.findMany({ where: { isActive: true } });
            const target = String(error.meta?.target || "");
            let errorMsg = error.message;
            if (error.code === 'P2002') {
                errorMsg = target.includes('phone') ? "This Phone Number is already registered!"
                    : target.includes('email') ? "This Email ID is already registered!"
                    : "A worker with this ID Number already exists!";
            }
            // Keep checkbox relations available on validation errors, including
            // on new worker forms and when editing an existing DOB string.
            const oldWorker = id ? await prisma.worker.findUnique({
                where: { id: Number(id) }, include: { nakas: true, skills: true },
            }) : null;
            const selectedIds = (value) => [].concat(value || []).map(Number);
            const worker = {
                ...(oldWorker || {}), ...req.body,
                isActive,
                nakas: oldWorker?.nakas || [],
                skills: skills.filter((skill) => selectedIds(skillIds).includes(skill.id)),
            };
            return res.status(400).render('admin/workers/form', {
                worker, skills, isEdit: !!id, error: errorMsg, formatDobInput,
            });
        }
        res.redirect('/admin/workers');
    }
};
// src/controllers/workerController.js

const loginWorker = async (req, res) => {
    // We expect 'loginId' from the app, which could be a phone OR email
    const { loginId, password } = req.body; 
    console.log("Login Attempt:", loginId,password); // Log the login ID for debugging
    
    try {
        // Find worker by matching either phone or email
        const worker = await prisma.worker.findFirst({ 
            where: { 
                OR: [
                    { phone: loginId },
                    { email: loginId }
                ]
            } 
        });
        console.log("worker found:", worker); // Log the worker object for debugging
        if (!worker) {
            return res.status(401).json({ success: false, message: "Invalid ID or password." });
        }

        const isMatch = await bcrypt.compare(password, worker.password);
        console.log("Password match:", isMatch); // Log the password match result for debugging
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid ID or password." });
        }

        console.log("Login successful for worker:", worker.id); // Log successful login

        res.json({ 
            success: true, 
            worker: { id: worker.id, name: worker.name, phone: worker.phone } 
        });

    } catch (error) {
        console.error("Login API Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const getWorkerProfile = async (req, res) => {
    try {
        const workerId = parseInt(req.params.id, 10);

        if (!Number.isInteger(workerId) || workerId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid worker ID required",
            });
        }

        // Mobile profile ko sirf display-safe fields return karo. Password aur
        // authentication-sensitive values API response me expose nahi hote.
        const worker = await prisma.worker.findUnique({
            where: { id: workerId },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                photoUrl: true,
                dob: true,
                age: true,
                qualification: true,
                address: true,
                pincode: true,
                gender: true,
                idProofType: true,
                idNumber: true,
                isActive: true,
                baseRating: true,
                nakas: {
                    select: {
                        id: true,
                        name: true,
                        pincode: true,
                    },
                    orderBy: { name: "asc" },
                },
                skills: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                    },
                    orderBy: { name: "asc" },
                },
                mitra: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                    },
                },
            },
        });

        if (!worker) {
            return res.status(404).json({ success: false, message: "Worker not found" });
        }

        return res.json({ success: true, worker });
    } catch (error) {
        console.error("Worker Profile Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Don't forget to export it!


const deleteWorker = async (req, res) => {
    try {
        await prisma.worker.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/workers');
    } catch (error) {
        res.redirect('/admin/workers');
    }
};

const getRemainingSeconds = (untilDate) => {
    if (!untilDate) return 0;

    const diff = new Date(untilDate).getTime() - new Date().getTime();
    return Math.max(0, Math.floor(diff / 1000));
};

const getElapsedSeconds = (startDate) => {
    if (!startDate) return 0;

    const diff = new Date().getTime() - new Date(startDate).getTime();
    return Math.max(0, Math.floor(diff / 1000));
};

const updateStatus = async (req, res) => {
    const {
        workerId,
        status,
        availabilityType = "FULL_DAY",
        availabilityHours,
    } = req.body;

    try {
        if (!workerId) {
            return res.status(400).json({
                success: false,
                message: "workerId required",
            });
        }

        const workerIdNumber = parseInt(workerId);

        // OFFLINE
        if (status === false || status === "false") {
            await prisma.worker.update({
                where: { id: workerIdNumber },
                data: {
                    isAvailable: false,
                    availabilityType: null,
                    availabilityStart: null,
                    availabilityHours: null,
                    availabilityUntil: null,
                    availabilityPoolSlotId: null,
                    lastActive: new Date(),
                },
            });

            return res.json({
                success: true,
                message: "Aap Offline hain!",
            });
        }

        // Starting availability is idempotent. If the worker is already in an
        // active pool, preserve the original start time instead of resetting
        // the elapsed timer when the app retries the request.
        const existingWorker = await prisma.worker.findUnique({
            where: { id: workerIdNumber },
            select: {
                isAvailable: true,
                availabilityType: true,
                availabilityStart: true,
                availabilityHours: true,
                availabilityUntil: true,
                availabilityPoolSlotId: true,
                availabilityPoolSlot: {
                    select: { id: true, startTime: true, sortOrder: true },
                },
            },
        });

        if (!existingWorker) {
            return res.status(404).json({
                success: false,
                message: "Worker not found",
            });
        }

        if (
            existingWorker.isAvailable &&
            existingWorker.availabilityStart &&
            existingWorker.availabilityUntil &&
            existingWorker.availabilityPoolSlotId &&
            new Date(existingWorker.availabilityUntil) > new Date()
        ) {
            return res.json({
                success: true,
                message: "Aap pehle se pool mein available hain!",
                pool: {
                    ...existingWorker,
                    elapsedSeconds: getElapsedSeconds(existingWorker.availabilityStart),
                    remainingSeconds: getRemainingSeconds(existingWorker.availabilityUntil),
                    poolNumber: existingWorker.availabilityPoolSlot
                        ? Number(existingWorker.availabilityPoolSlot.sortOrder || 0) + 1
                        : null,
                    poolStartTime: existingWorker.availabilityPoolSlot?.startTime || null,
                    serverTime: new Date().toISOString(),
                },
            });
        }

        const poolContext = await getActivePoolContext(prisma, new Date());
        const { poolEnd, now, activeSlot } = poolContext;

        let finalAvailabilityType = availabilityType || "FULL_DAY";
        let finalAvailabilityHours = null;
        let availabilityUntil = poolEnd;

        // Full Day and 2/3/4 Hours Work both use the Admin-managed daily
        // pool end. 2/3/4 hours is job-duration preference, not online expiry.
        if (!poolContext.isOpen || !activeSlot) {
    await prisma.worker.update({
        where: { id: workerIdNumber },
        data: {
            isAvailable: false,
            availabilityType: null,
            availabilityStart: null,
            availabilityHours: null,
            availabilityUntil: null,
            availabilityPoolSlotId: null,
            lastActive: new Date(),
        },
    });

    return res.status(400).json({
        success: false,
        message: now < poolContext.poolStart
            ? `Worker pool starts at ${poolContext.setting.poolDayStart}.`
            : `Today's worker pool ended at ${poolContext.setting.poolDayEnd}.`,
        code: "POOL_CLOSED",
    });
}

        // FULL DAY
        if (finalAvailabilityType === "FULL_DAY") {
            availabilityUntil = poolEnd;
            finalAvailabilityHours = null;
        }

        // SHORT WORK DURATION
        // 2/3/4 Hours means the committed duration of a job, not the time
        // the worker remains visible in the pool. The pool stays active until
        // the configured pool end, exactly like Full Day.
        else if (finalAvailabilityType === "SHORT_PERIOD") {
            finalAvailabilityHours = parseInt(availabilityHours);

            if (!finalAvailabilityHours || finalAvailabilityHours <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Please select valid work hours.",
                });
            }

            availabilityUntil = poolEnd;
        }

        else {
            return res.status(400).json({
                success: false,
                message: "Invalid availability type.",
            });
        }

        const updatedWorker = await prisma.worker.update({
            where: { id: workerIdNumber },
            data: {
                isAvailable: true,
                availabilityType: finalAvailabilityType,
                availabilityStart: now,
                availabilityHours: finalAvailabilityHours,
                availabilityUntil,
                availabilityPoolSlotId: activeSlot.id,
                lastActive: now,
            },
        });

        return res.json({
            success: true,
            message:
                finalAvailabilityType === "FULL_DAY"
                    ? "Aap Full Day work ke liye pool mein add ho gaye hain!"
                    : `Aap ${finalAvailabilityHours} Hours Work preference ke saath pool mein add ho gaye hain!`,
            pool: {
                isAvailable: updatedWorker.isAvailable,
                availabilityType: updatedWorker.availabilityType,
                availabilityStart: updatedWorker.availabilityStart,
                availabilityHours: updatedWorker.availabilityHours,
                availabilityUntil: updatedWorker.availabilityUntil,
                poolNumber: Number(activeSlot.sortOrder || 0) + 1,
                poolStartTime: activeSlot.startTime,
                elapsedSeconds: getElapsedSeconds(updatedWorker.availabilityStart),
                remainingSeconds: getRemainingSeconds(updatedWorker.availabilityUntil),
                serverTime: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({
            success: false,
            error: "Status update nahi ho paya",
        });
    }
};

const getPoolStatus = async (req, res) => {
    try {
        const { workerId } = req.params;

        const worker = await prisma.worker.findUnique({
            where: { id: parseInt(workerId) },
            select: {
                id: true,
                isAvailable: true,
                availabilityType: true,
                availabilityStart: true,
                availabilityHours: true,
                availabilityUntil: true,
                availabilityPoolSlotId: true,
                availabilityPoolSlot: {
                    select: { id: true, startTime: true, sortOrder: true },
                },
            },
        });

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: "Worker not found",
            });
        }

        const now = new Date();

        if (
            worker.isAvailable &&
            worker.availabilityUntil &&
            new Date(worker.availabilityUntil) <= now
        ) {
            await prisma.worker.update({
                where: { id: parseInt(workerId) },
                data: {
                    isAvailable: false,
                    availabilityType: null,
                    availabilityStart: null,
                    availabilityHours: null,
                    availabilityUntil: null,
                    availabilityPoolSlotId: null,
                    lastActive: now,
                },
            });

            return res.json({
                success: false,
                message: "Pool time ended. Worker is now offline.",
                code: "POOL_ENDED",
                isAvailable: false,
                remainingSeconds: 0,
            });
        }

        return res.json({
            success: true,
            isAvailable: worker.isAvailable,
            availabilityType: worker.availabilityType,
            availabilityStart: worker.availabilityStart,
            availabilityHours: worker.availabilityHours,
            availabilityUntil: worker.availabilityUntil,
            poolNumber: worker.availabilityPoolSlot
                ? Number(worker.availabilityPoolSlot.sortOrder || 0) + 1
                : null,
            poolStartTime: worker.availabilityPoolSlot?.startTime || null,
            elapsedSeconds: getElapsedSeconds(worker.availabilityStart),
            remainingSeconds: getRemainingSeconds(worker.availabilityUntil),
            serverTime: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Pool status error:", error);
        res.status(500).json({
            success: false,
            message: "Pool status fetch nahi ho paya",
        });
    }
};

const savePushToken = async (req, res) => {
    const { workerId, pushToken } = req.body;

    try {
        await prisma.worker.update({
            where: { id: parseInt(workerId) },
            data: { pushToken: pushToken }
        });
        
        console.log(`Worker ${workerId} ka Push Token save ho gaya!`);
        res.json({ success: true, message: "Token saved in Database!" });
    } catch (error) {
        console.error("Token save karne me error:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
};


const IST_OFFSET_MS = 330 * 60 * 1000;

const getCurrentWeekRange = () => {
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const weekday = istNow.getUTCDay();
    const daysFromMonday = (weekday + 6) % 7;

    const startUtcMs = Date.UTC(
        istNow.getUTCFullYear(),
        istNow.getUTCMonth(),
        istNow.getUTCDate() - daysFromMonday,
        0,
        0,
        0,
        0
    ) - IST_OFFSET_MS;

    const start = new Date(startUtcMs);
    const end = new Date(startUtcMs + 7 * 24 * 60 * 60 * 1000);

    return { start, end };
};

const getWalletDateRange = (fromValue = null, toValue = null) => {
    if (!fromValue && !toValue) {
        return getCurrentWeekRange();
    }

    const defaultRange = getCurrentWeekRange();
    const start = fromValue ? new Date(fromValue) : defaultRange.start;
    const end = toValue ? new Date(toValue) : new Date();

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        const error = new Error("Invalid wallet date range");
        error.code = "INVALID_WALLET_DATE_RANGE";
        throw error;
    }

    if (start >= end) {
        const error = new Error("Wallet 'from' date must be before 'to' date");
        error.code = "INVALID_WALLET_DATE_RANGE";
        throw error;
    }

    return { start, end };
};

const parseCancelledWorkerIds = (value) => {
    try {
        return JSON.parse(value || "[]").map(Number);
    } catch (error) {
        return [];
    }
};

const buildWorkerWalletSummary = async (workerId, start, end) => {
    const [completedBookings, finalizedPenalties] = await Promise.all([
        prisma.booking.findMany({
            where: {
                status: "COMPLETED",
                updatedAt: { gte: start, lt: end },
                workers: { some: { id: workerId } },
            },
            select: {
                id: true,
                amount: true,
                workerCount: true,
                cancelledWorkerIds: true,
                updatedAt: true,
                customer: {
                    select: { name: true },
                },
            },
            orderBy: { updatedAt: "desc" },
        }),
        prisma.conflict.findMany({
            where: {
                workerId,
                raisedByType: "WORKER",
                requestedAction: "CANCEL_DUTY",
                status: "SOLVED",
                updatedAt: { gte: start, lt: end },
            },
            select: {
                id: true,
                bookingId: true,
                penaltyAmount: true,
                reason: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
        }),
    ]);

    const earningTransactions = completedBookings
        .filter(
            (booking) =>
                !parseCancelledWorkerIds(booking.cancelledWorkerIds).includes(workerId)
        )
        .map((booking) => {
            const bookingAmount = Number(booking.amount || 0);
            const workerCount = Number(booking.workerCount || 1);
            const workerShare =
                workerCount > 0
                    ? Math.round(bookingAmount / workerCount)
                    : bookingAmount;

            return {
                id: `booking-${booking.id}`,
                sourceId: booking.id,
                type: "EARNING",
                amount: workerShare,
                title: `Booking #${booking.id}`,
                description: booking.customer?.name
                    ? `Completed job · ${booking.customer.name}`
                    : "Completed job",
                occurredAt: booking.updatedAt,
                bookingId: booking.id,
                conflictId: null,
            };
        });

    const deductionTransactions = finalizedPenalties.map((conflict) => ({
        id: `conflict-${conflict.id}`,
        sourceId: conflict.id,
        type: "DEDUCTION",
        amount: Number(conflict.penaltyAmount || 0),
        title: `Penalty · Booking #${conflict.bookingId}`,
        description: conflict.reason || "Mitra finalized cancellation penalty",
        occurredAt: conflict.updatedAt,
        bookingId: conflict.bookingId,
        conflictId: conflict.id,
    }));

    const grossEarning = earningTransactions.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
    );
    const totalDeductions = deductionTransactions.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
    );

    return {
        grossEarning,
        totalDeductions,
        balance: grossEarning - totalDeductions,
        transactions: [...earningTransactions, ...deductionTransactions].sort(
            (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
        ),
    };
};

const getWorkerWallet = async (req, res) => {
    try {
        const workerId = parseInt(req.params.workerId, 10);
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const requestedLimit = parseInt(req.query.limit, 10) || 5;
        const limit = Math.min(25, Math.max(1, requestedLimit));

        if (!Number.isInteger(workerId) || workerId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid worker ID required",
            });
        }

        const workerExists = await prisma.worker.findUnique({
            where: { id: workerId },
            select: { id: true },
        });

        if (!workerExists) {
            return res.status(404).json({
                success: false,
                message: "Worker not found",
            });
        }

        const { start, end } = getWalletDateRange(req.query.from, req.query.to);
        const wallet = await buildWorkerWalletSummary(workerId, start, end);

        const totalTransactions = wallet.transactions.length;
        const offset = (page - 1) * limit;
        const transactions = wallet.transactions.slice(offset, offset + limit);
        const hasMore = offset + transactions.length < totalTransactions;

        return res.json({
            success: true,
            summary: {
                balance: wallet.balance,
                grossEarning: wallet.grossEarning,
                totalDeductions: wallet.totalDeductions,
                from: start.toISOString(),
                to: end.toISOString(),
            },
            transactions,
            pagination: {
                page,
                limit,
                totalTransactions,
                hasMore,
                nextPage: hasMore ? page + 1 : null,
            },
        });
    } catch (error) {
        if (error.code === "INVALID_WALLET_DATE_RANGE") {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        console.error("Worker Wallet Error:", error);
        return res.status(500).json({
            success: false,
            message: "Wallet load nahi ho paya",
        });
    }
};

const getWorkerDashboard = async (req, res) => {
    try {
        const workerId = parseInt(req.params.workerId, 10);

        if (!Number.isInteger(workerId) || workerId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid worker ID required",
            });
        }

        // Keep the redesigned dashboard data (photo, rating and Nakas), while
        // restoring the reliable operational-state logic used by the worker flow.
        const worker = await prisma.worker.findUnique({
            where: { id: workerId },
            include: {
                nakas: {
                    select: { name: true },
                },
            },
        });

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: "Worker not found",
            });
        }

        const ratings = await prisma.workerClientRating.aggregate({
            where: { workerId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        const averageRating = ratings._avg.rating
            ? parseFloat(ratings._avg.rating.toFixed(1))
            : worker.baseRating;
        const ratingCount = ratings._count.rating;

        const now = new Date();
        let poolIsActive = Boolean(
            worker.isAvailable &&
            worker.availabilityUntil &&
            new Date(worker.availabilityUntil) > now
        );

        // Do not let an expired pool session keep the redesigned dashboard in
        // "Return to Work" mode after the worker is actually offline.
        if (worker.isAvailable && worker.availabilityUntil && !poolIsActive) {
            await prisma.worker.update({
                where: { id: workerId },
                data: {
                    isAvailable: false,
                    availabilityType: null,
                    availabilityStart: null,
                    availabilityHours: null,
                    availabilityUntil: null,
                    lastActive: now,
                },
            });
            poolIsActive = false;
        }

        // A booking relation remains in _BookingToWorker even after a worker
        // cancels that duty. Therefore we must not treat every ASSIGNED booking
        // relation as an active duty. Fetch the recent candidates, then exclude
        // bookings whose cancelledWorkerIds contains this worker.
        const activeDutyWhere = {
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
            workers: { some: { id: workerId } },
        };

        // When the worker joined a pool, only a booking created in the current
        // availability session can be the current duty. This also protects the
        // dashboard from old/stale ASSIGNED records.
        if (worker.availabilityStart) {
            activeDutyWhere.createdAt = { gte: worker.availabilityStart };
        }

        const activeCandidates = await prisma.booking.findMany({
            where: activeDutyWhere,
            select: {
                id: true,
                status: true,
                arrivedWorkerIds: true,
                cancelledWorkerIds: true,
                completedWorkerIds: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        const activeDuty =
            activeCandidates.find((booking) => {
                const cancelledIds = parseCancelledWorkerIds(
                    booking.cancelledWorkerIds
                );
                let completedIds = [];
                try {
                    completedIds = JSON.parse(
                        booking.completedWorkerIds || "[]"
                    ).map(Number);
                } catch (error) {
                    completedIds = [];
                }

                return (
                    !cancelledIds.includes(workerId) &&
                    !completedIds.includes(workerId)
                );
            }) || null;

        let operationalStatus = {
            type: "IDLE",
            label: "Not in pool",
            actionLabel: "Join Full Day Pool",
            bookingId: null,
            bookingStatus: null,
            returnScreen: null,
            availabilityType: null,
        };

        if (activeDuty) {
            let arrivedWorkerIds = [];
            try {
                arrivedWorkerIds = JSON.parse(
                    activeDuty.arrivedWorkerIds || "[]"
                ).map(Number);
            } catch (error) {
                arrivedWorkerIds = [];
            }

            const workerArrived = arrivedWorkerIds.includes(workerId);
            const inProgress =
                activeDuty.status === "IN_PROGRESS" || workerArrived;

            operationalStatus = {
                type: "BOOKING",
                label: inProgress ? "Work in progress" : "Booking assigned",
                actionLabel: "Return to Booking",
                bookingId: activeDuty.id,
                bookingStatus: activeDuty.status,
                returnScreen: inProgress
                    ? "duty-in-progress"
                    : "active-duty",
                availabilityType: null,
            };
        } else if (poolIsActive) {
            operationalStatus = {
                type: "POOL",
                label:
                    worker.availabilityType === "SHORT_PERIOD"
                        ? `In pool · ${worker.availabilityHours || "Short"} Hours Work`
                        : "Waiting for work",
                actionLabel: "Return to Pool",
                bookingId: null,
                bookingStatus: null,
                returnScreen: "available",
                availabilityType: worker.availabilityType,
            };
        }

        return res.status(200).json({
            success: true,
            data: {
                id: worker.id,
                name: worker.name,
                photoUrl: worker.photoUrl,
                baseRating: worker.baseRating,
                rating: {
                    averageRating,
                    ratingCount,
                },
                nakas: worker.nakas,
                operationalStatus,
            },
        });
    } catch (error) {
        console.error("Error fetching worker dashboard:", error);
        return res.status(500).json({
            success: false,
            message: "Server se data load nahi ho paya.",
        });
    }
};

// --------------------------------------------------
// Mitra Worker Onboarding: Shared Create + Edit helpers
// --------------------------------------------------

const NAKA_VERIFIED_STATUS = "VERIFIED";

const getNakaVerificationCutoff = (referenceDate = new Date()) => {
    const cutoff = new Date(referenceDate);
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff;
};

const getOperationalMitraNakaWhere = (mitraId, pincode = null) => {
    const where = {
        verificationStatus: NAKA_VERIFIED_STATUS,
        lastVerifiedAt: {
            gte: getNakaVerificationCutoff(),
        },
        mitras: {
            some: {
                id: mitraId,
            },
        },
    };

    if (pincode) {
        where.pincode = pincode;
    }

    return where;
};

/**
 * GET /mitra/api/nakas/search?pincode=421202
 * Returns the latest operational Nakas assigned to the logged-in Mitra.
 * This avoids stale Naka cards in an already-open Worker Onboarding page.
 */
const searchMitraNakasByPincode = async (req, res) => {
    try {
        const mitraId = Number(req.user?.id);
        const pincode = String(req.query.pincode || "").replace(/\D/g, "");

        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return res.status(401).json({
                success: false,
                message: "Mitra session was not found. Please login again.",
            });
        }

        if (!/^\d{6}$/.test(pincode)) {
            return res.status(422).json({
                success: false,
                message: "Please enter a valid 6-digit pincode.",
                nakas: [],
            });
        }

        const nakas = await prisma.naka.findMany({
            where: getOperationalMitraNakaWhere(mitraId, pincode),
            select: {
                id: true,
                name: true,
                pincode: true,
                city: {
                    select: {
                        name: true,
                        state: {
                            select: {
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        return res.json({
            success: true,
            nakas: nakas.map((naka) => ({
                id: naka.id,
                name: naka.name,
                pincode: naka.pincode,
                cityName: naka.city?.name || null,
                stateName: naka.city?.state?.name || null,
                stateCode: naka.city?.state?.code || null,
            })),
        });
    } catch (error) {
        console.error("Live Mitra Naka Search Error:", error);

        return res.status(500).json({
            success: false,
            message: "Nakas could not be loaded right now. Please try again.",
            nakas: [],
        });
    }
};
const getMitraWorkerFormData = async (mitraId) => {
    const [skills, mitra] = await Promise.all([
        prisma.skill.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        }),
        prisma.mitra.findUnique({
            where: { id: mitraId },
            include: {
                nakas: {
                    orderBy: { name: "asc" },
                },
            },
        }),
    ]);

    if (!mitra) {
        throw new Error("Mitra account was not found.");
    }

    return {
        skills,
        nakas: mitra.nakas || [],
    };
};

const toWorkerDobInput = (value) => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);
};

const getUniqueFieldMessage = (error) => {
    const target = Array.isArray(error?.meta?.target)
        ? error.meta.target.join(", ")
        : String(error?.meta?.target || "");

    if (target.includes("phone")) {
        return "This mobile number is already registered.";
    }

    if (target.includes("email")) {
        return "This email address is already registered.";
    }

    if (target.includes("aadhaarNumber")) {
        return "This Aadhaar number is already registered.";
    }

    if (target.includes("panNumber")) {
        return "This PAN number is already registered.";
    }

    if (target.includes("otherIdNumber")) {
        return "This ID proof number is already registered.";
    }

    if (target.includes("idNumber")) {
        return "This ID proof number is already registered.";
    }

    return "A worker with these details is already registered.";
};

const normalizeMitraWorkerData = async ({
    body,
    uploadedFile,
    mitraId,
    editingWorkerId = null,
}) => {
    const {
        name,
        phone,
        email,
        password,
        dob,
        qualification,
        idProofType,
        idNumber,
        address,
        pincode,
        gender,
        heightCm,
        weightKg,
        bankDetails,
        upiId,
        upiNumber,
        skillIds,
        nakaIds,
    } = body;

    const isEditMode = Number.isInteger(editingWorkerId) && editingWorkerId > 0;

    const cleanText = (value) => String(value || "").trim();
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanEmail = cleanText(email).toLowerCase() || null;
    const cleanPincode = String(pincode || "").replace(/\D/g, "");

    // --------------------------------------------------
    // 1. Required fields
    // --------------------------------------------------
    if (cleanText(name).length < 2) {
        throw new Error("Worker name must contain at least 2 characters.");
    }

    if (!cleanPhone) {
        throw new Error("Mobile number is required.");
    }

    if (!isEditMode && !cleanText(password)) {
        throw new Error("Password is required for a new worker.");
    }

    if (!cleanText(dob)) {
        throw new Error("Date of birth is required.");
    }

    if (!cleanText(gender)) {
        throw new Error("Gender is required.");
    }

    if (!cleanText(idProofType)) {
        throw new Error("Please select an ID proof type.");
    }

    if (!cleanText(idNumber)) {
        throw new Error("ID proof number is required.");
    }

    if (!cleanText(address)) {
        throw new Error("Address is required.");
    }

    if (!cleanPincode) {
        throw new Error("Pincode is required.");
    }

    if (heightCm === undefined || heightCm === null || cleanText(heightCm) === "") {
        throw new Error("Height is required.");
    }

    if (weightKg === undefined || weightKg === null || cleanText(weightKg) === "") {
        throw new Error("Weight is required.");
    }

    // --------------------------------------------------
    // 2. Basic format validation
    // --------------------------------------------------
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error("Please enter a valid email address.");
    }

    if (!/^\d{6}$/.test(cleanPincode)) {
        throw new Error("Pincode must contain exactly 6 digits.");
    }

    if (!isEditMode && cleanText(password).length < 6) {
        throw new Error("Password must contain at least 6 characters.");
    }

    if (isEditMode && cleanText(password) && cleanText(password).length < 6) {
        throw new Error("New password must contain at least 6 characters.");
    }

    // --------------------------------------------------
    // 3. DOB and age
    // --------------------------------------------------
    const dobDate = new Date(`${cleanText(dob)}T00:00:00`);

    if (Number.isNaN(dobDate.getTime())) {
        throw new Error("Please enter a valid date of birth.");
    }

    const today = new Date();
    const todayDateOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    if (dobDate >= todayDateOnly) {
        throw new Error("Date of birth must be earlier than today.");
    }

    let calculatedAge = todayDateOnly.getFullYear() - dobDate.getFullYear();
    const monthDifference = todayDateOnly.getMonth() - dobDate.getMonth();

    if (
        monthDifference < 0 ||
        (monthDifference === 0 && todayDateOnly.getDate() < dobDate.getDate())
    ) {
        calculatedAge--;
    }

    if (calculatedAge < 18 || calculatedAge > 100) {
        throw new Error("Worker age must be between 18 and 100 years.");
    }

    // --------------------------------------------------
    // 4. Gender, height, weight and BMI
    // --------------------------------------------------
    const cleanGender = cleanText(gender).toUpperCase();
    const allowedGenders = ["MALE", "FEMALE", "OTHER"];

    if (!allowedGenders.includes(cleanGender)) {
        throw new Error("Please select a valid gender: Male, Female or Other.");
    }

    const parsedHeightCm = Number(heightCm);
    const parsedWeightKg = Number(weightKg);

    if (
        !Number.isFinite(parsedHeightCm) ||
        parsedHeightCm < 80 ||
        parsedHeightCm > 250
    ) {
        throw new Error("Height must be between 80 cm and 250 cm.");
    }

    if (
        !Number.isFinite(parsedWeightKg) ||
        parsedWeightKg < 20 ||
        parsedWeightKg > 300
    ) {
        throw new Error("Weight must be between 20 kg and 300 kg.");
    }

    const heightInMeters = parsedHeightCm / 100;
    const calculatedBmi = Math.round(
        (parsedWeightKg / (heightInMeters * heightInMeters)) * 10
    ) / 10;

    // --------------------------------------------------
    // 5. ID proof validation
    // --------------------------------------------------
    const selectedProofType = cleanText(idProofType).toUpperCase();
    const allowedProofTypes = ["AADHAR", "AADHAAR", "PAN", "VOTING", "DRIVING"];

    if (!allowedProofTypes.includes(selectedProofType)) {
        throw new Error("Please select a valid ID proof type.");
    }

    let finalProofType = selectedProofType;
    let cleanIdNumber = "";
    let aadhaarNumber = null;
    let panNumber = null;
    let otherIdNumber = null;

    if (selectedProofType === "AADHAR" || selectedProofType === "AADHAAR") {
        finalProofType = "AADHAR";
        cleanIdNumber = String(idNumber).replace(/\D/g, "");

        if (!/^\d{12}$/.test(cleanIdNumber)) {
            throw new Error("Aadhaar number must contain exactly 12 digits.");
        }

        aadhaarNumber = cleanIdNumber;
    } else if (selectedProofType === "PAN") {
        cleanIdNumber = cleanText(idNumber)
            .toUpperCase()
            .replace(/\s+/g, "");

        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanIdNumber)) {
            throw new Error("PAN format is invalid. Example: ABCDE1234F");
        }

        panNumber = cleanIdNumber;
    } else {
        cleanIdNumber = cleanText(idNumber)
            .toUpperCase()
            .replace(/\s+/g, "");

        if (cleanIdNumber.length < 5 || cleanIdNumber.length > 30) {
            throw new Error("Please enter a valid ID proof number.");
        }

        otherIdNumber = cleanIdNumber;
    }

    const excludeCurrentWorker = isEditMode
        ? { id: { not: editingWorkerId } }
        : {};

    const existingProof = await prisma.worker.findFirst({
        where: {
            ...excludeCurrentWorker,
            OR: [
                { idNumber: cleanIdNumber },
                ...(aadhaarNumber ? [{ aadhaarNumber }] : []),
                ...(panNumber ? [{ panNumber }] : []),
                ...(otherIdNumber ? [{ otherIdNumber }] : []),
            ],
        },
        select: { id: true },
    });

    if (existingProof) {
        if (aadhaarNumber) {
            throw new Error("This Aadhaar number is already registered.");
        }

        if (panNumber) {
            throw new Error("This PAN number is already registered.");
        }

        throw new Error("This ID proof number is already registered.");
    }

    // --------------------------------------------------
    // 6. Phone/email duplicate check
    // --------------------------------------------------
    const existingPhone = await prisma.worker.findFirst({
        where: {
            ...excludeCurrentWorker,
            phone: cleanPhone,
        },
        select: { id: true },
    });

    if (existingPhone) {
        throw new Error("This mobile number is already registered.");
    }

    if (cleanEmail) {
        const existingEmail = await prisma.worker.findFirst({
            where: {
                ...excludeCurrentWorker,
                email: cleanEmail,
            },
            select: { id: true },
        });

        if (existingEmail) {
            throw new Error("This email address is already registered.");
        }
    }

    // --------------------------------------------------
    // 7. Skills + Nakas validation
    // --------------------------------------------------
    const rawSkillIds = Array.isArray(skillIds)
        ? skillIds
        : skillIds
          ? [skillIds]
          : [];

    const rawNakaIds = Array.isArray(nakaIds)
        ? nakaIds
        : nakaIds
          ? [nakaIds]
          : [];

    const selectedSkillIds = [...new Set(
        rawSkillIds
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    const selectedNakaIds = [...new Set(
        rawNakaIds
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (selectedSkillIds.length === 0) {
        throw new Error("Please select at least one skill.");
    }

    if (selectedNakaIds.length === 0) {
        throw new Error("Please select at least one Naka.");
    }

    const [activeSkills, mitra] = await Promise.all([
        prisma.skill.findMany({
            where: {
                id: { in: selectedSkillIds },
                isActive: true,
            },
            select: { id: true },
        }),
        prisma.mitra.findUnique({
            where: { id: mitraId },
            select: { id: true },
        }),
    ]);

    if (activeSkills.length !== selectedSkillIds.length) {
        throw new Error("One or more selected skills are invalid or inactive.");
    }

    if (!mitra) {
        throw new Error("Mitra account was not found.");
    }

    // During edit, previously assigned Nakas remain valid for a profile/video
    // update, even if their verification has expired since registration.
    // Only NEW Naka connections must pass the current operational checks.
    let previouslyAssignedNakaIds = new Set();
    if (isEditMode) {
        const editedWorker = await prisma.worker.findFirst({
            where: { id: editingWorkerId, mitraId },
            select: { nakas: { select: { id: true } } },
        });
        if (!editedWorker) {
            throw new Error("Worker not found or access denied.");
        }
        previouslyAssignedNakaIds = new Set(editedWorker.nakas.map((naka) => naka.id));
    }

    const newlySelectedNakaIds = selectedNakaIds.filter(
        (id) => !previouslyAssignedNakaIds.has(id)
    );
    const operationalNakas = newlySelectedNakaIds.length
        ? await prisma.naka.findMany({
            where: {
                id: { in: newlySelectedNakaIds },
                ...getOperationalMitraNakaWhere(mitraId),
            },
            select: { id: true },
        })
        : [];

    if (operationalNakas.length !== newlySelectedNakaIds.length) {
        throw new Error(
            "Newly selected Nakas must be assigned to your Mitra account and currently verified. Existing worker Nakas are preserved during profile edits."
        );
    }

    const workerData = {
        name: cleanText(name),
        phone: cleanPhone,
        email: cleanEmail,

        dob: dobDate,
        age: calculatedAge,
        qualification: cleanText(qualification) || null,

        idProofType: finalProofType,
        idNumber: cleanIdNumber,

        // Current UI allows one proof at a time. The selected proof is
        // stored separately and old selection fields are cleared.
        aadhaarNumber,
        panNumber,
        otherIdNumber,

        address: cleanText(address),
        pincode: cleanPincode,

        gender: cleanGender,
        heightCm: parsedHeightCm,
        weightKg: parsedWeightKg,
        bmi: calculatedBmi,

        bankDetails: cleanText(bankDetails) || null,
        upiId: cleanText(upiId) || null,
        upiNumber: cleanText(upiNumber) || null,
    };

    if (uploadedFile) {
        workerData.consentVoiceUrl = `/uploads/consents/${uploadedFile.filename}`;
    }

    if (cleanText(password)) {
        workerData.password = await bcrypt.hash(cleanText(password), 10);
    }

    return {
        workerData,
        selectedSkillIds,
        selectedNakaIds,
    };
};

const showMitraAddForm = async (req, res) => {
    try {
        const { skills, nakas } = await getMitraWorkerFormData(req.user.id);

        return res.render("mitra/add-worker", {
            layout: false,
            skills,
            nakas,

            worker: null,
            workerDob: "",
            isEdit: false,

            error: req.query.error || null,
            success_msg: req.query.success || null,
            error_msg: req.query.error || null,
        });
    } catch (error) {
        console.error("Show Add Worker Form Error:", error);

        return res.redirect(
            "/mitra/dashboard?error=" +
            encodeURIComponent("Unable to open worker onboarding form.")
        );
    }
};

const showMitraEditForm = async (req, res) => {
    const workerId = Number(req.params.id);

    if (!Number.isInteger(workerId) || workerId <= 0) {
        return res.redirect(
            "/mitra/workers?error=" +
            encodeURIComponent("Invalid worker selected.")
        );
    }

    try {
        const [formData, worker] = await Promise.all([
            getMitraWorkerFormData(req.user.id),
            prisma.worker.findFirst({
                where: {
                    id: workerId,
                    mitraId: req.user.id,
                },
                include: {
                    skills: {
                        select: { id: true, name: true },
                    },
                    nakas: {
                        select: { id: true, name: true, pincode: true },
                    },
                },
            }),
        ]);

        if (!worker) {
            return res.redirect(
                "/mitra/workers?error=" +
                encodeURIComponent("Worker not found or you do not have access.")
            );
        }

        return res.render("mitra/add-worker", {
            layout: false,
            skills: formData.skills,
            nakas: formData.nakas,

            worker,
            workerDob: toWorkerDobInput(worker.dob),
            isEdit: true,

            error: req.query.error || null,
            success_msg: req.query.success || null,
            error_msg: req.query.error || null,
        });
    } catch (error) {
        console.error("Show Edit Worker Form Error:", error);

        return res.redirect(
            "/mitra/workers?error=" +
            encodeURIComponent("Unable to open worker edit form.")
        );
    }
};

const saveMitraWorker = async (req, res) => {
    const redirectWithError = (message) => {
        return res.redirect(
            `/mitra/workers/add?error=${encodeURIComponent(message)}`
        );
    };

    try {
        const { workerData, selectedSkillIds, selectedNakaIds } =
            await normalizeMitraWorkerData({
                body: req.body,
                uploadedFile: req.file,
                mitraId: req.user.id,
            });

        await prisma.worker.create({
            data: {
                ...workerData,
                mitraId: req.user.id,
                isActive: true,

                skills: {
                    connect: selectedSkillIds.map((id) => ({ id })),
                },

                nakas: {
                    connect: selectedNakaIds.map((id) => ({ id })),
                },
            },
        });

        return res.redirect(
            "/mitra/dashboard?success=" +
            encodeURIComponent("Worker added successfully.")
        );
    } catch (error) {
        console.error("saveMitraWorker error:", error);

        return redirectWithError(
            error?.code === "P2002"
                ? getUniqueFieldMessage(error)
                : error.message || "Unable to save worker. Please try again."
        );
    }
};

const updateMitraWorker = async (req, res) => {
    const workerId = Number(req.params.id);

    const redirectWithError = (message) => {
        return res.redirect(
            `/mitra/workers/edit/${req.params.id}?error=${encodeURIComponent(message)}`
        );
    };

    if (!Number.isInteger(workerId) || workerId <= 0) {
        return res.redirect(
            "/mitra/workers?error=" +
            encodeURIComponent("Invalid worker selected.")
        );
    }

    try {
        const existingWorker = await prisma.worker.findFirst({
            where: {
                id: workerId,
                mitraId: req.user.id,
            },
            select: {
                id: true,
            },
        });

        if (!existingWorker) {
            return res.redirect(
                "/mitra/workers?error=" +
                encodeURIComponent("Worker not found or you do not have access.")
            );
        }

        const { workerData, selectedSkillIds, selectedNakaIds } =
            await normalizeMitraWorkerData({
                body: req.body,
                uploadedFile: req.file,
                mitraId: req.user.id,
                editingWorkerId: workerId,
            });

        await prisma.worker.update({
            where: { id: workerId },
            data: {
                ...workerData,

                skills: {
                    set: selectedSkillIds.map((id) => ({ id })),
                },

                nakas: {
                    set: selectedNakaIds.map((id) => ({ id })),
                },
            },
        });

        return res.redirect(
            "/mitra/workers?success=" +
            encodeURIComponent("Worker updated successfully.")
        );
    } catch (error) {
        console.error("updateMitraWorker error:", error);

        return redirectWithError(
            error?.code === "P2002"
                ? getUniqueFieldMessage(error)
                : error.message || "Unable to update worker. Please try again."
        );
    }
};

const listMitraWorkers = async (req, res) => {
    try {
        const mitraId = Number(req.user?.id);

        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return res.redirect(
                "/mitra/dashboard?error=" +
                encodeURIComponent("Mitra session was not found.")
            );
        }

        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "ALL").toUpperCase();

        const where = {
            mitraId,
        };

        if (status === "ACTIVE") {
            where.isActive = true;
        }

        if (status === "INACTIVE") {
            where.isActive = false;
        }

        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                    },
                },
                {
                    phone: {
                        contains: search,
                    },
                },
                {
                    email: {
                        contains: search,
                    },
                },
                {
                    idNumber: {
                        contains: search,
                    },
                },
            ];
        }

        const workers = await prisma.worker.findMany({
            where,
            include: {
                skills: {
                    orderBy: {
                        name: "asc",
                    },
                },
                nakas: {
                    orderBy: {
                        name: "asc",
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.render("mitra/workers", {
            layout: false,
            workers,

            filters: {
                search,
                status:
                    status === "ACTIVE" || status === "INACTIVE"
                        ? status
                        : "ALL",
            },

            success_msg: req.query.success || null,
            error_msg: req.query.error || null,

            activePage: "workers",

            mitraName:
                req.user?.name ||
                req.user?.fullName ||
                "Mitra",
        });
    } catch (error) {
        console.error("Mitra Worker List Error:", error);

        return res.redirect(
            "/mitra/dashboard?error=" +
            encodeURIComponent("Workers list load nahi ho payi.")
        );
    }
};

module.exports = {
    getWorkerDashboard,
    getWorkerWallet,
    listWorkers,
    showForm,
    saveWorker,
    deleteWorker,
    loginWorker,
    getWorkerProfile,
    updateStatus,
    getPoolStatus,
    savePushToken,
    showMitraAddForm,
    showMitraEditForm,
    searchMitraNakasByPincode,
    saveMitraWorker,
    updateMitraWorker,
    listMitraWorkers
};
