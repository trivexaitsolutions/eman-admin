// src/controllers/cityController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listCities = async (req, res) => {
    try {
        // Fetch cities and count how many Nakas each city has
        const cities = await prisma.city.findMany({
            include: { _count: { select: { nakas: true } } },
            orderBy: { id: 'desc' }
        });
        res.render('admin/cities/index', { cities });
    } catch (error) {
        console.error("Error loading cities:", error);
        res.status(500).send("Server Error");
    }
};

const showForm = async (req, res) => {
    try {
        let city = {};
        let isEdit = false;
        
        if (req.params.id) {
            city = await prisma.city.findUnique({ where: { id: parseInt(req.params.id) } });
            isEdit = true;
        }
        res.render('admin/cities/form', { city, isEdit });
    } catch (error) {
        res.redirect('/admin/cities');
    }
};

const saveCity = async (req, res) => {
    const { id, name } = req.body;
    try {
        if (id) {
            await prisma.city.update({
                where: { id: parseInt(id) },
                data: { name }
            });
        } else {
            await prisma.city.create({ data: { name } });
        }
        res.redirect('/admin/cities');
    } catch (error) {
        console.error("Save City Error:", error);
        res.redirect('/admin/cities');
    }
};

const deleteCity = async (req, res) => {
    try {
        await prisma.city.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/cities');
    } catch (error) {
        // Will fail if a Naka is currently attached to this city
        res.status(400).send("Cannot delete city. Please remove attached Nakas first.");
    }
};

module.exports = { listCities, showForm, saveCity, deleteCity };