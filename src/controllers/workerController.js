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


const getWorkerDashboard = async (req, res) => {
    try {
        const { workerId } = req.params;

        const worker = await prisma.worker.findUnique({
            where: { id: parseInt(workerId) },
            include: {
                bookings: {
                    where: { status: 'COMPLETED' }
                }
            }
        });

        if (!worker) {
            return res.status(404).json({ success: false, message: "Worker nahi mila" });
        }

        // Calculate Total Earnings from completed jobs (Basic logic for now)
        // Note: Asli system me hum isko weekly basis par filter karenge
        const totalEarned = worker.bookings.reduce((sum, job) => sum + (job.amount || 600), 0);

        // Dummy calculations for E-MAN Score & Level (Jab tak Rating engine poora nahi hota)
        const emanScore = 4.2; 
        const level = "Silver Imaandar";

        res.json({ 
            success: true, 
            data: {
                id: worker.id,
                name: worker.name,
                emanId: `EMN-MUM-00${worker.id}`,
                score: emanScore,
                level: level,
                weeklyEarning: totalEarned > 0 ? totalEarned : 2400 // Default for demo
            }
        });

    } catch (error) {
        console.error("Worker Dashboard Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


const showMitraAddForm = async (req, res) => {
    try {
        const skills = await prisma.skill.findMany({ where: { isActive: true } });
        const mitra = await prisma.mitra.findUnique({
            where: { id: req.user.id },
            include: { nakas: true }
        });

        res.render('mitra/add-worker', { 
            layout: false, 
            skills, 
            nakas: mitra.nakas || [], 
            error: req.query.error || null 
        });
    } catch (error) {
        res.redirect('/mitra/dashboard');
    }
};

const saveMitraWorker = async (req, res) => {
    try {
        // Saare naye fields ko destructure kiya
        const { 
            name, phone, email, password, 
            dob, age, qualification, 
            idProofType, idNumber, address, pincode, 
            bankDetails, upiId, upiNumber, 
            skillIds, nakaIds 
        } = req.body;

        // 1. Password Hash (Encrypt) karein
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Arrays handle karein (Kyunki multiple select boxes hain)
        // Agar ek select kiya hai toh string aayega, multiple me array. Isliye convert kar rahe hain.
        const connectSkills = Array.isArray(skillIds) ? skillIds.map(id => ({ id: parseInt(id) })) : (skillIds ? [{ id: parseInt(skillIds) }] : []);
        const connectNakas = Array.isArray(nakaIds) ? nakaIds.map(id => ({ id: parseInt(id) })) : (nakaIds ? [{ id: parseInt(nakaIds) }] : []);

        // 3. Date Object banayein
        const dobDate = new Date(dob);

        // 4. Video File Handle karein
        let videoUrl = null;
        if (req.file) {
            videoUrl = '/uploads/consents/' + req.file.filename;
        }

        // 5. Database Query
        await prisma.worker.create({
            data: {
                name,
                phone,
                email: email ? email.trim() : null,
                password: hashedPassword, // Hashed password
                dob: dobDate,
                age: parseInt(age),
                qualification: qualification || null,
                idProofType,
                idNumber,
                address,
                pincode,
                bankDetails: bankDetails || null,
                upiId: upiId || null,
                upiNumber: upiNumber || null,
                consentVoiceUrl: videoUrl, // Aapke schema me yehi field hai, main video link isi me save kar rahi hu
                skills: { connect: connectSkills }, // Multiple Skills Link
                nakas: { connect: connectNakas },   // Multiple Nakas Link
                mitraId: req.user.id,
                isActive: true
            }
        });

        res.redirect('/mitra/dashboard');
    } catch (error) {
        if (error.code === 'P2002') {
            // NAYA TARIQA: Global error message set karo
            req.flash('error_msg', 'Yeh Mobile Number ya Aadhaar pehle se system mein mojud hai!');
            return res.redirect('/mitra/workers/add');
        }
        
        req.flash('error_msg', 'Kuch galat ho gaya. Kripya dobara koshish karein.');
        res.redirect('/mitra/workers/add');
    }
};

module.exports = { getWorkerDashboard, listWorkers, showForm, saveWorker, deleteWorker, loginWorker, getWorkerProfile, updateStatus, savePushToken, showMitraAddForm, saveMitraWorker };