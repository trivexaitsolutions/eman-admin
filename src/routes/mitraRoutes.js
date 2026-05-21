// src/routes/mitraRoutes.js
const express = require('express');
const router = express.Router();
const mitraController = require('../controllers/mitraController');

router.get('/', mitraController.listMitras);
router.get('/create', mitraController.showForm);
router.get('/edit/:id', mitraController.showForm);
router.post('/save', mitraController.saveMitra);
router.get('/delete/:id', mitraController.deleteMitra);

module.exports = router;