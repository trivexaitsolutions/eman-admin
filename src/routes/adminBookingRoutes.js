// src/routes/adminBookingRoutes.js
const express = require("express");
const router = express.Router();

const adminBookingController = require("../controllers/adminBookingController");

router.get("/", adminBookingController.listBookings);
router.get("/online-workers", adminBookingController.listOnlineWorkers);
router.get("/:id", adminBookingController.showBooking);

module.exports = router;
