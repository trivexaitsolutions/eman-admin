const express = require('express');
const router = express.Router();
const workerController = require('../../controllers/workerController');

// This route will now be accessed via /api/worker/login
router.post('/login', workerController.loginWorker);
router.get('/profile/:id', workerController.getWorkerProfile);

module.exports = router;