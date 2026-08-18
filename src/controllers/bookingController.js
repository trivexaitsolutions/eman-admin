// src/controllers/bookingController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPushNotification } = require('../utils/sendNotification');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const {
    findNearbyVerifiedNakas
} = require('../utils/nearbyNakas');
const { getBookingSetting } = require('../utils/bookingSettings');

const NAKA_VERIFIED_STATUS = 'VERIFIED';

const getNakaVerificationCutoff = () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff;
};

const findBookableNaka = async (nakaId) => {
    const parsedNakaId = parseInt(nakaId, 10);

    if (!Number.isInteger(parsedNakaId) || parsedNakaId <= 0) {
        return null;
    }

    return prisma.naka.findFirst({
        where: {
            id: parsedNakaId,
            verificationStatus: NAKA_VERIFIED_STATUS,
            lastVerifiedAt: {
                gte: getNakaVerificationCutoff()
            }
        },
        select: {
            id: true,
            name: true
        }
    });
};

// const { sendPushNotification } = require('../utils/sendNotification');


const expireOldAvailableWorkers = async () => {
    const now = new Date();

    await prisma.worker.updateMany({
        where: {
            isAvailable: true,
            availabilityUntil: {
                lte: now,
            },
        },
        data: {
            isAvailable: false,
            availabilityType: null,
            availabilityStart: null,
            availabilityHours: null,
            availabilityUntil: null,
            lastActive: now,
        },
    });
};


// Razorpay Setup (Aap apni test keys .env file me daaliyega)
const razorpay = new Razorpay({
    key_id: 'rzp_test_SouUYINcIpP7iB',
    key_secret: 'NLb7nFGTsnZedF3oyJlmmLiH',
});

