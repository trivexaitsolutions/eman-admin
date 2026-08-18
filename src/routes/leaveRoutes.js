const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');

router.get('/', leaveController.listLeaves);
router.get('/my', leaveController.listMyEmployeeLeaves);
router.post('/apply', leaveController.applyEmployeeLeave);
router.post('/my/:id/cancel', leaveController.cancelEmployeeLeave);

// Admin / leave-manager actions
router.post('/create', leaveController.createManagedLeave);
router.post('/:id/decision', leaveController.decideLeave);
router.post('/:id/update', leaveController.updateManagedLeave);
router.post('/:id/reassign', leaveController.reassignManagedLeave);
router.post('/:id/return', leaveController.markReturned);
router.post('/:id/cancel', leaveController.cancelManagedLeave);

module.exports = router;
