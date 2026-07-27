// src/routes/workerRoutes.js
const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');

// Import our powerful new universal upload middleware
const upload = require('../middlewares/uploadMiddleware'); 

router.get('/', workerController.listWorkers);
router.get('/create', workerController.showForm);
router.get('/edit/:id', workerController.showForm);

// We just tell the middleware which fields to expect, and it handles the rest!
router.post('/save', upload.fields([
    { name: 'photoUrl', maxCount: 1 }, 
    { name: 'consentVoiceUrl', maxCount: 1 }
]), workerController.saveWorker);

router.get('/delete/:id', workerController.deleteWorker);

module.exports = router;