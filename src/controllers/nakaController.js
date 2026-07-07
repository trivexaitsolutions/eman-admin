// src/controllers/nakaController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VERIFIED_STATUS = 'VERIFIED';
const PENDING_STATUS = 'PENDING_VERIFICATION';
const REVERIFY_REQUIRED_STATUS = 'REVERIFY_REQUIRED';

const VALID_CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'N_A'];
const VALID_VERIFICATION_METHODS = [
    'ADMIN_ON_SITE_VISIT',
    'PHOTO_GPS_REVIEW',
    'PHONE_OR_VIDEO_CONFIRMATION',
    'OTHER',
];

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

function getVerificationDueDate(lastVerifiedAt) {
    if (!lastVerifiedAt) return null;

    const dueDate = new Date(lastVerifiedAt);
    dueDate.setMonth(dueDate.getMonth() + 6);
    return dueDate;
}

function getNakaCreator(naka) {
    if (naka.createdByType === 'MITRA') {
        if (naka.createdByMitra) {
            return {
                type: 'MITRA',
                name: naka.createdByMitra.name,
                phone: naka.createdByMitra.phone || null,
                label: `Mitra: ${naka.createdByMitra.name}`,
            };
        }

        return {
            type: 'MITRA',
            name: 'Mitra record unavailable',
            phone: null,
            label: 'Mitra submission',
        };
    }

    if (naka.createdByType === 'ADMIN') {
        if (naka.createdByEmployee) {
            return {
                type: 'ADMIN',
                name: naka.createdByEmployee.name,
                role: naka.createdByEmployee.role || null,
                label: `Admin: ${naka.createdByEmployee.name}`,
            };
        }

        return {
            type: 'ADMIN',
            name: 'Admin record unavailable',
            role: null,
            label: 'Admin entry',
        };
    }

    return {
        type: 'LEGACY',
        name: 'Legacy / existing record',
        label: 'Legacy / existing record',
    };
}

function buildUploadUrl(file) {
    if (!file) return null;
    return `/uploads/naka-verification/${file.filename}`;
}

function parseSurveyDate(value) {
    const raw = String(value || '').trim();

    if (!raw) return null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return undefined;
    }

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

    return date;
}

function parseNullableNonNegativeInteger(value) {
    const raw = String(value ?? '').trim();

    if (raw === '') return null;
    if (!/^\d+$/.test(raw)) return undefined;

    const parsed = Number(raw);

    if (!Number.isSafeInteger(parsed) || parsed > 1000000) {
        return undefined;
    }

    return parsed;
}

function normalizeText(value, maxLength = null) {
    const text = String(value || '').trim();

    if (maxLength && text.length > maxLength) {
        return { text, tooLong: true };
    }

    return { text, tooLong: false };
}

function getMissingVerificationFields(naka, photoUrl) {
    const missing = [];

    if (
        !Number.isFinite(Number(naka.latitude)) ||
        !Number.isFinite(Number(naka.longitude))
    ) {
        missing.push('exact GPS map location');
    }

    if (!VALID_CONFIDENCE_LEVELS.includes(naka.confidenceLevel)) {
        missing.push('confidence level');
    }

    if (!naka.surveyDate) {
        missing.push('survey date');
    }

    if (naka.peakHourHeadcount === null || naka.peakHourHeadcount === undefined) {
        missing.push('peak-hour worker headcount');
    }

    if (!/^[0-9]{6}$/.test(String(naka.pincode || ''))) {
        missing.push('valid 6-digit PIN code');
    }

    if (!photoUrl) {
        missing.push('verification photo');
    }

    return missing;
}

function getQueryFilter(value) {
    const filter = String(value || '').toLowerCase();
    return ['verified', 'nonverified', 'all'].includes(filter) ? filter : 'verified';
}

