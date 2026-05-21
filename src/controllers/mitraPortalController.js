// src/controllers/mitraPortalController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Email se Mitra ko database mein dhoondho
        const mitra = await prisma.mitra.findUnique({ where: { email } });

        // 2. Agar nahi mila ya inactive hai
        if (!mitra || !mitra.isActive) {
            return res.redirect('/mitra/login?error=invalid_credentials');
        }

        // 3. Password match karo
        const isMatch = await bcrypt.compare(password, mitra.password);
        if (!isMatch) {
            return res.redirect('/mitra/login?error=invalid_credentials');
        }

        // 4. Token banao aur role 'MITRA' set karo
        const token = jwt.sign(
            { id: mitra.id, name: mitra.name, email: mitra.email, role: 'MITRA' },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '7d' } // 7 din tak login rahega
        );

        // 5. 'mitraToken' naam ki cookie me save karo
        res.cookie('mitraToken', token, { httpOnly: true });
        res.redirect('/mitra/dashboard');
    } catch (error) {
        console.error("Mitra Login Error:", error);
        res.redirect('/mitra/login');
    }
};

const showDashboard = (req, res) => {
    // Layout false bhejenge taaki dashboard par bhi admin sidebar na aaye
    res.render('mitra/dashboard', { layout: false, user: req.user });
};

const logout = (req, res) => {
    res.clearCookie('mitraToken');
    res.redirect('/mitra/login');
};

module.exports = { login, showDashboard, logout };