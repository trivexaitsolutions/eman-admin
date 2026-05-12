// src/middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 1. Determine the target folder based on the input name
        let folderPath = 'public/uploads/misc'; // Default fallback folder
        
        if (file.fieldname === 'photoUrl') {
            folderPath = 'public/uploads/photos';
        } else if (file.fieldname === 'consentVoiceUrl') {
            folderPath = 'public/uploads/voice';
        }

        // 2. Resolve the absolute path
        const fullDir = path.join(__dirname, '../../', folderPath);

        // 3. Auto-create the directory if it's missing
        if (!fs.existsSync(fullDir)) {
            fs.mkdirSync(fullDir, { recursive: true });
        }

        // 4. Tell multer where to put the file
        cb(null, folderPath);
    },
    filename: function (req, file, cb) {
        // Generate a secure, unique filename
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

// Export the configured multer instance
const upload = multer({ storage: storage });

module.exports = upload;