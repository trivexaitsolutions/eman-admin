// src/routes/nakaRoutes.js
const express = require('express');
const router = express.Router();
const nakaController = require('../controllers/nakaController');

router.get('/', nakaController.listNakas);
router.get('/create', nakaController.showForm);
router.get('/edit/:id', nakaController.showForm);
router.post('/save', nakaController.saveNaka);
router.get('/delete/:id', nakaController.deleteNaka);

module.exports = router;