// models/BoardLead.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const CreativeFileSchema = new Schema({
    url: { type: String, required: true },
    key: { type: String, required: true },
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number } // bytes
}, { _id: true });

const BoardLeadSchema = new Schema({
    // Which board the lead is for
    board: { type: Schema.Types.ObjectId, ref: "AdvertisingBoard", required: true },

    // Optional: If the enquirer picked a pre-created availability slot
    slotId: { type: Schema.Types.ObjectId },

    // Campaign details
    campaign: {
        campaignName: { type: String, required: true, trim: true },
        brandName: { type: String, required: true, trim: true },
        adType: { type: String, enum: ["IMAGE", "VIDEO", "POSTER", "BANNER", "HTML", "OTHER"], required: true },
        creatives: { type: [CreativeFileSchema], default: [] }, // files uploaded by enquirer
        message: { type: String, trim: true, maxlength: 3000 },
        durationDays: { type: Number }, // optional - calculated from start/end
        startDate: { type: Date },
        endDate: { type: Date },
        preferredTimes: { type: [String], default: [] } // e.g. ["09:00-12:00", "18:00-21:00"]
    },

    // Contact details
    contact: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        companyName: { type: String },
        designation: { type: String }
    },

    // Commercials
    budget: {
        currency: { type: String, default: "INR" },
        amount: { type: Number, default: 0 }, // optional expected/quoted budget
        negotiable: { type: Boolean, default: false }
    },

    // Where the lead came from (web form, api, mobile, sales)
    source: { type: String, enum: ["WEBSITE", "API", "WHATSAPP", "EMAIL", "PHONE", "SALES_REP", "OTHER"], default: "WEBSITE" },

    // Lifecycle
    status: { type: String, enum: ["NEW", "CONTACTED", "QUALIFIED", "QUOTE_SENT", "CONFIRMED", "CANCELLED", "REJECTED"], default: "NEW" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "user" }, // sales user

    // relations & meta
    createdBy: { type: Schema.Types.ObjectId, ref: "user" }, // optional if logged-in
    ofCompany: { type: Schema.Types.ObjectId, ref: "company" }, // optional
    notes: { type: [String], default: [] },

    // small quick-statistics
    isFollowedUp: { type: Boolean, default: false },
    followedUpAt: { type: Date, default: null },

    // soft delete / visibility
    isActive: { type: Boolean, default: true },

}, { timestamps: true });

// indexes for fast queries
BoardLeadSchema.index({ board: 1, status: 1 });
BoardLeadSchema.index({ "contact.email": 1 });
BoardLeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model("BoardLead", BoardLeadSchema);