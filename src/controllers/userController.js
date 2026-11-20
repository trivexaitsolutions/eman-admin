// src/controllers/userController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendOtpViaConfiguredProvider } = require('../services/otpDelivery');
const { getSettings } = require('../services/apiIntegrations');
const { reserveOtp } = require('../utils/otpRateLimit');
const { randomInt } = require('node:crypto');
const { uppercaseName } = require('../utils/registration');
const {
    findNearbyVerifiedNakas
} = require('../utils/nearbyNakas');
const {
    getBookingSetting,
    toPublicMapSettings
} = require('../utils/bookingSettings');
const { normalizeDuration, durationRate, workerDayBaseRate } = require('../utils/workerDuration');

// Foreground-only heartbeat; inactivity is determined using a two-minute TTL.
const updateCustomerPresence = async (req, res) => {
    const customerId = Number(req.body?.customerId);
    if (!Number.isSafeInteger(customerId) || customerId < 1) {
        return res.status(400).json({ success: false, message: "Valid customer ID required." });
    }
    try {
        // Client app sends online=false on background/logout. Avoid guessing
        // presence based on customer.updatedAt or Expo push token.
        const result = await prisma.customer.updateMany({
            where: { id: customerId },
            data: { lastSeenAt: req.body?.online === false ? null : new Date() },
        });
        if (!result.count) return res.status(404).json({ success: false, message: "Customer not found." });
        return res.json({ success: true });
    } catch (error) {
        console.error("Customer presence update error:", error);
        return res.status(500).json({ success: false, message: "Presence update failed." });
    }
};

const NAKA_VERIFIED_STATUS = 'VERIFIED';

const getNakaVerificationCutoff = () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff;
};

// Customer login and registration OTP flow.
// Never create an account until the email provider accepts the OTP message.
// A pending (unverified) account can retry with its original phone/email.
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').trim();

