// E-MAN demo worker campaigns. Every action is admin-only and scoped to a
// claimed demo worker, NEVER to arbitrary worker IDs from the browser.
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { getActivePoolContext } = require('../utils/bookingSettings');
const { issueArrivalCodes } = require('../utils/arrivalCodes');
const workerController = require('./workerController');
const bookingController = require('./bookingController');

const MAX_PER_DEVICE = 20;
const MAX_PER_CAMPAIGN = 200;
const MAX_GLOBAL = Math.min(5000, Math.max(20, Number(process.env.SIMULATOR_GLOBAL_MAX || 200) || 200));
const VALID_MODES = new Set(['MANUAL', 'AUTOMATIC']);
const VALID_DURATIONS = new Set(['FULL_DAY', '2', '3', '4']);

function enabled() {
    return process.env.SIMULATOR_ENABLED === 'true' &&
        String(process.env.JWT_SECRET || '').length >= 24 &&
        (process.env.NODE_ENV !== 'production' || process.env.SIMULATOR_ALLOW_PRODUCTION === 'true');
}
function ensureEnabled(req, res, next) {
    if (!enabled()) return res.status(403).send('Simulator disabled. Enable SIMULATOR_ENABLED in a staging environment.');
    next();
}
function numberId(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function deviceId(value) {
    const v = String(value || '');
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(v)) {
        const e = new Error('Invalid browser/device ID. Refresh the simulator screen.'); e.httpStatus = 400; throw e;
    }
    return v;
}
function ids(raw) {
    try { const list = JSON.parse(raw || '[]'); return Array.isArray(list) ? list.map(Number) : []; }
    catch { return []; }
}
function fail(res, err) {
    console.error('Simulator:', err);
    return res.status(err.httpStatus || 500).json({ success: false, message: err.httpStatus ? err.message : 'Simulator request failed' });
}
async function getCampaign(id) {
    const campaign = await prisma.simulatorCampaign.findUnique({ where: { id: numberId(id) || -1 } });
    if (!campaign) { const e = new Error('Campaign not found'); e.httpStatus = 404; throw e; }
    return campaign;
}
function requireRunning(campaign) {
    if (campaign.status !== 'RUNNING') { const e = new Error('Campaign is not running'); e.httpStatus = 409; throw e; }
}
async function getInstance(campaignId, workerId, id) {
    const instance = await prisma.simulatorInstance.findFirst({
        where: { campaignId: numberId(campaignId) || -1, workerId: numberId(workerId) || -1, deviceId: deviceId(id) },
    });
    if (!instance) { const e = new Error('This worker is not claimed by this PC.'); e.httpStatus = 403; throw e; }
    return instance;
}
async function list(req, res) {
    const campaigns = await prisma.simulatorCampaign.findMany({ orderBy: { id: 'desc' },
        include: { _count: { select: { instances: true } } } });
    const demoWorkers = await prisma.worker.count({ where: { isDemo: true, isActive: true } });
    res.render('admin/simulator/index', { campaigns, demoWorkers, maxPerDevice: MAX_PER_DEVICE, maxPerCampaign: MAX_PER_CAMPAIGN });
}
async function create(req, res) {
    try {
        const name = String(req.body.name || '').trim().slice(0, 80);
        const mode = String(req.body.mode || 'MANUAL').toUpperCase();
        const maxWorkers = Number(req.body.maxWorkers || 200);
        const pollSeconds = Number(req.body.pollSeconds || 20);
        if (!name || !VALID_MODES.has(mode) || !Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > MAX_PER_CAMPAIGN ||
            !Number.isInteger(pollSeconds) || pollSeconds < 10 || pollSeconds > 120) {
            req.flash('error_msg', 'Invalid name, mode, workers limit or polling interval.');
            return res.redirect('/admin/simulator');
        }
        const campaign = await prisma.simulatorCampaign.create({ data: {
            name, mode, maxWorkers, pollSeconds,
            createdById: numberId(req.user?.id), status: 'RUNNING',
        } });
        return res.redirect(`/admin/simulator/${campaign.id}`);
    } catch (e) { console.error(e); req.flash('error_msg', 'Campaign create failed'); return res.redirect('/admin/simulator'); }
}
async function update(req, res) {
    try {
        const campaign = await getCampaign(req.params.id);
        const action = String(req.body.action || '');
        if (!['RUNNING', 'PAUSED', 'STOPPED'].includes(action)) return res.status(400).send('Invalid status');
        if (campaign.status === 'STOPPED' && action !== 'STOPPED') return res.status(409).send('Stopped campaign cannot be restarted; create a new one');
        await prisma.simulatorCampaign.update({ where: { id: campaign.id }, data: { status: action } });
        // Stopping only stops simulation. Do NOT cancel real bookings or change workers' duty state.
        return res.redirect(`/admin/simulator/${campaign.id}`);
    } catch (e) { return res.status(e.httpStatus || 500).send(e.message); }
}
async function show(req, res) {
    try {
        const campaign = await getCampaign(req.params.id);
        const allocated = await prisma.simulatorInstance.count({ where: { campaignId: campaign.id } });
        res.render('admin/simulator/show', { campaign, allocated, maxPerDevice: MAX_PER_DEVICE });
    } catch (e) { return res.status(e.httpStatus || 500).send(e.message); }
}

