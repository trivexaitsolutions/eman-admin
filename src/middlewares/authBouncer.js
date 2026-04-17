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

module.exports = requireAuth;