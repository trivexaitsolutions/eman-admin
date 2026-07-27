const multer = require('multer');
const path = require('path');
const fs = require('fs');

const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folderPath = 'public/uploads/misc';

        if (file.fieldname === 'photoUrl') {
            folderPath = 'public/uploads/photos';
        } else if (file.fieldname === 'consentVoiceUrl') {
            folderPath = 'public/uploads/voice';
        } else if (file.fieldname === 'verificationPhoto') {
            folderPath = 'public/uploads/naka-verification';
        }

        const fullDir = path.join(__dirname, '../../', folderPath);

        if (!fs.existsSync(fullDir)) {
            fs.mkdirSync(fullDir, { recursive: true });
        }

        cb(null, folderPath);
    },
    filename: function (req, file, cb) {
        const safeExtension = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB per file
    },
    fileFilter: (req, file, cb) => {
        // Existing worker photo/voice uploads remain unchanged. Apply image-only validation
        // only to the new Naka verification proof field.
        if (file.fieldname === 'verificationPhoto' && !IMAGE_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('Verification photo must be a JPG, PNG, or WEBP image.'));
        }

        return cb(null, true);
    },
});

module.exports = upload;
