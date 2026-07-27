// src/controllers/adminBookingController.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PAGE_SIZE = 20;
const ACTIVE_BOOKING_STATUSES = ["ASSIGNED", "IN_PROGRESS"];
const LIVE_BOOKING_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS"];
const BOOKING_STATUSES = [
    "PENDING",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED"
];

function positiveInteger(value, fallback = 1) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeText(value, fallback = "—") {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function parseJsonIds(value) {
    try {
        const parsed = JSON.parse(value || "[]");
        if (!Array.isArray(parsed)) return [];

        return [
            ...new Set(
                parsed
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )
        ];
    } catch (error) {
        return [];
    }
}

function startOfDay(date = new Date()) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
}

function nextDay(date) {
    const value = new Date(date);
    value.setDate(value.getDate() + 1);
    return value;
}

function parseDateInput(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return null;
    }

    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
    if (!value) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function formatDate(value) {
    if (!value) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(value));
}

function timeAgo(value) {
    if (!value) return "—";

    const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(value).getTime()) / 1000)
    );

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 172800) return "Yesterday";
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;

    return formatDate(value);
}

function durationSince(value, endValue = new Date()) {
    if (!value) return "—";

    const start = new Date(value).getTime();
    const end = new Date(endValue).getTime();

    if (Number.isNaN(start) || Number.isNaN(end)) return "—";

    const totalMinutes = Math.max(0, Math.floor((end - start) / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function statusMeta(status) {
    const map = {
        PENDING: {
            label: "Payment Pending",
            classes: "border-amber-200 bg-amber-50 text-amber-700"
        },
        ASSIGNED: {
            label: "Workers Assigned",
            classes: "border-sky-200 bg-sky-50 text-sky-700"
        },
        IN_PROGRESS: {
            label: "Work In Progress",
            classes: "border-violet-200 bg-violet-50 text-violet-700"
        },
        COMPLETED: {
            label: "Completed",
            classes: "border-emerald-200 bg-emerald-50 text-emerald-700"
        },
        CANCELLED: {
            label: "Cancelled",
            classes: "border-red-200 bg-red-50 text-red-700"
        }
    };

    return map[status] || {
        label: safeText(status, "Unknown"),
        classes: "border-stone-200 bg-stone-50 text-stone-700"
    };
}

function buildPageUrl(basePath, query, page) {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (key === "page") return;
        if (value === undefined || value === null || String(value).trim() === "") {
            return;
        }

        params.set(key, String(value));
    });

    params.set("page", String(page));

    return `${basePath}?${params.toString()}`;
}

async function loadNakaSkillMaps(bookings) {
    const nakaIds = new Set();
    const skillIds = new Set();

    bookings.forEach((booking) => {
        if (booking.nakaId) nakaIds.add(Number(booking.nakaId));
        parseJsonIds(booking.selectedNakaIds).forEach((id) => nakaIds.add(id));
        if (booking.skillId) skillIds.add(Number(booking.skillId));
    });

    const [nakas, skills] = await Promise.all([
        nakaIds.size
            ? prisma.naka.findMany({
                  where: { id: { in: Array.from(nakaIds) } },
                  select: {
                      id: true,
                      name: true,
                      pincode: true,
                      city: { select: { name: true } }
                  }
              })
            : [],
        skillIds.size
            ? prisma.skill.findMany({
                  where: { id: { in: Array.from(skillIds) } },
                  select: { id: true, name: true }
              })
            : []
    ]);

    return {
        nakaMap: new Map(nakas.map((naka) => [naka.id, naka])),
        skillMap: new Map(skills.map((skill) => [skill.id, skill]))
    };
}

function decorateBooking(booking, nakaMap, skillMap) {
    const selectedNakaIds = parseJsonIds(booking.selectedNakaIds);
    const selectedNakas = selectedNakaIds
        .map((id) => nakaMap.get(id))
        .filter(Boolean);

    const primaryNaka = nakaMap.get(Number(booking.nakaId)) || null;
    const arrivedWorkerIds = parseJsonIds(booking.arrivedWorkerIds);
    const cancelledWorkerIds = parseJsonIds(booking.cancelledWorkerIds);
    const completedWorkerIds = parseJsonIds(booking.completedWorkerIds);

    return {
        ...booking,
        statusMeta: statusMeta(booking.status),
        createdAtFormatted: formatDateTime(booking.createdAt),
        updatedAtFormatted: formatDateTime(booking.updatedAt),
        createdAgo: timeAgo(booking.createdAt),
        primaryNaka,
        selectedNakas:
            selectedNakas.length > 0
                ? selectedNakas
                : primaryNaka
                  ? [primaryNaka]
                  : [],
        skill: skillMap.get(Number(booking.skillId)) || null,
        arrivedWorkerIds,
        cancelledWorkerIds,
        completedWorkerIds
    };
}

const listBookings = async (req, res) => {
    try {
        const requestedPage = positiveInteger(req.query.page, 1);
        const search = String(req.query.search || "").trim();
        const requestedStatus = String(req.query.status || "").trim().toUpperCase();
        const status = BOOKING_STATUSES.includes(requestedStatus)
            ? requestedStatus
            : "";

        const nakaId = optionalPositiveInteger(req.query.nakaId);
        const skillId = optionalPositiveInteger(req.query.skillId);
        const fromDate = parseDateInput(req.query.fromDate);
        const toDate = parseDateInput(req.query.toDate);

        const where = {};

        if (status) where.status = status;
        if (nakaId) where.nakaId = nakaId;
        if (skillId) where.skillId = skillId;

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = fromDate;
            if (toDate) where.createdAt.lt = nextDay(toDate);
        }

        if (search) {
            const searchAsId = Number(search);
            const or = [
                {
                    customer: {
                        is: {
                            OR: [
                                { name: { contains: search } },
                                { phone: { contains: search } },
                                { businessName: { contains: search } }
                            ]
                        }
                    }
                },
                {
                    workers: {
                        some: {
                            OR: [
                                { name: { contains: search } },
                                { phone: { contains: search } }
                            ]
                        }
                    }
                },
                { razorpayOrderId: { contains: search } },
                { razorpayPaymentId: { contains: search } }
            ];

            if (Number.isInteger(searchAsId) && searchAsId > 0) {
                or.unshift({ id: searchAsId });
            }

            where.OR = or;
        }

        const todayStart = startOfDay();
        const now = new Date();

        const [
            totalRecords,
            allNakas,
            allSkills,
            activeBookings,
            pendingPayments,
            completedToday,
            onlineWorkers
        ] = await Promise.all([
            prisma.booking.count({ where }),
            prisma.naka.findMany({
                select: { id: true, name: true },
                orderBy: { name: "asc" }
            }),
            prisma.skill.findMany({
                select: { id: true, name: true },
                orderBy: { name: "asc" }
            }),
            prisma.booking.count({
                where: { status: { in: ACTIVE_BOOKING_STATUSES } }
            }),
            prisma.booking.count({ where: { status: "PENDING" } }),
            prisma.booking.count({
                where: {
                    status: "COMPLETED",
                    updatedAt: { gte: todayStart }
                }
            }),
            prisma.worker.count({
                where: {
                    isActive: true,
                    availabilityUntil: { gt: now }
                }
            })
        ]);

        const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
        const currentPage = Math.min(requestedPage, totalPages);

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        businessName: true,
                        clientType: true
                    }
                },
                address: {
                    select: {
                        title: true,
                        addressLine: true,
                        city: true,
                        pincode: true
                    }
                },
                workers: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        photoUrl: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip: (currentPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE
        });

        const { nakaMap, skillMap } = await loadNakaSkillMaps(bookings);
        const rows = bookings.map((booking) =>
            decorateBooking(booking, nakaMap, skillMap)
        );

        return res.render("admin/bookings/index", {
            pageTitle: "Bookings",
            rows,
            summary: {
                activeBookings,
                pendingPayments,
                completedToday,
                onlineWorkers
            },
            filters: {
                search,
                status,
                nakaId: nakaId || "",
                skillId: skillId || "",
                fromDate: req.query.fromDate || "",
                toDate: req.query.toDate || ""
            },
            filterOptions: {
                statuses: BOOKING_STATUSES,
                nakas: allNakas,
                skills: allSkills
            },
            pagination: {
                currentPage,
                totalPages,
                totalRecords,
                pageSize: PAGE_SIZE,
                firstRecord:
                    totalRecords === 0
                        ? 0
                        : (currentPage - 1) * PAGE_SIZE + 1,
                lastRecord: Math.min(currentPage * PAGE_SIZE, totalRecords),
                pageUrl: (page) =>
                    buildPageUrl("/admin/bookings", req.query, page)
            }
        });
    } catch (error) {
        console.error("Admin Bookings List Error:", error);

        return res.status(500).send(
            "Bookings load nahi ho payi. Server logs check karein."
        );
    }
};

