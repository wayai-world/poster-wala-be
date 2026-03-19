// models/Booking.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const PaymentSchema = new Schema({
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    method: { type: String, enum: ["BANK_TRANSFER", "UPI", "CARD", "CASH", "OTHER"], default: "OTHER" },
    methodDetails: { type: Schema.Types.Mixed, default: {} }, // optional (bank txn id, UPI id, card last4, etc)
    transactionId: { type: String }, // external tx id
    status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"], default: "COMPLETED" },
    createdAt: { type: Date, default: Date.now },
    note: { type: String, default: "" }
}, { _id: true, timestamps: false });

const BookingSchema = new Schema({
    ofCompany: { type: Schema.Types.ObjectId, ref: "company", required: false },

    board: { type: Schema.Types.ObjectId, ref: "AdvertisingBoard", required: true },
    // lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },

    // [startDate, endDate) convention
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    totalAmount: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "INR" },

    // payment tracking
    payments: { type: [PaymentSchema], default: [] },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["PENDING", "PARTIALLY_PAID", "PAID", "REFUNDED"], default: "PENDING" },

    // booking lifecycle
    status: { type: String, enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"], default: "CONFIRMED" },

    createdBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
    notes: { type: [String], default: [] },

    // idempotency key to avoid duplicate bookings on retries
    idempotencyKey: { type: String, index: true, default: null }
}, { timestamps: true });

// indexes for overlap queries & tenant isolation
BookingSchema.index({ board: 1, startDate: 1, endDate: 1 });
BookingSchema.index({ tenantId: 1, board: 1, startDate: 1, endDate: 1 });

/**
 * Instance method to recalc paid amount and paymentStatus
 */
BookingSchema.methods.recalculatePayments = function () {
    const paid = (this.payments || []).filter(p => p.status === "COMPLETED" || p.status === "PENDING").reduce((s, p) => s + (p.amount || 0), 0);
    this.paidAmount = paid;
    if (paid <= 0) this.paymentStatus = "PENDING";
    else if (paid < (this.totalAmount || 0)) this.paymentStatus = "PARTIALLY_PAID";
    else if (paid >= (this.totalAmount || 0)) this.paymentStatus = "PAID";
};

module.exports = mongoose.models.Booking || mongoose.model("Booking", BookingSchema);