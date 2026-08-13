// src/routes/bookingSettingRoutes.js
const express = require('express');
const router = express.Router();
const bookingSettingController = require('../controllers/bookingSettingController');

router.get('/', bookingSettingController.showBookingSettings);
router.post('/', bookingSettingController.updateBookingSettings);

module.exports = router;
