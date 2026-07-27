// src/routes/cityRoutes.js
const express = require('express');
const router = express.Router();
const cityController = require('../controllers/cityController');

router.get('/', cityController.listCities);
router.get('/create', cityController.showForm);
router.get('/edit/:id', cityController.showForm);
router.post('/save', cityController.saveCity);
router.get('/delete/:id', cityController.deleteCity);

module.exports = router;
