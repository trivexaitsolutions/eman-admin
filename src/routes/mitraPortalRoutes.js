// src/routes/mitraPortalRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mitraPortalController = require('../controllers/mitraPortalController');
const mitraNakaController = require('../controllers/mitraNakaController');
const nakaVerificationUpload = require('../middlewares/nakaVerificationUpload');
const workerController = require('../controllers/workerController');
const mitraBouncer = require('../middlewares/mitraBouncer');
const leaveController = require('../controllers/leaveController');
const draftController = require('../controllers/fieldOfficerDraftController');
const clientOtp = require('../services/fieldAgentClientOtp');
const { validateWorkerUpi } = require('../controllers/upiValidationController');

// Multer Storage for Video Consents.
// Browser MediaRecorder implementations can report different video MIME types
// (for example video/webm;codecs=vp9, video/3gpp, or application/octet-stream
// for a video file selected from disk). Accept video/* MIME types and use a
// strict extension allow-list only for generic/empty MIME types.
const CONSENT_VIDEO_EXTENSIONS = new Set([
    '.mp4', '.webm', '.mov', '.ogv', '.ogg', '.avi', '.m4v',
    '.3gp', '.3g2', '.mkv', '.mpeg', '.mpg', '.wmv', '.flv'
]);

const CONSENT_MIME_EXTENSIONS = {
    'video/mp4': '.mp4',
    'application/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/ogg': '.ogv',
    'application/ogg': '.ogv',
    'video/x-msvideo': '.avi',
    'video/x-m4v': '.m4v',
    'video/3gpp': '.3gp',
    'video/3gpp2': '.3g2',
    'video/x-matroska': '.mkv',
    'video/mpeg': '.mpeg',
    'video/x-ms-wmv': '.wmv',
    'video/x-flv': '.flv'
};

const getConsentVideoMime = (file) =>
    String(file.mimetype || '').split(';', 1)[0].trim().toLowerCase();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/consents';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const mime = getConsentVideoMime(file);
        const originalExt = path.extname(file.originalname || '').toLowerCase();
        const ext = CONSENT_MIME_EXTENSIONS[mime]
            || (CONSENT_VIDEO_EXTENSIONS.has(originalExt) ? originalExt : '.webm');
        cb(null, 'consent-' + Date.now() + '-' + require('node:crypto').randomBytes(4).toString('hex') + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        const mime = getConsentVideoMime(file);
        const originalExt = path.extname(file.originalname || '').toLowerCase();
        const hasVideoMime = mime.startsWith('video/');
        const hasRecognizedVideoExtension = CONSENT_VIDEO_EXTENSIONS.has(originalExt);
        const hasGenericMime = !mime || [
            'application/octet-stream', 'application/mp4', 'application/x-mp4'
        ].includes(mime);
        const allowed = hasVideoMime || (hasGenericMime && hasRecognizedVideoExtension);

        if (!allowed) {
            const receivedType = mime || 'unknown';
            return cb(new Error(
                `Unsupported consent video format (${receivedType}). Please record again or select an MP4/WebM video.`
            ), false);
        }

        cb(null, true);
    },
});


// --- PUBLIC ROUTES ---
router.get('/', (req, res) => res.redirect('/field-agent/login'));
router.get('/login', (req, res) => res.render('mitra/login', { layout: false }));
router.post('/login', mitraPortalController.login);
router.get('/logout', mitraPortalController.logout);

// --- PROTECTED ROUTES ---
router.get('/dashboard', mitraBouncer, mitraPortalController.showDashboard);
router.get('/drafts', mitraBouncer, draftController.listDrafts);
router.post('/drafts/save', mitraBouncer, express.json({ limit: '120kb' }), draftController.saveDraft);
router.post('/drafts/video', mitraBouncer, upload.single('videoConsent'), draftController.saveDraftVideo);
router.post('/api/validate-upi', mitraBouncer, express.json(), validateWorkerUpi);


// Field Agent Naka Submission
// A Field Agent can submit survey evidence, but cannot mark a Naka as VERIFIED.
// Submission creates a PENDING_VERIFICATION Naka and assigns it to that Field Agent.
router.get('/nakas', mitraBouncer, mitraNakaController.listMyNakas);
router.get('/nakas/add', mitraBouncer, mitraNakaController.showAddNakaForm);
router.post(
    '/nakas/submit',
    mitraBouncer,
    nakaVerificationUpload.single('verificationPhoto'),
    mitraNakaController.submitNaka
);

// Conflict Management Routes
router.get('/conflicts', mitraBouncer, mitraPortalController.getMitraConflicts);

router.get('/conflicts/:id', mitraBouncer, mitraPortalController.getMitraConflictDetails);

router.post('/conflicts/:id/status', mitraBouncer, mitraPortalController.updateMitraConflictStatus);

// Leave Management
router.get('/leaves', mitraBouncer, leaveController.listMitraLeaves);
router.post('/leaves/apply', mitraBouncer, leaveController.applyMitraLeave);
router.post('/leaves/:id/cancel', mitraBouncer, leaveController.cancelMitraLeave);

// 🚀 WORKER ROUTES UPDATE: upload.single('videoConsent') add kiya
router.get(
    "/workers",
    mitraBouncer,
    workerController.listMitraWorkers
);
router.get('/workers/add', mitraBouncer, workerController.showMitraAddForm);

// Live lookup: returns the current assigned + operational Nakas for a PIN.
router.get(
    '/api/nakas/search',
    mitraBouncer,
    workerController.searchMitraNakasByPincode
);

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
router.post('/clients/otp/send', mitraBouncer, express.json({ limit: '8kb' }), clientOtp.send);
router.post('/clients/otp/verify', mitraBouncer, express.json({ limit: '8kb' }), clientOtp.verify);
router.post('/clients/add', mitraBouncer, mitraPortalController.postAddClient);

router.get('/clients/edit/:id', mitraBouncer, mitraPortalController.showEditClient);
router.post('/clients/update/:id', mitraBouncer, mitraPortalController.updateClient);



module.exports = router;
