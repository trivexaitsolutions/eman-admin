// src/controllers/bookingController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPushNotification } = require('../utils/sendNotification');
const Razorpay = require('razorpay');
const crypto = require('crypto');
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

module.exports = { bookWorkers,initiateBooking,verifyPayment };