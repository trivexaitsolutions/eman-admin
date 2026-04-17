// src/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

// All paths here are prefixed with /admin/employees in the main router
router.get('/', employeeController.listEmployees);
router.get('/create', employeeController.showForm);
router.get('/edit/:id', employeeController.showForm);
router.post('/save', employeeController.saveEmployee);
router.get('/delete/:id', employeeController.deleteEmployee);

module.exports = router;