// src/routes/nakaRoutes.js
const express = require('express');
const router = express.Router();
const nakaController = require('../controllers/nakaController');
const upload = require('../middlewares/uploadMiddleware');

router.get('/', nakaController.listNakas);
router.get('/create', nakaController.showForm);
router.get('/edit/:id', nakaController.showForm);

// Naka create/edit. The two submit buttons send saveAction=VERIFY_NOW or VERIFY_LATER.
router.post('/save', upload.single('verificationPhoto'), nakaController.saveNaka);

// The list-page verification modal uses these two endpoints.
router.get('/:id/verification-details', nakaController.getVerificationDetails);
router.post('/:id/verify', upload.single('verificationPhoto'), nakaController.verifyNaka);

router.get('/delete/:id', nakaController.deleteNaka);

// Existing worker assignment API: only currently verified Nakas are operationally visible.
router.get('/api/by-pincode/:pincode', nakaController.getNakasByPincode);

module.exports = router;
