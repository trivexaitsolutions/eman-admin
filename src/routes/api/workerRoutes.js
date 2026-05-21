const express = require('express');
const router = express.Router();
const workerController = require('../../controllers/workerController');
const { savePushToken,getWorkerDashboard } = require('../../controllers/workerController');

// This route will now be accessed via /api/worker/login
router.post('/login', workerController.loginWorker);
router.get('/profile/:id', workerController.getWorkerProfile);
router.post('/update-status', workerController.updateStatus);
router.post('/save-push-token', savePushToken);
router.get('/dashboard/:workerId', getWorkerDashboard);
module.exports = router;