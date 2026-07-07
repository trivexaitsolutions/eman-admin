// src/controllers/mitraNakaController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PENDING_STATUS = 'PENDING_VERIFICATION';
const VERIFIED_STATUS = 'VERIFIED';
const REVERIFY_REQUIRED_STATUS = 'REVERIFY_REQUIRED';
const VALID_CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'N_A'];

function getVerificationCutoff(referenceDate = new Date()) {
    const cutoff = new Date(referenceDate);
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff;
}

function getComputedVerificationStatus(naka, cutoff = getVerificationCutoff()) {
    if (naka.verificationStatus !== VERIFIED_STATUS) {
        return naka.verificationStatus || PENDING_STATUS;
    }

    if (!naka.lastVerifiedAt || new Date(naka.lastVerifiedAt) < cutoff) {
        return REVERIFY_REQUIRED_STATUS;
    }

    return VERIFIED_STATUS;
}

function getFilter(value) {
    const filter = String(value || '').toLowerCase();
    return ['all', 'verified', 'pending'].includes(filter) ? filter : 'all';
}

function getFilterWhere(filter, cutoff) {
    if (filter === 'verified') {
        return {
            verificationStatus: VERIFIED_STATUS,
            lastVerifiedAt: { gte: cutoff },
        };
    }

    if (filter === 'pending') {
        return {
            OR: [
                { verificationStatus: { not: VERIFIED_STATUS } },
                { lastVerifiedAt: null },
                { lastVerifiedAt: { lt: cutoff } },
            ],
        };
    }

    return {};
}

function parseSurveyDate(value) {
    const raw = String(value || '').trim();
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;

    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return undefined;
    }

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date >= tomorrow) return undefined;
    return date;
}

function parseHeadcount(value) {
    const raw = String(value ?? '').trim();
    if (!/^\d+$/.test(raw)) return undefined;

    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed > 1000000) return undefined;
    return parsed;
}

function cleanText(value, maxLength) {
    const text = String(value || '').trim();
    if (maxLength && text.length > maxLength) {
        return { text, tooLong: true };
    }
    return { text, tooLong: false };
}

function buildUploadUrl(file) {
    return file ? `/uploads/naka-verification/${file.filename}` : null;
}

function mitraName(req) {
    return req.user?.name || req.user?.fullName || 'Mitra';
}

