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

const showDashboard = async (req, res) => {
    try {
        // Assume kar rahe hain ki Mitra login hai aur uski ID req me hai (e.g., req.session.mitra.id)
        // Testing ke liye ID 1 use kar rahe hain, aap isko apne auth bouncer ke hisaab se set karein
        const mitraId = req.user ? req.user.id : 1; 

        // Time logic: Aaj ki shuruwat aur Is mahine ki shuruwat
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // --- WORKERS STATS ---
        const totalWorkers = await prisma.worker.count({ where: { mitraId } });
        const workersToday = await prisma.worker.count({ where: { mitraId, createdAt: { gte: startOfToday } } });
        const workersMonth = await prisma.worker.count({ where: { mitraId, createdAt: { gte: startOfMonth } } });

        // --- CLIENTS STATS ---
        const totalClients = await prisma.customer.count({ where: { mitraId } });
        const clientsToday = await prisma.customer.count({ where: { mitraId, createdAt: { gte: startOfToday } } });
        const clientsMonth = await prisma.customer.count({ where: { mitraId, createdAt: { gte: startOfMonth } } });

        // Data EJS ko bhejna
        const stats = {
            totalWorkers, workersToday, workersMonth,
            totalClients, clientsToday, clientsMonth,
            totalNetwork: totalWorkers + totalClients
        };

        res.render('mitra/dashboard', { layout: false, stats });

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        res.status(500).send("Server Error");
    }
};

const logout = (req, res) => {
    res.clearCookie('mitraToken');
    res.redirect('/mitra/login');
};

const getAddClient = (req, res) => {
    res.render('mitra/add-client', { layout: false });
};

// POST: Naye Client ka data database me save karne ke liye
const postAddClient = async (req, res) => {
    try {
        const { 
            clientType, contactName, phone, email, 
            siteAddress, businessName, businessType, 
            gstNumber, workerRequirement 
        } = req.body;
        
        // 🚀 1. Mitra ki ID fetch karein (aapke mitraBouncer/auth middleware ke hisaab se)
        // Agar aap req.user use karte hain toh req.user.id, ya phir req.session.mitraId 
        const mitraId = req.user ? req.user.id : 1; // Dummy '1' for testing if auth is off
        
        const existingCustomer = await prisma.customer.findUnique({ where: { phone } });

        // 🚀 2. Data object mein mitraId add kar diya
        const dataToSave = {
            clientType,
            name: contactName,
            email: email || `${phone}@eman-b2b.com`, // Email optional tha
            siteAddress,
            businessName: clientType === 'Company' ? businessName : null,
            businessType: clientType === 'Company' ? businessType : null,
            gstNumber: clientType === 'Company' ? gstNumber : null,
            workerRequirement,
            isVerified: true, // OTP frontend par verify ho gaya tha
            mitraId: mitraId  // <--- YAHAN JOD DIYA MITRA KA CONNECTION!
        };

        if (existingCustomer) {
            await prisma.customer.update({
                where: { phone },
                data: dataToSave
            });
        } else {
            await prisma.customer.create({
                data: { phone, ...dataToSave }
            });
        }
        
        res.redirect('/mitra/dashboard');
    } catch (error) {
        console.error("Add Client Error:", error);
        res.render('mitra/add-client', { layout: false, error_msg: 'Failed to add client. Check details.' });
    }
};


module.exports = { login, showDashboard, logout, getAddClient, postAddClient };