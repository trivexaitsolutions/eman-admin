// src/controllers/userController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendOtpEmail } = require('../utils/mailer');

// 1. Send OTP (For both Login and Register)
// 1. Send OTP (For both Login and Register)
const sendOtp = async (req, res) => {
    const { email, phone, name } = req.body;

    if (!email && !phone) {
        return res.status(400).json({ success: false, message: "Email ya Phone number zaroori hai" });
    }

    try {
        // Database me check karo ki kya yeh user exist karta hai
        let customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { email: email || '' },
                    { phone: phone || '' }
                ]
            }
        });

        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        if (!customer) {
            // ----- NAYA LOGIC YAHAN HAI -----
            // Agar 'name' nahi aaya, matlab user Login screen se naya email daal raha hai
            if (!name) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Account nahi mila! Kripya niche 'Create Account' par click karke pehle register karein." 
                });
            }

            // Agar 'name' aaya hai, matlab sahi me naya registration hai
            if (!email || !phone) {
                return res.status(400).json({ success: false, message: "Naye account ke liye Name, Email, aur Phone sab zaruri hai!" });
            }
            
            // Naya customer banao
            customer = await prisma.customer.create({
                data: { name, phone, email, otp: generatedOtp, otpExpiry: expiryTime }
            });
        } else {
            // Agar account pehle se hai, par user galti se "Create Account" wale form se aaya hai
            if (name) {
                // YAHAN HUM CHECK KARENGE KYA DUPLICATE HAI
                if (customer.phone === phone && customer.email === email) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Yeh Phone Number aur Email dono pehle se registered hain! Kripya Login karein." 
                    });
                } else if (customer.phone === phone) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Yeh Phone Number kisi aur account se juda hai. Kripya dusra number use karein." 
                    });
                } else if (customer.email === email) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Yeh Email ID pehle se registered hai. Kripya dusri email daalein." 
                    });
                }
            }

            // Purane customer ka OTP update karo (Login process)
            customer = await prisma.customer.update({
                where: { id: customer.id },
                data: { otp: generatedOtp, otpExpiry: expiryTime }
            });
        }

        // Email par OTP bhejien
        const emailSent = await sendOtpEmail(customer.email, generatedOtp);

        if (emailSent) {
            res.json({ success: true, message: `OTP ${customer.email} par bhej diya gaya hai!`, customerId: customer.id });
        } else {
            res.status(500).json({ success: false, message: "Email bhejne me problem aayi." });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// 2. Verify OTP
const verifyOtp = async (req, res) => {
    const { customerId, otp } = req.body;

    try {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });

        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer nahi mila" });
        }

        // Check if OTP matches and is not expired
        if (customer.otp !== otp) {
            return res.status(400).json({ success: false, message: "Galat OTP!" });
        }

        if (new Date() > customer.otpExpiry) {
            return res.status(400).json({ success: false, message: "OTP expire ho chuka hai!" });
        }

        // OTP verify ho gaya, ab usko database se hata do security ke liye
        await prisma.customer.update({
            where: { id: customerId },
            data: { otp: null, otpExpiry: null }
        });

        res.json({ success: true, message: "Login Successful!", customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
const getBookingOptions = async (req, res) => {
    try {
        // 🛠️ YAHAN UPDATE KIYA HAI: include { rates: true } add kiya
        const skills = await prisma.skill.findMany({ 
            where: { isActive: true },
            include: { rates: true } 
        });
        
        const cities = await prisma.city.findMany(); 
        const nakas = await prisma.naka.findMany();  

        res.json({ 
            success: true, 
            skills, 
            cities, 
            nakas 
        });
    } catch (error) {
        console.error("Options fetch error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};



module.exports = { sendOtp, verifyOtp, getBookingOptions };