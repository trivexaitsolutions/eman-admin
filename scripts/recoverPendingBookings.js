#!/usr/bin/env node
'use strict';
// Optional safe one-time recovery: node scripts/recoverPendingBookings.js --ids=68,69
// Reads Razorpay payment status BEFORE making any changes; never force-unlocks paid/unknown orders.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { getRazorpayGateway } = require('../src/services/apiIntegrations');
const { paymentCheck, releaseUnpaidBooking, confirmCapturedBooking } = require('../src/utils/bookingReservation');
const prisma = new PrismaClient();

(async () => {
    const arg = process.argv.find((value) => value.startsWith('--ids='));
    if (!arg) throw new Error('Usage: node scripts/recoverPendingBookings.js --ids=68,69');
    const ids = [...new Set(arg.slice(6).split(',').map(Number))];
    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new Error('Please pass numeric booking IDs, e.g. --ids=68,69');
    }
    const gateway = await getRazorpayGateway();
    for (const id of ids) {
        const booking = await prisma.booking.findUnique({
            where: { id },
            select: { id: true, amount: true, status: true, razorpayOrderId: true, razorpayPaymentId: true },
        });
        if (!booking) { console.log(`#${id}: not found`); continue; }
        if (booking.status !== 'PENDING' || booking.razorpayPaymentId) {
            console.log(`#${id}: ${booking.status}; left unchanged`); continue;
        }
        const payment = await paymentCheck(gateway, booking.razorpayOrderId);
        if (payment.state === 'UNPAID') {
            const released = await releaseUnpaidBooking(prisma, id);
            console.log(`#${id}: no collected payment; cancelled=${released.released}, workers unlocked=${released.workerCount || 0}`);
        } else if (payment.state === 'CAPTURED') {
            const confirmed = await confirmCapturedBooking(prisma, booking, payment.payment);
            console.log(`#${id}: payment captured; confirmed=${confirmed.confirmed}. Notify the worker/customer of the confirmed booking.`);
        } else {
            console.log(`#${id}: gateway state ${payment.state}; left locked. Investigate in Razorpay dashboard.`);
        }
    }
})().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