function getFilterWhere(filter, cutoff) {
    if (filter === 'verified') {
        return {
            verificationStatus: VERIFIED_STATUS,
            lastVerifiedAt: { gte: cutoff },
        };
    }

    if (filter === 'nonverified') {
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

const listNakas = async (req, res) => {
    try {
        const cutoff = getVerificationCutoff();
        const activeFilter = getQueryFilter(req.query.filter);

        const [nakas, verifiedCount, nonVerifiedCount, totalCount] = await Promise.all([
            prisma.naka.findMany({
                where: getFilterWhere(activeFilter, cutoff),
                include: {
                    city: {
                        include: {
                            state: { select: { id: true, name: true, code: true } },
                        },
                    },
                    createdByMitra: { select: { id: true, name: true, phone: true } },
                    createdByEmployee: { select: { id: true, name: true, role: true } },
                    _count: { select: { workers: true } },
                },
                orderBy: { id: 'desc' },
            }),
            prisma.naka.count({
                where: {
                    verificationStatus: VERIFIED_STATUS,
                    lastVerifiedAt: { gte: cutoff },
                },
            }),
            prisma.naka.count({
                where: {
                    OR: [
                        { verificationStatus: { not: VERIFIED_STATUS } },
                        { lastVerifiedAt: null },
                        { lastVerifiedAt: { lt: cutoff } },
                    ],
                },
            }),
            prisma.naka.count(),
        ]);

        const decoratedNakas = nakas.map((naka) => ({
            ...naka,
            computedVerificationStatus: getComputedVerificationStatus(naka, cutoff),
            verificationDueAt: getVerificationDueDate(naka.lastVerifiedAt),
            addedBy: getNakaCreator(naka),
        }));

        return res.render('admin/nakas/index', {
            nakas: decoratedNakas,
            activeFilter,
            counts: {
                verified: verifiedCount,
                nonverified: nonVerifiedCount,
                all: totalCount,
            },
            success: req.query.success || null,
            error: req.query.error || null,
        });
    } catch (error) {
        console.error('List Nakas Error:', error);
        return res.status(500).send('Server Error');
    }
};

const showForm = async (req, res) => {
    try {
        const [states, cities] = await Promise.all([
            prisma.state.findMany({
                orderBy: [
                    { type: 'asc' },
                    { name: 'asc' },
                ],
            }),
            prisma.city.findMany({
                where: {
                    stateId: {
                        not: null,
                    },
                },
                include: {
                    state: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                },
                orderBy: [
                    { state: { name: 'asc' } },
                    { name: 'asc' },
                ],
            }),
        ]);

        let naka = {};
        let isEdit = false;

        if (req.params.id) {
            naka = await prisma.naka.findUnique({
                where: {
                    id: parseInt(req.params.id, 10),
                },
            });

            if (!naka) {
                return res.redirect(
                    '/admin/nakas?filter=all&error=' +
                    encodeURIComponent('Naka was not found.')
                );
            }

            isEdit = true;
        }

        return res.render('admin/nakas/form', {
            naka,
            states,
            cities,
            isEdit,
            error: req.query.error || null,
        });
    } catch (error) {
        console.error('Show Naka Form Error:', error);

        return res.redirect(
            '/admin/nakas?filter=all&error=' +
            encodeURIComponent('Unable to open Naka form.')
        );
    }
};

const saveNaka = async (req, res) => {
    const redirectWithError = (message) => {
        const id = String(req.body.id || '').trim();

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
        const {
            id,
            name,
            pincode,
            stateId,
            cityId,
            latitude,
            longitude,
            confidenceLevel,
            landmark,
            surveyDate,
            peakHourHeadcount,
            surveyNotes,
            verificationNote,
            verificationMethod,
            saveAction,
        } = req.body;

        const parsedId = id ? Number(id) : null;
        const parsedStateId = Number(stateId);
        const parsedCityId = Number(cityId);
        const shouldVerifyNow = saveAction === 'VERIFY_NOW';
        const shouldVerifyLater = saveAction === 'VERIFY_LATER';

        if (!shouldVerifyNow && !shouldVerifyLater) {
            return redirectWithError('Please choose Save & Verify or Verify Later.');
        }

        if (parsedId && (!Number.isInteger(parsedId) || parsedId <= 0)) {
            return redirectWithError('Invalid Naka ID.');
        }

        const cleanName = normalizeText(name, 120);
        const cleanLandmark = normalizeText(landmark, 191);
        const cleanSurveyNotes = normalizeText(surveyNotes, 3000);
        const cleanVerificationNote = normalizeText(verificationNote, 3000);
        const cleanConfidenceLevel = String(confidenceLevel || '').trim();
        const cleanVerificationMethod = String(verificationMethod || '').trim();
        const normalizedPincode = String(pincode || '').trim().replace(/\s+/g, '');

        const latitudeValue = String(latitude || '').trim();
        const longitudeValue = String(longitude || '').trim();
        const parsedSurveyDate = parseSurveyDate(surveyDate);
        const parsedHeadcount = parseNullableNonNegativeInteger(peakHourHeadcount);

        if (!cleanName.text || cleanName.text.length < 2) {
            return redirectWithError('Naka name must contain at least 2 characters.');
        }

        if (cleanName.tooLong) {
            return redirectWithError('Naka name cannot exceed 120 characters.');
        }

        if (cleanLandmark.tooLong) {
            return redirectWithError('Landmark cannot exceed 191 characters.');
        }

        if (!/^[0-9]{6}$/.test(normalizedPincode)) {
            return redirectWithError('Please enter a valid 6-digit PIN code.');
        }

        if (cleanSurveyNotes.tooLong || cleanVerificationNote.tooLong) {
            return redirectWithError('Notes cannot exceed 3000 characters.');
        }

        if (!Number.isInteger(parsedStateId) || parsedStateId <= 0) {
            return redirectWithError('Please select a valid State / Union Territory.');
        }

        if (!Number.isInteger(parsedCityId) || parsedCityId <= 0) {
            return redirectWithError('Please select a valid city.');
        }

        if (!latitudeValue || !longitudeValue) {
            return redirectWithError('Please select the exact Naka location on the map.');
        }

        const parsedLatitude = Number(latitudeValue);
        const parsedLongitude = Number(longitudeValue);

        if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
            return redirectWithError('Please select a valid latitude from the map.');
        }

        if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
            return redirectWithError('Please select a valid longitude from the map.');
        }

        if (!VALID_CONFIDENCE_LEVELS.includes(cleanConfidenceLevel)) {
            return redirectWithError('Please select a valid confidence level.');
        }

        if (parsedSurveyDate === undefined) {
            return redirectWithError('Please enter a valid survey date.');
        }

        if (parsedHeadcount === undefined) {
            return redirectWithError('Peak-hour worker headcount must be a whole number of 0 or more.');
        }

        /*
         * The browser sends both values only for the dependent dropdown UI.
         * The relation is verified on the server so a City from another State
         * cannot be submitted through DevTools or a manually edited request.
         */
        const city = await prisma.city.findUnique({
            where: {
                id: parsedCityId,
            },
            include: {
                state: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
            },
        });

        if (!city || !city.state) {
            return redirectWithError(
                'Selected City is missing its State / Union Territory. Please update the City master first.'
            );
        }

        if (city.stateId !== parsedStateId) {
            return redirectWithError(
                `Selected City belongs to ${city.state.name}. Please select the matching State / Union Territory.`
            );
        }

        let existingNaka = null;

        if (parsedId) {
            existingNaka = await prisma.naka.findUnique({
                where: { id: parsedId },
            });

            if (!existingNaka) {
                return redirectWithError('Naka was not found.');
            }
        }

        const sameNaka = await prisma.naka.findFirst({
            where: {
                cityId: parsedCityId,
                name: cleanName.text,
            },
            select: { id: true },
        });

        if (sameNaka && sameNaka.id !== parsedId) {
            return redirectWithError(
                'A Naka with this name already exists in the selected city.'
            );
        }

        const uploadedPhotoUrl = buildUploadUrl(req.file);
        const proofPhotoUrl = uploadedPhotoUrl || existingNaka?.verificationPhotoUrl || null;

        if (shouldVerifyNow) {
            const verificationCandidate = {
                pincode: normalizedPincode,
                latitude: parsedLatitude,
                longitude: parsedLongitude,
                confidenceLevel: cleanConfidenceLevel,
                surveyDate: parsedSurveyDate,
                peakHourHeadcount: parsedHeadcount,
            };

            const missingFields = getMissingVerificationFields(
                verificationCandidate,
                proofPhotoUrl
            );

            if (missingFields.length > 0) {
                return redirectWithError(
                    `Save & Verify needs: ${missingFields.join(', ')}.`
                );
            }

            if (!cleanVerificationNote.text || cleanVerificationNote.text.length < 5) {
                return redirectWithError(
                    'Please enter a verification note of at least 5 characters.'
                );
            }

            if (!VALID_VERIFICATION_METHODS.includes(cleanVerificationMethod)) {
                return redirectWithError('Please select a valid verification method.');
            }
        }

        const now = new Date();
        const creatorAdminId = Number(req.user?.id);

        if (!Number.isInteger(creatorAdminId) || creatorAdminId <= 0) {
            return redirectWithError('Your admin session is invalid. Please log in again.');
        }

        const nakaData = {
            name: cleanName.text,
            // Manual entry for now. A future postal/map API will auto-fill and validate this same value.
            pincode: normalizedPincode,
            cityId: parsedCityId,
            latitude: parsedLatitude,
            longitude: parsedLongitude,
            confidenceLevel: cleanConfidenceLevel,
            landmark: cleanLandmark.text || null,
            surveyDate: parsedSurveyDate || null,
            peakHourHeadcount: parsedHeadcount,
            surveyNotes: cleanSurveyNotes.text || null,
            verificationPhotoUrl: proofPhotoUrl,
            verificationStatus: shouldVerifyNow ? VERIFIED_STATUS : PENDING_STATUS,
            // Verify Later intentionally removes the active verification stamp.
            lastVerifiedAt: shouldVerifyNow ? now : null,
        };

        // Preserve the original source on every edit. For a fresh Admin entry,
        // persist the creating Admin so the list/audit trail can show ownership.
        if (!parsedId) {
            nakaData.createdByType = 'ADMIN';
            nakaData.createdByEmployeeId = creatorAdminId;
        }

        const verifierId = creatorAdminId;

        const savedNaka = await prisma.$transaction(async (tx) => {
            const naka = parsedId
                ? await tx.naka.update({
                    where: { id: parsedId },
                    data: nakaData,
                })
                : await tx.naka.create({ data: nakaData });

            if (shouldVerifyNow) {
                await tx.nakaVerification.create({
                    data: {
                        nakaId: naka.id,
                        verifiedById: verifierId,
                        verificationMethod: cleanVerificationMethod,
                        verificationNote: cleanVerificationNote.text,
                        verifiedAt: now,
                        photoUrl: naka.verificationPhotoUrl,
                        surveyDate: naka.surveyDate,
                        peakHourHeadcount: naka.peakHourHeadcount,
                        latitude: naka.latitude,
                        longitude: naka.longitude,
                    },
                });
            }

            return naka;
        });

        const successMessage = shouldVerifyNow
            ? `${savedNaka.name} was saved and verified successfully.`
            : `${savedNaka.name} was saved and moved to the non-verified list.`;

        const targetFilter = shouldVerifyNow ? 'verified' : 'nonverified';

        return res.redirect(
            `/admin/nakas?filter=${targetFilter}&success=${encodeURIComponent(successMessage)}`
        );
    } catch (error) {
        console.error('Save Naka Error:', error);
        return redirectWithError(
            'Naka save nahi ho paya. Please check all details and try again.'
        );
    }
};

