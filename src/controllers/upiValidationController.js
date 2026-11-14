const axios = require('axios');
const { randomUUID } = require('node:crypto');

// RazorpayX (payout account validation) requires separately enabled access,
// credentials and a source account. Gateway checkout keys alone are not enough.
const validateWorkerUpi = async (req, res) => {
    const upiId = String(req.body?.upiId || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    if (!/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/.test(upiId) || upiId.length > 100) {
        return res.status(400).json({ success: false, verified: false, message: 'Please enter a valid UPI ID format.' });
    }
    if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ success: false, verified: false, message: 'Enter worker name and a valid mobile number before verifying UPI.' });
    }
    const key = process.env.RAZORPAYX_KEY_ID;
    const secret = process.env.RAZORPAYX_KEY_SECRET;
    const source = process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER;
    if (!key || !secret || !source) {
        return res.status(503).json({ success: false, verified: false, code: 'NOT_CONFIGURED', message: 'Live UPI verification is not enabled. Field Agent can save UPI ID for later verification.' });
    }
    try {
        const response = await axios.post('https://api.razorpay.com/v1/fund_accounts/validations', {
            source_account_number: source,
            validation_type: 'pennydrop',
            reference_id: randomUUID().slice(0, 36),
            fund_account: {
                account_type: 'vpa',
                vpa: { address: upiId },
                contact: { name, contact: phone, type: 'employee' },
            },
        }, { auth: { username: key, password: secret }, timeout: 15000 });
        const details = response.data?.validation_results || {};
        const verified = response.data?.status === 'completed' && details.account_status === 'active';
        return res.json({ success: true, verified, status: response.data?.status || 'unknown',
            registeredName: verified ? details.registered_name || null : null,
            message: verified ? 'UPI ID verified with RazorpayX.' : 'Verification pending or UPI ID not confirmed.' });
    } catch (error) {
        console.warn('RazorpayX VPA validation failed:', error.response?.status || error.message);
        return res.status(502).json({ success: false, verified: false, message: 'RazorpayX verification unavailable or account not enabled. Try again later.' });
    }
};

module.exports = { validateWorkerUpi };
