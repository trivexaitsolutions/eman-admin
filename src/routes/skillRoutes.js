// src/routes/skillRoutes.js
const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');

router.get('/', skillController.listSkills);
router.get('/create', skillController.showForm);
router.get('/edit/:id', skillController.showForm);
router.post('/save', skillController.saveSkill);
router.get('/delete/:id', skillController.deleteSkill);

module.exports = router;