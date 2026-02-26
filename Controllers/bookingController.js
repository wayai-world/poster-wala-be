// controllers/bookingController.js
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const AdvertisingBoard = require("../models/AdvertisingBoard");
const Lead = require("../models/Lead"); // you said you'll remove lead controller/schema, but convert uses existing Lead model
// const catchAsync = require("../utils/catchAsync"    );
const appError = require("../utils/appError");
const catchAsync = require("../utils/catchAsyncWrapper");

/**
 * Helper: convert to Date
 */
function toDate(d) {
    if (!d) return null;
    return (d instanceof Date) ? new Date(d) : new Date(d);
}

/**
 * Internal: create booking transactionally (used by createBooking and convertLeadToBooking)
 * payload: { boardId, leadId, startDate, endDate, totalAmount, currency, bookedBy, tenantId, idempotencyKey, initialPayment (optional) }
 *
 * initialPayment: { amount, currency, method, transactionId, methodDetails, status }
 */
async function createBookingTransaction(payload) {
    const {
        boardId, leadId = null, startDate, endDate, totalAmount = 0, currency = "INR",
        bookedBy = null, tenantId = null, idempotencyKey = null, initialPayment = null
    } = payload;

    const sd = toDate(startDate), ed = toDate(endDate);
    if (!sd || !ed || sd >= ed) throw new appError("Invalid startDate/endDate", 400);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // idempotency: return existing booking if key found (inside tx)
        if (idempotencyKey) {
            const existing = await Booking.findOne({ idempotencyKey }).session(session);
            if (existing) {
                await session.commitTransaction();
                session.endSession();
                return existing;
            }
        }

        // overlap check inside transaction
        const conflict = await Booking.findOne({
            board: boardId,
            status: { $in: ["CONFIRMED", "PENDING"] },
            startDate: { $lt: ed },
            endDate: { $gt: sd }
        }).session(session);

        if (conflict) throw new appError("Requested range overlaps with existing booking", 409);

        // create booking
        const [booking] = await Booking.create([{
            tenantId: tenantId || null,
            board: boardId,
            lead: leadId || null,
            startDate: sd,
            endDate: ed,
            totalAmount,
            currency,
            status: "CONFIRMED",
            createdBy: bookedBy || null,
            idempotencyKey: idempotencyKey || null
        }], { session });

        // apply initial payment if provided
        if (initialPayment && initialPayment.amount > 0) {
            const payment = {
                amount: Number(initialPayment.amount),
                currency: initialPayment.currency || currency || "INR",
                method: initialPayment.method || "OTHER",
                methodDetails: initialPayment.methodDetails || {},
                transactionId: initialPayment.transactionId || undefined,
                status: initialPayment.status || "COMPLETED",
                createdAt: new Date(),
                note: initialPayment.note || ""
            };
            booking.payments.push(payment);
            booking.recalculatePayments();
            await booking.save({ session });
        } else {
            // recalc to set paymentStatus properly
            booking.recalculatePayments();
            await booking.save({ session });
        }

        // update board occupancy quick fields: set occupied.till to latest confirmed endDate
        const latest = await Booking.findOne({
            board: boardId,
            status: { $in: ["CONFIRMED", "PENDING"] }
        }).sort({ endDate: -1 }).session(session);

        const till = latest ? latest.endDate : booking.endDate;
        const board = await AdvertisingBoard.findById(boardId).session(session);
        if (!board) throw new appError("Board not found", 404);

        board.occupied = board.occupied || {};
        board.occupied.isOccupied = !!till && (new Date(till) > new Date());
        board.occupied.till = till || null;
        board.bookings = board.bookings || [];
        board.bookings.push(booking._id);
        await board.save({ session });

        // update lead if present (mark closed)
        if (leadId) {
            await Lead.findByIdAndUpdate(leadId, {
                status: "DEAL_CLOSED",
                bookingRef: booking._id,
                convertedToBooking: true,
                conversionDetails: {
                    bookingId: booking._id,
                    bookedAt: new Date(),
                    totalAmount,
                    currency
                }
            }, { session });
        }

        await session.commitTransaction();
        session.endSession();

        return await Booking.findById(booking._id).populate("board").populate("lead").exec();
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}