const showBooking = async (req, res) => {
    try {
        const bookingId = positiveInteger(req.params.id, 0);

        if (!bookingId) {
            return res.status(404).send("Booking not found.");
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                customer: true,
                address: true,
                workers: {
                    include: {
                        nakas: {
                            select: {
                                id: true,
                                name: true,
                                pincode: true
                            }
                        },
                        skills: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                ratings: true,
                workerClientRatings: true,
                conflicts: {
                    include: {
                        timeline: {
                            orderBy: { createdAt: "desc" }
                        }
                    },
                    orderBy: { createdAt: "desc" }
                }
            }
        });

        if (!booking) {
            return res.status(404).send("Booking not found.");
        }

        const { nakaMap, skillMap } = await loadNakaSkillMaps([booking]);
        const row = decorateBooking(booking, nakaMap, skillMap);

        const workers = row.workers.map((worker) => {
            const workerId = Number(worker.id);

            let dutyState = "Assigned";
            let dutyClasses = "border-sky-200 bg-sky-50 text-sky-700";

            if (row.cancelledWorkerIds.includes(workerId)) {
                dutyState = "Cancelled";
                dutyClasses = "border-red-200 bg-red-50 text-red-700";
            } else if (row.completedWorkerIds.includes(workerId)) {
                dutyState = "Completed";
                dutyClasses =
                    "border-emerald-200 bg-emerald-50 text-emerald-700";
            } else if (row.arrivedWorkerIds.includes(workerId)) {
                dutyState = "Arrived / Working";
                dutyClasses =
                    "border-violet-200 bg-violet-50 text-violet-700";
            }

            return {
                ...worker,
                dutyState,
                dutyClasses
            };
        });

        return res.render("admin/bookings/show", {
            pageTitle: `Booking #${row.id}`,
            booking: {
                ...row,
                workers
            },
            helpers: {
                formatDateTime,
                safeText
            }
        });
    } catch (error) {
        console.error("Admin Booking Detail Error:", error);

        return res.status(500).send(
            "Booking details load nahi ho payi. Server logs check karein."
        );
    }
};

