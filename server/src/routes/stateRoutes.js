// src/routes/stateRoutes.js
const express = require('express');
const router = express.Router();
const stateController = require('../controllers/stateController');

// States are seeded master data. This page is intentionally read-only.
router.get('/', stateController.listStates);

module.exports = router;