const sendOtp = async (req, res) => {
    const {
        name, clientType, businessName, businessType, gstNumber
    } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const isRegistration = Boolean(String(name || '').trim());

    if (!email && !phone) {
        return res.status(400).json({ success: false, message: 'Email ya Phone number zaroori hai.' });
    }

    try {
        let customer = null;
        let registrationData = null;

        if (isRegistration) {
            if (!email || !phone) {
                return res.status(400).json({ success: false, message: 'Registration ke liye Name, Email aur Phone sab zaroori hain.' });
            }
            if (!/^\S+@\S+\.\S+$/.test(email)) {
                return res.status(400).json({ success: false, message: 'Valid email address daalein.' });
            }

            const type = clientType === 'Company' ? 'Company' : 'Individual';
            if (type === 'Company' && (!String(businessName || '').trim() || !String(businessType || '').trim())) {
                return res.status(400).json({ success: false, message: 'Company name and industry type are required.' });
            }

            // Check both unique identifiers independently. An OR query alone can
            // pick an arbitrary matching account and misreport which field conflicts.
            const [phoneMatch, emailMatch] = await Promise.all([
                prisma.customer.findUnique({ where: { phone } }),
                prisma.customer.findUnique({ where: { email } })
            ]);
            if (phoneMatch && emailMatch && phoneMatch.id !== emailMatch.id) {
                return res.status(409).json({ success: false, message: 'Phone aur Email alag accounts se linked hain. Kripya support se sampark karein.' });
            }
            customer = phoneMatch || emailMatch;

            if (customer) {
                if (customer.isVerified) {
                    const samePhone = customer.phone === phone;
                    const sameEmail = normalizeEmail(customer.email) === email;
                    const message = samePhone && sameEmail
                        ? 'Yeh Phone Number aur Email pehle se registered hain. Kripya Login karein.'
                        : samePhone
                            ? 'Yeh Phone Number pehle se registered hai. Kripya Login karein.'
                            : 'Yeh Email ID pehle se registered hai. Kripya Login karein.';
                    return res.status(409).json({ success: false, message });
                }

                // Historical customers may be unverified in the DB because
                // older login code never set isVerified=true. Do not treat
                // those accounts as editable registrations without a pending OTP.
                if (!customer.otp) {
                    return res.status(409).json({
                        success: false,
                        message: 'Is Phone ya Email ka account pehle se hai. Kripya Login karein.'
                    });
                }

                // Only the original phone/email pair may resume an unverified
                // registration. Never overwrite another account's identifiers.
                if (customer.phone !== phone || normalizeEmail(customer.email) !== email) {
                    return res.status(409).json({
                        success: false,
                        message: 'Is Phone ya Email par pehle se incomplete registration hai. Wahi Phone aur Email se OTP dobara bhejein, ya support se correction karvayein.'
                    });
                }
            }

            registrationData = {
                name: uppercaseName(name),
                phone,
                email,
                clientType: type,
                businessName: type === 'Company' ? uppercaseName(businessName) : null,
                businessType: type === 'Company' ? String(businessType).trim() : null,
                gstNumber: type === 'Company' ? String(gstNumber || '').trim().toUpperCase() || null : null
            };
        } else {
            customer = await prisma.customer.findFirst({
                where: { OR: [
                    ...(email ? [{ email }] : []),
                    ...(phone ? [{ phone }] : [])
                ] }
            });
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Account nahi mila! Kripya Create Account par click karke register karein.'
                });
            }
        }

        const demoOtp = process.env.DEMO_OTP_ENABLED === 'true' &&
            process.env.NODE_ENV !== 'production' && customer?.isDemo === true;
        const generatedOtp = demoOtp ? '123456' : String(randomInt(100000, 1000000));
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000);
        const otpSettings = await getSettings();
        const destination = registrationData?.email || normalizeEmail(customer?.email);
        if (otpSettings.otpProvider === 'MAIL' && !destination) {
            return res.status(400).json({ success: false, message: 'OTP bhejne ke liye account par email address zaroori hai.' });
        }

        // Single-process rate guard for chargeable OTP channels; after a failed provider
        // response users can retry, but successful sends have a 60-second cooldown.
        const limit = demoOtp ? null : reserveOtp(registrationData?.phone || customer?.phone || destination, req.ip);
        if (limit && !limit.allowed) {
            return res.status(429).json({ success: false, message: limit.message });
        }
        // Send BEFORE inserting/updating OTP details. Failed provider calls must
        // never create a new customer record that blocks the next attempt.
        let delivery;
        try {
            delivery = demoOtp ? { sent: true, channel: 'demo' } : await sendOtpViaConfiguredProvider({
                email: destination, phone: registrationData?.phone || customer?.phone, otp: generatedOtp, settings: otpSettings
            });
        } catch (sendError) {
            limit?.finish(false);
            throw sendError;
        }
        limit?.finish(delivery.sent);
        if (!delivery.sent) {
            return res.status(503).json({
                success: false,
                message: delivery.error || 'OTP abhi nahi bhej pa rahe. API provider settings check karke dobara try karein.'
            });
        }

        if (isRegistration && !customer) {
            customer = await prisma.customer.create({
                data: { ...registrationData, isVerified: false, otp: generatedOtp, otpExpiry: expiryTime }
            });
        } else {
            customer = await prisma.customer.update({
                where: { id: customer.id },
                data: {
                    ...(isRegistration ? registrationData : {}),
                    otp: generatedOtp,
                    otpExpiry: expiryTime
                }
            });
        }

        return res.json({
            success: true,
            message: demoOtp ? 'Demo OTP is 123456 (staging only).' : `OTP aapke ${delivery.channel} par bhej diya gaya hai.`,
            otpChannel: delivery.channel,
            customerId: customer.id
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Phone ya Email pehle se account se linked hai. Kripya Login karein.'
            });
        }
        console.error('Customer OTP request failed:', error);
        return res.status(500).json({ success: false, message: 'Server error. Kripya dobara try karein.' });
    }
};

