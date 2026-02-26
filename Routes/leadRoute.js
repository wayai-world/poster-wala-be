const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const { isLoggedIn } = require("../Middleware/isLoggedIn");
const skipCompanyMiddleware = require("../Middleware/skipCompanyMiddleware");
// const auth = require("../middleware/auth"); // apply as needed

router.post("/", skipCompanyMiddleware, leadController.createLead); // public
router.get("/", isLoggedIn, leadController.listLeads);
router.get("/:id", isLoggedIn, leadController.getLead);
router.patch("/:id", isLoggedIn, leadController.updateLead);

// convert lead to booking (protected)
router.post("/:id/convert", isLoggedIn, leadController.convertLeadToBooking);

module.exports = router;