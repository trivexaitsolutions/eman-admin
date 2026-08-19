const express = require('express');
const router = express.Router();
const workerController = require('../../controllers/workerController');
const { savePushToken,getWorkerDashboard } = require('../../controllers/workerController');
const bookingController = require('../../controllers/bookingController');

// This route will now be accessed via /api/worker/login
router.post('/login', workerController.loginWorker);
router.get('/profile/:id', workerController.getWorkerProfile);
router.post('/update-status', workerController.updateStatus);
router.post('/save-push-token', savePushToken);
router.get('/dashboard/:workerId', getWorkerDashboard);
router.get('/wallet/:workerId', workerController.getWorkerWallet);

router.post('/login', workerController.loginWorker);
router.get('/profile/:id', workerController.getWorkerProfile);
// router.post('/update-status', workerController.updateStatus);
router.get("/pool-status/:workerId", workerController.getPoolStatus);
router.get(
  "/client-rating-status/:bookingId/:workerId",
  bookingController.getClientRatingStatus
);

router.post(
  "/rate-client",
  bookingController.submitClientRatingByWorker
);

router.get(
  "/history/:workerId",
  bookingController.getWorkerBookingHistory
);

router.get(
  "/booking-details/:bookingId/:workerId",
  bookingController.getWorkerBookingDetails
);

module.exports = router;