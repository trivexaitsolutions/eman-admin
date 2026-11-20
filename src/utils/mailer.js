'use strict';
const nodemailer = require('nodemailer');
const { getSettings } = require('../services/apiIntegrations');

const sendOtpEmail = async (toEmail, otpCode, suppliedSettings) => {
    try {
        const config = suppliedSettings || await getSettings();
        if (!config.mailUser || !config.mailAppPassword || !toEmail) {
            console.error('[MAIL OTP] Sender credentials or recipient missing.');
            return false;
        }
        const transporter = nodemailer.createTransport({
            service: 'gmail', auth: { user: config.mailUser, pass: config.mailAppPassword }
        });
        await transporter.sendMail({
            from: `"E-MAN App" <${config.mailUser}>`,
            to: toEmail,
            subject: 'E-MAN Verification OTP',
            html: `<div style="font-family:Arial;padding:20px;text-align:center"><h2>E-MAN App</h2><p>Aapka OTP:</p><h1 style="letter-spacing:5px;color:#0052CC">${otpCode}</h1><p>10 minutes valid.</p></div>`
        });
        return true;
    } catch (error) {
        console.error('[MAIL OTP] Failed:', error?.message || error);
        return false;
    }
};
module.exports = { sendOtpEmail };
