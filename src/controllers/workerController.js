// src/controllers/workerController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const listWorkers = async (req, res) => {
    try {
        const workers = await prisma.worker.findMany({
            include: { nakas: true, skills: true },
            orderBy: { id: 'desc' }
        });
        res.render('admin/workers/index', { workers });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

const showForm = async (req, res) => {
    try {
        const skills = await prisma.skill.findMany({ where: { isActive: true } });
        let worker = { isActive: true, nakas: [], skills: [] };
        let isEdit = false;
        
        if (req.params.id) {
            worker = await prisma.worker.findUnique({ 
                where: { id: parseInt(req.params.id) },
                include: { nakas: true, skills: true }
            });
            isEdit = true;
        }
        res.render('admin/workers/form', { worker, skills, isEdit, error: null });
    } catch (error) {
        res.redirect('/admin/workers');
    }
};
// src/controllers/workerController.js

const saveWorker = async (req, res) => {
    // 1. Add phone, email, and password to the destructured body
    const { 
        id, name, phone, email, password, dob, age, qualification, idProofType, idNumber, 
        address, pincode, bankDetails, upiId, upiNumber,
        nakaIds, skillIds 
    } = req.body;
    
    const isActive = req.body.isActive === 'on';

    try {
        const selectedNakas = [].concat(nakaIds || []).filter(id => id).map(nid => ({ id: parseInt(nid) }));
        const selectedSkills = [].concat(skillIds || []).filter(id => id).map(sid => ({ id: parseInt(sid) }));

        // 2. Add phone and email to workerData
        const workerData = {
            name,
            phone,
            email: email ? email.trim() : null, // Store null if left blank
            dob: new Date(dob),
            age: parseInt(age),
            qualification,
            idProofType,
            idNumber,
            address,
            pincode,
            bankDetails,
            upiId,
            upiNumber,
            isActive
        };

        // 3. Encrypt the password if one was provided
        if (password) {
            workerData.password = await bcrypt.hash(password, 10);
        }

        // Handle uploaded files
        if (req.files && req.files['photoUrl']) {
            workerData.photoUrl = '/uploads/photos/' + req.files['photoUrl'][0].filename;
        }
        if (req.files && req.files['consentVoiceUrl']) {
            workerData.consentVoiceUrl = '/uploads/voice/' + req.files['consentVoiceUrl'][0].filename;
        }

        if (id) {
            await prisma.worker.update({ 
                where: { id: parseInt(id) }, 
                data: { ...workerData, nakas: { set: selectedNakas }, skills: { set: selectedSkills } } 
            });
        } else {
            await prisma.worker.create({ 
                data: { ...workerData, nakas: { connect: selectedNakas }, skills: { connect: selectedSkills } } 
            });
        }
        
        res.redirect('/admin/workers');
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            const skills = await prisma.skill.findMany({ where: { isActive: true } });
            // Let the user know exactly which unique field they duplicated!
            const target = error.meta.target;
            let errorMsg = "A worker with this ID Number already exists!";
            if (target.includes('phone')) errorMsg = "This Phone Number is already registered!";
            if (target.includes('email')) errorMsg = "This Email ID is already registered!";

            return res.render('admin/workers/form', { 
                worker: req.body, skills, isEdit: !!id, error: errorMsg 
            });
        }
        res.redirect('/admin/workers');
    }
};
// src/controllers/workerController.js

const loginWorker = async (req, res) => {
    // We expect 'loginId' from the app, which could be a phone OR email
    const { loginId, password } = req.body; 
    console.log("Login Attempt:", loginId,password); // Log the login ID for debugging
    
    try {
        // Find worker by matching either phone or email
        const worker = await prisma.worker.findFirst({ 
            where: { 
                OR: [
                    { phone: loginId },
                    { email: loginId }
                ]
            } 
        });
        console.log("worker found:", worker); // Log the worker object for debugging
        if (!worker) {
            return res.status(401).json({ success: false, message: "Invalid ID or password." });
        }

        const isMatch = await bcrypt.compare(password, worker.password);
        console.log("Password match:", isMatch); // Log the password match result for debugging
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid ID or password." });
        }

        console.log("Login successful for worker:", worker.id); // Log successful login

        res.json({ 
            success: true, 
            worker: { id: worker.id, name: worker.name, phone: worker.phone } 
        });

    } catch (error) {
        console.error("Login API Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const getWorkerProfile = async (req, res) => {
    try {
        const worker = await prisma.worker.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { nakas: true, skills: true }
        });

        if (!worker) {
            return res.status(404).json({ success: false, message: "Worker not found" });
        }

        res.json({ success: true, worker });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Don't forget to export it!


const deleteWorker = async (req, res) => {
    try {
        await prisma.worker.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/workers');
    } catch (error) {
        res.redirect('/admin/workers');
    }
};

const updateStatus = async (req, res) => {
    const { workerId, status } = req.body; // status: true or false
    try {
        await prisma.worker.update({
            where: { id: parseInt(workerId) },
            data: { isAvailable: status }
        });
        res.json({ success: true, message: status ? "Aap Live hain!" : "Aap Offline hain!" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Status update nahi ho paya" });
    }
};

const savePushToken = async (req, res) => {
    const { workerId, pushToken } = req.body;

    try {
        await prisma.worker.update({
            where: { id: parseInt(workerId) },
            data: { pushToken: pushToken }
        });
        
        console.log(`Worker ${workerId} ka Push Token save ho gaya!`);
        res.json({ success: true, message: "Token saved in Database!" });
    } catch (error) {
        console.error("Token save karne me error:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
};

module.exports = { listWorkers, showForm, saveWorker, deleteWorker, loginWorker, getWorkerProfile, updateStatus, savePushToken };