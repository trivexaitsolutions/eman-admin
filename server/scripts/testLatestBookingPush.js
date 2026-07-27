const { PrismaClient } = require("@prisma/client");
const {
    sendPushNotification
} = require("../src/utils/sendNotification");

const prisma = new PrismaClient();

async function main() {
    const booking = await prisma.booking.findFirst({
        where: {
            status: "ASSIGNED"
        },
        orderBy: {
            id: "desc"
        },
        include: {
            workers: {
                select: {
                    id: true,
                    name: true,
                    pushToken: true
                }
            }
        }
    });

    if (!booking) {
        console.log("❌ Koi ASSIGNED booking nahi mili.");
        return;
    }

    console.log("Latest Booking ID:", booking.id);
    console.log("Assigned Workers:", booking.workers);

    if (booking.workers.length === 0) {
        console.log("❌ Booking me koi worker connected nahi hai.");
        return;
    }

    for (const worker of booking.workers) {
        if (!worker.pushToken) {
            console.log(
                `❌ Worker ${worker.id} (${worker.name}) ka pushToken missing hai.`
            );
            continue;
        }

        console.log(
            `Worker ${worker.id} ko test notification bhej rahe hain...`
        );

        const result = await sendPushNotification(
            worker.pushToken,
            "Test New Duty",
            "Aapko ek test duty notification bheji gayi hai.",
            {
                bookingId: booking.id,
                action: "OPEN_ACTIVE_DUTY"
            }
        );

        console.log(
            `Worker ${worker.id} send result:`,
            result
        );
    }
}

main()
    .catch((error) => {
        console.error("Test Push Error:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });