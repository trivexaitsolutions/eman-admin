// src/routes/nakaRoutes.js
const express = require('express');
const router = express.Router();
const nakaController = require('../controllers/nakaController');
const upload = require('../middlewares/nakaVerificationUpload');

router.get('/', nakaController.listNakas);
router.get('/create', nakaController.showForm);
router.get('/edit/:id', nakaController.showForm);

// State/City lookup used while Admin enters a Naka PIN code.
router.get('/api/location-by-pincode/:pincode', nakaController.getLocationByPincode);

// Existing operational Naka lookup. Returns only currently verified Nakas.
router.get('/api/by-pincode/:pincode', nakaController.getNakasByPincode);

// Naka create/edit. The buttons send saveAction=VERIFY_NOW or VERIFY_LATER.
router.post('/save', upload.single('verificationPhoto'), nakaController.saveNaka);

// Verification modal endpoints.
router.get('/:id/verification-details', nakaController.getVerificationDetails);
router.post('/:id/verify', upload.single('verificationPhoto'), nakaController.verifyNaka);

router.get('/delete/:id', nakaController.deleteNaka);

module.exports = router;
