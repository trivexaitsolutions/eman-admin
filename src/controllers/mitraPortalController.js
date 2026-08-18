// src/controllers/mitraPortalController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Email se Mitra ko database mein dhoondho
        const mitra = await prisma.mitra.findUnique({ where: { email } });

        // 2. Agar nahi mila ya inactive hai
        if (!mitra || !mitra.isActive) {
            return res.redirect('/mitra/login?error=invalid_credentials');
        }

        // 3. Password match karo
        const isMatch = await bcrypt.compare(password, mitra.password);
        if (!isMatch) {
            return res.redirect('/mitra/login?error=invalid_credentials');
        }

        // 4. Token banao aur role 'MITRA' set karo
        const token = jwt.sign(
            { id: mitra.id, name: mitra.name, email: mitra.email, role: 'MITRA' },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '7d' } // 7 din tak login rahega
        );

        // 5. 'mitraToken' naam ki cookie me save karo
        res.cookie('mitraToken', token, { httpOnly: true });
        res.redirect('/mitra/dashboard');
    } catch (error) {
        console.error("Mitra Login Error:", error);
        res.redirect('/mitra/login');
    }
};

const showDashboard = async (req, res) => {
    try {
        // Assume kar rahe hain ki Mitra login hai aur uski ID req me hai (e.g., req.session.mitra.id)
        // Testing ke liye ID 1 use kar rahe hain, aap isko apne auth bouncer ke hisaab se set karein
        const mitraId = req.user ? req.user.id : 1; 

        // Time logic: Aaj ki shuruwat aur Is mahine ki shuruwat
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // --- WORKERS STATS ---
        const totalWorkers = await prisma.worker.count({ where: { mitraId } });
        const workersToday = await prisma.worker.count({ where: { mitraId, createdAt: { gte: startOfToday } } });
        const workersMonth = await prisma.worker.count({ where: { mitraId, createdAt: { gte: startOfMonth } } });

        // --- CLIENTS STATS ---
        const totalClients = await prisma.customer.count({ where: { mitraId } });
        const clientsToday = await prisma.customer.count({ where: { mitraId, createdAt: { gte: startOfToday } } });
        const clientsMonth = await prisma.customer.count({ where: { mitraId, createdAt: { gte: startOfMonth } } });

        // Worker ke direct "Connect Mitra" cancellation requests.
        const pendingWorkerRequests = await prisma.conflict.count({
            where: {
                mitraId,
                raisedByType: "WORKER",
                requestedAction: "CANCEL_DUTY",
                status: {
                    in: ["PENDING", "IN_PROGRESS"],
                },
            },
        });

        // Data EJS ko bhejna
        const stats = {
            totalWorkers, workersToday, workersMonth,
            totalClients, clientsToday, clientsMonth,
            pendingWorkerRequests,
            totalNetwork: totalWorkers + totalClients
        };

        return res.render("mitra/dashboard", {
            layout: false,
            stats,

            success_msg: req.query.success || null,
            error_msg: req.query.error || null,

            activePage: "dashboard",

            mitraName:
                req.user?.name ||
                req.user?.fullName ||
                "Mitra",
        });

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        res.status(500).send("Server Error");
    }
};

const logout = (req, res) => {
    res.clearCookie('mitraToken');
    res.redirect('/mitra/login');
};

const getAddClient = (req, res) => {
    return res.render("mitra/add-client", {
        layout: false,
        isEdit: false,
        client: null,
        primaryAddress: null,
        success_msg: req.query.success || null,
        error_msg: req.query.error || null,
    });
};

