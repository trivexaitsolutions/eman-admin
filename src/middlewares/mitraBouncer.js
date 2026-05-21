// src/middlewares/mitraBouncer.js
const jwt = require('jsonwebtoken');

const mitraBouncer = (req, res, next) => {
    // 1. Mitra ki special cookie check karein
    const token = req.cookies ? req.cookies.mitraToken : null;

    if (!token) {
        return res.redirect('/mitra/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        
        // 2. Check karein ki role MITRA hi hai na
        if (decoded.role !== 'MITRA') {
            return res.redirect('/mitra/login');
        }

        // 3. User data ko request mein daal do dashboard ke liye
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('mitraToken');
        return res.redirect('/mitra/login');
    }
};

module.exports = mitraBouncer;