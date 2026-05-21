// src/controllers/nakaController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listNakas = async (req, res) => {
    try {
        // Fetch Nakas, include the City name, and count the workers
        const nakas = await prisma.naka.findMany({
            include: { city: true, _count: { select: { workers: true } } },
            orderBy: { id: 'desc' }
        });
        res.render('admin/nakas/index', { nakas });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

const showForm = async (req, res) => {
    try {
        // We need cities for the dropdown menu
        const cities = await prisma.city.findMany({ orderBy: { name: 'asc' } });
        let naka = {};
        let isEdit = false;
        
        if (req.params.id) {
            naka = await prisma.naka.findUnique({ where: { id: parseInt(req.params.id) } });
            isEdit = true;
        }
        res.render('admin/nakas/form', { naka, cities, isEdit });
    } catch (error) {
        res.redirect('/admin/nakas');
    }
};

const saveNaka = async (req, res) => {
    // Notice we grab cityId and pincode from the form now
    const { id, name, cityId, pincode } = req.body;
    try {
        const data = { name, pincode, cityId: parseInt(cityId) };
        
        if (id) {
            await prisma.naka.update({ where: { id: parseInt(id) }, data });
        } else {
            await prisma.naka.create({ data });
        }
        res.redirect('/admin/nakas');
    } catch (error) {
        console.error("Save Naka Error:", error);
        res.redirect('/admin/nakas');
    }
};
const deleteNaka = async (req, res) => {
    try {
        await prisma.naka.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/nakas');
    } catch (error) {
        res.status(400).send("Cannot delete. Please remove assigned workers first.");
    }
};

module.exports = { listNakas, showForm, saveNaka, deleteNaka };