// POST: Naye Client ka data database me save karne ke liye
const postAddClient = async (req, res) => {
    const redirectWithError = (message) => {
        return res.redirect(
            `/mitra/clients/add?error=${encodeURIComponent(message)}`
        );
    };

    const cleanText = (value) => {
        const text = String(value || "").trim();
        return text || null;
    };

    const cleanPhone = (value) => {
        return String(value || "").replace(/\D/g, "");
    };

    const parseCoordinate = (value, fieldName, min, max) => {
        const rawValue = cleanText(value);

        if (!rawValue) {
            throw new Error(`${fieldName} is required.`);
        }

        const parsedValue = Number(rawValue);

        if (
            !Number.isFinite(parsedValue) ||
            parsedValue < min ||
            parsedValue > max
        ) {
            throw new Error(`${fieldName} is invalid.`);
        }

        return parsedValue.toFixed(6);
    };

    try {
        const {
            clientType,
            contactName,
            phone,
            email,
            businessName,
            businessType,
            gstNumber,
            workerRequirement,

            // Work-site location fields
            siteAddress,
            siteLatitude,
            siteLongitude,
            siteLocationSource,
        } = req.body;

        const finalClientType = cleanText(clientType);
        const finalContactName = cleanText(contactName);
        const finalPhone = cleanPhone(phone);
        const finalEmail = cleanText(email)?.toLowerCase() || null;

        // ---------------------------------------
        // Client validation
        // ---------------------------------------
        if (
            !finalClientType ||
            !["Individual", "Company"].includes(finalClientType)
        ) {
            return redirectWithError(
                "Please select a valid client type."
            );
        }

        if (!finalContactName || finalContactName.length < 2) {
            return redirectWithError(
                "Please enter client contact person name."
            );
        }

        if (!/^[6-9]\d{9}$/.test(finalPhone)) {
            return redirectWithError(
                "Please enter a valid 10-digit Indian mobile number."
            );
        }

        if (
            finalEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)
        ) {
            return redirectWithError(
                "Please enter a valid email address."
            );
        }

        if (
            finalClientType === "Company" &&
            !cleanText(businessName)
        ) {
            return redirectWithError(
                "Company name is required for a company client."
            );
        }

        if (
            finalClientType === "Company" &&
            !cleanText(businessType)
        ) {
            return redirectWithError(
                "Business type is required for a company client."
            );
        }

        // ---------------------------------------
        // Work-site written address validation
        // ---------------------------------------
        const finalSiteAddress = cleanText(siteAddress);

        if (!finalSiteAddress || finalSiteAddress.length < 10) {
            return redirectWithError(
                "Please enter complete work site address with room, flat, plot or shop details."
            );
        }

        // ---------------------------------------
        // Current location validation
        // ---------------------------------------
        const finalLatitude = parseCoordinate(
            siteLatitude,
            "Current location latitude",
            -90,
            90
        );

        const finalLongitude = parseCoordinate(
            siteLongitude,
            "Current location longitude",
            -180,
            180
        );

        if (siteLocationSource !== "CURRENT_LOCATION") {
            return redirectWithError(
                "Please capture the current work site location first."
            );
        }

        const mitraId = req.user?.id;

        if (!mitraId) {
            return redirectWithError(
                "Mitra session was not found. Please login again."
            );
        }

        const existingCustomer = await prisma.customer.findUnique({
            where: {
                phone: finalPhone,
            },
        });

        const finalCustomerEmail =
            finalEmail ||
            existingCustomer?.email ||
            `${finalPhone}@eman-b2b.com`;

        const customerPayload = {
            clientType: finalClientType,
            name: finalContactName,
            email: finalCustomerEmail,

            // Legacy field — old pages safe rahengi
            siteAddress: finalSiteAddress,

            businessName:
                finalClientType === "Company"
                    ? cleanText(businessName)
                    : null,

            businessType:
                finalClientType === "Company"
                    ? cleanText(businessType)
                    : null,

            gstNumber:
                finalClientType === "Company"
                    ? cleanText(gstNumber)?.toUpperCase() || null
                    : null,

            workerRequirement: cleanText(workerRequirement),
            isVerified: true,
            mitraId,
        };

        await prisma.$transaction(async (tx) => {
            let savedCustomer;

            if (existingCustomer) {
                savedCustomer = await tx.customer.update({
                    where: {
                        id: existingCustomer.id,
                    },
                    data: customerPayload,
                });
            } else {
                savedCustomer = await tx.customer.create({
                    data: {
                        phone: finalPhone,
                        ...customerPayload,
                    },
                });
            }

            const existingPrimaryWorkSite =
                await tx.customerAddress.findFirst({
                    where: {
                        customerId: savedCustomer.id,
                        title: "Primary Work Site",
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                });

            // Is client ka latest Mitra-added site default hoga
            await tx.customerAddress.updateMany({
                where: {
                    customerId: savedCustomer.id,
                },
                data: {
                    isDefault: false,
                },
            });

            const workSiteAddressData = {
                title: "Primary Work Site",
                fullName: finalContactName,
                phone: finalPhone,

                // User app aur worker app dono yahi readable address use karenge
                addressLine: finalSiteAddress,

                // Same written details future structured UI ke liye bhi store
                addressDetail: finalSiteAddress,

                // Auto address fetching use nahi kar rahe
                mapAddress: null,
                landmark: null,
                city: null,
                state: null,
                pincode: null,
                placeId: null,

                latitude: finalLatitude,
                longitude: finalLongitude,
                locationSource: "CURRENT_LOCATION",

                isDefault: true,
            };

            if (existingPrimaryWorkSite) {
                await tx.customerAddress.update({
                    where: {
                        id: existingPrimaryWorkSite.id,
                    },
                    data: workSiteAddressData,
                });
            } else {
                await tx.customerAddress.create({
                    data: {
                        customerId: savedCustomer.id,
                        ...workSiteAddressData,
                    },
                });
            }
        });

        return res.redirect(
            "/mitra/dashboard?success=" +
            encodeURIComponent("Client added successfully.")
        );
    } catch (error) {
        console.error("Add Client Error:", error);

        if (error?.code === "P2002") {
            return redirectWithError(
                "A client with this mobile number or email already exists."
            );
        }

        return redirectWithError(
            error.message ||
            "Client save nahi ho paya. Please check all details."
        );
    }
};