const initiateBooking = async (req, res) => {
    const {
        customerId,
        skillId,
        workerCount,
        minRating = 0,
        addressId,
        workLatitude,
        workLongitude,
        workLocationText,
        selectedWorkerIds = []
    } = req.body;

    let lockedWorkerIds = [];
    let pendingBooking = null;
    let validNakaIds = [];
    let verifiedNakas = [];
    let confirmedWorkLocation = null;

    try {
        /*
        |--------------------------------------------------------------------------
        | 1. Basic request validation
        |--------------------------------------------------------------------------
        */

        const parsedCustomerId = Number(customerId);
        const parsedSkillId = Number(skillId);
        const parsedWorkerCount = Number(workerCount);
        const parsedMinRating = Number(minRating || 0);
        const parsedAddressId = Number(addressId);

        if (
            !Number.isInteger(parsedCustomerId) ||
            parsedCustomerId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer selected."
            });
        }

        if (
            !Number.isInteger(parsedSkillId) ||
            parsedSkillId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid skill."
            });
        }

        if (
            !Number.isInteger(parsedWorkerCount) ||
            parsedWorkerCount < 1 ||
            parsedWorkerCount > 10
        ) {
            return res.status(400).json({
                success: false,
                message: "Worker count must be between 1 and 10."
            });
        }

        if (
            !Number.isFinite(parsedMinRating) ||
            parsedMinRating < 0 ||
            parsedMinRating > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid minimum rating selected."
            });
        }

        if (
            !Number.isInteger(parsedAddressId) ||
            parsedAddressId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid work address."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 2. Resolve Nakas automatically from the confirmed work location
        |--------------------------------------------------------------------------
        */

        // Never trust Naka IDs or radius sent by the app. Both the preview
        // and final booking use the current admin setting and Haversine.
        const bookingSetting = await getBookingSetting(prisma);
        const nearbyResult = await findNearbyVerifiedNakas(prisma, {
            latitude: workLatitude,
            longitude: workLongitude,
            radiusMeters: bookingSetting.nearbyNakaRadiusMeters
        });

        verifiedNakas = nearbyResult.selectedNakas;
        validNakaIds = verifiedNakas.map((naka) => naka.id);
        confirmedWorkLocation = nearbyResult.workLocation;

        if (validNakaIds.length === 0) {
            return res.status(400).json({
                success: false,
                code: "NO_NAKAS_IN_RADIUS",
                message: `Is work location ke ${bookingSetting.nearbyNakaRadiusMeters} meter radius me koi verified Naka nahi mila.`
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 3. Expire workers whose availability has ended
        |--------------------------------------------------------------------------
        */

        await expireOldAvailableWorkers();

        /*
        |--------------------------------------------------------------------------
        | 4. Validate customer
        |--------------------------------------------------------------------------
        */

        const customer = await prisma.customer.findUnique({
            where: {
                id: parsedCustomerId
            },
            select: {
                id: true
            }
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer account not found."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 5. Validate address ownership
        |--------------------------------------------------------------------------
        */

        const customerAddress =
            await prisma.customerAddress.findFirst({
                where: {
                    id: parsedAddressId,
                    customerId: parsedCustomerId
                },
                select: {
                    id: true
                }
            });

        if (!customerAddress) {
            return res.status(400).json({
                success: false,
                message:
                    "Selected address does not belong to this customer."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 6. Nakas were already selected and verified from GPS above
        |--------------------------------------------------------------------------
        */

        /*
        |--------------------------------------------------------------------------
        | 7. Get skill and calculate amount on backend
        |--------------------------------------------------------------------------
        */

        const skill = await prisma.skill.findFirst({
            where: {
                id: parsedSkillId,
                isActive: true
            },
            include: {
                rates: true
            }
        });

        if (!skill) {
            return res.status(400).json({
                success: false,
                message: "Selected skill is not available."
            });
        }

        if (
            !Array.isArray(skill.rates) ||
            skill.rates.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Rate has not been configured for this skill."
            });
        }

        let selectedRate = null;

        // Rating 0 means Any Rating, therefore use lowest available rate.
        if (parsedMinRating === 0) {
            selectedRate = [...skill.rates].sort(
                (a, b) =>
                    Number(a.rate) - Number(b.rate)
            )[0];
        } else {
            selectedRate = skill.rates.find(
                (rate) =>
                    Number(rate.star) ===
                    parsedMinRating
            );
        }

        if (!selectedRate) {
            return res.status(400).json({
                success: false,
                message:
                    "Rate is not configured for the selected worker rating."
            });
        }

        const unitPrice = Number(selectedRate.rate);

        if (
            !Number.isFinite(unitPrice) ||
            unitPrice <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid rate configured for this skill."
            });
        }

        const totalAmount =
            unitPrice * parsedWorkerCount;

        /*
        |--------------------------------------------------------------------------
        | 8. Find eligible workers from system-selected nearby Nakas
        |--------------------------------------------------------------------------
        */

        const now = new Date();

        const candidateWorkers =
            await prisma.worker.findMany({
                where: {
                    isActive: true,
                    isAvailable: true,

                    availabilityUntil: {
                        gt: now
                    },

                    nakas: {
                        some: {
                            id: {
                                in: validNakaIds
                            }
                        }
                    },

                    skills: {
                        some: {
                            id: parsedSkillId
                        }
                    }
                },

                take: 100,

                select: {
                    id: true,
                    name: true,
                    baseRating: true,
                    lastActive: true
                },

                orderBy: {
                    lastActive: "desc"
                }
            });

        const candidateWorkerIds = candidateWorkers.map(
            (worker) => worker.id
        );

        const ratingGroups = candidateWorkerIds.length
            ? await prisma.rating.groupBy({
                by: ["workerId"],
                where: {
                    workerId: {
                        in: candidateWorkerIds
                    }
                },
                _avg: {
                    mehnat: true,
                    vyavhaar: true
                }
            })
            : [];

        const ratingMap = new Map();

        ratingGroups.forEach((rating) => {
            const average =
                (Number(rating._avg.mehnat || 0) +
                    Number(rating._avg.vyavhaar || 0)) /
                2;

            ratingMap.set(rating.workerId, average);
        });

        const eligibleWorkers = candidateWorkers
            .map((worker) => ({
                ...worker,
                averageRating: ratingMap.has(worker.id)
                    ? Number(ratingMap.get(worker.id))
                    : Number(worker.baseRating || 3)
            }))
            .filter(
                (worker) =>
                    parsedMinRating === 0 ||
                    worker.averageRating >= parsedMinRating
            )
            .sort((first, second) => {
                if (second.averageRating !== first.averageRating) {
                    return second.averageRating - first.averageRating;
                }

                return (
                    new Date(second.lastActive || 0).getTime() -
                    new Date(first.lastActive || 0).getTime()
                );
            });

        const assignmentMode = bookingSetting.assignmentMode;

        let workersToBook = [];

        if (assignmentMode === "CUSTOMER_SELECT") {
            const normalizedSelectedWorkerIds = Array.isArray(selectedWorkerIds)
                ? [
                    ...new Set(
                        selectedWorkerIds
                            .map((id) => Number(id))
                            .filter(
                                (id) => Number.isInteger(id) && id > 0
                            )
                    )
                ]
                : [];

            if (
                normalizedSelectedWorkerIds.length !== parsedWorkerCount
            ) {
                return res.status(400).json({
                    success: false,
                    code: "SELECTED_WORKERS_INVALID",
                    message: `Please select exactly ${parsedWorkerCount} worker(s).`
                });
            }

            const eligibleWorkerMap = new Map(
                eligibleWorkers.map((worker) => [worker.id, worker])
            );

            workersToBook = normalizedSelectedWorkerIds
                .map((id) => eligibleWorkerMap.get(id))
                .filter(Boolean);

            if (workersToBook.length !== parsedWorkerCount) {
                return res.status(409).json({
                    success: false,
                    code: "WORKERS_NO_LONGER_AVAILABLE",
                    message: "Selected worker me se koi ab available nahi hai. Please workers refresh karke dobara select karein."
                });
            }
        } else {
            workersToBook = eligibleWorkers.slice(0, parsedWorkerCount);
        }

        if (workersToBook.length < parsedWorkerCount) {
            return res.status(400).json({
                success: false,
                code: "NOT_ENOUGH_WORKERS",
                message:
                    `Sorry! Is location ke nearby Nakas me abhi sirf ` +
                    `${eligibleWorkers.length} matching worker(s) available hain.`
            });
        }

        lockedWorkerIds = workersToBook.map(
            (worker) => worker.id
        );

        /*
        |--------------------------------------------------------------------------
        | 9. Create pending booking and lock workers
        |--------------------------------------------------------------------------
        */

        pendingBooking =
            await prisma.$transaction(
                async (tx) => {
                    const workerLock = await tx.worker.updateMany({
                        where: {
                            id: {
                                in: lockedWorkerIds
                            },
                            isAvailable: true,
                            availabilityUntil: {
                                gt: now
                            }
                        },
                        data: {
                            isAvailable: false
                        }
                    });

                    if (workerLock.count !== lockedWorkerIds.length) {
                        const lockError = new Error(
                            "Selected workers are no longer available."
                        );
                        lockError.code = "WORKERS_NO_LONGER_AVAILABLE";
                        throw lockError;
                    }

                    const booking =
                        await tx.booking.create({
                            data: {
                                customerId:
                                    parsedCustomerId,

                                // Legacy primary Naka mirror
                                nakaId:
                                    validNakaIds[0],

                                selectedNakaIds:
                                    JSON.stringify(
                                        validNakaIds
                                    ),

                                addressId:
                                    parsedAddressId,

                                workLatitude:
                                    confirmedWorkLocation.latitude,

                                workLongitude:
                                    confirmedWorkLocation.longitude,

                                workLocationText:
                                    String(workLocationText || "")
                                        .trim()
                                        .slice(0, 1000) || null,

                                skillId:
                                    parsedSkillId,

                                workerCount:
                                    parsedWorkerCount,

                                amount:
                                    totalAmount,

                                status:
                                    "PENDING",

                                workers: {
                                    connect:
                                        lockedWorkerIds.map(
                                            (id) => ({
                                                id
                                            })
                                        )
                                }
                            }
                        });

                    return booking;
                }
            );

        /*
        |--------------------------------------------------------------------------
        | 10. Create Razorpay order
        |--------------------------------------------------------------------------
        */

        let razorpayOrder;

        try {
            razorpayOrder =
                await razorpay.orders.create({
                    amount: Math.round(
                        totalAmount * 100
                    ),
                    currency: "INR",
                    receipt:
                        `receipt_booking_${pendingBooking.id}`
                });
        } catch (razorpayError) {
            /*
             * Razorpay order failed, therefore undo worker lock
             * and remove pending booking.
             */

            await prisma.$transaction([
                prisma.worker.updateMany({
                    where: {
                        id: {
                            in: lockedWorkerIds
                        }
                    },
                    data: {
                        isAvailable: true
                    }
                }),

                prisma.booking.delete({
                    where: {
                        id: pendingBooking.id
                    }
                })
            ]);

            pendingBooking = null;
            lockedWorkerIds = [];

            throw razorpayError;
        }

        /*
        |--------------------------------------------------------------------------
        | 11. Save Razorpay order ID
        |--------------------------------------------------------------------------
        */

        await prisma.booking.update({
            where: {
                id: pendingBooking.id
            },
            data: {
                razorpayOrderId:
                    razorpayOrder.id
            }
        });

        /*
        |--------------------------------------------------------------------------
        | 12. Return secure backend-calculated details
        |--------------------------------------------------------------------------
        */

        return res.json({
            success: true,
            message:
                "Workers locked. Proceed to payment.",

            bookingId:
                pendingBooking.id,

            unitPrice,
            totalAmount,

            selectedNakas:
                verifiedNakas,

            razorpayOrder
        });

    } catch (error) {
        console.error(
            "Initiate Booking Error:",
            error
        );

        if (error.code === "INVALID_WORK_LOCATION") {
            return res.status(400).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }

        if (error.code === "WORKERS_NO_LONGER_AVAILABLE") {
            return res.status(409).json({
                success: false,
                code: error.code,
                message: "Selected worker me se koi ab available nahi hai. Please refresh karke dobara select karein."
            });
        }

        if (error.statusCode === 401) {
            return res.status(500).json({
                success: false,
                message:
                    "Razorpay API keys are missing or invalid."
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Server error while initiating booking."
        });
    }
};

const cancelPendingBooking = async (req, res) => {
    const { bookingId, customerId } = req.body;

    try {
        const parsedBookingId = Number(bookingId);
        const parsedCustomerId = Number(customerId);

        if (
            !Number.isInteger(parsedBookingId) ||
            parsedBookingId <= 0 ||
            !Number.isInteger(parsedCustomerId) ||
            parsedCustomerId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking details."
            });
        }

        const pendingBooking = await prisma.booking.findFirst({
            where: {
                id: parsedBookingId,
                customerId: parsedCustomerId,
                status: "PENDING",
                razorpayPaymentId: null
            },
            include: {
                workers: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!pendingBooking) {
            return res.status(404).json({
                success: false,
                message: "Pending booking not found."
            });
        }

        const workerIds = pendingBooking.workers.map(
            (worker) => worker.id
        );

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            /*
             * Sirf un workers ko available karo
             * jinki availability abhi expire nahi hui.
             */
            if (workerIds.length > 0) {
                await tx.worker.updateMany({
                    where: {
                        id: {
                            in: workerIds
                        },
                        availabilityUntil: {
                            gt: now
                        }
                    },
                    data: {
                        isAvailable: true
                    }
                });
            }

            /*
             * Pending unpaid booking delete kar do.
             */
            await tx.booking.delete({
                where: {
                    id: parsedBookingId
                }
            });
        });

        return res.json({
            success: true,
            message: "Pending booking cancelled and workers released."
        });

    } catch (error) {
        console.error(
            "Cancel Pending Booking Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Pending booking cancel nahi ho payi."
        });
    }
};

const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    try {
        // 1. Signature Verify Karein (Security Check)
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                        .update(body.toString())
                                        .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // ✅ PAYMENT SUCCESS!

            // 2. Booking status "ASSIGNED" karein aur payment ID save karein
            const confirmedBooking = await prisma.booking.update({
                where: { id: parseInt(bookingId) },
                data: {
                    status: "ASSIGNED",
                    razorpayPaymentId: razorpay_payment_id
                },
                include: { workers: true } // Workers ka data (Push token) laane ke liye
            });

            // 3. 🪄 PUSH NOTIFICATION KA MAGIC YAHAN AAYEGA!
            for (const worker of confirmedBooking.workers) {
                if (worker.pushToken) {
                    const title = "🎉 NAYA KAAM MIL GAYA!";
                    const body = "Customer ka payment ho gaya hai. Jaldi location check karein!";
                    const data = { bookingId: confirmedBooking.id, action: "OPEN_ACTIVE_DUTY" };

                    await sendPushNotification(worker.pushToken, title, body, data);
                    console.log(`Worker ${worker.name} ko Payment Success Notification bhej di gayi hai.`);
                }
            }

            res.json({ success: true, message: "Payment verified & Booking Confirmed!" });

        } else {
            // ❌ PAYMENT FAKE HAI YA FAIL HUI
            res.status(400).json({ success: false, message: "Invalid Signature" });
        }

    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ success: false, message: "Server Error during verification" });
    }
};