async function claim(req, res) {
    try {
        const campaign = await getCampaign(req.params.id); requireRunning(campaign);
        const device = deviceId(req.body.deviceId);
        const requested = Number(req.body.count);
        if (!Number.isInteger(requested) || requested < 1 || requested > MAX_PER_DEVICE) {
            return res.status(400).json({ success: false, message: 'Choose 1 to 20 worker instances for this PC.' });
        }
        // Serializable avoids double-claiming when 10 PCs join at the same time.
        let result;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                result = await prisma.$transaction(async (tx) => {
                    const current = await tx.simulatorInstance.findMany({
                        where: { campaignId: campaign.id, deviceId: device }, orderBy: { slotIndex: 'asc' },
                    });
                    const all = await tx.simulatorInstance.findMany({
                        where: { campaign: { status: { in: ['RUNNING', 'PAUSED'] } } },
                        select: { workerId: true },
                    });
                    const occupied = new Set(all.map((row) => row.workerId));
                    const allocationCount = await tx.simulatorInstance.count({ where: { campaignId: campaign.id } });
                    const availableSlots = Math.min(requested - current.length,
                        campaign.maxWorkers - allocationCount, MAX_GLOBAL - all.length);
                    if (availableSlots < 0) {
                        const excess = current.slice(requested);
                        if (excess.length) await tx.simulatorInstance.deleteMany({ where: { id: { in: excess.map((v) => v.id) } } });
                    } else if (availableSlots > 0) {
                        const freeWorkers = await tx.worker.findMany({
                            where: { isDemo: true, isActive: true, id: { notIn: Array.from(occupied) } },
                            select: { id: true }, orderBy: { id: 'asc' }, take: availableSlots,
                        });
                        const usedSlots = new Set(current.map((v) => v.slotIndex));
                        for (const w of freeWorkers) {
                            let slot = 1;
                            while (usedSlots.has(slot)) slot++;
                            usedSlots.add(slot);
                            await tx.simulatorInstance.create({ data: {
                                campaignId: campaign.id, deviceId: device, workerId: w.id, slotIndex: slot,
                            } });
                        }
                    }
                    return tx.simulatorInstance.findMany({ where: { campaignId: campaign.id, deviceId: device },
                        orderBy: { slotIndex: 'asc' } });
                }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
                break;
            } catch (e) { if (e.code === 'P2034' && attempt < 3) continue; throw e; }
        }
        const workers = await prisma.worker.findMany({ where: { id: { in: result.map((v) => v.workerId) } },
            select: { id: true, name: true, phone: true, isDemo: true } });
        const byId = new Map(workers.map((w) => [w.id, w]));
        return res.json({ success: true, instances: result.map((inst) => ({ ...inst, worker: byId.get(inst.workerId) })) });
    } catch (e) { return fail(res, e); }
}
async function clearClaims(req, res) {
    try {
        const campaign = await getCampaign(req.params.id);
        // Release simulator identities only. Don't cancel bookings or reset pool membership.
        await prisma.simulatorInstance.deleteMany({ where: { campaignId: campaign.id } });
        req.flash('success_msg', 'All PC claims released; existing bookings untouched.');
        return res.redirect(`/admin/simulator/${campaign.id}`);
    } catch (e) { return res.status(e.httpStatus || 500).send(e.message); }
}
async function claims(req, res) {
    try {
        const campaign = await getCampaign(req.params.id);
        const device = deviceId(req.query.deviceId);
        const rows = await prisma.simulatorInstance.findMany({
            where: { campaignId: campaign.id, deviceId: device }, orderBy: { slotIndex: 'asc' },
        });
        const workers = await prisma.worker.findMany({
            where: { id: { in: rows.map((v) => v.workerId) } },
            select: { id: true, name: true, phone: true },
        });
        const byId = new Map(workers.map((v) => [v.id, v]));
        return res.json({ success: true, instances: rows.map((v) => ({ ...v, worker: byId.get(v.workerId) })) });
    } catch (e) { return fail(res, e); }
}
// Fast, scoped status refresh: one request for all claimed workers on this PC.
// Keeps assigned workers at the top without making 20 individual polling calls.
async function priorities(req, res) {
    try {
        const campaign = await getCampaign(req.params.id);
        if (campaign.status === 'STOPPED') return res.status(409).json({ success: false, message: 'Campaign stopped' });
        const device = deviceId(req.query.deviceId);
        const claims = await prisma.simulatorInstance.findMany({
            where: { campaignId: campaign.id, deviceId: device }, select: { workerId: true },
        });
        const workerIds = claims.map((row) => row.workerId);
        if (!workerIds.length) return res.json({ success: true, statuses: [] });
        const [workers, bookings] = await Promise.all([
            prisma.worker.findMany({
                where: { id: { in: workerIds }, isDemo: true },
                select: { id: true, isAvailable: true, availabilityUntil: true },
            }),
            prisma.booking.findMany({
                where: {
                    status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
                    workers: { some: { id: { in: workerIds } } },
                },
                select: {
                    completedWorkerIds: true, cancelledWorkerIds: true,
                    workers: { where: { id: { in: workerIds } }, select: { id: true } },
                },
            }),
        ]);
        const inBooking = new Set();
        for (const booking of bookings) {
            const completed = ids(booking.completedWorkerIds);
            const cancelled = ids(booking.cancelledWorkerIds);
            for (const worker of booking.workers) {
                if (!completed.includes(worker.id) && !cancelled.includes(worker.id)) inBooking.add(worker.id);
            }
        }
        const now = Date.now();
        return res.json({ success: true, statuses: workers.map((worker) => ({
            workerId: worker.id,
            operationalStatus: inBooking.has(worker.id) ? 'In Booking' :
                (worker.isAvailable && worker.availabilityUntil &&
                new Date(worker.availabilityUntil).getTime() > now ? 'Online' : 'Offline'),
        })) });
    } catch (e) { return fail(res, e); }
}

