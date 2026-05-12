const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const bookingController = require('../../controllers/bookingController');

// Placeholder for future customer app routes!
router.get('/test', (req, res) => {
    res.json({ message: "User/Customer API is ready to be built!" });
});

router.post('/send-otp', userController.sendOtp);
router.post('/verify-otp', userController.verifyOtp);
router.get('/booking-options', userController.getBookingOptions);
router.post('/book-workers', bookingController.bookWorkers);

module.exports = router;