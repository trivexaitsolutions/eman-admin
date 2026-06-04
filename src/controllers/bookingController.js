// src/controllers/bookingController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPushNotification } = require('../utils/sendNotification');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Expo } = require('expo-server-sdk');
let expo = new Expo();
// const { sendPushNotification } = require('../utils/sendNotification');


// Razorpay Setup (Aap apni test keys .env file me daaliyega)
const razorpay = new Razorpay({
    key_id: 'rzp_test_SouUYINcIpP7iB',
    key_secret: 'NLb7nFGTsnZedF3oyJlmmLiH',
});

const initiateBooking = async (req, res) => {
    const { customerId, nakaId, skillId, workerCount, totalAmount } = req.body;

    try {
        // 1. Dhoondo kaun se workers free hain
        const availableWorkers = await prisma.worker.findMany({
            where: {
                isAvailable: true,
                nakas: { some: { id: parseInt(nakaId) } },
                skills: { some: { id: parseInt(skillId) } }
                // Note: Agar star rating ki filter lagani hai, toh wo yahan add hogi
            },
            take: parseInt(workerCount)
        });

        // 2. Check karo ki kya utne workers mile?
        if (availableWorkers.length < parseInt(workerCount)) {
            return res.status(400).json({ 
                success: false, 
                message: `Sorry! Abhi is Naka par sirf ${availableWorkers.length} worker(s) free hain.` 
            });
        }

        const workerIds = availableWorkers.map(w => w.id);

        // 3. TRANSACTION: Workers ko LOCK karo aur 'PENDING' booking banao
        const pendingBooking = await prisma.$transaction(async (tx) => {
            // A. Booking generate karo (Status PENDING)
            const booking = await tx.booking.create({
                data: {
                    customerId: parseInt(customerId),
                    nakaId: parseInt(nakaId),
                    skillId: parseInt(skillId),
                    workerCount: parseInt(workerCount),
                    amount: totalAmount, // Naya field
                    status: "PENDING",   // Naya status
                    workers: {
                        connect: workerIds.map(id => ({ id }))
                    }
                }
            });

            // B. Un workers ko 'Busy' (Locked) mark kar do taaki koi aur book na kar le
            await tx.worker.updateMany({
                where: { id: { in: workerIds } },
                data: { isAvailable: false }
            });

            return booking;
        });

        // 4. RAZORPAY ORDER GENERATE KARO
        // Razorpay hamesha paise (paisa = rupees * 100) me leta hai
        const options = {
            amount: totalAmount * 100, 
            currency: "INR",
            receipt: `receipt_booking_${pendingBooking.id}`
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // 5. Booking me Razorpay ka Order ID save karo
        await prisma.booking.update({
            where: { id: pendingBooking.id },
            data: { razorpayOrderId: razorpayOrder.id }
        });

        // 6. Frontend ko response bhejo taaki wo payment popup khol sake
        res.json({ 
            success: true, 
            message: "Workers Locked! Proceed to Payment.", 
            bookingId: pendingBooking.id,
            razorpayOrder: razorpayOrder 
        });

    } catch (error) {
        console.error("Initiate Booking Error:", error);
        
        // Agar Razorpay API key dummy hui, toh yahan error aayega
        if (error.statusCode === 401) {
            return res.status(500).json({ success: false, message: "Razorpay API Keys missing or invalid." });
        }
        res.status(500).json({ success: false, message: "Server error booking initiate karte waqt" });
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
        // 1. Dhoondo kaun se workers free hain, us naka par, aur wo skill jaante hain
        const availableWorkers = await prisma.worker.findMany({
            where: {
                isAvailable: true,
                nakas: { some: { id: parseInt(nakaId) } }, // Naka match
                skills: { some: { id: parseInt(skillId) } } // Skill match
            },
            take: parseInt(workerCount) // Sirf utne hi uthao jitne customer ne maange hain!
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
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
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
      orderBy: { createdAt: "desc" },
    });

    if (activeBooking) {
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
    } else {
      return res.json({
        success: false,
        message: "Koi active booking nahi hai",
      });
    }
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

    const activeDuty = await prisma.booking.findFirst({
      where: {
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        workers: {
          some: { id: parseInt(workerId) },
        },
      },
      include: {
        customer: true,
        // naka: true, // agar tumhare Booking model me naka relation hai
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

    if (cancelledWorkerIds.map(Number).includes(Number(workerId))) {
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

// 2. WORKER: QR scan hone ke baad Duty 'IN_PROGRESS' karne ke liye
const verifyQrAndStartDuty = async (req, res) => {
    try {
        const { bookingId, workerId } = req.body; // Worker app ab apna ID bhi bhejega

        // 1. Booking nikaalo
        const booking = await prisma.booking.findUnique({ 
            where: { id: parseInt(bookingId) },
            include: { customer: true }
        });

        // 2. Naye worker ka ID list me add karo
        let arrivedList = JSON.parse(booking.arrivedWorkerIds || "[]");
        if (!arrivedList.includes(parseInt(workerId))) {
            arrivedList.push(parseInt(workerId));
        }

        // 3. Check karo kya sab workers aa gaye?
        const allArrived = arrivedList.length >= booking.workerCount;
        const newStatus = allArrived ? "IN_PROGRESS" : "ASSIGNED";

        console.log('Old arrival list:', booking.arrivedWorkerIds);
        console.log('Updated arrival list:', arrivedList, parseInt(bookingId));

        // 4. Database update karo
        const updatedBooking = await prisma.booking.update({
            where: { id: parseInt(bookingId) },
            data: { 
                arrivedWorkerIds: JSON.stringify(arrivedList),
                status: newStatus 
            }
        });

        // 🚀 PUSH NOTIFICATION TO CUSTOMER 
        // 2. 🚀 ASLI PUSH NOTIFICATION LOGIC
        const customerToken = booking.customer.pushToken; // Customer ka saved token

        if (Expo.isExpoPushToken(customerToken)) {
            await expo.sendPushNotificationsAsync([{
                to: customerToken,
                sound: 'default',
                title: 'Worker Arrived! ✅',
                body: 'Aapka worker site par pahunch gaya hai.',
                data: { action: 'REFRESH_BOOKING' }, // Yeh app ko refresh karne bolega
            }]);
        }

        res.json({ success: true, message: "Duty Started!", booking: updatedBooking });
    } catch (error) {
        console.error("QR Verify Error:", error);
        res.status(500).json({ success: false, message: "QR verification failed" });
    }
};


const completeBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;

        // 1. Booking ko "COMPLETED" mark karo aur workers ka data nikalo
        const updatedBooking = await prisma.booking.update({
            where: { id: parseInt(bookingId) },
            data: { status: "COMPLETED" },
            include: { workers: true } // Notification bhejne ke liye workers chahiye
        });

        // 2. Sabhi assigned workers ko Push Notification bhejo (Agar unka token hai)
        const expo = new Expo();
        let messages = [];

        for (let worker of updatedBooking.workers) {
            // Note: Ensure kijiye aapke Worker model me bhi pushToken save ho raha ho
            if (worker.pushToken && Expo.isExpoPushToken(worker.pushToken)) {
                messages.push({
                    to: worker.pushToken,
                    sound: 'default',
                    title: 'Duty Completed! 🎉',
                    body: 'Customer ne work complete mark kar diya hai. Great job!',
                    data: { action: 'DUTY_COMPLETED' },
                });
            }
        }

        if (messages.length > 0) {
            let chunks = expo.chunkPushNotifications(messages);
            for (let chunk of chunks) {
                await expo.sendPushNotificationsAsync(chunk);
            }
        }

        res.json({ success: true, message: "Work Marked as Complete!" });
    } catch (error) {
        console.error("Complete Booking Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
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


module.exports = { submitRating,bookWorkers,initiateBooking,verifyPayment,getCurrentBooking,getCurrentDuty,verifyQrAndStartDuty,completeBooking,getBookingHistory,getBookingById };