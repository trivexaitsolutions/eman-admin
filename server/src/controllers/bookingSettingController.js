// src/controllers/bookingSettingController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
            },
        });

        return res.render('admin/booking-settings/index', {
            setting,
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

        await prisma.bookingSetting.upsert({
            where: { id: 1 },
            update: {
                assignmentMode,
            },
            create: {
                id: 1,
                assignmentMode,
            },
        });

        const readableMode =
            assignmentMode === 'AUTO'
                ? 'Automatic Worker Assignment'
                : 'Customer Selects Worker';

        req.flash('success_msg', `Booking mode updated: ${readableMode}`);
        return res.redirect('/admin/booking-settings');
    } catch (error) {
        console.error('Booking settings update error:', error);
        req.flash('error_msg', 'Booking mode save nahi ho paaya. Please try again.');
        return res.redirect('/admin/booking-settings');
    }
};

module.exports = {
    showBookingSettings,
    updateBookingSettings,
};
