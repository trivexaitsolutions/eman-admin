'use strict';
// Low-cost single-process guard against paid SMS/WhatsApp OTP spam.
// For multi-instance production deployments replace with Redis/shared rate limiter.
const destinations = new Map();
const ips = new Map();
const HOUR = 3600_000;
function prune(map, now) {
    if (map.size < 2500) return;
    for (const [key, state] of map) {
        if (now - state.windowStart > HOUR * 2 && !state.pending) map.delete(key);
    }
}
function reserveOtp(target, ip, now = Date.now()) {
    target = String(target || '').toLowerCase().trim();
    ip = String(ip || 'unknown');
    if (!target) return { allowed: false, message: 'Phone ya Email required.' };
    prune(destinations, now); prune(ips, now);
    let state = destinations.get(target);
    if (!state || now - state.windowStart >= HOUR) state = { windowStart: now, count: 0, lastSent: 0, pending: false };
    let ipState = ips.get(ip);
    if (!ipState || now - ipState.windowStart >= HOUR) ipState = {windowStart: now, count: 0};
    if (state.pending || (state.lastSent && now - state.lastSent < 60_000)) {
        return { allowed: false, message: 'OTP abhi bheja gaya hai. 60 seconds baad retry karein.' };
    }
    if (state.count >= 5 || ipState.count >= 100) {
        return { allowed: false, message: 'OTP request limit reached. Thodi der baad retry karein.' };
    }
    state.pending = true;
    destinations.set(target, state);
    return {
        allowed: true,
        finish(delivered) {
            state.pending = false;
            if (delivered) {
                state.count += 1;
                state.lastSent = Date.now();
                ipState.count += 1;
                ips.set(ip, ipState);
            }
        }
    };
}
module.exports = { reserveOtp };
