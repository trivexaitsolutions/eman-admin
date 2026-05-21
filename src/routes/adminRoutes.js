// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const mitraRoutes = require('./mitraRoutes'); // <-- YEH LINE ADD KAREIN

// 🚀 FIX 1: Curly braces {} laga kar exact function import kiya
const { authBouncer } = require('../middlewares/authBouncer');

const employeeRoutes = require('./employeeRoutes');
const cityRoutes = require('./cityRoutes');
const nakaRoutes = require('./nakaRoutes');
const skillRoutes = require('./skillRoutes');
const workerRoutes = require('./workerRoutes');

// --- PUBLIC ROUTES (No bouncer needed) ---
router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);

router.get('/logout', (req, res) => {
    // 🚀 FIX 2: Token hatane ke sath session bhi destroy karna zaroori hai
    res.clearCookie('token'); 
    if (req.session) {
        req.session.destroy();
    }
    res.redirect('/admin/login');
});

// --- PROTECTED ROUTES (Smart Bouncer) ---

// Dashboard sab access kar sakte hain
router.get('/dashboard', authBouncer(['superadmin', 'admin', 'employee']), (req, res) => {
    res.render('admin/dashboard');
});

// Master Data aur Employees sirf Admin/Superadmin access kar sakte hain (Employee nahi!)
router.use('/employees', authBouncer(['superadmin', 'admin']), employeeRoutes);
router.use('/cities', authBouncer(['superadmin', 'admin']), cityRoutes);
router.use('/nakas', authBouncer(['superadmin', 'admin']), nakaRoutes);
router.use('/skills', authBouncer(['superadmin', 'admin']), skillRoutes);

// Workers ko Admin aur Employee dono manage kar sakte hain
router.use('/workers', authBouncer(['superadmin', 'admin', 'employee']), workerRoutes);
router.use('/mitras', authBouncer(['superadmin', 'admin']), mitraRoutes);

module.exports = router;