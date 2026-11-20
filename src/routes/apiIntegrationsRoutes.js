'use strict';
const router = require('express').Router();
const controller = require('../controllers/apiIntegrationsController');
router.get('/', controller.show);
router.post('/', controller.save);
module.exports = router;