/**
 * POST /api/bookings
 * create a booking (admin)
 * body: { boardId, leadId?, startDate, endDate, totalAmount, currency, idempotencyKey, initialPayment }
 */
exports.createBooking = catchAsync(async (req, res, next) => {
    const { boardId, leadId, startDate, endDate, totalAmount, currency, idempotencyKey, initialPayment } = req.body;
    const bookedBy = req.user?._id || null;
    const payload = {
        boardId,
        leadId: leadId || null,
        startDate,
        endDate,
        totalAmount: Number(totalAmount) || 0,
        currency: currency || "INR",
        bookedBy,
        idempotencyKey: idempotencyKey || null,
        initialPayment: initialPayment || null
    };

    try {
        const booking = await createBookingTransaction(payload);
        res.status(201).json({ status: true, data: booking });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/leads/:id/convert
 * convert lead to booking (accepts same body as createBooking but boardId is derived from lead)
 * body may include initialPayment for partial/full payment
 */
exports.convertLeadToBooking = catchAsync(async (req, res, next) => {
    const { id: leadId } = req.params;
    const { startDate, endDate, totalAmount, currency = "INR", idempotencyKey, initialPayment } = req.body;
    const bookedBy = req.user?._id || null;

    if (!mongoose.Types.ObjectId.isValid(leadId)) return next(new appError("Invalid lead id", 400));
    const lead = await Lead.findById(leadId);
    if (!lead) return next(new appError("Lead not found", 404));
    if (!lead.board) return next(new appError("Lead does not reference a board", 400));

    const payload = {
        boardId: lead.board,
        leadId: lead._id,
        startDate,
        endDate,
        totalAmount: Number(totalAmount) || 0,
        currency: currency || "INR",
        bookedBy: bookedBy || null,
        idempotencyKey: idempotencyKey || null,
        initialPayment: initialPayment || null
    };

    try {
        // keep console logs if you need debugging
        // console.log("Converting lead to booking with payload:", payload);
        const booking = await createBookingTransaction(payload);

        // update lead was handled inside createBookingTransaction, but ensure always saved
        // (createBookingTransaction attempts a lead update in the same transaction)
        res.status(201).json({ status: true, data: booking, msg: "Lead converted to booking" });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/bookings/:id/pay
 * Accepts payment for an existing booking (partial or full)
 * body: { amount, currency, method, transactionId, methodDetails, status }
 */
exports.payBooking = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { amount, currency = "INR", method = "OTHER", transactionId, methodDetails = {}, status = "COMPLETED", note = "" } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new appError("Invalid booking id", 400));
    if (!amount || Number(amount) <= 0) return next(new appError("amount is required and must be > 0", 400));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(id).session(session);
        if (!booking) throw new appError("Booking not found", 404);
        if (booking.status === "CANCELLED") throw new appError("Cannot pay a cancelled booking", 400);

        const payment = {
            amount: Number(amount),
            currency,
            method,
            methodDetails,
            transactionId,
            status,
            createdAt: new Date(),
            note
        };

        booking.payments.push(payment);
        booking.recalculatePayments();

        // don't allow over-payment beyond totalAmount (you may allow but warn)
        if (booking.paidAmount > booking.totalAmount) {
            // Option: allow but mark note. We'll prevent by rejecting
            throw new appError("Payment would exceed total booking amount", 400);
        }

        // if paid in full, update paymentStatus
        if (booking.paidAmount >= booking.totalAmount) {
            booking.paymentStatus = "PAID";
        } else if (booking.paidAmount > 0) {
            booking.paymentStatus = "PARTIALLY_PAID";
        } else {
            booking.paymentStatus = "PENDING";
        }

        await booking.save({ session });

        // if you want to update board occupancy after payment (not usually necessary), do it here

        await session.commitTransaction();
        session.endSession();

        res.json({ status: true, data: booking, msg: "Payment recorded" });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
});

/**
 * POST /api/bookings/:id/refund
 * (simple refund handler - marks payment as refunded and updates booking.paidAmount/paymentStatus)
 * body: { paymentId, amount (optional) }
 */
exports.refundPayment = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { paymentId, amount } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new appError("Invalid booking id", 400));
    if (!paymentId) return next(new appError("paymentId required", 400));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(id).session(session);
        if (!booking) throw new appError("Booking not found", 404);

        const p = booking.payments.id(paymentId) || booking.payments.find(x => String(x._id) === String(paymentId));
        if (!p) throw new appError("Payment not found", 404);
        if (p.status === "REFUNDED") throw new appError("Payment already refunded", 400);

        // Mark refunded (you may process external refund with payment gateway)
        p.status = "REFUNDED";

        // optionally adjust amount if partial refund: create new negative payment? Simpler: reduce paid amount by refunded amount
        // if amount provided: subtract amount; else subtract full p.amount
        const refundAmount = (amount && Number(amount) > 0) ? Number(amount) : Number(p.amount || 0);

        // create a refund record as a payment with negative amount or a dedicated refunds array — here we just mark p.refunded and adjust calculations
        p.refundAmount = refundAmount;
        p.refundedAt = new Date();
        // If you want to store refund transaction id etc, extend p

        // recalc paidAmount ignoring refunded amounts
        // We'll treat refunded payment as not completed for paidAmount calculation: set status REFUNDED so recalculate ignores it
        booking.recalculatePayments();

        // after recalc check status
        if (booking.paidAmount <= 0) booking.paymentStatus = "PENDING";
        else if (booking.paidAmount < booking.totalAmount) booking.paymentStatus = "PARTIALLY_PAID";
        else booking.paymentStatus = "PAID";

        await booking.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.json({ status: true, data: booking, msg: "Payment marked refunded" });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
});