const showEditClient = async (req, res) => {
    try {
        const mitraId = Number(req.user?.id);
        const customerId = Number(req.params.id);

        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return res.redirect(
                "/mitra/dashboard?error=" +
                encodeURIComponent("Mitra session was not found.")
            );
        }

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.redirect(
                "/mitra/clients?error=" +
                encodeURIComponent("Invalid client selected.")
            );
        }

        const client = await prisma.customer.findFirst({
            where: {
                id: customerId,
                mitraId,
            },
            include: {
                addresses: {
                    orderBy: [
                        { isDefault: "desc" },
                        { updatedAt: "desc" },
                    ],
                    take: 1,
                },
            },
        });

        if (!client) {
            return res.redirect(
                "/mitra/clients?error=" +
                encodeURIComponent("Client was not found or is not assigned to you.")
            );
        }

        return res.render("mitra/add-client", {
            layout: false,
            isEdit: true,
            client,
            primaryAddress: client.addresses?.[0] || null,
            success_msg: req.query.success || null,
            error_msg: req.query.error || null,
        });
    } catch (error) {
        console.error("Show Edit Client Error:", error);

        return res.redirect(
            "/mitra/clients?error=" +
            encodeURIComponent("Client edit page load nahi ho paya.")
        );
    }
};

const updateClient = async (req, res) => {
    const customerId = Number(req.params.id);

    const redirectWithError = (message) => {
        return res.redirect(
            `/mitra/clients/edit/${customerId}?error=${encodeURIComponent(message)}`
        );
    };

    const cleanText = (value) => {
        const text = String(value || "").trim();
        return text || null;
    };

    const cleanPhone = (value) => String(value || "").replace(/\D/g, "");

    const parseCoordinate = (value, fieldName, min, max) => {
        const rawValue = cleanText(value);

        if (!rawValue) {
            throw new Error(`${fieldName} is required.`);
        }

        const parsedValue = Number(rawValue);

        if (
            !Number.isFinite(parsedValue) ||
            parsedValue < min ||
            parsedValue > max
        ) {
            throw new Error(`${fieldName} is invalid.`);
        }

        return parsedValue.toFixed(6);
    };

    try {
        const mitraId = Number(req.user?.id);

        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return redirectWithError("Mitra session was not found. Please login again.");
        }

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.redirect(
                "/mitra/clients?error=" +
                encodeURIComponent("Invalid client selected.")
            );
        }

        const existingCustomer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                mitraId,
            },
            include: {
                addresses: {
                    where: {
                        title: "Primary Work Site",
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                    take: 1,
                },
            },
        });

        if (!existingCustomer) {
            return res.redirect(
                "/mitra/clients?error=" +
                encodeURIComponent("Client was not found or is not assigned to you.")
            );
        }

        const {
            clientType,
            contactName,
            phone,
            email,
            businessName,
            businessType,
            gstNumber,
            workerRequirement,
            siteAddress,
            siteLatitude,
            siteLongitude,
            siteLocationSource,
        } = req.body;

        const finalClientType = cleanText(clientType);
        const finalContactName = cleanText(contactName);
        const finalPhone = cleanPhone(phone);
        const finalEmail = cleanText(email)?.toLowerCase() || null;
        const finalSiteAddress = cleanText(siteAddress);

        if (!finalClientType || !["Individual", "Company"].includes(finalClientType)) {
            return redirectWithError("Please select a valid client type.");
        }

        if (!finalContactName || finalContactName.length < 2) {
            return redirectWithError("Please enter client contact person name.");
        }

        if (!/^[6-9]\d{9}$/.test(finalPhone)) {
            return redirectWithError("Please enter a valid 10-digit Indian mobile number.");
        }

        if (finalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
            return redirectWithError("Please enter a valid email address.");
        }

        if (finalClientType === "Company" && !cleanText(businessName)) {
            return redirectWithError("Company name is required for a company client.");
        }

        if (finalClientType === "Company" && !cleanText(businessType)) {
            return redirectWithError("Business type is required for a company client.");
        }

        if (!finalSiteAddress || finalSiteAddress.length < 10) {
            return redirectWithError(
                "Please enter complete work site address with room, flat, plot or shop details."
            );
        }

        const finalLatitude = parseCoordinate(
            siteLatitude,
            "Current location latitude",
            -90,
            90
        );

        const finalLongitude = parseCoordinate(
            siteLongitude,
            "Current location longitude",
            -180,
            180
        );

        if (siteLocationSource !== "CURRENT_LOCATION") {
            return redirectWithError(
                "Please capture the current work site location first."
            );
        }

        const duplicatePhone = await prisma.customer.findFirst({
            where: {
                phone: finalPhone,
                NOT: {
                    id: customerId,
                },
            },
            select: { id: true },
        });

        if (duplicatePhone) {
            return redirectWithError(
                "This mobile number is already registered for another client."
            );
        }

        if (finalEmail) {
            const duplicateEmail = await prisma.customer.findFirst({
                where: {
                    email: finalEmail,
                    NOT: {
                        id: customerId,
                    },
                },
                select: { id: true },
            });

            if (duplicateEmail) {
                return redirectWithError(
                    "This email address is already registered for another client."
                );
            }
        }

        const customerData = {
            clientType: finalClientType,
            name: finalContactName,
            phone: finalPhone,
            email: finalEmail,
            siteAddress: finalSiteAddress,
            businessName:
                finalClientType === "Company"
                    ? cleanText(businessName)
                    : null,
            businessType:
                finalClientType === "Company"
                    ? cleanText(businessType)
                    : null,
            gstNumber:
                finalClientType === "Company"
                    ? cleanText(gstNumber)?.toUpperCase() || null
                    : null,
            workerRequirement: cleanText(workerRequirement),
        };

        const workSiteAddressData = {
            title: "Primary Work Site",
            fullName: finalContactName,
            phone: finalPhone,
            addressLine: finalSiteAddress,
            addressDetail: finalSiteAddress,
            mapAddress: null,
            landmark: null,
            city: null,
            state: null,
            pincode: null,
            placeId: null,
            latitude: finalLatitude,
            longitude: finalLongitude,
            locationSource: "CURRENT_LOCATION",
            isDefault: true,
        };

        await prisma.$transaction(async (tx) => {
            await tx.customer.update({
                where: {
                    id: customerId,
                },
                data: customerData,
            });

            await tx.customerAddress.updateMany({
                where: {
                    customerId,
                },
                data: {
                    isDefault: false,
                },
            });

            const existingPrimaryWorkSite = existingCustomer.addresses?.[0] || null;

            if (existingPrimaryWorkSite) {
                await tx.customerAddress.update({
                    where: {
                        id: existingPrimaryWorkSite.id,
                    },
                    data: workSiteAddressData,
                });
            } else {
                await tx.customerAddress.create({
                    data: {
                        customerId,
                        ...workSiteAddressData,
                    },
                });
            }
        });

        return res.redirect(
            "/mitra/clients?success=" +
            encodeURIComponent("Client updated successfully.")
        );
    } catch (error) {
        console.error("Update Client Error:", error);

        if (error?.code === "P2002") {
            return redirectWithError(
                "A client with this mobile number or email already exists."
            );
        }

        return redirectWithError(
            error.message ||
            "Client update nahi ho paya. Please check all details."
        );
    }
};

