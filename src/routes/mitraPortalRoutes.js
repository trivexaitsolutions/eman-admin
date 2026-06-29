// src/routes/mitraPortalRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mitraPortalController = require('../controllers/mitraPortalController');
const workerController = require('../controllers/workerController');
const mitraBouncer = require('../middlewares/mitraBouncer');

// Multer Storage for Video Consents
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/consents';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'consent-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


// --- PUBLIC ROUTES ---
router.get('/login', (req, res) => res.render('mitra/login', { layout: false }));
router.post('/login', mitraPortalController.login);
router.get('/logout', mitraPortalController.logout);

// --- PROTECTED ROUTES ---
router.get('/dashboard', mitraBouncer, mitraPortalController.showDashboard);

// Conflict Management Routes
router.get('/conflicts', mitraBouncer, mitraPortalController.getMitraConflicts);

router.get('/conflicts/:id', mitraBouncer, mitraPortalController.getMitraConflictDetails);

router.post('/conflicts/:id/status', mitraBouncer, mitraPortalController.updateMitraConflictStatus);

// 🚀 WORKER ROUTES UPDATE: upload.single('videoConsent') add kiya
router.get(
    "/workers",
    mitraBouncer,
    workerController.listMitraWorkers
);
router.get('/workers/add', mitraBouncer, workerController.showMitraAddForm);

router.get(
    '/workers/edit/:id',
    mitraBouncer,
    workerController.showMitraEditForm
);

router.post(
    '/workers/save',
    mitraBouncer,
    upload.single('videoConsent'),
    workerController.saveMitraWorker
);

router.post(
    '/workers/update/:id',
    mitraBouncer,
    upload.single('videoConsent'),
    workerController.updateMitraWorker
);

// Client Onboarding Routes
router.get('/clients', mitraBouncer, mitraPortalController.listMitraClients);

router.get('/clients/add', mitraBouncer, mitraPortalController.getAddClient);
router.post('/clients/add', mitraBouncer, mitraPortalController.postAddClient);

router.get('/clients/edit/:id', mitraBouncer, mitraPortalController.showEditClient);
router.post('/clients/update/:id', mitraBouncer, mitraPortalController.updateClient);



module.exports = router;