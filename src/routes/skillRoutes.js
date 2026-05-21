// src/routes/skillRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const skillController = require('../controllers/skillController');

// Multer Storage Configuration (Images ko public/uploads/skills me save karne ke liye)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/skills'); // Ensure karein ki yeh folder aapke project me exist karta ho
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'skill-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/', skillController.listSkills);
router.get('/create', skillController.showForm);
router.get('/edit/:id', skillController.showForm);

// NAYA CHANGE: 'upload.single("image")' middleware add kiya gaya hai
router.post('/save', upload.single('image'), skillController.saveSkill);

router.get('/delete/:id', skillController.deleteSkill);

module.exports = router;