const verifyOtp = async (req, res) => {
    const customerId = Number(req.body?.customerId);
    const otp = String(req.body?.otp || '').trim();
    const pushToken = req.body?.pushToken;

    if (!Number.isSafeInteger(customerId) || customerId < 1 || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: 'Valid Customer ID aur 6-digit OTP daalein.' });
    }

    try {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer nahi mila.' });
        }
        if (!customer.otp || customer.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Galat OTP!' });
        }
        if (!customer.otpExpiry || new Date() > new Date(customer.otpExpiry)) {
            return res.status(400).json({ success: false, message: 'OTP expire ho chuka hai!' });
        }

        // A customer becomes verified only after successful OTP verification.
        const updatedUser = await prisma.customer.update({
            where: { id: customerId },
            data: {
                otp: null,
                otpExpiry: null,
                isVerified: true,
                ...(pushToken ? { pushToken: String(pushToken) } : {})
            }
        });
        return res.json({
            success: true,
            message: 'Login Successful!',
            customer: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone
            }
        });
    } catch (error) {
        console.error('Customer OTP verification failed:', error);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

const getBookingOptions = async (req, res) => {
    try {
        const verificationCutoff = getNakaVerificationCutoff();

        const bookingSetting = await getBookingSetting(prisma);
        const assignmentMode = bookingSetting.assignmentMode;

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
            mapSettings: toPublicMapSettings(bookingSetting),
            settingUpdatedAt: bookingSetting.updatedAt,
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

const getNearbyNakas = async (req, res) => {
    try {
        const bookingSetting = await getBookingSetting(prisma);
        const nearbyResult = await findNearbyVerifiedNakas(prisma, {
            latitude: req.body.workLatitude,
            longitude: req.body.workLongitude,
            radiusMeters: bookingSetting.nearbyNakaRadiusMeters
        });

        return res.json({
            success: true,
            mapSettings: toPublicMapSettings(bookingSetting),
            ...nearbyResult,
            total: nearbyResult.nearbyNakas.length
        });
    } catch (error) {
        if (error.code === "INVALID_WORK_LOCATION") {
            return res.status(400).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }

        console.error("Nearby Nakas Error:", error);

        return res.status(500).json({
            success: false,
            message: "Nearby Nakas load nahi ho paye."
        });
    }
};


const getAvailableWorkers = async (req, res) => {
    try {
        const {
            workLatitude,
            workLongitude,
            skillId,
            minRating = 0,
            duration = 'FULL_DAY'
        } = req.body;

        /*
        |--------------------------------------------------------------------------
        | 1. Admin mode check
        |--------------------------------------------------------------------------
        */

        const bookingSetting = await getBookingSetting(prisma);
        const assignmentMode = bookingSetting.assignmentMode;

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

        const selectedDuration = normalizeDuration(duration);
        if (!selectedDuration) return res.status(400).json({ success: false, code: "INVALID_DURATION", message: "Choose Full Day, 2, 3 or 4 Hours." });
        const parsedSkillId = Number(skillId);
        const parsedMinRating = Number(minRating || 0);

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
        | 3. Resolve the immutable nearby Naka pool and validate skill
        |--------------------------------------------------------------------------
        */

        const nearbyResult = await findNearbyVerifiedNakas(prisma, {
            latitude: workLatitude,
            longitude: workLongitude,
            radiusMeters: bookingSetting.nearbyNakaRadiusMeters
        });
        const verifiedNakas = nearbyResult.selectedNakas;
        const validNakaIds = verifiedNakas.map((naka) => naka.id);

        if (validNakaIds.length === 0) {
            return res.status(400).json({
                success: false,
                code: "NO_NAKAS_IN_RADIUS",
                message: `Is work location ke ${bookingSetting.nearbyNakaRadiusMeters} meter radius me koi verified Naka nahi mila.`
            });
        }

        const skill = await prisma.skill.findFirst({
            where: {
                id: parsedSkillId,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                rates: {
                    select: { star: true, rate: true },
                },
            }
        });

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

                skills: { some: { id: parsedSkillId } },
                // Hide workers held by another unpaid or confirmed booking.
                bookings: { none: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } } },
                ...(selectedDuration === 'FULL_DAY'
                    ? { availabilityType: 'FULL_DAY' }
                    : { availabilityType: 'SHORT_PERIOD', availabilityHours: Number(selectedDuration) })
            },

            select: {
                id: true,
                name: true,
                photoUrl: true,
                consentVoiceUrl: true,
                age: true,
                gender: true,
                qualification: true,
                baseRating: true,
                lastActive: true,
                availabilityUntil: true,
                availabilityType: true,
                availabilityHours: true,
                availabilityPoolSlot: {
                    select: {
                        id: true,
                        startTime: true,
                        sortOrder: true,
                    },
                },

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
                    select: { id: true, name: true, rates: { select: { rate: true } } }
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
                    Number(vyavhaar.toFixed(1)),
                isDefaultRating: false
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
                        averageRating:
                            Number(worker.baseRating || 3),
                        ratingCount: 0,
                        mehnatRating:
                            Number(worker.baseRating || 3),
                        vyavhaarRating:
                            Number(worker.baseRating || 3),
                        isDefaultRating: true
                    };

                return {
                    id: worker.id,
                    name: worker.name,
                    photoUrl: worker.photoUrl,
                    consentVoiceUrl: worker.consentVoiceUrl || null,
                    videoUrl: worker.consentVoiceUrl || null,
                    age: worker.age,
                    gender: worker.gender,
                    qualification:
                        worker.qualification,

                    isDefaultRating:
                        Boolean(rating.isDefaultRating),

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
                    availabilityType:
                        worker.availabilityType,
                    availabilityHours:
                        worker.availabilityHours,
                    poolNumber: worker.availabilityPoolSlot
                        ? Number(worker.availabilityPoolSlot.sortOrder || 0) + 1
                        : 1,
                    poolStartTime:
                        worker.availabilityPoolSlot?.startTime ||
                        bookingSetting.poolDayStart,
                    baseRate: workerDayBaseRate(worker),
                    effectiveRate: durationRate(worker, selectedDuration),
                    duration: selectedDuration,

                    nakas: worker.nakas,
                    skills: worker.skills
                };
            })
            .filter((worker) => {
                if (worker.effectiveRate == null || worker.effectiveRate <= 0) return false;
                if (parsedMinRating === 0) {
                    return true;
                }

                return (
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

        if (error.code === "INVALID_WORK_LOCATION") {
            return res.status(400).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }

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
    updateCustomerPresence,
    getBookingOptions,
    searchNakas,
    getNearbyNakas,
    getAvailableWorkers
};
