const mongoose = require("mongoose");

const { Schema } = mongoose;

const AvailabilitySlotSchema = new Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // For day-parting/time slots (optional)
    startTime: { type: String }, // "09:00"
    endTime: { type: String },   // "18:00"
    price: { type: Number, default: 0 }, // override board price for this slot
    currency: { type: String, default: "INR" },
    isAvailable: { type: Boolean, default: true },
    bookedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
    bookingRef: { type: Schema.Types.ObjectId, ref: "booking", default: null },
}, { _id: true });

const AdvertisingBoardSchema = new Schema({
    name: {
        type: String,
        required: [true, "name is required"],
        maxlength: [100, "Name too long"],
        minlength: [2, "Name too short"],
        trim: true
    },

    description: { type: String, trim: true, maxlength: 2000 },

    type: {
        type: String,
        required: [true, "Board type is required"],
        enum: ["LED_SCREEN", "LIGHT_SCREEN", "POSTER", "BILLBOARD", "POLE", "BUS_SHELTER", "DIGITAL_PANEL", "OTHER"],
        default: "POSTER"
    },

    // physical dimension in meters [width, height] (or use a subobject)
    dimensions: {
        widthMeters: { type: Number, required: true },
        heightMeters: { type: Number, required: true },
        depthMeters: { type: Number, default: 0 }, // optional
        unit: { type: String, default: "m" }
    },

    // price base (per day / per slot / cpm)
    pricing: {
        model: { type: String, enum: ["PER_DAY", "PER_SLOT", "CPM", "FLAT"], default: "PER_DAY" },
        baseRate: { type: Number, default: 0 }, // base numeric value
        currency: { type: String, default: "INR" },
        notes: { type: String }
    },

    // location
    location: {
        addressLine1: { type: String },
        addressLine2: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String, default: "India" },
        postalCode: { type: String },
        coords: {
            // GeoJSON point for geospatial queries
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
        },
        nearbyLandmarks: { type: [String], default: [] }
    },

    // audience & analytics
    populationK: { type: Number, default: 0 }, // e.g., 50 => 50k
    estimatedFootfallPerDay: { type: Number, default: 0 },
    estimatedImpressionsPerDay: { type: Number, default: 0 },

    // media attributes (for digital)
    isDigital: { type: Boolean, default: false },
    screenResolution: { type: String }, // "1920x1080"
    brightnessNits: { type: Number },
    orientation: { type: String, enum: ["PORTRAIT", "LANDSCAPE", "SQUARE"], default: "LANDSCAPE" },
    facingDirection: { type: String }, // "north", "south-east", etc.

    // images
    // coverImage: { type: String }, // URL or asset id
    // images: { type: [String], default: [] }, // gallery

    coverImage: {
        url: { type: String },
        key: { type: String }
    },
    images: [{ url: String, key: String }],

    // availability slots:
    availability: { type: [AvailabilitySlotSchema], default: [] },

    // occupancy quick-view
    occupied: {
        isOccupied: { type: Boolean, default: false },
        till: { type: Date, default: null }
    },

    tags: { type: [String], default: [] },
    permittedUses: { type: [String], default: [] }, // e.g., ["retail", "political", "automotive"]

    contact: {
        name: { type: String },
        phone: { type: String },
        email: { type: String }
    },

    // relations
    createdBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
    ofCompany: { type: Schema.Types.ObjectId, ref: "company", required: true },

    bookings: [{ type: Schema.Types.ObjectId, ref: "booking" }],
    reviews: [{ type: Schema.Types.ObjectId, ref: "review" }],

    // admin flags
    isActive: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },

    // availiblity flags
    isAvailableNowToBook: { type: Boolean, default: true },


}, { timestamps: true });

// geospatial index
AdvertisingBoardSchema.index({ "location.coords": "2dsphere" });

// helper: get next available slot (virtual-ish method)
AdvertisingBoardSchema.methods.getNextAvailableSlots = function (limit = 5) {
    return this.availability.filter(s => s.isAvailable && s.startDate > new Date()).slice(0, limit);
};

const AdvertisingBoard = mongoose.model("AdvertisingBoard", AdvertisingBoardSchema);
module.exports = AdvertisingBoard;