const listMyNakas = async (req, res) => {
    try {
        const mitraId = Number(req.user?.id);
        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return res.redirect('/mitra/login');
        }

        const cutoff = getVerificationCutoff();
        const activeFilter = getFilter(req.query.filter);
        const assignmentWhere = {
            mitras: { some: { id: mitraId } },
            ...getFilterWhere(activeFilter, cutoff),
        };

        const [nakas, total, verified, pending] = await Promise.all([
            prisma.naka.findMany({
                where: assignmentWhere,
                include: {
                    city: {
                        include: {
                            state: { select: { name: true, code: true } },
                        },
                    },
                    _count: { select: { workers: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.naka.count({ where: { mitras: { some: { id: mitraId } } } }),
            prisma.naka.count({
                where: {
                    mitras: { some: { id: mitraId } },
                    verificationStatus: VERIFIED_STATUS,
                    lastVerifiedAt: { gte: cutoff },
                },
            }),
            prisma.naka.count({
                where: {
                    mitras: { some: { id: mitraId } },
                    OR: [
                        { verificationStatus: { not: VERIFIED_STATUS } },
                        { lastVerifiedAt: null },
                        { lastVerifiedAt: { lt: cutoff } },
                    ],
                },
            }),
        ]);

        const decoratedNakas = nakas.map((naka) => ({
            ...naka,
            computedVerificationStatus: getComputedVerificationStatus(naka, cutoff),
        }));

        return res.render('mitra/nakas/index', {
            layout: false,
            nakas: decoratedNakas,
            activeFilter,
            counts: { total, verified, pending },
            activePage: 'nakas',
            mitraName: mitraName(req),
            success_msg: req.query.success || null,
            error_msg: req.query.error || null,
        });
    } catch (error) {
        console.error('Mitra Naka List Error:', error);
        return res.redirect(
            '/mitra/dashboard?error=' +
            encodeURIComponent('My Nakas list load nahi ho payi.')
        );
    }
};

const showAddNakaForm = async (req, res) => {
    try {
        const [states, cities] = await Promise.all([
            prisma.state.findMany({
                orderBy: [{ type: 'asc' }, { name: 'asc' }],
            }),
            prisma.city.findMany({
                where: { stateId: { not: null } },
                include: {
                    state: { select: { id: true, name: true, code: true } },
                },
                orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
            }),
        ]);

        return res.render('mitra/nakas/form', {
            layout: false,
            states,
            cities,
            error_msg: req.query.error || null,
            mitraName: mitraName(req),
        });
    } catch (error) {
        console.error('Mitra Add Naka Form Error:', error);
        return res.redirect(
            '/mitra/nakas?error=' +
            encodeURIComponent('Naka form open nahi ho paya.')
        );
    }
};

const submitNaka = async (req, res) => {
    const redirectWithError = (message) =>
        res.redirect(`/mitra/nakas/add?error=${encodeURIComponent(message)}`);

    try {
        const mitraId = Number(req.user?.id);
        if (!Number.isInteger(mitraId) || mitraId <= 0) {
            return redirectWithError('Mitra session invalid hai. Please login again.');
        }

        const {
            name,
            stateId,
            cityId,
            pincode,
            latitude,
            longitude,
            confidenceLevel,
            landmark,
            surveyDate,
            peakHourHeadcount,
            surveyNotes,
        } = req.body;

        const cleanName = cleanText(name, 120);
        const cleanLandmark = cleanText(landmark, 191);
        const cleanSurveyNotes = cleanText(surveyNotes, 3000);
        const parsedStateId = Number(stateId);
        const parsedCityId = Number(cityId);
        // Manual PIN entry for now. In a later phase, this value will be
        // populated/confirmed from the selected map location via a postal API.
        const normalizedPincode = String(pincode || '').trim().replace(/\s+/g, '');
        const parsedLatitude = Number(String(latitude || '').trim());
        const parsedLongitude = Number(String(longitude || '').trim());
        const parsedSurveyDate = parseSurveyDate(surveyDate);
        const parsedHeadcount = parseHeadcount(peakHourHeadcount);
        const cleanConfidenceLevel = String(confidenceLevel || '').trim();

        if (!cleanName.text || cleanName.text.length < 2) {
            return redirectWithError('Naka name must contain at least 2 characters.');
        }
        if (cleanName.tooLong || cleanLandmark.tooLong || cleanSurveyNotes.tooLong) {
            return redirectWithError('Please keep Naka details within the allowed length.');
        }
        if (!Number.isInteger(parsedStateId) || parsedStateId <= 0) {
            return redirectWithError('Please select a valid State / Union Territory.');
        }
        if (!Number.isInteger(parsedCityId) || parsedCityId <= 0) {
            return redirectWithError('Please select a valid City.');
        }
        if (!/^\d{6}$/.test(normalizedPincode)) {
            return redirectWithError('Please enter a valid 6-digit PIN code.');
        }
        if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
            return redirectWithError('Please capture a valid exact map location.');
        }
        if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
            return redirectWithError('Please capture a valid exact map location.');
        }
        if (!VALID_CONFIDENCE_LEVELS.includes(cleanConfidenceLevel)) {
            return redirectWithError('Please select a valid confidence level.');
        }
        if (!parsedSurveyDate) {
            return redirectWithError('Please enter a valid survey date that is not in the future.');
        }
        if (parsedHeadcount === undefined) {
            return redirectWithError('Peak-hour worker headcount must be a whole number of 0 or more.');
        }
        if (!req.file) {
            return redirectWithError('Please upload one Naka verification photo.');
        }

        const city = await prisma.city.findUnique({
            where: { id: parsedCityId },
            include: { state: { select: { id: true, name: true } } },
        });

        if (!city?.state || city.stateId !== parsedStateId) {
            return redirectWithError('Selected City does not belong to the selected State / Union Territory.');
        }

        const duplicate = await prisma.naka.findFirst({
            where: { cityId: parsedCityId, name: cleanName.text },
            select: { id: true, createdByMitraId: true },
        });

        if (duplicate) {
            const ownSubmission = Number(duplicate.createdByMitraId) === mitraId;
            return redirectWithError(
                ownSubmission
                    ? 'You have already submitted this Naka for the selected City.'
                    : 'A Naka with this name already exists in the selected City.'
            );
        }

        const photoUrl = buildUploadUrl(req.file);

        await prisma.naka.create({
            data: {
                name: cleanName.text,
                pincode: normalizedPincode,
                cityId: parsedCityId,
                latitude: parsedLatitude,
                longitude: parsedLongitude,
                confidenceLevel: cleanConfidenceLevel,
                landmark: cleanLandmark.text || null,
                surveyDate: parsedSurveyDate,
                peakHourHeadcount: parsedHeadcount,
                surveyNotes: cleanSurveyNotes.text || null,
                verificationPhotoUrl: photoUrl,
                verificationStatus: PENDING_STATUS,
                lastVerifiedAt: null,

                // Permanent source/audit link for Admin list and verification modal.
                createdByType: 'MITRA',
                createdByMitraId: mitraId,

                // The Mitra is assigned to this Naka immediately on submission.
                mitras: {
                    connect: { id: mitraId },
                },
            },
        });

        return res.redirect(
            '/mitra/nakas?filter=pending&success=' +
            encodeURIComponent('Naka submitted for Admin verification and assigned to you successfully.')
        );
    } catch (error) {
        console.error('Mitra Submit Naka Error:', error);

        if (error?.code === 'P2002') {
            return redirectWithError('A matching Naka already exists.');
        }

        return redirectWithError('Naka submit nahi ho paya. Please check all details and try again.');
    }
};

module.exports = {
    listMyNakas,
    showAddNakaForm,
    submitNaka,
};
