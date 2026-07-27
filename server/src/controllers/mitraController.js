// src/controllers/mitraController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// 1. Saare Mitras ki list dikhane ke liye
const listMitras = async (req, res) => {
    try {
        const mitras = await prisma.mitra.findMany({
            include: { nakas: true },
            orderBy: { id: 'desc' }
        });
        res.render('admin/mitras/index', { mitras });
    } catch (error) {
        console.error("List Mitras Error:", error);
        res.status(500).send("Server Error");
    }
};

// 2. Add / Edit form display karne ke liye
const showForm = async (req, res) => {
    try {
        const nakas = await prisma.naka.findMany();
        let mitra = { isActive: true, nakas: [] };
        let isEdit = false;
        
        if (req.params.id) {
            mitra = await prisma.mitra.findUnique({ 
                where: { id: parseInt(req.params.id) },
                include: { nakas: true }
            });
            isEdit = true;
        }
        res.render('admin/mitras/form', { mitra, nakas, isEdit, error: null });
    } catch (error) {
        console.error("Show Mitra Form Error:", error);
        res.redirect('/admin/mitras');
    }
};

// 3. Mitra ka data save ya update karne ke liye
const saveMitra = async (req, res) => {
    const { id, name, phone, email, password, nakaIds } = req.body;
    const isActive = req.body.isActive === 'on';

    try {
        // Checkbox se aaye IDs ko integer array me convert karna
        const selectedNakas = [].concat(nakaIds || []).filter(nId => nId).map(nId => ({ id: parseInt(nId) }));

        const mitraData = {
            name,
            phone,
            email: email ? email.trim() : null,
            isActive
        };

        // Agar password dala hai (ya new account hai) toh encrypt karo
        if (password) {
            mitraData.password = await bcrypt.hash(password, 10);
        }

        if (id) {
            // Update Mode
            await prisma.mitra.update({ 
                where: { id: parseInt(id) }, 
                data: { 
                    ...mitraData, 
                    nakas: { set: selectedNakas } // Purane hatakar naye set karega
                } 
            });
        } else {
            // Create Mode
            await prisma.mitra.create({ 
                data: { 
                    ...mitraData, 
                    nakas: { connect: selectedNakas } 
                } 
            });
        }
        
        res.redirect('/admin/mitras');
    } catch (error) {
        console.error("Save Mitra Backend Error:", error);
        res.redirect('/admin/mitras'); 
    }
};

// 4. Mitra delete karne ke liye
const deleteMitra = async (req, res) => {
    try {
        await prisma.mitra.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/mitras');
    } catch (error) {
        console.error("Delete Mitra Error:", error);
        res.redirect('/admin/mitras');
    }
};

module.exports = { listMitras, showForm, saveMitra, deleteMitra };