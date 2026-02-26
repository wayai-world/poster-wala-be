// routes/bookings.js
const express = require("express");
const router = express.Router();
const bookingController = require("../Controllers/bookingController");
const { isLoggedIn } = require("../Middleware/isLoggedIn");
// const auth = require("../middleware/auth");

// Create booking (admin)
router.post("/", isLoggedIn, bookingController.createBooking);

// Convert lead to booking (admin) - uses Lead model (assumed present)
router.post("/convert/:id", isLoggedIn, bookingController.convertLeadToBooking);
// Note: earlier you showed example as POST /api/leads/:id/convert — if you prefer that route keep it and call bookingController.convertLeadToBooking

// Pay booking (partial/full)
router.post("/:id/pay", isLoggedIn, bookingController.payBooking);

// Refund a payment
router.post("/:id/refund", isLoggedIn, bookingController.refundPayment);

// Cancel booking
router.post("/:id/cancel", isLoggedIn, bookingController.cancelBooking);

// Get booking
router.get("/:id", isLoggedIn, bookingController.getBooking);

// List bookings
router.get("/", isLoggedIn, bookingController.listBookings);

module.exports = router;