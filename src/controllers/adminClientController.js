const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getActiveBookingMaps, customerStatus } = require("../services/adminPresenceService");

const listClients = async (req, res) => {
    try {
        const [clients, activeBookings] = await Promise.all([
            prisma.customer.findMany({
                include: { mitra: { select: { id: true, name: true, phone: true } } },
                orderBy: { id: "desc" },
            }),
            getActiveBookingMaps(prisma),
        ]);
        const now = new Date();
        res.render("admin/clients/index", {
            clients: clients.map((client) => ({
                ...client,
                operationalStatus: customerStatus(client, activeBookings.byCustomer.get(client.id), now),
            })),
        });
    } catch (error) {
        console.error("Admin client list error:", error);
        res.status(500).send("Unable to load clients.");
    }
};

module.exports = { listClients };
