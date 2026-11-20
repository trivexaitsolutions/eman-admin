// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const conflictRoutes = require('./conflictRoutes');
const mitraRoutes = require('./mitraRoutes');
const { authBouncer } = require('../middlewares/authBouncer');
// const adminDashboardController = require('../controllers/adminDashboardController');

const employeeRoutes = require('./employeeRoutes');
const stateRoutes = require('./stateRoutes');
const cityRoutes = require('./cityRoutes');
const nakaRoutes = require('./nakaRoutes');
const skillRoutes = require('./skillRoutes');
const workerRoutes = require('./workerRoutes');
const bookingSettingRoutes = require('./bookingSettingRoutes');
const apiIntegrationsRoutes = require('./apiIntegrationsRoutes');
const adminBookingRoutes = require('./adminBookingRoutes');
const adminDashboardController = require('../controllers/adminDashboardController');
const leaveRoutes = require('./leaveRoutes');
const adminClientController = require('../controllers/adminClientController');
const adminSimulatorRoutes = require('./adminSimulatorRoutes');

router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    if (req.session) req.session.destroy();
    res.redirect('/admin/login');
});

router.get(
    '/dashboard',
    authBouncer(['superadmin', 'admin', 'employee']),
    adminDashboardController.showDashboard
);
router.use('/employees', authBouncer(['superadmin', 'admin']), employeeRoutes);
router.use('/states', authBouncer(['superadmin', 'admin']), stateRoutes);
router.use('/cities', authBouncer(['superadmin', 'admin']), cityRoutes);
router.use('/nakas', authBouncer(['superadmin', 'admin']), nakaRoutes);
router.use('/skills', authBouncer(['superadmin', 'admin']), skillRoutes);
router.use('/simulator', authBouncer(['superadmin', 'admin']), adminSimulatorRoutes);
router.use('/booking-settings', authBouncer(['superadmin', 'admin']), bookingSettingRoutes);
router.use('/api-integrations', authBouncer(['superadmin', 'admin']), apiIntegrationsRoutes);
router.use('/bookings', authBouncer(['superadmin', 'admin', 'employee']), adminBookingRoutes);

router.get('/clients', authBouncer(['superadmin', 'admin', 'employee']), adminClientController.listClients);
router.use('/workers', authBouncer(['superadmin', 'admin', 'employee']), workerRoutes);
router.use('/field-agents', authBouncer(['superadmin', 'admin']), mitraRoutes);
// Old admin links continue to work; POST /admin/mitras/save remains compatible.
router.use('/mitras', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return res.redirect(302, req.originalUrl.replace(/^\/admin\/mitras(?=\/|\?|$)/, '/admin/field-agents'));
    }
    next();
}, authBouncer(['superadmin', 'admin']), mitraRoutes);
router.use('/conflicts', authBouncer(['superadmin', 'admin', 'employee']), conflictRoutes);
router.use('/leaves', authBouncer(['superadmin', 'admin', 'employee']), leaveRoutes);

module.exports = router;
