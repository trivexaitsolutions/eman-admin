const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { submitRating,initiateBooking, verifyPayment, bookWorkers,getCurrentBooking,getCurrentDuty,verifyQrAndStartDuty,completeBooking,getBookingHistory,cancelPendingBooking,getBookingById /*, baaki purane functions */, } = require('../../controllers/bookingController');
const conflictController = require('../../controllers/conflictController');
const customerAddressController = require("../../controllers/customerAddressController");
const bookingController = require("../../controllers/bookingController");


// Placeholder for future customer app routes!
router.get('/test', (req, res) => {
    res.json({ message: "User/Customer API is ready to be built!" });
});

router.post('/send-otp', userController.sendOtp);
router.post('/verify-otp', userController.verifyOtp);
router.get('/booking-options', userController.getBookingOptions);
router.get('/nakas/search', userController.searchNakas);
router.post('/nakas/nearby', userController.getNearbyNakas);
router.post('/available-workers', userController.getAvailableWorkers);
// router.post('/book-workers', bookingController.bookWorkers);
// Frontend '/user/initiate-booking' pe call karega toh ye chalega
router.post('/initiate-booking', initiateBooking);

// Frontend '/user/verify-payment' pe call karega toh ye chalega
router.post('/verify-payment', verifyPayment);
router.post('/cancel-pending-booking', cancelPendingBooking);
router.get('/current-booking/:customerId', getCurrentBooking);

router.get('/worker/current-duty/:workerId', getCurrentDuty);

// Customer app worker ka QR scan karke arrival verify karega
router.post('/worker/verify-qr', verifyQrAndStartDuty);
router.post('/complete-booking', completeBooking);

router.get('/booking-history/:customerId', getBookingHistory);

router.get('/booking/:id', getBookingById);
router.post('/submit-rating', submitRating);

router.post('/conflicts/create', conflictController.createConflict);

router.get(
  "/customer-addresses/:customerId",
  customerAddressController.getAddresses
);

router.post(
  "/customer-addresses",
  customerAddressController.addAddress
);

router.put(
  "/customer-addresses/:id",
  customerAddressController.updateAddress
);

router.delete(
  "/customer-addresses/:id",
  customerAddressController.deleteAddress
);

router.get(
    "/worker/client-rating-status/:bookingId/:workerId",
    bookingController.getClientRatingStatus
);

router.post(
    "/worker/rate-client",
    bookingController.submitClientRatingByWorker
);

router.post("/worker/complete-duty", bookingController.completeWorkerDuty);


module.exports = router;
