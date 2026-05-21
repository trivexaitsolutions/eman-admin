// src/middlewares/authBouncer.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'eman_secret_key_2026';

const requireAuth = (req, res, next) => {
    // 1. Look for the token in the cookies
    const token = req.cookies.token;

    // 2. If no token, kick them back to login
    if (!token) {
        return res.redirect('/admin/login');
    }

    try {
        // 3. Verify the token is real and hasn't been tampered with
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 4. Attach the user data to the request AND to EJS locals
        req.user = decoded;
        res.locals.user = decoded; // This makes 'user' available in EVERY EJS file!
        
        next(); // Let them pass
    } catch (err) {
        // Token is expired or fake
        res.clearCookie('token');
        return res.redirect('/admin/login');
    }
};

const authBouncer = (allowedRoles = []) => {
    return (req, res, next) => {
        // 1. Cookies se token nikalein
        const token = req.cookies ? req.cookies.token : null;

        // 2. Agar token nahi hai, toh login par bhej do
        if (!token) {
            return res.redirect('/admin/login');
        }

        try {
            // 3. Token ko verify karein (Apna actual JWT_SECRET check kar lena jo login controller me hai)
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
            
            req.user = decoded; 
            
            // 🚀 BOHOT ZAROORI: EJS templates ko user ka data yahi se pass kar do
            res.locals.user = decoded;
            res.locals.userRole = decoded.role; // 'admin', 'employee', etc.

            // 4. Role check karein
            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).send("Access Denied: Aapke paas permission nahi hai.");
            }

            next();
        } catch (error) {
            console.error("Bouncer Token Error:", error);
            res.clearCookie('token');
            return res.redirect('/admin/login');
        }
    };
};

module.exports = {requireAuth, authBouncer};