const listOnlineWorkers = async (req, res) => {
    try {
        const requestedPage = positiveInteger(req.query.page, 1);
        const search = String(req.query.search || "").trim();
        const state = String(req.query.state || "").trim().toLowerCase();
        const now = new Date();

        const where = {
            isActive: true,
            availabilityUntil: { gt: now }
        };

        if (state === "available") {
            where.isAvailable = true;
        } else if (state === "busy") {
            where.isAvailable = false;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } },
                {
                    nakas: {
                        some: { name: { contains: search } }
                    }
                },
                {
                    skills: {
                        some: { name: { contains: search } }
                    }
                }
            ];
        }

        const [
            totalRecords,
            totalOnline,
            totalAvailable,
            totalBusy
        ] = await Promise.all([
            prisma.worker.count({ where }),
            prisma.worker.count({
                where: {
                    isActive: true,
                    availabilityUntil: { gt: now }
                }
            }),
            prisma.worker.count({
                where: {
                    isActive: true,
                    isAvailable: true,
                    availabilityUntil: { gt: now }
                }
            }),
            prisma.worker.count({
                where: {
                    isActive: true,
                    isAvailable: false,
                    availabilityUntil: { gt: now }
                }
            })
        ]);

        const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
        const currentPage = Math.min(requestedPage, totalPages);

        const workers = await prisma.worker.findMany({
            where,
            include: {
                nakas: {
                    select: {
                        id: true,
                        name: true,
                        pincode: true
                    }
                },
                skills: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                bookings: {
                    where: {
                        status: { in: LIVE_BOOKING_STATUSES }
                    },
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                        customer: {
                            select: {
                                name: true,
                                phone: true
                            }
                        }
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1
                }
            },
            orderBy: [
                { isAvailable: "desc" },
                { availabilityStart: "asc" },
                { lastActive: "desc" }
            ],
            skip: (currentPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE
        });

        const workerIds = workers.map((worker) => worker.id);

        const ratingGroups = workerIds.length
            ? await prisma.rating.groupBy({
                  by: ["workerId"],
                  where: {
                      workerId: {
                          in: workerIds
                      }
                  },
                  _avg: {
                      mehnat: true,
                      vyavhaar: true
                  },
                  _count: {
                      _all: true
                  }
              })
            : [];

        const ratingMap = new Map();

        ratingGroups.forEach((item) => {
            const mehnatRating = Number(item._avg.mehnat || 0);
            const vyavhaarRating = Number(item._avg.vyavhaar || 0);
            const averageRating =
                (mehnatRating + vyavhaarRating) / 2;

            ratingMap.set(item.workerId, {
                averageRating:
                    Number(averageRating.toFixed(1)),
                ratingCount:
                    Number(item._count._all || 0),
                mehnatRating:
                    Number(mehnatRating.toFixed(1)),
                vyavhaarRating:
                    Number(vyavhaarRating.toFixed(1))
            });
        });

        const rows = workers.map((worker) => {
            const liveBooking = worker.bookings[0] || null;
            const onlineSince = worker.availabilityStart || worker.lastActive;
            let currentState = "Available";
            let stateClasses =
                "border-emerald-200 bg-emerald-50 text-emerald-700";

            if (liveBooking?.status === "PENDING") {
                currentState = "Payment Hold";
                stateClasses =
                    "border-amber-200 bg-amber-50 text-amber-700";
            } else if (
                liveBooking &&
                ACTIVE_BOOKING_STATUSES.includes(liveBooking.status)
            ) {
                currentState = "On Booking";
                stateClasses =
                    "border-violet-200 bg-violet-50 text-violet-700";
            } else if (!worker.isAvailable) {
                currentState = "Busy / Locked";
                stateClasses =
                    "border-stone-200 bg-stone-100 text-stone-700";
            }

            return {
                ...worker,
                rating: ratingMap.get(worker.id) || {
                    averageRating: 0,
                    ratingCount: 0,
                    mehnatRating: 0,
                    vyavhaarRating: 0
                },
                liveBooking,
                currentState,
                stateClasses,
                onlineSinceFormatted: formatDateTime(onlineSince),
                onlineFor: durationSince(onlineSince, now),
                lastActiveFormatted: formatDateTime(worker.lastActive),
                lastActiveAgo: timeAgo(worker.lastActive),
                availableUntilFormatted: formatDateTime(
                    worker.availabilityUntil
                )
            };
        });

        return res.render("admin/bookings/online-workers", {
            pageTitle: "Online Workers",
            rows,
            summary: {
                totalOnline,
                totalAvailable,
                totalBusy
            },
            filters: {
                search,
                state
            },
            pagination: {
                currentPage,
                totalPages,
                totalRecords,
                pageSize: PAGE_SIZE,
                firstRecord:
                    totalRecords === 0
                        ? 0
                        : (currentPage - 1) * PAGE_SIZE + 1,
                lastRecord: Math.min(currentPage * PAGE_SIZE, totalRecords),
                pageUrl: (page) =>
                    buildPageUrl(
                        "/admin/bookings/online-workers",
                        req.query,
                        page
                    )
            }
        });
    } catch (error) {
        console.error("Admin Online Workers Error:", error);

        return res.status(500).send(
            "Online workers load nahi ho paye. Server logs check karein."
        );
    }
};

module.exports = {
    listBookings,
    showBooking,
    listOnlineWorkers
};