const getVerificationDetails = async (req, res) => {
    try {
        const nakaId = Number(req.params.id);

        if (!Number.isInteger(nakaId) || nakaId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid Naka ID.' });
        }

        const naka = await prisma.naka.findUnique({
            where: { id: nakaId },
            include: {
                city: {
                    select: {
                        id: true,
                        name: true,
                        state: { select: { id: true, name: true, code: true } },
                    },
                },
                createdByMitra: { select: { id: true, name: true, phone: true } },
                createdByEmployee: { select: { id: true, name: true, role: true } },
                _count: { select: { workers: true } },
                verificationHistory: {
                    include: {
                        verifiedBy: {
                            select: { id: true, name: true, role: true },
                        },
                    },
                    orderBy: { verifiedAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!naka) {
            return res.status(404).json({ success: false, message: 'Naka was not found.' });
        }

        const cutoff = getVerificationCutoff();
        const currentStatus = getComputedVerificationStatus(naka, cutoff);
        const missingVerificationFields = getMissingVerificationFields(
            naka,
            naka.verificationPhotoUrl
        );

        return res.json({
            success: true,
            naka: {
                ...naka,
                computedVerificationStatus: currentStatus,
                verificationDueAt: getVerificationDueDate(naka.lastVerifiedAt),
                addedBy: getNakaCreator(naka),
                missingVerificationFields,
            },
        });
    } catch (error) {
        console.error('Get Naka Verification Details Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to load Naka verification details.',
        });
    }
};

const verifyNaka = async (req, res) => {
    const redirectWithError = (message) =>
        res.redirect(
            `/admin/nakas?filter=nonverified&error=${encodeURIComponent(message)}`
        );

    try {
        const nakaId = Number(req.params.id);
        const verifierId = Number(req.user?.id);
        const cleanVerificationNote = normalizeText(req.body.verificationNote, 3000);
        const cleanVerificationMethod = String(req.body.verificationMethod || '').trim();

        if (!Number.isInteger(nakaId) || nakaId <= 0) {
            return redirectWithError('Invalid Naka ID.');
        }

        if (!Number.isInteger(verifierId) || verifierId <= 0) {
            return redirectWithError('Your admin session is invalid. Please log in again.');
        }

        if (cleanVerificationNote.tooLong) {
            return redirectWithError('Verification note cannot exceed 3000 characters.');
        }

        if (!cleanVerificationNote.text || cleanVerificationNote.text.length < 5) {
            return redirectWithError('Please enter a verification note of at least 5 characters.');
        }

        if (!VALID_VERIFICATION_METHODS.includes(cleanVerificationMethod)) {
            return redirectWithError('Please select a valid verification method.');
        }

        const naka = await prisma.naka.findUnique({
            where: { id: nakaId },
        });

        if (!naka) {
            return redirectWithError('Naka was not found.');
        }

        const nakaCity = await prisma.city.findUnique({
            where: {
                id: naka.cityId,
            },
            include: {
                state: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!nakaCity?.state) {
            return redirectWithError(
                'This Naka City does not have a State / Union Territory yet. Update the City master before verification.'
            );
        }

        const proofPhotoUrl = buildUploadUrl(req.file) || naka.verificationPhotoUrl;
        const missingFields = getMissingVerificationFields(naka, proofPhotoUrl);

        if (missingFields.length > 0) {
            return redirectWithError(
                `Please edit this Naka first. Missing: ${missingFields.join(', ')}.`
            );
        }

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            const verifiedNaka = await tx.naka.update({
                where: { id: nakaId },
                data: {
                    verificationStatus: VERIFIED_STATUS,
                    lastVerifiedAt: now,
                    verificationPhotoUrl: proofPhotoUrl,
                },
            });

            await tx.nakaVerification.create({
                data: {
                    nakaId: verifiedNaka.id,
                    verifiedById: verifierId,
                    verificationMethod: cleanVerificationMethod,
                    verificationNote: cleanVerificationNote.text,
                    verifiedAt: now,
                    photoUrl: verifiedNaka.verificationPhotoUrl,
                    surveyDate: verifiedNaka.surveyDate,
                    peakHourHeadcount: verifiedNaka.peakHourHeadcount,
                    latitude: verifiedNaka.latitude,
                    longitude: verifiedNaka.longitude,
                },
            });
        });

        return res.redirect(
            `/admin/nakas?filter=verified&success=${encodeURIComponent('Naka verified successfully. It will be due for re-verification after 6 months.')}`
        );
    } catch (error) {
        console.error('Verify Naka Error:', error);
        return redirectWithError('Naka verification failed. Please try again.');
    }
};

const deleteNaka = async (req, res) => {
    try {
        await prisma.naka.delete({ where: { id: parseInt(req.params.id, 10) } });
        return res.redirect(
            `/admin/nakas?filter=all&success=${encodeURIComponent('Naka deleted successfully.')}`
        );
    } catch (error) {
        console.error('Delete Naka Error:', error);
        return res.redirect(
            `/admin/nakas?filter=all&error=${encodeURIComponent('Cannot delete. Please remove assigned workers first.')}`
        );
    }
};

// Used by the existing worker assignment screen. It now returns only currently verified Nakas.
const getNakasByPincode = async (req, res) => {
    try {
        const pincode = String(req.params.pincode || '').replace(/\D/g, '').slice(0, 6);

        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ error: 'Please provide a valid 6-digit pincode.' });
        }

        const nakas = await prisma.naka.findMany({
            where: {
                pincode,
                verificationStatus: VERIFIED_STATUS,
                lastVerifiedAt: { gte: getVerificationCutoff() },
            },
            select: {
                id: true,
                name: true,
                pincode: true,
                city: {
                    select: {
                        name: true,
                        state: { select: { name: true, code: true } },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        return res.json(nakas);
    } catch (error) {
        console.error('Get Nakas By Pincode Error:', error);
        return res.status(500).json({ error: 'Failed to fetch Nakas.' });
    }
};

// Used only by Admin Naka form. The local City PIN master determines both State and City.
const getLocationByPincode = async (req, res) => {
    try {
        const pincode = String(req.params.pincode || '').replace(/\D/g, '').slice(0, 6);

        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 6-digit PIN code.',
            });
        }

        const mapping = await prisma.cityPincode.findUnique({
            where: { pincode },
            include: {
                city: {
                    include: {
                        state: { select: { id: true, name: true, code: true, type: true } },
                    },
                },
            },
        });

        if (!mapping || !mapping.city?.state) {
            return res.status(404).json({
                success: false,
                code: 'PINCODE_NOT_MAPPED',
                message: 'This PIN is not mapped yet. Add it under Master: Cities before creating a Naka.',
            });
        }

        return res.json({
            success: true,
            pincode,
            city: { id: mapping.city.id, name: mapping.city.name },
            state: mapping.city.state,
        });
    } catch (error) {
        console.error('Get Location By Pincode Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to look up the PIN code right now.',
        });
    }
};

module.exports = {
    listNakas,
    showForm,
    saveNaka,
    getVerificationDetails,
    verifyNaka,
    deleteNaka,
    getNakasByPincode,
    getLocationByPincode,
};
