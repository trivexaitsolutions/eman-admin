const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { submitRating,initiateBooking, verifyPayment, bookWorkers,getCurrentBooking,getCurrentDuty,verifyQrAndStartDuty,completeBooking,getBookingHistory,getBookingById /*, baaki purane functions */, } = require('../../controllers/bookingController');

// Placeholder for future customer app routes!
router.get('/test', (req, res) => {
    res.json({ message: "User/Customer API is ready to be built!" });
});

router.post('/send-otp', userController.sendOtp);
router.post('/verify-otp', userController.verifyOtp);
router.get('/booking-options', userController.getBookingOptions);
// router.post('/book-workers', bookingController.bookWorkers);
// Frontend '/user/initiate-booking' pe call karega toh ye chalega
router.post('/initiate-booking', initiateBooking);

// Frontend '/user/verify-payment' pe call karega toh ye chalega
router.post('/verify-payment', verifyPayment);
router.get('/current-booking/:customerId', getCurrentBooking);

router.get('/worker/current-duty/:workerId', getCurrentDuty);

// Worker app QR scan karke yahan request bhejega
router.post('/worker/verify-qr', verifyQrAndStartDuty);
router.post('/complete-booking', completeBooking);

router.get('/booking-history/:customerId', getBookingHistory);

router.get('/booking/:id', getBookingById);
router.post('/submit-rating', submitRating);

module.exports = router;