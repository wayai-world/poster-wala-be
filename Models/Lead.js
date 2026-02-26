// models/Lead.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const LeadSchema = new Schema({
    board: { type: Schema.Types.ObjectId, ref: "AdvertisingBoard", required: true },

    // Short client info (minimal enquiry)
    contact: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: false, trim: true },
        phone: { type: String, required: false, trim: true }
    },

    // basic campaign interest (optional)
    campaign: {
        adType: { type: String, enum: ["IMAGE", "VIDEO", "POSTER", "BANNER", "OTHER"], default: "IMAGE" },
        preferredStartDate: { type: Date },
        preferredEndDate: { type: Date },
        message: { type: String, trim: true, maxlength: 1500 }
    },

    // lifecycle/stage for the sales team
    status: {
        type: String,
        enum: ["NOT_STARTED", "CONTACTED", "QUALIFIED", "NEGOTIATION", "DEAL_CLOSED", "LOST"],
        default: "NOT_STARTED"
    },

    // optional assignment, notes, produced booking link after conversion
    assignedTo: { type: Schema.Types.ObjectId, ref: "user" },
    notes: [{ type: String }],
    isActive: { type: Boolean, default: true },

    // link to booking after conversion
    bookingRef: { type: Schema.Types.ObjectId, ref: "Booking", default: null },

    // meta
    source: { type: String, enum: ["WEBSITE", "WHATSAPP", "SALES", "OTHER"], default: "WEBSITE" },
    createdBy: { type: Schema.Types.ObjectId, ref: "user" }, // optional if user filled while logged-in
    ofCompany: { type: Schema.Types.ObjectId, ref: "company" }, // optional
    convertedToBooking: { type: Boolean, default: false },
    conversionDetails: {
        bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
        bookedAt: { type: Date },
        totalAmount: { type: Number },
        currency: { type: String }
    }

}, { timestamps: true });

LeadSchema.index({ board: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Lead", LeadSchema);