const bookWorkers = async (req, res) => {
    const { customerId, nakaId, skillId, workerCount } = req.body;

    try {
        await expireOldAvailableWorkers();

        const now = new Date();
        // 1. Dhoondo kaun se workers free hain, us naka par, aur wo skill jaante hain
        const availableWorkers = await prisma.worker.findMany({
            where: {
                isAvailable: true,
                availabilityUntil: {
                    gt: now,
                },
                nakas: { some: { id: parseInt(nakaId) } },
                skills: { some: { id: parseInt(skillId) } },
            },
            take: parseInt(workerCount),
        });

        // 2. Check karo ki kya utne workers mile?
        if (availableWorkers.length < parseInt(workerCount)) {
            return res.status(400).json({ 
                success: false, 
                message: `Sorry! Abhi is Naka par sirf ${availableWorkers.length} worker(s) free hain. Kripya quantity kam karein.` 
            });
        }

        // 3. Agar mil gaye, toh unki ID nikal lo
        const workerIds = availableWorkers.map(w => w.id);

        // 4. TRANSACTION: Booking banao aur workers ko lock karo
        const bookingResult = await prisma.$transaction(async (tx) => {
            
            // A. Booking generate karo aur workers ko is booking se connect karo
            const booking = await tx.booking.create({
                data: {
                    customerId: parseInt(customerId),
                    nakaId: parseInt(nakaId),
                    skillId: parseInt(skillId),
                    workerCount: parseInt(workerCount),
                    status: "ASSIGNED",
                    workers: {
                        connect: workerIds.map(id => ({ id }))
                    }
                },
                include: { workers: true } // Return me assigned workers ka data bhi chahiye
            });

            // B. Un workers ko 'Busy' (Offline) mark kar do
            await tx.worker.updateMany({
                where: { id: { in: workerIds } },
                data: { isAvailable: false }
            });

            return booking;
        });

        // -------------------------------------------------------------
        // 5. 🪄 PUSH NOTIFICATION KA MAGIC (NAYA CODE)
        // -------------------------------------------------------------
        // Har assigned worker ko check karo aur notification bhejo
        for (const worker of bookingResult.workers) {
            // Agar worker ke paas push token hai (yaani usne phone me app setup kiya hai)
            if (worker.pushToken) {
                const title = "🎉 NAYA KAAM MIL GAYA!";
                const body = "Customer ne aapko book kiya hai. Turant app open karke details check karein!";
                const data = { 
                    bookingId: bookingResult.id, 
                    action: "OPEN_ACTIVE_DUTY" 
                };

                // Notification Postman ko call karein
                await sendPushNotification(worker.pushToken, title, body, data);
                console.log(`Worker ${worker.name} ko Push Notification bhej di gayi hai.`);
            } else {
                console.log(`Worker ${worker.name} ka token nahi hai (App install ya login nahi kiya hoga).`);
            }
        }
        // -------------------------------------------------------------

        res.json({ 
            success: true, 
            message: "Booking Successful! Workers assign ho gaye hain.", 
            booking: bookingResult 
        });

    } catch (error) {
        console.error("Booking Engine Error:", error);
        res.status(500).json({ success: false, message: "Server error booking karte waqt" });
    }
};

