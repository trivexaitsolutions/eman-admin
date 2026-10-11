const crypto = require("crypto");

// Ten-minute rotating manual-arrival codes. A 30-second grace period lets a
// customer finish typing a code captured just before rotation.
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const CODE_GRACE_MS = 30 * 1000;
// Never ship a known fallback secret. Supply ARRIVAL_CODE_SECRET (or JWT_SECRET)
// consistently across production server instances.
const secret = process.env.ARRIVAL_CODE_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

const getBucket = (time) => Math.floor(Number(time) / CODE_LIFETIME_MS);

function createArrivalCodes(bookingId, workers, bucket) {
    const codes = new Map();
    const used = new Set();
    const ids = [...new Set(workers.map((worker) => Number(worker?.id))
        .filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);

    for (const workerId of ids) {
        let nonce = 0;
        let code;
        do {
            const hash = crypto.createHmac("sha256", secret)
                .update(`${Number(bookingId)}:${workerId}:${bucket}:${nonce++}`)
                .digest("hex");
            code = String((parseInt(hash.slice(0, 12), 16) % 900000) + 100000);
        } while (used.has(code));
        used.add(code);
        codes.set(workerId, code);
    }
    return codes;
}

function issueArrivalCodes(bookingId, workers, now = Date.now()) {
    const bucket = getBucket(now);
    return {
        codes: createArrivalCodes(bookingId, workers, bucket),
        expiresAt: new Date((bucket + 1) * CODE_LIFETIME_MS).toISOString(),
    };
}

function verifyArrivalCode(bookingId, workers, code, now = Date.now()) {
    if (!/^\d{6}$/.test(String(code))) return { status: "INVALID" };
    const bucket = getBucket(now);
    const current = createArrivalCodes(bookingId, workers, bucket);
    for (const [workerId, candidate] of current) {
        if (candidate === code) return { status: "VALID", workerId };
    }
    const previous = createArrivalCodes(bookingId, workers, bucket - 1);
    for (const [workerId, candidate] of previous) {
        if (candidate !== code) continue;
        if (Number(now) - bucket * CODE_LIFETIME_MS <= CODE_GRACE_MS) {
            return { status: "VALID", workerId };
        }
        return { status: "EXPIRED" };
    }
    return { status: "INVALID" };
}

module.exports = { CODE_LIFETIME_MS, CODE_GRACE_MS, issueArrivalCodes, verifyArrivalCode };
