const { randomUUID } = require('node:crypto');
const { getSettings } = require('../services/apiIntegrations');

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
    let config;
    try { config = await getSettings(); }
    catch (error) { console.error('RazorpayX settings unavailable:', error.message); return res.status(503).json({ success:false, verified:false, message:'API settings unavailable.' }); }
    const key = config.razorpayxKeyId;
    const secret = config.razorpayxKeySecret;
    const source = config.razorpayxSourceAccountNumber;
    if (!key || !secret || !source) {
        return res.status(503).json({ success: false, verified: false, code: 'NOT_CONFIGURED', message: 'Live UPI verification is not enabled. Field Agent can save UPI ID for later verification.' });
    }
    try {
        const response = await fetch('https://api.razorpay.com/v1/fund_accounts/validations', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_account_number: source,
                validation_type: 'pennydrop',
                reference_id: randomUUID().slice(0, 36),
                fund_account: {
                    account_type: 'vpa',
                    vpa: { address: upiId },
                    contact: { name, contact: phone, type: 'employee' },
                },
            }),
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`RazorpayX HTTP ${response.status}`);
        const responseData = await response.json();
        const details = responseData?.validation_results || {};
        const verified = responseData?.status === 'completed' && details.account_status === 'active';
        return res.json({ success: true, verified, status: responseData?.status || 'unknown',
            registeredName: verified ? details.registered_name || null : null,
            message: verified ? 'UPI ID verified with RazorpayX.' : 'Verification pending or UPI ID not confirmed.' });
    } catch (error) {
        console.warn('RazorpayX VPA validation failed:', error.message);
        return res.status(502).json({ success: false, verified: false, message: 'RazorpayX verification unavailable or account not enabled. Try again later.' });
    }
};

module.exports = { validateWorkerUpi };
