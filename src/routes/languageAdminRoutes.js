'use strict';
const router = require('express').Router();
const c = require('../controllers/languageAdminController');
router.get('/', c.index);
router.post('/', c.create);
router.post('/:code', c.update);
module.exports = router;
