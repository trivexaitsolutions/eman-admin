// src/controllers/bookingController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

        // 4. TRANSACTION: Booking banao aur workers ko lock karo (Dono kaam ek saath honge, taaki koi glitch na ho)
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

module.exports = { bookWorkers };