// server.js
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

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

// --- 3. ROUTES ---
// Funnel all admin traffic through our nested router hub
const adminRoutes = require('./src/routes/adminRoutes');
app.use('/admin', adminRoutes);

// If someone just types localhost:3000, send them to the admin login
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Add these right above your Admin routes in server.js
app.use('/api/worker', require('./src/routes/api/workerRoutes'));
app.use('/api/user', require('./src/routes/api/userRoutes'));

// --- 4. START SERVER ---
app.listen(PORT,"0.0.0.0", () => {
    console.log(`🚀 E-man Server running clean on http://0.0.0.0:${PORT}`);
});