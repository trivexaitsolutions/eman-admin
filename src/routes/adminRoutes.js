// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Import the Bouncer
const requireAuth = require('../middlewares/authBouncer');

// Add this under your protected dashboard route in adminRoutes.js
const employeeRoutes = require('./employeeRoutes');
const cityRoutes = require('./cityRoutes');
const nakaRoutes = require('./nakaRoutes');
const skillRoutes = require('./skillRoutes');
const workerRoutes = require('./workerRoutes');


// --- PUBLIC ROUTES (No bouncer needed) ---
router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);

// --- PROTECTED ROUTES (Bouncer checks ID) ---
// Notice we put requireAuth in the middle!
router.get('/dashboard', requireAuth, (req, res) => {
    // Now we can pass data to EJS, and 'user' is already available thanks to the bouncer!
    // res.send(`<h1>Welcome to the Control Center, ${req.user.name}!</h1><br><a href="/admin/logout">Logout</a>`);
    res.render('admin/dashboard');
});

// Let's add a quick logout route while we are here
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/admin/login');
});



// Protect all employee routes with the Bouncer
router.use('/employees', requireAuth, employeeRoutes);
// Add this under your protected dashboard route in adminRoutes.js

router.use('/cities', requireAuth, cityRoutes);

router.use('/nakas', requireAuth, nakaRoutes);

router.use('/skills', requireAuth, skillRoutes);

router.use('/workers', requireAuth, workerRoutes);

module.exports = router;