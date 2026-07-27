// src/controllers/skillController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listSkills = async (req, res) => {
    try {
        const skills = await prisma.skill.findMany({
            // Fetch the rates ordered by star (1 to 5+)
            include: { rates: { orderBy: { star: 'asc' } }, _count: { select: { workers: true } } },
            orderBy: { id: 'desc' }
        });
        res.render('admin/skills/index', { skills });
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

const showForm = async (req, res) => {
    try {
        let skill = { isActive: true, rates: [] };
        let isEdit = false;
        
        if (req.params.id) {
            skill = await prisma.skill.findUnique({ 
                where: { id: parseInt(req.params.id) },
                include: { rates: { orderBy: { star: 'asc' } } }
            });
            isEdit = true;
        }
        res.render('admin/skills/form', { skill, isEdit, error: null });
    } catch (error) {
        res.redirect('/admin/skills');
    }
};

const saveSkill = async (req, res) => {
    const { id, name, description, stars, rates } = req.body;
    const isActive = req.body.isActive === 'on';

    try {
        let skillId = id ? parseInt(id) : null;
        
        // Basic data prepare karein
        const skillData = { 
            name: name.trim(), 
            description: description?.trim(), 
            isActive 
        };

        // 🚀 NAYA LOGIC: Agar image upload hui hai, toh path set karein
        if (req.file) {
            skillData.imageUrl = '/uploads/skills/' + req.file.filename;
        }

        if (skillId) {
            await prisma.skill.update({ where: { id: skillId }, data: skillData });
            await prisma.skillRate.deleteMany({ where: { skillId } });
        } else {
            const newSkill = await prisma.skill.create({ data: skillData });
            skillId = newSkill.id;
        }

        const starArray = Array.isArray(stars) ? stars : [stars];
        const rateArray = Array.isArray(rates) ? rates : [rates];
        
        const rateRecords = [];
        for (let i = 0; i < starArray.length; i++) {
            if (starArray[i] && rateArray[i]) {
                rateRecords.push({
                    skillId: skillId,
                    star: parseFloat(starArray[i]),
                    rate: parseFloat(rateArray[i])
                });
            }
        }

        if (rateRecords.length > 0) {
            await prisma.skillRate.createMany({ data: rateRecords });
        }

        res.redirect('/admin/skills');
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.render('admin/skills/form', { skill: { ...req.body, rates: [] }, isEdit: !!id, error: "This skill name already exists!" });
        }
        res.redirect('/admin/skills');
    }
};

const deleteSkill = async (req, res) => {
    try {
        await prisma.skill.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/skills');
    } catch (error) {
        res.redirect('/admin/skills');
    }
};

module.exports = { listSkills, showForm, saveSkill, deleteSkill };