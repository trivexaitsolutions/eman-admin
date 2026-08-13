// src/controllers/bookingSettingController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const {
    DEFAULT_NEARBY_NAKA_RADIUS_METERS,
    MAX_NEARBY_NAKA_RADIUS_METERS,
    MIN_NEARBY_NAKA_RADIUS_METERS,
    normalizeRadiusMeters
} = require('../utils/bookingSettings');

const ALLOWED_MODES = ['AUTO', 'CUSTOMER_SELECT'];

const showBookingSettings = async (req, res) => {
    try {
        // Singleton setting: project me hamesha id = 1 wali ek hi row use hogi.
        // Row pehli baar na ho to AUTO mode ke saath automatically create ho jayegi.
        const setting = await prisma.bookingSetting.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                assignmentMode: 'AUTO',
                showMapToCustomer: false,
                nearbyNakaRadiusMeters: DEFAULT_NEARBY_NAKA_RADIUS_METERS,
            },
        });

        return res.render('admin/booking-settings/index', {
            setting,
            hasMapApiKey: Boolean(setting.mapApiKey),
            mapApiKeyPreview: setting.mapApiKey
                ? `••••••••${setting.mapApiKey.slice(-4)}`
                : null,
            minRadiusMeters: MIN_NEARBY_NAKA_RADIUS_METERS,
            maxRadiusMeters: MAX_NEARBY_NAKA_RADIUS_METERS,
        });
    } catch (error) {
        console.error('Booking settings load error:', error);
        req.flash('error_msg', 'Booking settings load nahi ho paayi. Database setup check karein.');
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

        const mapApiKeyUpdate = clearMapApiKey
            ? { mapApiKey: null }
            : submittedMapApiKey
                ? { mapApiKey: submittedMapApiKey }
                : {};

        await prisma.bookingSetting.upsert({
            where: { id: 1 },
            update: {
                assignmentMode,
                showMapToCustomer,
                nearbyNakaRadiusMeters: normalizeRadiusMeters(radiusInput),
                ...mapApiKeyUpdate,
            },
            create: {
                id: 1,
                assignmentMode,
                showMapToCustomer,
                nearbyNakaRadiusMeters: normalizeRadiusMeters(radiusInput),
                mapApiKey: clearMapApiKey ? null : submittedMapApiKey || null,
            },
        });

        const readableMode =
            assignmentMode === 'AUTO'
                ? 'Automatic Worker Assignment'
                : 'Customer Selects Worker';

        req.flash(
            'success_msg',
            `Booking settings saved: ${readableMode}, ${showMapToCustomer ? 'Map ON' : 'Map OFF'}, ${radiusInput} meters.`
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
