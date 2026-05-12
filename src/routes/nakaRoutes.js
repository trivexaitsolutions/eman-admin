// src/routes/nakaRoutes.js
const express = require('express');
const router = express.Router();
const nakaController = require('../controllers/nakaController');

router.get('/', nakaController.listNakas);
router.get('/create', nakaController.showForm);
router.get('/edit/:id', nakaController.showForm);
router.post('/save', nakaController.saveNaka);
router.get('/delete/:id', nakaController.deleteNaka);

// Add this to src/routes/nakaRoutes.js
// API Endpoint for the frontend to fetch Nakas by pincode
router.get('/api/by-pincode/:pincode', async (req, res) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
        const nakas = await prisma.naka.findMany({
            where: { pincode: req.params.pincode },
            select: { id: true, name: true, city: { select: { name: true } } }
        });
        res.json(nakas);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch Nakas" });
    }
});

module.exports = router;