/**
 * GET /api/bookings/:id
 */
exports.getBooking = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new appError("Invalid id", 400));
    const booking = await Booking.findById(id).populate("board").populate("lead");
    if (!booking) return next(new appError("Booking not found", 404));
    res.json({ status: true, data: booking });
});

/**
 * GET /api/bookings
 * query: board, start, end, page, limit
 */
exports.listBookings = catchAsync(async (req, res, next) => {
    const { board, start, end, page = 1, limit = 50 } = req.query;
    const q = {};
    if (board) q.board = board;
    if (start && end) {
        q.startDate = { $lt: new Date(end) };
        q.endDate = { $gt: new Date(start) };
    }
    const bookings = await Booking.find(q).sort({ startDate: 1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ status: true, count: bookings.length, data: bookings });
});

/**
 * POST /api/bookings/:id/cancel
 * cancel booking and update board occupancy
 */
exports.cancelBooking = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(id).session(session);
        if (!booking) throw new appError("Booking not found", 404);
        if (booking.status === "CANCELLED") throw new appError("Booking already cancelled", 400);

        booking.status = "CANCELLED";
        await booking.save({ session });

        // recompute latest endDate for board
        const latest = await Booking.findOne({
            board: booking.board,
            status: { $in: ["CONFIRMED", "PENDING"] }
        }).sort({ endDate: -1 }).session(session);

        const board = await AdvertisingBoard.findById(booking.board).session(session);
        if (!board) throw new appError("Board not found", 404);

        const till = latest ? latest.endDate : null;
        board.occupied = board.occupied || {};
        board.occupied.isOccupied = !!till && (new Date(till) > new Date());
        board.occupied.till = till || null;
        board.bookings = (board.bookings || []).filter(bid => String(bid) !== String(booking._id));
        await board.save({ session });

        // optionally update linked lead: if you want to mark lead as LOST or revert status, implement here

        await session.commitTransaction();
        session.endSession();

        res.json({ status: true, data: booking, msg: "Booking cancelled" });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
});

/**
 * Export internals if other modules need to call
 */
exports.createBookingTransaction = createBookingTransaction;