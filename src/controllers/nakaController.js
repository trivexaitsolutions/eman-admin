// src/controllers/nakaController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listNakas = async (req, res) => {
    try {
        // Fetch Nakas, include the City name, and count the workers
        const nakas = await prisma.naka.findMany({
            include: { city: true, _count: { select: { workers: true } } },
            orderBy: { id: 'desc' }
        });
        res.render('admin/nakas/index', { nakas });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

const showForm = async (req, res) => {
    try {
        const cities = await prisma.city.findMany({
            orderBy: { name: "asc" },
        });

        let naka = {};
        let isEdit = false;

        if (req.params.id) {
            naka = await prisma.naka.findUnique({
                where: { id: parseInt(req.params.id, 10) },
            });

            if (!naka) {
                return res.redirect(
                    "/admin/nakas?error=" +
                    encodeURIComponent("Naka was not found.")
                );
            }

            isEdit = true;
        }

        return res.render("admin/nakas/form", {
            naka,
            cities,
            isEdit,
            error: req.query.error || null,
        });
    } catch (error) {
        console.error("Show Naka Form Error:", error);

        return res.redirect(
            "/admin/nakas?error=" +
            encodeURIComponent("Unable to open Naka form.")
        );
    }
};

const saveNaka = async (req, res) => {
    const redirectWithError = (message) => {
        const id = String(req.body.id || "").trim();

        if (id) {
            return res.redirect(
                `/admin/nakas/edit/${id}?error=${encodeURIComponent(message)}`
            );
        }

        return res.redirect(
            `/admin/nakas/create?error=${encodeURIComponent(message)}`
        );
    };

    try {
        const { id, name, cityId, pincode, latitude, longitude } = req.body;

        const parsedId = id ? Number(id) : null;
        const parsedCityId = Number(cityId);

        const cleanName = String(name || "").trim();
        const cleanPincode = String(pincode || "")
            .replace(/\D/g, "")
            .slice(0, 6);

        const latitudeValue = String(latitude || "").trim();
        const longitudeValue = String(longitude || "").trim();

        // ----------------------------------------
        // Basic validation
        // ----------------------------------------
        if (!cleanName || cleanName.length < 2) {
            return redirectWithError(
                "Naka name must contain at least 2 characters."
            );
        }

        if (cleanName.length > 120) {
            return redirectWithError(
                "Naka name cannot exceed 120 characters."
            );
        }

        if (!Number.isInteger(parsedCityId) || parsedCityId <= 0) {
            return redirectWithError("Please select a valid city.");
        }

        if (!/^\d{6}$/.test(cleanPincode)) {
            return redirectWithError(
                "Naka pincode must contain exactly 6 digits."
            );
        }

        if (!latitudeValue || !longitudeValue) {
            return redirectWithError(
                "Please select the exact Naka location on the map."
            );
        }

        const parsedLatitude = Number(latitudeValue);
        const parsedLongitude = Number(longitudeValue);

        if (
            !Number.isFinite(parsedLatitude) ||
            parsedLatitude < -90 ||
            parsedLatitude > 90
        ) {
            return redirectWithError(
                "Please select a valid latitude from the map."
            );
        }

        if (
            !Number.isFinite(parsedLongitude) ||
            parsedLongitude < -180 ||
            parsedLongitude > 180
        ) {
            return redirectWithError(
                "Please select a valid longitude from the map."
            );
        }

        // ----------------------------------------
        // Check selected City exists
        // ----------------------------------------
        const city = await prisma.city.findUnique({
            where: { id: parsedCityId },
            select: { id: true },
        });

        if (!city) {
            return redirectWithError("Selected city was not found.");
        }

        // ----------------------------------------
        // Same Naka name should not repeat
        // inside the same city
        // ----------------------------------------
        const sameNaka = await prisma.naka.findFirst({
            where: {
                cityId: parsedCityId,
                name: cleanName,
            },
            select: { id: true },
        });

        if (sameNaka && sameNaka.id !== parsedId) {
            return redirectWithError(
                "A Naka with this name already exists in the selected city."
            );
        }

        const data = {
            name: cleanName,
            pincode: cleanPincode,
            cityId: parsedCityId,
            latitude: parsedLatitude,
            longitude: parsedLongitude,
        };

        if (parsedId) {
            await prisma.naka.update({
                where: { id: parsedId },
                data,
            });
        } else {
            await prisma.naka.create({ data });
        }

        return res.redirect("/admin/nakas");
    } catch (error) {
        console.error("Save Naka Error:", error);

        return redirectWithError(
            "Naka save nahi ho paya. Please check all details and try again."
        );
    }
};
const deleteNaka = async (req, res) => {
    try {
        await prisma.naka.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/nakas');
    } catch (error) {
        res.status(400).send("Cannot delete. Please remove assigned workers first.");
    }
};

module.exports = {
    listNakas,
    showForm,
    saveNaka,
    deleteNaka,
};