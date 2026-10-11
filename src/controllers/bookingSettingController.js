// src/controllers/bookingSettingController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const {
    ALLOWED_POOL_REDUCTION_TYPES,
    buildIndiaDateForToday,
    DEFAULT_NEARBY_NAKA_RADIUS_METERS,
    DEFAULT_POOL_DAY_END,
    DEFAULT_POOL_DAY_START,
    DEFAULT_POOL_REDUCTION_TYPE,
    DEFAULT_POOL_REDUCTION_VALUE,
    MAX_NEARBY_NAKA_RADIUS_METERS,
    MIN_NEARBY_NAKA_RADIUS_METERS,
    normalizeRadiusMeters,
    normalizeTimeValue,
    timeToMinutes,
} = require('../utils/bookingSettings');

const ALLOWED_MODES = ['AUTO', 'CUSTOMER_SELECT'];

const normalizeSubmittedPoolTimes = (rawValue, dayStart, dayEnd) => {
    const submitted = Array.isArray(rawValue)
        ? rawValue
        : rawValue
            ? [rawValue]
            : [];

    const dayStartMinutes = timeToMinutes(dayStart);
    const dayEndMinutes = timeToMinutes(dayEnd);

    const normalized = submitted
        .map((value) => normalizeTimeValue(value, null))
        .filter(Boolean)
        .filter((value) => {
            const minutes = timeToMinutes(value);
            return minutes >= dayStartMinutes && minutes < dayEndMinutes;
        });

    // Pool 1 is always the configured day-start pool.
    normalized.push(dayStart);

    return [...new Set(normalized)].sort(
        (first, second) => timeToMinutes(first) - timeToMinutes(second)
    );
};

const showBookingSettings = async (req, res) => {
    try {
        const setting = await prisma.bookingSetting.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                assignmentMode: 'AUTO',
                showMapToCustomer: false,
                nearbyNakaRadiusMeters: DEFAULT_NEARBY_NAKA_RADIUS_METERS,
                poolDayStart: DEFAULT_POOL_DAY_START,
                poolDayEnd: DEFAULT_POOL_DAY_END,
                poolReductionType: DEFAULT_POOL_REDUCTION_TYPE,
                poolReductionValue: DEFAULT_POOL_REDUCTION_VALUE,
            },
            include: {
                poolSlots: {
                    where: { isActive: true },
                    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
                },
            },
        });

        let poolSlots = setting.poolSlots || [];

        if (poolSlots.length === 0) {
            const defaultSlot = await prisma.poolSlot.create({
                data: {
                    bookingSettingId: 1,
                    startTime: setting.poolDayStart || DEFAULT_POOL_DAY_START,
                    sortOrder: 0,
                    isActive: true,
                },
            });
            poolSlots = [defaultSlot];
        }

        return res.render('admin/booking-settings/index', {
            setting: {
                ...setting,
                poolSlots,
            },
            hasMapApiKey: Boolean(setting.mapApiKey),
            mapApiKeyPreview: setting.mapApiKey
                ? `••••••••${setting.mapApiKey.slice(-4)}`
                : null,
            minRadiusMeters: MIN_NEARBY_NAKA_RADIUS_METERS,
            maxRadiusMeters: MAX_NEARBY_NAKA_RADIUS_METERS,
        });
    } catch (error) {
        console.error('Booking settings load error:', error);
        req.flash('error_msg', 'Booking settings load nahi ho paayi. Latest pool migration run karein.');
        return res.redirect('/admin/dashboard');
    }
};