const listMitraClients = async (req, res) => {
    try {
        const mitraId = Number(req.user?.id);

        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return res.redirect(
                "/mitra/dashboard?error=" +
                encodeURIComponent("Mitra session was not found.")
            );
        }

        const search = String(req.query.search || "").trim();
        const type = String(req.query.type || "ALL").toUpperCase();

        const where = {
            mitraId,
        };

        if (type === "COMPANY") {
            where.clientType = "Company";
        }

        if (type === "INDIVIDUAL") {
            where.clientType = "Individual";
        }

        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                    },
                },
                {
                    businessName: {
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
            ];
        }

        const clients = await prisma.customer.findMany({
            where,
            include: {
                addresses: {
                    where: {
                        isDefault: true,
                    },
                    select: {
                        id: true,
                        addressLine: true,
                        pincode: true,
                        latitude: true,
                        longitude: true,
                        updatedAt: true,
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                    take: 1,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.render("mitra/clients", {
            layout: false,
            clients,
            filters: {
                search,
                type:
                    type === "COMPANY" || type === "INDIVIDUAL"
                        ? type
                        : "ALL",
            },
            success_msg: req.query.success || null,
            error_msg: req.query.error || null,
            activePage: "clients",
            mitraName:
                req.user?.name ||
                req.user?.fullName ||
                "Mitra",
        });
    } catch (error) {
        console.error("Mitra Client List Error:", error);

        return res.redirect(
            "/mitra/dashboard?error=" +
            encodeURIComponent("Clients list load nahi ho payi.")
        );
    }
};

const calculateMitraConflictAmounts = (conflict) => {
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

const formatMitraConflict = (conflict) => {
    const booking = conflict.booking;
    const customer = booking?.customer || null;

    const worker =
        booking?.workers?.find(
            (w) => Number(w.id) === Number(conflict.workerId)
        ) || null;

    const amountData = calculateMitraConflictAmounts(conflict);

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

        totalBookingAmount: amountData.totalBookingAmount,
        perWorkerAmount: amountData.perWorkerAmount,
        suggestedRefundAmount: amountData.suggestedRefundAmount,

        createdAt: conflict.createdAt,
        updatedAt: conflict.updatedAt,

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

        timeline: conflict.timeline || [],
    };
};

const getMitraConflicts = async (req, res) => {
    try {
        const mitraId = req.user ? req.user.id : 1;

        const { status, fromDate, toDate } = req.query;

        const now = new Date();

        const defaultFromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultToDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const finalFromDate =
            fromDate || defaultFromDate.toISOString().split("T")[0];

        const finalToDate =
            toDate || defaultToDate.toISOString().split("T")[0];

        const where = {
            mitraId: Number(mitraId),
        };

        if (status && status !== "ALL") {
            where.status = status;
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

        const formattedConflicts = conflicts.map(formatMitraConflict);

        return res.render("mitra/conflicts", {
            layout: false,
            mitra: req.user,
            conflicts: formattedConflicts,
            filters: {
                status: status || "ALL",
                fromDate: finalFromDate,
                toDate: finalToDate,
            },
        });
    } catch (error) {
        console.error("Mitra Conflicts Error:", error);
        return res.status(500).send("Server Error while loading conflicts");
    }
};

const getMitraConflictDetails = async (req, res) => {
    try {
        const mitraId = req.user ? req.user.id : 1;
        const { id } = req.params;

        const conflict = await prisma.conflict.findFirst({
            where: {
                id: parseInt(id),
                mitraId: Number(mitraId),
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
            return res.status(404).send("Conflict not found or not assigned to you");
        }

        const formattedConflict = formatMitraConflict(conflict);

        return res.render("mitra/conflict-review", {
            layout: false,
            mitra: req.user,
            conflict: formattedConflict,
        });
    } catch (error) {
        console.error("Mitra Conflict Details Error:", error);
        return res.status(500).send("Server Error while loading conflict details");
    }
};

const updateMitraConflictStatus = async (req, res) => {
    try {
        const mitraId = req.user ? req.user.id : 1;
        const { id } = req.params;
        const { status, note, penaltyAmount } = req.body;

        if (!status || !["PENDING", "IN_PROGRESS", "SOLVED", "UNRESOLVED"].includes(status)) {
            return res.status(400).send("Invalid status");
        }

        if (!note || !note.trim()) {
            return res.status(400).send("Note is required");
        }

        const conflict = await prisma.conflict.findFirst({
            where: {
                id: parseInt(id),
                mitraId: Number(mitraId),
            },
        });

        if (!conflict) {
            return res.status(404).send("Conflict not found or not assigned to you");
        }

        const isWorkerCancellation =
            conflict.raisedByType === "WORKER" &&
            conflict.requestedAction === "CANCEL_DUTY";

        let finalPenaltyAmount = conflict.penaltyAmount || 0;

        // Penalty is a Mitra decision and becomes final only when the
        // worker cancellation conflict is marked SOLVED.
        if (isWorkerCancellation && status === "SOLVED") {
            const rawPenalty = String(penaltyAmount ?? "").trim();

            if (!/^\d+$/.test(rawPenalty)) {
                return res.status(400).send("Penalty amount must be 0 or a positive whole number");
            }

            finalPenaltyAmount = Number(rawPenalty);

            if (!Number.isSafeInteger(finalPenaltyAmount)) {
                return res.status(400).send("Invalid penalty amount");
            }
        }

        const updateData = { status };
        let timelineNote = note.trim();

        if (isWorkerCancellation && status === "SOLVED") {
            updateData.penaltyAmount = finalPenaltyAmount;
            timelineNote = `Worker penalty finalized by Mitra: ₹${finalPenaltyAmount}. ${timelineNote}`;
        } else if (isWorkerCancellation) {
            updateData.penaltyAmount = 0;
        }

        await prisma.$transaction(async (tx) => {
            await tx.conflict.update({
                where: {
                    id: parseInt(id),
                },
                data: updateData,
            });

            await tx.conflictTimeline.create({
                data: {
                    conflictId: parseInt(id),
                    updatedByType: "MITRA",
                    updatedById: Number(mitraId),
                    oldStatus: conflict.status,
                    newStatus: status,
                    note: timelineNote,
                },
            });
        });

        return res.redirect(`/mitra/conflicts/${id}`);
    } catch (error) {
        console.error("Mitra Conflict Update Error:", error);
        return res.status(500).send("Server Error while updating conflict");
    }
};


module.exports = {
    listMitraClients,
    login,
    showDashboard,
    logout,
    getAddClient,
    postAddClient,
    showEditClient,
    updateClient,
    getMitraConflicts,
    getMitraConflictDetails,
    updateMitraConflictStatus,
};
