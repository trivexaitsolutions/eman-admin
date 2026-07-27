// src/controllers/userController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendOtpEmail } = require('../utils/mailer');

const NAKA_VERIFIED_STATUS = 'VERIFIED';

const getNakaVerificationCutoff = () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff;
};

// 1. Send OTP (For both Login and Register)
// 1. Send OTP (For both Login and Register)
const sendOtp = async (req, res) => {
    const { email, phone, name } = req.body;

    if (!email && !phone) {
        return res.status(400).json({ success: false, message: "Email ya Phone number zaroori hai" });
    }

    try {
        // Database me check karo ki kya yeh user exist karta hai
        let customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { email: email || '' },
                    { phone: phone || '' }
                ]
            }
        });

        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        if (!customer) {
            // ----- NAYA LOGIC YAHAN HAI -----
            // Agar 'name' nahi aaya, matlab user Login screen se naya email daal raha hai
            if (!name) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Account nahi mila! Kripya niche 'Create Account' par click karke pehle register karein." 
                });
            }

            // Agar 'name' aaya hai, matlab sahi me naya registration hai
            if (!email || !phone) {
                return res.status(400).json({ success: false, message: "Naye account ke liye Name, Email, aur Phone sab zaruri hai!" });
            }
            
            // Naya customer banao
            customer = await prisma.customer.create({
                data: { name, phone, email, otp: generatedOtp, otpExpiry: expiryTime }
            });
        } else {
            // Agar account pehle se hai, par user galti se "Create Account" wale form se aaya hai
            if (name) {
                // YAHAN HUM CHECK KARENGE KYA DUPLICATE HAI
                if (customer.phone === phone && customer.email === email) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Yeh Phone Number aur Email dono pehle se registered hain! Kripya Login karein." 
                    });
                } else if (customer.phone === phone) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Yeh Phone Number kisi aur account se juda hai. Kripya dusra number use karein." 
                    });
                } else if (customer.email === email) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Yeh Email ID pehle se registered hai. Kripya dusri email daalein." 
                    });
                }
            }

            // Purane customer ka OTP update karo (Login process)
            customer = await prisma.customer.update({
                where: { id: customer.id },
                data: { otp: generatedOtp, otpExpiry: expiryTime }
            });
        }

        // Email par OTP bhejien
        const emailSent = await sendOtpEmail(customer.email, generatedOtp);

        if (emailSent) {
            res.json({ success: true, message: `OTP ${customer.email} par bhej diya gaya hai!`, customerId: customer.id });
        } else {
            res.status(500).json({ success: false, message: "Email bhejne me problem aayi." });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// 2. Verify OTP
const verifyOtp = async (req, res) => {
    const { customerId, otp, pushToken } = req.body;

    try {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });

        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer nahi mila" });
        }

        // Check if OTP matches and is not expired
        if (customer.otp !== otp) {
            return res.status(400).json({ success: false, message: "Galat OTP!" });
        }

        if (new Date() > customer.otpExpiry) {
            return res.status(400).json({ success: false, message: "OTP expire ho chuka hai!" });
        }

        // OTP verify ho gaya, ab usko database se hata do security ke liye
        await prisma.customer.update({
            where: { id: customerId },
            data: { otp: null, otpExpiry: null }
        });


        const updatedUser = await prisma.customer.update({ // Ya prisma.user
            where: { id: customerId },
            data: { 
                pushToken: pushToken || null // Agar token mila toh save karo, warna null
            }
        });
        res.json({ success: true, message: "Login Successful!", customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
const getBookingOptions = async (req, res) => {
    try {
        const verificationCutoff = getNakaVerificationCutoff();

        // Admin setting read karo. Row missing ho toh current working AUTO mode use hoga.
        let bookingSetting = null;

        try {
            bookingSetting = await prisma.bookingSetting.findUnique({
                where: { id: 1 },
                select: {
                    assignmentMode: true,
                    updatedAt: true
                }
            });
        } catch (settingError) {
            // Booking options ko setting read failure ki wajah se break nahi karna.
            console.error("Booking setting fetch error; using AUTO fallback:", settingError);
        }

        const assignmentMode = bookingSetting?.assignmentMode || "AUTO";

        const [skills, cities, nakas] = await Promise.all([
            prisma.skill.findMany({
                where: { isActive: true },
                include: { rates: true }
            }),

            prisma.city.findMany(),

            // Customer ko sirf currently verified Nakas dikhane hain
            prisma.naka.findMany({
                where: {
                    verificationStatus: NAKA_VERIFIED_STATUS,
                    lastVerifiedAt: {
                        gte: verificationCutoff
                    }
                },
                orderBy: {
                    name: "asc"
                }
            })
        ]);

        return res.json({
            success: true,
            assignmentMode,
            settingUpdatedAt: bookingSetting?.updatedAt || null,
            skills,
            cities,
            nakas
        });

    } catch (error) {
        console.error("Options fetch error:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

const searchNakas = async (req, res) => {
    try {
        const search = String(req.query.q || "").trim();

        // Empty search par saare Nakas return nahi karne
        if (!search) {
            return res.json({
                success: true,
                nakas: []
            });
        }

        const verificationCutoff = new Date();
        verificationCutoff.setMonth(
            verificationCutoff.getMonth() - 6
        );

        const nakas = await prisma.naka.findMany({
            where: {
                verificationStatus: "VERIFIED",

                lastVerifiedAt: {
                    gte: verificationCutoff
                },

                OR: [
                    {
                        name: {
                            contains: search
                        }
                    },
                    {
                        pincode: {
                            contains: search
                        }
                    },
                    {
                        city: {
                            name: {
                                contains: search
                            }
                        }
                    }
                ]
            },

            select: {
                id: true,
                name: true,
                pincode: true,
                landmark: true,
                cityId: true,

                city: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },

            orderBy: {
                name: "asc"
            },

            take: 20
        });

        return res.json({
            success: true,
            nakas
        });

    } catch (error) {
        console.error("Search Nakas Error:", error);

        return res.status(500).json({
            success: false,
            message: "Nakas search nahi ho paye."
        });
    }
};


const getAvailableWorkers = async (req, res) => {
    try {
        const {
            nakaIds,
            skillId,
            minRating = 0
        } = req.body;

        /*
        |--------------------------------------------------------------------------
        | 1. Admin mode check
        |--------------------------------------------------------------------------
        */

        let assignmentMode = "AUTO";

        try {
            const bookingSetting =
                await prisma.bookingSetting.findUnique({
                    where: { id: 1 },
                    select: {
                        assignmentMode: true
                    }
                });

            assignmentMode =
                bookingSetting?.assignmentMode || "AUTO";
        } catch (settingError) {
            console.error(
                "Available workers setting fetch error:",
                settingError
            );
        }

        if (assignmentMode !== "CUSTOMER_SELECT") {
            return res.status(409).json({
                success: false,
                code: "WORKER_SELECTION_DISABLED",
                assignmentMode,
                message:
                    "Customer worker selection is currently disabled."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 2. Request validation
        |--------------------------------------------------------------------------
        */

        if (!Array.isArray(nakaIds)) {
            return res.status(400).json({
                success: false,
                message: "Please select nearby Nakas."
            });
        }

        const validNakaIds = [
            ...new Set(
                nakaIds
                    .map((id) => Number(id))
                    .filter(
                        (id) =>
                            Number.isInteger(id) &&
                            id > 0
                    )
            )
        ];

        const parsedSkillId = Number(skillId);
        const parsedMinRating = Number(minRating || 0);

        if (
            validNakaIds.length < 1 ||
            validNakaIds.length > 3
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please select between 1 and 3 Nakas."
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
            !Number.isFinite(parsedMinRating) ||
            parsedMinRating < 0 ||
            parsedMinRating > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid minimum rating selected."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 3. Validate selected Nakas and skill
        |--------------------------------------------------------------------------
        */

        const verificationCutoff =
            getNakaVerificationCutoff();

        const [verifiedNakas, skill] =
            await Promise.all([
                prisma.naka.findMany({
                    where: {
                        id: {
                            in: validNakaIds
                        },
                        verificationStatus:
                            NAKA_VERIFIED_STATUS,
                        lastVerifiedAt: {
                            gte: verificationCutoff
                        }
                    },
                    select: {
                        id: true,
                        name: true
                    }
                }),

                prisma.skill.findFirst({
                    where: {
                        id: parsedSkillId,
                        isActive: true
                    },
                    select: {
                        id: true,
                        name: true
                    }
                })
            ]);

        if (
            verifiedNakas.length !==
            validNakaIds.length
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "One or more selected Nakas are not currently available."
            });
        }

        if (!skill) {
            return res.status(400).json({
                success: false,
                message: "Selected skill is not available."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 4. Find active and currently available workers
        |--------------------------------------------------------------------------
        */

        const now = new Date();

        const workers = await prisma.worker.findMany({
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

            select: {
                id: true,
                name: true,
                photoUrl: true,
                age: true,
                gender: true,
                qualification: true,
                lastActive: true,
                availabilityUntil: true,

                nakas: {
                    where: {
                        id: {
                            in: validNakaIds
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        pincode: true,

                        city: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },

                skills: {
                    where: {
                        id: parsedSkillId
                    },
                    select: {
                        id: true,
                        name: true
                    }
                }
            },

            orderBy: {
                lastActive: "desc"
            },

            take: 100
        });

        if (workers.length === 0) {
            return res.json({
                success: true,
                assignmentMode,
                selectedNakas: verifiedNakas,
                skill,
                workers: [],
                total: 0
            });
        }

        /*
        |--------------------------------------------------------------------------
        | 5. Calculate worker ratings
        |--------------------------------------------------------------------------
        */

        const workerIds =
            workers.map((worker) => worker.id);

        const ratingGroups =
            await prisma.rating.groupBy({
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
            });

        const ratingMap = new Map();

        ratingGroups.forEach((item) => {
            const mehnat =
                Number(item._avg.mehnat || 0);

            const vyavhaar =
                Number(item._avg.vyavhaar || 0);

            const averageRating =
                (mehnat + vyavhaar) / 2;

            ratingMap.set(item.workerId, {
                averageRating:
                    Number(averageRating.toFixed(1)),

                ratingCount:
                    Number(item._count._all || 0),

                mehnatRating:
                    Number(mehnat.toFixed(1)),

                vyavhaarRating:
                    Number(vyavhaar.toFixed(1))
            });
        });

        /*
        |--------------------------------------------------------------------------
        | 6. Safe response + minimum rating filter
        |--------------------------------------------------------------------------
        */

        const safeWorkers = workers
            .map((worker) => {
                const rating =
                    ratingMap.get(worker.id) || {
                        averageRating: 0,
                        ratingCount: 0,
                        mehnatRating: 0,
                        vyavhaarRating: 0
                    };

                return {
                    id: worker.id,
                    name: worker.name,
                    photoUrl: worker.photoUrl,
                    age: worker.age,
                    gender: worker.gender,
                    qualification:
                        worker.qualification,

                    averageRating:
                        rating.averageRating,

                    ratingCount:
                        rating.ratingCount,

                    mehnatRating:
                        rating.mehnatRating,

                    vyavhaarRating:
                        rating.vyavhaarRating,

                    availabilityUntil:
                        worker.availabilityUntil,

                    nakas: worker.nakas,
                    skills: worker.skills
                };
            })
            .filter((worker) => {
                if (parsedMinRating === 0) {
                    return true;
                }

                return (
                    worker.ratingCount > 0 &&
                    worker.averageRating >=
                        parsedMinRating
                );
            })
            .sort((a, b) => {
                if (
                    b.averageRating !==
                    a.averageRating
                ) {
                    return (
                        b.averageRating -
                        a.averageRating
                    );
                }

                return (
                    b.ratingCount -
                    a.ratingCount
                );
            });

        return res.json({
            success: true,
            assignmentMode,
            selectedNakas: verifiedNakas,
            skill,
            workers: safeWorkers,
            total: safeWorkers.length
        });

    } catch (error) {
        console.error(
            "Available Workers Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Available workers fetch nahi ho paye."
        });
    }
};


module.exports = {
    sendOtp,
    verifyOtp,
    getBookingOptions,
    searchNakas,
    getAvailableWorkers
};