const updateBookingSettings = async (req, res) => {
    try {
        const assignmentMode = String(req.body.assignmentMode || '')
            .trim()
            .toUpperCase();

        if (!ALLOWED_MODES.includes(assignmentMode)) {
            req.flash('error_msg', 'Please select a valid worker assignment mode.');
            return res.redirect('/admin/booking-settings');
        }

        const radiusInput = Number(req.body.nearbyNakaRadiusMeters);
        if (
            !Number.isInteger(radiusInput) ||
            radiusInput < MIN_NEARBY_NAKA_RADIUS_METERS ||
            radiusInput > MAX_NEARBY_NAKA_RADIUS_METERS
        ) {
            req.flash(
                'error_msg',
                `Nearby Naka radius ${MIN_NEARBY_NAKA_RADIUS_METERS} se ${MAX_NEARBY_NAKA_RADIUS_METERS} meters ke beech rakhein.`
            );
            return res.redirect('/admin/booking-settings');
        }

        const poolDayStart = normalizeTimeValue(req.body.poolDayStart, null);
        const poolDayEnd = normalizeTimeValue(req.body.poolDayEnd, null);

        if (!poolDayStart || !poolDayEnd) {
            req.flash('error_msg', 'Please select valid Pool Start and End times.');
            return res.redirect('/admin/booking-settings');
        }

        if (timeToMinutes(poolDayEnd) <= timeToMinutes(poolDayStart)) {
            req.flash('error_msg', 'Pool End Time must be after Pool Start Time.');
            return res.redirect('/admin/booking-settings');
        }

        const poolReductionType = String(req.body.poolReductionType || '')
            .trim()
            .toUpperCase();

        if (!ALLOWED_POOL_REDUCTION_TYPES.includes(poolReductionType)) {
            req.flash('error_msg', 'Please select Fixed or Percentage pool reduction.');
            return res.redirect('/admin/booking-settings');
        }

        const poolReductionValue = Number(req.body.poolReductionValue);
        if (!Number.isFinite(poolReductionValue) || poolReductionValue < 0) {
            req.flash('error_msg', 'Pool reduction value must be 0 or more.');
            return res.redirect('/admin/booking-settings');
        }

        if (poolReductionType === 'PERCENTAGE' && poolReductionValue > 100) {
            req.flash('error_msg', 'Percentage reduction cannot be more than 100%.');
            return res.redirect('/admin/booking-settings');
        }

        const poolStartTimes = normalizeSubmittedPoolTimes(
            req.body.poolStartTimes,
            poolDayStart,
            poolDayEnd
        );

        if (poolStartTimes.length === 0) {
            req.flash('error_msg', 'At least one pool is required.');
            return res.redirect('/admin/booking-settings');
        }

        const showMapToCustomer = ['1', 'true', 'on', 'yes'].includes(
            String(req.body.showMapToCustomer || '').toLowerCase()
        );
        const submittedMapApiKey = String(req.body.mapApiKey || '').trim();
        const clearMapApiKey = ['1', 'true', 'on', 'yes'].includes(
            String(req.body.clearMapApiKey || '').toLowerCase()
        );

        if (submittedMapApiKey.length > 500) {
            req.flash('error_msg', 'Map API key is too long.');
            return res.redirect('/admin/booking-settings');
        }

        const existingSetting = await prisma.bookingSetting.findUnique({
            where: { id: 1 },
            select: { mapApiKey: true },
        });

        const mapApiKey = clearMapApiKey
            ? null
            : submittedMapApiKey || existingSetting?.mapApiKey || null;

        await prisma.$transaction(async (tx) => {
            await tx.bookingSetting.upsert({
                where: { id: 1 },
                update: {
                    assignmentMode,
                    showMapToCustomer,
                    nearbyNakaRadiusMeters: normalizeRadiusMeters(radiusInput),
                    mapApiKey,
                    poolDayStart,
                    poolDayEnd,
                    poolReductionType,
                    poolReductionValue,
                },
                create: {
                    id: 1,
                    assignmentMode,
                    showMapToCustomer,
                    nearbyNakaRadiusMeters: normalizeRadiusMeters(radiusInput),
                    mapApiKey,
                    poolDayStart,
                    poolDayEnd,
                    poolReductionType,
                    poolReductionValue,
                },
            });

            // Keep existing PoolSlot IDs for unchanged start times. Deleting
            // all slots used to silently detach every worker currently online.
            const oldSlots = await tx.poolSlot.findMany({
                where: { bookingSettingId: 1 },
            });
            const slotsByTime = new Map(oldSlots.map((slot) => [slot.startTime, slot]));
            const updatedSlots = [];
            for (const [index, startTime] of poolStartTimes.entries()) {
                const oldSlot = slotsByTime.get(startTime);
                const slot = oldSlot
                    ? await tx.poolSlot.update({
                        where: { id: oldSlot.id },
                        data: { sortOrder: index, isActive: true },
                    })
                    : await tx.poolSlot.create({
                        data: {
                            bookingSettingId: 1,
                            startTime,
                            sortOrder: index,
                            isActive: true,
                        },
                    });
                updatedSlots.push(slot);
            }

            const removedSlotIds = oldSlots
                .filter((slot) => !poolStartTimes.includes(slot.startTime))
                .map((slot) => slot.id);
            const now = new Date();
            const todayStart = buildIndiaDateForToday('00:00', now);
            const configuredEnd = buildIndiaDateForToday(poolDayEnd, now);

            // If a configured pool was removed, only its current workers need
            // reassignment. Choose the pool active when they originally joined.
            if (removedSlotIds.length) {
                const affectedWorkers = await tx.worker.findMany({
                    where: {
                        availabilityPoolSlotId: { in: removedSlotIds },
                        availabilityStart: { gte: todayStart },
                        availabilityUntil: { gt: now },
                    },
                    select: { id: true, availabilityStart: true },
                });
                for (const worker of affectedWorkers) {
                    const joinParts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
                    }).formatToParts(worker.availabilityStart);
                    const joinHour = Number(joinParts.find((item) => item.type === 'hour')?.value || 0);
                    const joinMinute = Number(joinParts.find((item) => item.type === 'minute')?.value || 0);
                    const joinMinutes = joinHour * 60 + joinMinute;
                    const eligibleSlots = updatedSlots.filter(
                        (slot) => timeToMinutes(slot.startTime) <= joinMinutes
                    );
                    const matchedSlot = eligibleSlots[eligibleSlots.length - 1] || updatedSlots[0];
                    await tx.worker.update({
                        where: { id: worker.id },
                        data: { availabilityPoolSlotId: matchedSlot.id },
                    });
                }
                await tx.poolSlot.updateMany({
                    where: { id: { in: removedSlotIds } },
                    data: { isActive: false },
                });
            }

            // The configured end time applies to today's pool session, not a
            // fresh 12-hour period, even when changed while workers are online.
            await tx.worker.updateMany({
                where: {
                    availabilityStart: { gte: todayStart },
                    availabilityUntil: { not: null },
                },
                data: { availabilityUntil: configuredEnd },
            });
            if (configuredEnd <= now) {
                await tx.worker.updateMany({
                    where: {
                        isAvailable: true,
                        availabilityStart: { gte: todayStart },
                    },
                    data: { isAvailable: false, lastActive: now },
                });
            }
        });

        const readableMode =
            assignmentMode === 'AUTO'
                ? 'Automatic Worker Assignment'
                : 'Customer Selects Worker';

        req.flash(
            'success_msg',
            `Booking settings saved. ${poolStartTimes.length} pool(s), ${poolDayStart}–${poolDayEnd}, ${poolReductionType === 'FIXED' ? '₹' : ''}${poolReductionValue}${poolReductionType === 'PERCENTAGE' ? '%' : ''} reduction per next pool.`
        );
        return res.redirect('/admin/booking-settings');
    } catch (error) {
        console.error('Booking settings update error:', error);
        req.flash('error_msg', 'Booking settings save nahi ho paayi. Please try again.');
        return res.redirect('/admin/booking-settings');
    }
};

module.exports = {
    showBookingSettings,
    updateBookingSettings,
};
