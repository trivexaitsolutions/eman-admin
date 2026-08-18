// server.js
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();
const { startLeaveReassignmentWatcher } = require('./src/services/leaveService');


const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// --- 1. VIEW ENGINE SETUP ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // We will build this layout next

// --- 2. MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(require('./src/middlewares/viewGlobals'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'trivexait_eman_secret', // Aap ise kuch bhi rakh sakte hain
    resave: false,
    saveUninitialized: true
}));

app.use(flash());

// 🚀 GLOBAL VARIABLES: Yeh aapke har EJS page me available honge
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// --- 3. ROUTES ---
// Funnel all admin traffic through our nested router hub
const adminRoutes = require('./src/routes/adminRoutes');
const mitraPortalRoutes = require('./src/routes/mitraPortalRoutes');
app.use('/admin', adminRoutes);
app.use('/mitra', mitraPortalRoutes);

// If someone just types localhost:3000, send them to the admin login
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Add these right above your Admin routes in server.js
app.use('/api/worker', require('./src/routes/api/workerRoutes'));
app.use('/api/user', require('./src/routes/api/userRoutes'));

// Keep approved Mitra leaves in sync with conflict assignment/reassignment.
startLeaveReassignmentWatcher();

// --- 4. START SERVER ---
app.listen(PORT,"0.0.0.0", () => {
    console.log(`🚀 E-man Server running clean on http://0.0.0.0:${PORT}`);
});