async function release(req, res) {
    try {
        await getCampaign(req.params.id);
        const device = deviceId(req.body.deviceId);
        await prisma.simulatorInstance.deleteMany({ where: { campaignId: numberId(req.params.id), deviceId: device } });
        // Release PC claims, not worker pool membership or assigned booking.
        return res.json({ success: true });
    } catch (e) { return fail(res, e); }
}
async function state(req, res) {
    try {
        const campaign = await getCampaign(req.params.id);
        const device = deviceId(req.query.deviceId);
        await getInstance(campaign.id, req.params.workerId, device);
        if (campaign.status === 'STOPPED') return res.status(409).json({ success: false, message: 'Campaign stopped' });
        const workerId = numberId(req.params.workerId);
        const worker = await prisma.worker.findUnique({ where: { id: workerId },
            select: { id: true, name: true, phone: true, isDemo: true, isActive: true, isAvailable: true,
                availabilityType: true, availabilityHours: true, availabilityStart: true, availabilityUntil: true,
                mitra: { select: { name: true, phone: true } },
                skills: { select: { name: true } }, nakas: { select: { name: true } } } });
        if (!worker || !worker.isDemo) return res.status(403).json({ success: false, message: 'Only demo workers allowed' });
        const recent = await prisma.booking.findMany({ where: { workers: { some: { id: workerId } },
            status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] } },
            select: { id: true, status: true, customer: { select: { name: true } }, createdAt: true,
                arrivedWorkerIds: true, cancelledWorkerIds: true, completedWorkerIds: true,
                workerWorkDurations: true, workerArrivalTimes: true,
                workers: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: 8 });
        const current = recent.find((b) => ['ASSIGNED', 'IN_PROGRESS'].includes(b.status) &&
            !ids(b.cancelledWorkerIds).includes(workerId) && !ids(b.completedWorkerIds).includes(workerId));
        const completed = recent.find((b) => ids(b.completedWorkerIds).includes(workerId) ||
            (b.status === 'COMPLETED' && !ids(b.cancelledWorkerIds).includes(workerId)));
        const booking = current || completed || null;
        const rating = completed ? await prisma.workerClientRating.findUnique({
            where: { bookingId_workerId: { bookingId: completed.id, workerId } }, select: { id: true },
        }) : null;
        let arrivalCode = null, expiresAt = null;
        if (current && !ids(current.arrivedWorkerIds).includes(workerId)) {
            const result = issueArrivalCodes(current.id, current.workers);
            arrivalCode = result.codes.get(workerId) || null;
            expiresAt = result.expiresAt;
        }
        let startedAt = null, committedHours = null;
        if (current) {
            try {
                const times = JSON.parse(current.workerArrivalTimes || '{}');
                startedAt = times[String(workerId)] || null;
            } catch { /* legacy bookings may not contain a work start time */ }
            try {
                const durations = JSON.parse(current.workerWorkDurations || '{}');
                const duration = durations[String(workerId)];
                if (duration?.type === 'SHORT_PERIOD') committedHours = Number(duration.hours);
            } catch { /* legacy snapshot */ }
            if (!committedHours && worker.availabilityType === 'SHORT_PERIOD') committedHours = Number(worker.availabilityHours);
        }
        const operationalStatus = current ? 'In Booking' :
            (worker.isAvailable && worker.availabilityUntil && new Date(worker.availabilityUntil) > new Date() ? 'Online' : 'Offline');
        return res.json({ success: true, worker: { ...worker, operationalStatus },
            booking: booking && {
                id: booking.id, customerName: booking.customer.name, status: booking.status,
                isComplete: !current, workerArrived: ids(booking.arrivedWorkerIds).includes(workerId),
                workStartedAt: startedAt, committedHours,
                completedAt: completed ? completed.createdAt : null,
                canRate: !!(completed && !rating), rated: !!rating,
                arrivalCode, arrivalCodeExpiresAt: expiresAt,
            }, campaign: { status: campaign.status, mode: campaign.mode }, serverTime: new Date().toISOString() });
    } catch (e) { return fail(res, e); }
}
// Scoped booking query; never load all active bookings for every one of 200 workers.
async function hasActiveWork(workerId) {
    const bookings = await prisma.booking.findMany({
        where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, workers: { some: { id: workerId } } },
        select: { cancelledWorkerIds: true, completedWorkerIds: true },
    });
    return bookings.some((b) => !ids(b.cancelledWorkerIds).includes(workerId) &&
        !ids(b.completedWorkerIds).includes(workerId));
}
async function callExisting(handler, body, res) {
    // Forward to the exact working API controller, preserving its validations,
    // pool pricing and booking state transitions.
    return handler({ body }, res);
}
async function action(req, res) {
    try {
        const campaign = await getCampaign(req.params.id); requireRunning(campaign);
        const device = deviceId(req.body.deviceId);
        const inst = await getInstance(campaign.id, req.params.workerId, device);
        const worker = await prisma.worker.findUnique({ where: { id: inst.workerId }, select: { isDemo: true } });
        if (!worker?.isDemo) return res.status(403).json({ success: false, message: 'Not a demo worker' });
        const operation = String(req.body.operation || '');
        if (operation === 'JOIN') {
            const duration = String(req.body.duration || 'FULL_DAY');
            if (!VALID_DURATIONS.has(duration)) return res.status(400).json({ success: false, message: 'Choose Full Day, 2, 3 or 4 Hours.' });
            if (await hasActiveWork(inst.workerId)) return res.status(409).json({ success: false, message: 'Worker already on duty' });
            return callExisting(workerController.updateStatus, { workerId: inst.workerId, status: true,
                availabilityType: duration === 'FULL_DAY' ? 'FULL_DAY' : 'SHORT_PERIOD',
                availabilityHours: duration === 'FULL_DAY' ? null : Number(duration) }, res);
        }
        if (operation === 'OFFLINE') {
            if (await hasActiveWork(inst.workerId)) return res.status(409).json({ success: false, message: 'Assigned worker ko offline nahi kar sakte.' });
            return callExisting(workerController.updateStatus, { workerId: inst.workerId, status: false }, res);
        }
        if (operation === 'RATE') {
            const rating = Number(req.body.rating);
            const bookingId = numberId(req.body.bookingId);
            if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Invalid rating/booking' });
            return callExisting(bookingController.submitClientRatingByWorker, {
                bookingId, workerId: inst.workerId, rating }, res);
        }
        return res.status(400).json({ success: false, message: 'Unknown operation' });
    } catch (e) { return fail(res, e); }
}
// Staging automatic worker behavior: join the same admin pool, keep checking,
// automatically rate customers after completion. Customer arrival confirmation,
// payments and cancellation NEVER run automatically.
async function autoTick(req, res) {
    try {
        const campaign = await getCampaign(req.params.id); requireRunning(campaign);
        if (campaign.mode !== 'AUTOMATIC') return res.status(409).json({ success: false, message: 'Manual campaign' });
        const device = deviceId(req.body.deviceId);
        const inst = await getInstance(campaign.id, req.params.workerId, device);
        const worker = await prisma.worker.findUnique({ where: { id: inst.workerId },
            select: { isDemo: true, isAvailable: true, availabilityUntil: true, availabilityType: true,
                availabilityHours: true } });
        if (!worker?.isDemo) return res.status(403).json({ success: false, message: 'Not demo' });
        const assigned = await hasActiveWork(inst.workerId);
        // A worker already on duty should never be moved into a new pool.
        if (!assigned && (!worker.isAvailable || !worker.availabilityUntil || new Date(worker.availabilityUntil) < new Date())) {
            const pool = await getActivePoolContext(prisma);
            if (pool.isOpen) {
                const durations = ['FULL_DAY', '2', '3', '4'];
                const value = durations[inst.workerId % durations.length];
                return callExisting(workerController.updateStatus, { workerId: inst.workerId, status: true,
                    availabilityType: value === 'FULL_DAY' ? 'FULL_DAY' : 'SHORT_PERIOD',
                    availabilityHours: value === 'FULL_DAY' ? null : Number(value) }, res);
            }
        }
        const completed = await prisma.booking.findFirst({
            where: { workers: { some: { id: inst.workerId } }, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' }, select: { id: true, completedWorkerIds: true },
        });
        if (completed && ids(completed.completedWorkerIds).includes(inst.workerId)) {
            const rated = await prisma.workerClientRating.findUnique({
                where: { bookingId_workerId: { bookingId: completed.id, workerId: inst.workerId } }, select: { id: true },
            });
            if (!rated) return callExisting(bookingController.submitClientRatingByWorker, {
                bookingId: completed.id, workerId: inst.workerId, rating: 5 }, res);
        }
        return res.json({ success: true, message: assigned ? 'On duty' : 'Heartbeat', assigned });
    } catch (e) { return fail(res, e); }
}
module.exports = { ensureEnabled, list, show, create, update, claim, claims, priorities, clearClaims, release, state, action, autoTick,
    MAX_PER_DEVICE, MAX_PER_CAMPAIGN, MAX_GLOBAL };