const getCurrentBooking = async (req, res) => {
  try {
    const { customerId } = req.params;

    const activeBooking = await prisma.booking.findFirst({
      where: {
        customerId: parseInt(customerId),
        OR: [
          {
            status: {
              in: ["ASSIGNED", "IN_PROGRESS"],
            },
          },
          {
            status: "COMPLETED",
            isRated: false,
          },
        ],
      },
      include: {
        workers: true,
        conflicts: {
          where: {
            raisedByType: "WORKER",
            requestedAction: "CANCEL_DUTY",
            continueWork: false,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!activeBooking) {
      return res.json({
        success: false,
        message: "Koi active booking nahi hai",
      });
    }

    const workerAmount =
      activeBooking.amount && activeBooking.workerCount
        ? Math.round(
            Number(activeBooking.amount) / Number(activeBooking.workerCount)
          )
        : 0;

    const cancelledConflictInfo = activeBooking.conflicts.map((conflict) => {
      const worker = activeBooking.workers.find(
        (w) => Number(w.id) === Number(conflict.workerId)
      );

      return {
        workerId: conflict.workerId,
        workerName: worker?.name || "Worker",
        reason: conflict.reason,
        description: conflict.description,
        amount: workerAmount,
        conflictId: conflict.id,
        createdAt: conflict.createdAt,
      };
    });

    return res.json({
      success: true,
      booking: {
        ...activeBooking,
        cancelledConflictInfo,
      },
    });
  } catch (error) {
    console.error("Current Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// 1. WORKER: Current duty (kaam) fetch karne ke liye
const getCurrentDuty = async (req, res) => {
  try {
    const { workerId } = req.params;
    const numericWorkerId = Number(workerId);

    if (!Number.isInteger(numericWorkerId) || numericWorkerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker id",
      });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: numericWorkerId },
      select: { availabilityStart: true },
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    const activeDutyWhere = {
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      workers: {
        some: { id: numericWorkerId },
      },
    };

    // A worker must only see a booking assigned during the availability
    // session they just started. This prevents an unfinished legacy booking
    // from opening immediately after the 3-second hold.
    if (worker.availabilityStart) {
      activeDutyWhere.createdAt = {
        gte: worker.availabilityStart,
      };
    }

    const activeDuty = await prisma.booking.findFirst({
      where: activeDutyWhere,
      include: {
        customer: true,
        address: true,
        workers: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!activeDuty) {
      return res.json({
        success: false,
        message: "Koi active duty nahi hai",
      });
    }

    let cancelledWorkerIds = [];

    try {
      cancelledWorkerIds = JSON.parse(activeDuty.cancelledWorkerIds || "[]");
    } catch (e) {
      cancelledWorkerIds = [];
    }

    if (cancelledWorkerIds.map(Number).includes(numericWorkerId)) {
      return res.json({
        success: false,
        message: "This duty has been cancelled for this worker.",
      });
    }

    return res.json({
      success: true,
      duty: activeDuty,
    });
  } catch (error) {
    console.error("Current Duty Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// 2. CUSTOMER: Worker ka QR scan karke arrival verify karne ke liye
const verifyQrAndStartDuty = async (req, res) => {
    try {
        const { bookingId, workerId, customerId } = req.body;
        const numericBookingId = Number(bookingId);
        const numericWorkerId = Number(workerId);
        const numericCustomerId = Number(customerId);

        if (
            !Number.isInteger(numericBookingId) ||
            !Number.isInteger(numericWorkerId) ||
            !Number.isInteger(numericCustomerId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid QR verification request",
            });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: numericBookingId },
            include: {
                customer: true,
                workers: true,
            },
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (Number(booking.customerId) !== numericCustomerId) {
            return res.status(403).json({
                success: false,
                message: "This booking does not belong to this customer",
            });
        }

        if (!["ASSIGNED", "IN_PROGRESS"].includes(booking.status)) {
            return res.status(409).json({
                success: false,
                message: "This booking is not accepting worker arrivals",
            });
        }

        const assignedWorker = booking.workers.find(
            (worker) => Number(worker.id) === numericWorkerId
        );

        if (!assignedWorker) {
            return res.status(403).json({
                success: false,
                message: "This worker is not assigned to your booking",
            });
        }

        let arrivedList = [];
        let cancelledWorkerIds = [];

        try {
            arrivedList = JSON.parse(booking.arrivedWorkerIds || "[]").map(Number);
        } catch (error) {
            arrivedList = [];
        }

        try {
            cancelledWorkerIds = JSON.parse(
                booking.cancelledWorkerIds || "[]"
            ).map(Number);
        } catch (error) {
            cancelledWorkerIds = [];
        }

        if (cancelledWorkerIds.includes(numericWorkerId)) {
            return res.status(409).json({
                success: false,
                message: "This worker has been cancelled from the booking",
            });
        }

        if (!arrivedList.includes(numericWorkerId)) {
            arrivedList.push(numericWorkerId);
        }

        arrivedList = [...new Set(arrivedList)];

        const activeWorkerIds = booking.workers
            .map((worker) => Number(worker.id))
            .filter((id) => !cancelledWorkerIds.includes(id));
        const allArrived =
            activeWorkerIds.length > 0 &&
            activeWorkerIds.every((id) => arrivedList.includes(id));
        const newStatus = allArrived ? "IN_PROGRESS" : "ASSIGNED";

        const updatedBooking = await prisma.booking.update({
            where: { id: numericBookingId },
            data: {
                arrivedWorkerIds: JSON.stringify(arrivedList),
                status: newStatus,
            },
        });

        // Customer ke scan ke baad verified worker ko confirmation bhejo.
        const workerToken = assignedWorker.pushToken;

        if (workerToken) {
            const title = allArrived
                ? "All Workers Arrived! ✅"
                : "Worker Arrived! ✅";

            const body = allArrived
                ? "Sabhi assigned workers aa gaye hain. Aap work start kar sakte hain."
                : "Aapka ek worker site par pahunch gaya hai.";

            await sendPushNotification(
                workerToken,
                "Arrival Verified",
                "Customer ne aapka QR scan kar liya hai. Aap duty start kar sakte hain.",
                {
                    action: "OPEN_ACTIVE_DUTY",
                    bookingId: booking.id,
                    workerId: numericWorkerId,
                    allArrived,
                }
            );
        }

        return res.json({
            success: true,
            message: allArrived
                ? "All workers arrived. Work can start now."
                : `${assignedWorker.name || "Worker"} arrival verified successfully.`,
            allArrived,
            worker: {
                id: assignedWorker.id,
                name: assignedWorker.name,
            },
            booking: updatedBooking,
        });
    } catch (error) {
        console.error("QR Verify Error:", error);

        return res.status(500).json({
            success: false,
            message: "QR verification failed",
        });
    }
};

const completeBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;

        const updatedBooking = await prisma.booking.update({
            where: { id: parseInt(bookingId) },
            data: {
                status: "COMPLETED",
            },
            include: {
                workers: true,
            },
        });

        // Har worker ko separate notification bhejo
        for (const worker of updatedBooking.workers) {
            if (!worker.pushToken) {
                continue;
            }

            await sendPushNotification(
                worker.pushToken,
                "Duty Completed! 🎉",
                "Customer ne work complete mark kar diya hai. Please client ko rate karein.",
                {
                    action: "RATE_CLIENT",
                    bookingId: updatedBooking.id,
                    workerId: worker.id,
                }
            );

            console.log(
                `Worker ${worker.name} ko work-complete notification bhej di gayi hai.`
            );
        }

        return res.json({
            success: true,
            message: "Work Marked as Complete!",
        });
    } catch (error) {
        console.error("Complete Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

const getBookingHistory = async (req, res) => {
    try {
        const { customerId } = req.params;

        // Saari bookings dhoondo jo 'COMPLETED' ya 'CANCELLED' ho chuki hain
        // Ya phir aap saari bookings bhi dikha sakte hain
        const history = await prisma.booking.findMany({
    where: {
        customerId: parseInt(customerId)
    },
    include: {
        workers: true // Sirf workers ko include karein
    },
    orderBy: {
        createdAt: "desc"
    }
});

        res.json({ success: true, history });
    } catch (error) {
        console.error("History Fetch Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// src/controllers/bookingController.js (getBookingById)
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await prisma.booking.findUnique({
            where: { id: parseInt(id) },
            include: {
                workers: true,
                ratings: true // 👈 YEH NAYI LINE ADD KI HAI (Purani rating laane ke liye)
            }
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking nahi mili" });
        }

        const isRated = booking.isRated || false; 

        res.json({ success: true, booking: { ...booking, isRated } });

    } catch (error) {
        console.error("Fetch Booking Details Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// src/controllers/bookingController.js (submitRating)
const submitRating = async (req, res) => {
    try {
        const { bookingId, ratings } = req.body;

        await prisma.$transaction(async (tx) => {
            
            // 🚀 SMART FIX: Agar pehle se is booking ki koi rating hai, toh usko delete kar do (Edit mode ke liye)
            await tx.rating.deleteMany({
                where: { bookingId: parseInt(bookingId) }
            });

            const ratingData = ratings.map(r => ({
                bookingId: parseInt(bookingId),
                workerId: parseInt(r.workerId),
                mehnat: parseInt(r.mehnat),
                vyavhaar: parseInt(r.vyavhaar)
            }));

            // Nayi ratings insert karo
            await tx.rating.createMany({
                data: ratingData
            });

            await tx.booking.update({
                where: { id: parseInt(bookingId) },
                data: { isRated: true }
            });
        });

        res.json({ success: true, message: "Ratings submitted successfully!" });

    } catch (error) {
        console.error("Submit Rating Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


const getClientRatingStatus = async (req, res) => {
    try {
        const { bookingId, workerId } = req.params;

        if (!bookingId || !workerId) {
            return res.status(400).json({
                success: false,
                message: "bookingId and workerId are required",
            });
        }

        const bookingIdNumber = parseInt(bookingId);
        const workerIdNumber = parseInt(workerId);

        const booking = await prisma.booking.findFirst({
            where: {
                id: bookingIdNumber,
                workers: {
                    some: { id: workerIdNumber },
                },
            },
            include: {
                customer: true,
                workers: true,
            },
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found for this worker.",
            });
        }

        const existingRating = await prisma.workerClientRating.findUnique({
            where: {
                bookingId_workerId: {
                    bookingId: bookingIdNumber,
                    workerId: workerIdNumber,
                },
            },
        });

        return res.json({
            success: true,
            booking: {
                id: booking.id,
                status: booking.status,
                customerId: booking.customerId,
                customerName: booking.customer?.name || "Client",
                customerPhone: booking.customer?.phone || "",
                amount: booking.amount,
                createdAt: booking.createdAt,
            },
            isRated: !!existingRating,
            rating: existingRating,
        });
    } catch (error) {
        console.error("Get Client Rating Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Client rating status fetch nahi ho paya",
        });
    }
};

const submitClientRatingByWorker = async (req, res) => {
    try {
        const {
            bookingId,
            workerId,
            rating,
            behaviour,
            locationAccuracy,
            coordination,
            comment,
        } = req.body;

        if (!bookingId || !workerId || !rating) {
            return res.status(400).json({
                success: false,
                message: "bookingId, workerId and rating are required",
            });
        }

        const bookingIdNumber = parseInt(bookingId);
        const workerIdNumber = parseInt(workerId);
        const finalRating = parseInt(rating);

        if (finalRating < 1 || finalRating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5",
            });
        }

        const booking = await prisma.booking.findFirst({
            where: {
                id: bookingIdNumber,
                workers: {
                    some: { id: workerIdNumber },
                },
            },
            include: {
                customer: true,
            },
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found for this worker.",
            });
        }

        if (booking.status !== "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "Client rating can be submitted only after work completion.",
            });
        }

        const savedRating = await prisma.workerClientRating.upsert({
            where: {
                bookingId_workerId: {
                    bookingId: bookingIdNumber,
                    workerId: workerIdNumber,
                },
            },
            update: {
                rating: finalRating,
                behaviour: behaviour ? parseInt(behaviour) : null,
                locationAccuracy: locationAccuracy ? parseInt(locationAccuracy) : null,
                coordination: coordination ? parseInt(coordination) : null,
                comment: comment || null,
            },
            create: {
                bookingId: bookingIdNumber,
                workerId: workerIdNumber,
                customerId: booking.customerId,
                rating: finalRating,
                behaviour: behaviour ? parseInt(behaviour) : null,
                locationAccuracy: locationAccuracy ? parseInt(locationAccuracy) : null,
                coordination: coordination ? parseInt(coordination) : null,
                comment: comment || null,
            },
        });

        return res.json({
            success: true,
            message: "Client rating submitted successfully.",
            rating: savedRating,
        });
    } catch (error) {
        console.error("Submit Client Rating By Worker Error:", error);
        return res.status(500).json({
            success: false,
            message: "Client rating submit nahi ho payi",
        });
    }
};


const getWorkerBookingHistory = async (req, res) => {
    try {
        const { workerId } = req.params;

        const workerIdNumber = parseInt(workerId);

        const bookings = await prisma.booking.findMany({
            where: {
                workers: {
                    some: { id: workerIdNumber },
                },
                status: {
                    in: ["COMPLETED", "CANCELLED"],
                },
            },
            include: {
                customer: true,
                workerClientRatings: {
                    where: {
                        workerId: workerIdNumber,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const totalJobs = bookings.length;

        const completedJobs = bookings.filter(
            (booking) => booking.status === "COMPLETED"
        );

        const totalEarning = completedJobs.reduce((sum, booking) => {
            const workerCount = Number(booking.workerCount || 1);
            const amount = Number(booking.amount || 0);
            const workerShare = workerCount > 0 ? Math.round(amount / workerCount) : amount;

            return sum + workerShare;
        }, 0);

        const pendingRatings = completedJobs.filter(
            (booking) => !booking.workerClientRatings?.length
        ).length;

        // Only Mitra-finalized worker cancellation penalties reduce the worker's
        // displayed earning/wallet amount. Pending or unresolved conflicts do not.
        const penaltySummary = await prisma.conflict.aggregate({
            where: {
                workerId: workerIdNumber,
                raisedByType: "WORKER",
                requestedAction: "CANCEL_DUTY",
                status: "SOLVED",
            },
            _sum: {
                penaltyAmount: true,
            },
        });

        const totalPenalty = Number(penaltySummary._sum.penaltyAmount || 0);
        const netTotalEarning = totalEarning - totalPenalty;

        const history = bookings.map((booking) => {
            const workerCount = Number(booking.workerCount || 1);
            const amount = Number(booking.amount || 0);
            const workerShare = workerCount > 0 ? Math.round(amount / workerCount) : amount;
            const clientRating = booking.workerClientRatings?.[0] || null;

            return {
                id: booking.id,
                status: booking.status,
                amount: booking.amount,
                workerShare,
                workerCount: booking.workerCount,
                customerId: booking.customerId,
                customerName: booking.customer?.name || "Client",
                customerPhone: booking.customer?.phone || "",
                nakaId: booking.nakaId,
                skillId: booking.skillId,
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt,
                isClientRated: !!clientRating,
                clientRating,
            };
        });

        return res.json({
            success: true,
            summary: {
                totalJobs,
                completedJobs: completedJobs.length,
                totalEarning: netTotalEarning,
                grossEarning: totalEarning,
                totalPenalty,
                pendingRatings,
            },
            history,
        });
    } catch (error) {
        console.error("Worker Booking History Error:", error);
        return res.status(500).json({
            success: false,
            message: "Worker booking history fetch nahi ho payi",
        });
    }
};

const getWorkerBookingDetails = async (req, res) => {
    try {
        const { bookingId, workerId } = req.params;

        const bookingIdNumber = parseInt(bookingId);
        const workerIdNumber = parseInt(workerId);

        const booking = await prisma.booking.findFirst({
            where: {
                id: bookingIdNumber,
                workers: {
                    some: { id: workerIdNumber },
                },
            },
            include: {
                customer: true,
                workers: true,
                workerClientRatings: {
                    where: {
                        workerId: workerIdNumber,
                    },
                },
            },
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found for this worker.",
            });
        }

        const workerCount = Number(booking.workerCount || 1);
        const amount = Number(booking.amount || 0);
        const workerShare = workerCount > 0 ? Math.round(amount / workerCount) : amount;
        const clientRating = booking.workerClientRatings?.[0] || null;

        return res.json({
            success: true,
            booking: {
                ...booking,
                workerShare,
                isClientRated: !!clientRating,
                clientRating,
            },
        });
    } catch (error) {
        console.error("Worker Booking Details Error:", error);
        return res.status(500).json({
            success: false,
            message: "Worker booking details fetch nahi ho payi",
        });
    }
};


const completeWorkerDuty = async (req, res) => {
  try {
    const { bookingId, workerId } = req.body;

    if (!bookingId || !workerId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID aur Worker ID required hai.",
      });
    }

    const booking = await prisma.booking.findUnique({
      where: {
        id: Number(bookingId),
      },
      include: {
        workers: true,
        customer: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    const assignedWorkerIds = booking.workers.map((worker) => Number(worker.id));

    if (!assignedWorkerIds.includes(Number(workerId))) {
      return res.status(400).json({
        success: false,
        message: "Ye worker is booking me assigned nahi hai.",
      });
    }

    let cancelledWorkerIds = [];
    let completedWorkerIds = [];

    try {
      cancelledWorkerIds = JSON.parse(booking.cancelledWorkerIds || "[]").map(Number);
    } catch (e) {
      cancelledWorkerIds = [];
    }

    try {
      completedWorkerIds = JSON.parse(booking.completedWorkerIds || "[]").map(Number);
    } catch (e) {
      completedWorkerIds = [];
    }

    if (cancelledWorkerIds.includes(Number(workerId))) {
      return res.status(400).json({
        success: false,
        message: "Cancelled worker duty complete nahi kar sakta.",
      });
    }

    if (!completedWorkerIds.includes(Number(workerId))) {
      completedWorkerIds.push(Number(workerId));
    }

    const activeWorkerIds = assignedWorkerIds.filter(
      (id) => !cancelledWorkerIds.includes(Number(id))
    );

    const allWorkersCompleted =
      activeWorkerIds.length > 0 &&
      activeWorkerIds.every((id) => completedWorkerIds.includes(Number(id)));

    const updatedBooking = await prisma.booking.update({
      where: {
        id: Number(bookingId),
      },
      data: {
        completedWorkerIds: JSON.stringify(completedWorkerIds),
        status: allWorkersCompleted ? "COMPLETED" : booking.status,
      },
      include: {
        workers: true,
        customer: true,
      },
    });

    return res.json({
      success: true,
      message: allWorkersCompleted
        ? "All workers completed duty."
        : "Worker duty completed.",
      allWorkersCompleted,
      completedWorkerIds,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Complete Worker Duty Error:", error);
    return res.status(500).json({
      success: false,
      message: "Worker duty complete nahi ho payi.",
    });
  }
};

module.exports = {
    submitRating,
    getClientRatingStatus,
    submitClientRatingByWorker,
    bookWorkers,
    initiateBooking,
    verifyPayment,
    getCurrentBooking,
    getCurrentDuty,
    verifyQrAndStartDuty,
    completeBooking,
    getBookingHistory,
    getBookingById,
    getWorkerBookingHistory,
    getWorkerBookingDetails,
    completeWorkerDuty,
    cancelPendingBooking
};
