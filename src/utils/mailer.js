// src/utils/mailer.js
const nodemailer = require('nodemailer');

// Aapko apne Gmail account se ek "App Password" generate karna hoga aur yahan dalna hoga
// Filhal testing ke liye aap apni email aur password daal sakte hain
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gandheresarvesh@gmail.com', // Apna testing email yahan daalein
        pass: 'mcog ewuk affz hxtn' // Apna App Password yahan daalein
    }
});

const sendOtpEmail = async (toEmail, otpCode) => {
    try {
        const mailOptions = {
            from: '"E-MAN App" <gandheresarvesh@gmail.com>',
            to: toEmail,
            subject: 'E-MAN Login OTP',
            html: `
                <div style="font-family: Arial; padding: 20px; text-align: center;">
                    <h2>E-MAN App me aapka swagat hai!</h2>
                    <p>Aapka Login/Register OTP niche diya gaya hai:</p>
                    <h1 style="color: #0052CC; letter-spacing: 5px;">${otpCode}</h1>
                    <p>Yeh OTP 10 minute ke liye valid hai.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Email bhejne me error:", error);
        return false;
    }
};

module.exports = { sendOtpEmail };