// controllers/leadController.js
const Lead = require("../models/Lead");
const AdvertisingBoard = require("../models/AdvertisingBoard");
// const BookingController = require("./bookingController"); // used for conversion
// const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsyncWrapper");
const { createBookingFromLead } = require("./bookingController");
const { getOne, getAll } = require("../utils/crud");

/**
 * create a short lead (public form)
 */
exports.createLead = catchAsync(async (req, res, next) => {
    const { board, contact, campaign, source } = req.body;

    if (!board) return next(new appError("board id is required", 400));
    if (!contact || (!contact.name && !contact.phone && !contact.email)) {
        return next(new appError("contact name/phone/email required", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(board)) return next(new appError("Invalid board id", 400));
    const boardDoc = await AdvertisingBoard.findById(board);
    if (!boardDoc) return next(new appError("Advertising board not found", 404));

    const lead = await Lead.create({
        board,
        contact,
        campaign,
        source: source || "WEBSITE",
        createdBy: req.user?._id || null,
        ofCompany: req.user?.ofCompany || null
    });

    res.status(201).json({ status: true, data: lead });
});

/**
 * update lead (status, notes, assign, contact enrichment)
 */
exports.updateLead = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new appError("Invalid id", 400));

    const lead = await Lead.findById(id);
    if (!lead) return next(new appError("Lead not found", 404));

    // allow certain updates
    const allowed = ["status", "assignedTo", "notes", "contact", "campaign", "isActive"];
    for (const k of allowed) {
        if (typeof req.body[k] !== "undefined") {
            lead[k] = req.body[k];
        }
    }

    await lead.save();
    res.status(200).json({ status: true, data: lead });
});

/**
 * convert lead to booking (creates booking and updates board availability + lead.bookingRef + lead.status)
 * body must include either slotId OR startDate & endDate & totalAmount
 *
 * Example: POST /api/leads/:id/convert
 * body: { slotId: "...", totalAmount: 10000, currency: "INR", bookedBy: userId }
 */
exports.convertLeadToBooking = catchAsync(async (req, res, next) => {
    const { id: leadId } = req.params;
    const { slotId, startDate, endDate, totalAmount, currency = "INR" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(leadId)) return next(new appError("Invalid lead id", 400));
    const lead = await Lead.findById(leadId);
    if (!lead) return next(new appError("Lead not found", 404));

    // Delegate to booking controller which handles transaction & board update
    const bookingPayload = {
        boardId: lead.board,
        slotId,
        startDate,
        endDate,
        totalAmount,
        currency,
        bookedBy: req.user?._id || null,
        leadData: lead,
    };
    console.log("Converting lead to booking with payload:", bookingPayload);

    const booking = await createBookingFromLead(bookingPayload);
    console.log("Booking created from lead:", booking);



    // we need to delete lead now
    await Lead.findByIdAndDelete(leadId);

    res.status(201).json({ status: true, data: booking, msg: "Lead converted to booking" });
});

/**
 * get / list leads
 */
exports.getLead = getOne(Lead);

exports.listLeads = getAll(Lead);