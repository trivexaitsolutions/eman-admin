// src/middlewares/nakaVerificationUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = path.join(__dirname, '../../public/uploads/naka-verification');

const storage = multer.diskStorage({
    destination(req, file, cb) {
        try {
            fs.mkdirSync(uploadDirectory, { recursive: true });
            cb(null, uploadDirectory);
        } catch (error) {
            cb(error);
        }
    },
    filename(req, file, cb) {
        const safeExtension = path.extname(file.originalname || '').toLowerCase();
        cb(null, `naka-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
    },
});

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
        files: 1,
    },
    fileFilter(req, file, cb) {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return cb(new Error('Only JPG, PNG or WEBP verification photos are allowed.'));
        }
        return cb(null, true);
    },
});

module.exports = upload;
