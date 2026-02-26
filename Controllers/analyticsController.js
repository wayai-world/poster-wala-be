// controllers/analyticsController.js
// Comprehensive analytics for admin dashboard — PlaceIt
// Uses AnalyticsAggregationBuilder for dynamic pipelines

const AdvertisingBoard = require("../Models/AdvertisingBoard");
const Booking = require("../Models/Booking");
const Lead = require("../Models/Lead");
const BoardLead = require("../Models/BoardLead");
const User = require("../Models/User");
const Company = require("../Models/Company");
const Review = require("../Models/Review");
const catchAsync = require("../utils/catchAsyncWrapper");
const AnalyticsAggregationBuilder = require("../utils/analyticsQueryBuilder");

/* ─────────────────────────────────────────────────────────────────────────────
   Helper
───────────────────────────────────────────────────────────────────────────── */

function ok(res, data, extra = {}) {
    return res.status(200).json({ status: true, data, ...extra });
}

function buildDateMatch(query) {
    const match = {};
    if (query.startDate || query.endDate) {
        match.createdAt = {};
        if (query.startDate) match.createdAt.$gte = new Date(query.startDate);
        if (query.endDate) match.createdAt.$lte = new Date(query.endDate);
    }
    return match;
}

/* ─────────────────────────────────────────────────────────────────────────────
   OVERVIEW DASHBOARD
   GET /api/v1/analytics/overview
───────────────────────────────────────────────────────────────────────────── */

exports.getOverview = catchAsync(async (req, res) => {
    const [
        totalBoards,
        activeBoards,
        totalCompanies,
        totalUsers,
        totalLeads,
        totalBoardLeads,
        totalReviews,
        bookingStats,
    ] = await Promise.all([
        AdvertisingBoard.countDocuments(),
        AdvertisingBoard.countDocuments({ isActive: true }),
        Company.countDocuments(),
        User.countDocuments(),
        Lead.countDocuments(),
        BoardLead.countDocuments(),
        Review.countDocuments(),
        Booking.aggregate([
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                    pendingBookings: {
                        $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
                    },
                    confirmedBookings: {
                        $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] },
                    },
                    cancelledBookings: {
                        $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
                    },
                    completedBookings: {
                        $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
                    },
                    avgBookingValue: { $avg: "$totalAmount" },
                },
            },
        ]),
    ]);

    const stats = bookingStats[0] || {
        totalBookings: 0,
        totalRevenue: 0,
        totalPaid: 0,
        pendingBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        completedBookings: 0,
        avgBookingValue: 0,
    };

    ok(res, {
        boards: { total: totalBoards, active: activeBoards, inactive: totalBoards - activeBoards },
        companies: { total: totalCompanies },
        users: { total: totalUsers },
        leads: { total: totalLeads },
        boardLeads: { total: totalBoardLeads },
        reviews: { total: totalReviews },
        bookings: {
            total: stats.totalBookings,
            pending: stats.pendingBookings,
            confirmed: stats.confirmedBookings,
            cancelled: stats.cancelledBookings,
            completed: stats.completedBookings,
        },
        revenue: {
            total: stats.totalRevenue,
            paid: stats.totalPaid,
            outstanding: stats.totalRevenue - stats.totalPaid,
            avgBookingValue: Math.round(stats.avgBookingValue || 0),
        },
    });
});

/* ─────────────────────────────────────────────────────────────────────────────
   ADVERTISING BOARD ANALYTICS
   GET /api/v1/analytics/boards/*
───────────────────────────────────────────────────────────────────────────── */

// GET /boards/summary
exports.getBoardsSummary = catchAsync(async (req, res) => {
    const pipeline = new AnalyticsAggregationBuilder(AdvertisingBoard, req.query, AdvertisingBoard.schema)
        .buildMatch()
        .pipeline;

    // Run summary aggregation on the filtered set
    const matchStage = pipeline.length ? pipeline[0] : { $match: {} };

    const [data] = await AdvertisingBoard.aggregate([
        matchStage,
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
                published: { $sum: { $cond: ["$isPublished", 1, 0] } },
                unpublished: { $sum: { $cond: ["$isPublished", 0, 1] } },
                digital: { $sum: { $cond: ["$isDigital", 1, 0] } },
                physical: { $sum: { $cond: ["$isDigital", 0, 1] } },
                occupied: { $sum: { $cond: ["$occupied.isOccupied", 1, 0] } },
                avgFootfall: { $avg: "$estimatedFootfallPerDay" },
                avgImpressions: { $avg: "$estimatedImpressionsPerDay" },
                avgBaseRate: { $avg: "$pricing.baseRate" },
                totalImpressions: { $sum: "$estimatedImpressionsPerDay" },
            },
        },
        { $project: { _id: 0 } },
    ]);

    ok(res, data || {});
});

// GET /boards/by-type
exports.getBoardsByType = catchAsync(async (req, res) => {
    const data = await AdvertisingBoard.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: "$type",
                count: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                avgBaseRate: { $avg: "$pricing.baseRate" },
                avgImpressions: { $avg: "$estimatedImpressionsPerDay" },
                digital: { $sum: { $cond: ["$isDigital", 1, 0] } },
            },
        },
        { $sort: { count: -1 } },
        { $project: { type: "$_id", count: 1, active: 1, avgBaseRate: 1, avgImpressions: 1, digital: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /boards/by-city
exports.getBoardsByCity = catchAsync(async (req, res) => {
    const data = await AdvertisingBoard.aggregate([
        { $match: { "location.city": { $exists: true, $ne: "" } } },
        {
            $group: {
                _id: "$location.city",
                count: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                avgBaseRate: { $avg: "$pricing.baseRate" },
                totalImpressions: { $sum: "$estimatedImpressionsPerDay" },
            },
        },
        { $sort: { count: -1 } },
        { $limit: parseInt(req.query.limit) || 20 },
        { $project: { city: "$_id", count: 1, active: 1, avgBaseRate: 1, totalImpressions: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /boards/by-state
exports.getBoardsByState = catchAsync(async (req, res) => {
    const data = await AdvertisingBoard.aggregate([
        { $match: { "location.state": { $exists: true, $ne: "" } } },
        {
            $group: {
                _id: "$location.state",
                count: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                avgBaseRate: { $avg: "$pricing.baseRate" },
                cities: { $addToSet: "$location.city" },
            },
        },
        { $sort: { count: -1 } },
        { $project: { state: "$_id", count: 1, active: 1, avgBaseRate: 1, cityCount: { $size: "$cities" }, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /boards/by-pricing-model
exports.getBoardsByPricingModel = catchAsync(async (req, res) => {
    const data = await AdvertisingBoard.aggregate([
        {
            $group: {
                _id: "$pricing.model",
                count: { $sum: 1 },
                minRate: { $min: "$pricing.baseRate" },
                maxRate: { $max: "$pricing.baseRate" },
                avgRate: { $avg: "$pricing.baseRate" },
            },
        },
        { $sort: { count: -1 } },
        { $project: { pricingModel: "$_id", count: 1, minRate: 1, maxRate: 1, avgRate: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /boards/occupancy
exports.getBoardsOccupancy = catchAsync(async (req, res) => {
    const [data] = await AdvertisingBoard.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                occupied: { $sum: { $cond: ["$occupied.isOccupied", 1, 0] } },
                free: { $sum: { $cond: ["$occupied.isOccupied", 0, 1] } },
                avgFootfall: { $avg: "$estimatedFootfallPerDay" },
                avgImpressions: { $avg: "$estimatedImpressionsPerDay" },
                totalFootfall: { $sum: "$estimatedFootfallPerDay" },
                totalImpressions: { $sum: "$estimatedImpressionsPerDay" },
            },
        },
        {
            $addFields: {
                occupancyRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$occupied", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data || {});
});

// GET /boards/top-performing
exports.getTopPerformingBoards = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const data = await AdvertisingBoard.aggregate([
        { $match: { isActive: true } },
        { $sort: { estimatedImpressionsPerDay: -1, estimatedFootfallPerDay: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "companies",
                localField: "ofCompany",
                foreignField: "_id",
                as: "company",
            },
        },
        { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                name: 1,
                type: 1,
                "location.city": 1,
                "location.state": 1,
                estimatedImpressionsPerDay: 1,
                estimatedFootfallPerDay: 1,
                "pricing.baseRate": 1,
                "pricing.model": 1,
                isDigital: 1,
                "occupied.isOccupied": 1,
                "company.name": 1,
                bookingsCount: { $size: { $ifNull: ["$bookings", []] } },
            },
        },
    ]);
    ok(res, data);
});

// GET /boards/availability-stats
exports.getBoardsAvailabilityStats = catchAsync(async (req, res) => {
    const data = await AdvertisingBoard.aggregate([
        { $unwind: { path: "$availability", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: null,
                totalSlots: { $sum: { $cond: [{ $ifNull: ["$availability", false] }, 1, 0] } },
                availableSlots: {
                    $sum: {
                        $cond: [
                            { $and: [{ $ifNull: ["$availability", false] }, { $eq: ["$availability.isAvailable", true] }] },
                            1,
                            0,
                        ],
                    },
                },
                bookedSlots: {
                    $sum: {
                        $cond: [
                            { $and: [{ $ifNull: ["$availability", false] }, { $eq: ["$availability.isAvailable", false] }] },
                            1,
                            0,
                        ],
                    },
                },
                avgSlotPrice: { $avg: "$availability.price" },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data[0] || { totalSlots: 0, availableSlots: 0, bookedSlots: 0, avgSlotPrice: 0 });
});

// GET /boards/orientation-split
exports.getBoardsOrientationSplit = catchAsync(async (req, res) => {
    const data = await AdvertisingBoard.aggregate([
        {
            $group: {
                _id: "$orientation",
                count: { $sum: 1 },
                digital: { $sum: { $cond: ["$isDigital", 1, 0] } },
                avgImpressions: { $avg: "$estimatedImpressionsPerDay" },
            },
        },
        { $project: { orientation: "$_id", count: 1, digital: 1, avgImpressions: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /boards/created-over-time
exports.getBoardsCreatedOverTime = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month"; // month | week | day | year
    const data = await AdvertisingBoard.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit } },
                count: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                digital: { $sum: { $cond: ["$isDigital", 1, 0] } },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { period: "$_id", count: 1, active: 1, digital: 1, _id: 0 } },
    ]);
    ok(res, data);
});

/* ─────────────────────────────────────────────────────────────────────────────
   BOOKING ANALYTICS
   GET /api/v1/analytics/bookings/*
───────────────────────────────────────────────────────────────────────────── */

// GET /bookings/summary
exports.getBookingsSummary = catchAsync(async (req, res) => {
    const dateMatch = buildDateMatch(req.query);
    const [data] = await Booking.aggregate([
        ...(dateMatch.createdAt ? [{ $match: dateMatch }] : []),
        {
            $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" },
                totalPaid: { $sum: "$paidAmount" },
                avgBookingValue: { $avg: "$totalAmount" },
                minBookingValue: { $min: "$totalAmount" },
                maxBookingValue: { $max: "$totalAmount" },
                pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
                confirmed: { $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
                fullyPaid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0] } },
                partiallyPaid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PARTIALLY_PAID"] }, 1, 0] } },
                paymentPending: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PENDING"] }, 1, 0] } },
            },
        },
        {
            $addFields: {
                collectionRate: {
                    $cond: [
                        { $gt: ["$totalRevenue", 0] },
                        { $multiply: [{ $divide: ["$totalPaid", "$totalRevenue"] }, 100] },
                        0,
                    ],
                },
                outstanding: { $subtract: ["$totalRevenue", "$totalPaid"] },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data || {});
});

// GET /bookings/by-status
exports.getBookingsByStatus = catchAsync(async (req, res) => {
    const data = await Booking.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalAmount: { $sum: "$totalAmount" },
                totalPaid: { $sum: "$paidAmount" },
            },
        },
        { $sort: { count: -1 } },
        { $project: { status: "$_id", count: 1, totalAmount: 1, totalPaid: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /bookings/by-payment-status
exports.getBookingsByPaymentStatus = catchAsync(async (req, res) => {
    const data = await Booking.aggregate([
        {
            $group: {
                _id: "$paymentStatus",
                count: { $sum: 1 },
                totalAmount: { $sum: "$totalAmount" },
                totalPaid: { $sum: "$paidAmount" },
                outstanding: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } },
            },
        },
        { $sort: { count: -1 } },
        { $project: { paymentStatus: "$_id", count: 1, totalAmount: 1, totalPaid: 1, outstanding: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /bookings/revenue-over-time
exports.getBookingsRevenueOverTime = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month";
    const data = await Booking.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        { $match: { status: { $in: ["CONFIRMED", "COMPLETED"] } } },
        {
            $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit } },
                bookingsCount: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" },
                totalPaid: { $sum: "$paidAmount" },
                avgRevenue: { $avg: "$totalAmount" },
            },
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                period: "$_id",
                bookingsCount: 1,
                totalRevenue: 1,
                totalPaid: 1,
                avgRevenue: 1,
                _id: 0,
            },
        },
    ]);
    ok(res, data);
});

// GET /bookings/top-boards
exports.getTopBookedBoards = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Booking.aggregate([
        { $match: { status: { $in: ["CONFIRMED", "COMPLETED"] } } },
        {
            $group: {
                _id: "$board",
                bookingsCount: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" },
                totalPaid: { $sum: "$paidAmount" },
                avgBookingValue: { $avg: "$totalAmount" },
            },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "advertisingboards",
                localField: "_id",
                foreignField: "_id",
                as: "board",
            },
        },
        { $unwind: { path: "$board", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                boardId: "$_id",
                boardName: "$board.name",
                boardType: "$board.type",
                city: "$board.location.city",
                state: "$board.location.state",
                bookingsCount: 1,
                totalRevenue: 1,
                totalPaid: 1,
                avgBookingValue: 1,
                _id: 0,
            },
        },
    ]);
    ok(res, data);
});

// GET /bookings/avg-duration
exports.getBookingsAvgDuration = catchAsync(async (req, res) => {
    const data = await Booking.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $addFields: {
                durationDays: {
                    $divide: [
                        { $subtract: ["$endDate", "$startDate"] },
                        1000 * 60 * 60 * 24,
                    ],
                },
            },
        },
        {
            $group: {
                _id: null,
                avgDurationDays: { $avg: "$durationDays" },
                minDurationDays: { $min: "$durationDays" },
                maxDurationDays: { $max: "$durationDays" },
                totalBookings: { $sum: 1 },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data[0] || {});
});

// GET /bookings/payment-methods
exports.getBookingsPaymentMethods = catchAsync(async (req, res) => {
    const data = await Booking.aggregate([
        { $unwind: { path: "$payments", preserveNullAndEmptyArrays: false } },
        { $match: { "payments.status": "COMPLETED" } },
        {
            $group: {
                _id: "$payments.method",
                count: { $sum: 1 },
                totalAmount: { $sum: "$payments.amount" },
                avgAmount: { $avg: "$payments.amount" },
            },
        },
        { $sort: { totalAmount: -1 } },
        { $project: { method: "$_id", count: 1, totalAmount: 1, avgAmount: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /bookings/cancellation-rate
exports.getBookingsCancellationRate = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month";
    const data = await Booking.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit } },
                total: { $sum: 1 },
                cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
            },
        },
        {
            $addFields: {
                cancellationRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$cancelled", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { period: "$_id", total: 1, cancelled: 1, cancellationRate: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /bookings/revenue-by-company
exports.getBookingsRevenueByCompany = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Booking.aggregate([
        { $match: { ofCompany: { $exists: true, $ne: null } } },
        {
            $group: {
                _id: "$ofCompany",
                bookingsCount: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" },
                totalPaid: { $sum: "$paidAmount" },
            },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "companies",
                localField: "_id",
                foreignField: "_id",
                as: "company",
            },
        },
        { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                companyId: "$_id",
                companyName: "$company.name",
                bookingsCount: 1,
                totalRevenue: 1,
                totalPaid: 1,
                _id: 0,
            },
        },
    ]);
    ok(res, data);
});

/* ─────────────────────────────────────────────────────────────────────────────
   LEAD ANALYTICS
   GET /api/v1/analytics/leads/*
───────────────────────────────────────────────────────────────────────────── */

// GET /leads/summary
exports.getLeadsSummary = catchAsync(async (req, res) => {
    const dateMatch = buildDateMatch(req.query);
    const [data] = await Lead.aggregate([
        ...(dateMatch.createdAt ? [{ $match: dateMatch }] : []),
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                converted: { $sum: { $cond: ["$convertedToBooking", 1, 0] } },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$status", "LOST"] }, 1, 0] } },
                avgConversionAmount: { $avg: "$conversionDetails.totalAmount" },
            },
        },
        {
            $addFields: {
                conversionRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$converted", "$total"] }, 100] },
                        0,
                    ],
                },
                lossRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$lost", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data || {});
});

// GET /leads/by-status
exports.getLeadsByStatus = catchAsync(async (req, res) => {
    const data = await Lead.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                converted: { $sum: { $cond: ["$convertedToBooking", 1, 0] } },
            },
        },
        { $sort: { count: -1 } },
        { $project: { status: "$_id", count: 1, converted: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /leads/by-source
exports.getLeadsBySource = catchAsync(async (req, res) => {
    const data = await Lead.aggregate([
        {
            $group: {
                _id: "$source",
                count: { $sum: 1 },
                converted: { $sum: { $cond: ["$convertedToBooking", 1, 0] } },
            },
        },
        {
            $addFields: {
                conversionRate: {
                    $cond: [
                        { $gt: ["$count", 0] },
                        { $multiply: [{ $divide: ["$converted", "$count"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $sort: { count: -1 } },
        { $project: { source: "$_id", count: 1, converted: 1, conversionRate: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /leads/conversion-rate-over-time
exports.getLeadsConversionOverTime = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month";
    const data = await Lead.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit } },
                total: { $sum: 1 },
                converted: { $sum: { $cond: ["$convertedToBooking", 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$status", "LOST"] }, 1, 0] } },
            },
        },
        {
            $addFields: {
                conversionRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$converted", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { period: "$_id", total: 1, converted: 1, lost: 1, conversionRate: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /leads/by-ad-type
exports.getLeadsByAdType = catchAsync(async (req, res) => {
    const data = await Lead.aggregate([
        {
            $group: {
                _id: "$campaign.adType",
                count: { $sum: 1 },
                converted: { $sum: { $cond: ["$convertedToBooking", 1, 0] } },
            },
        },
        { $sort: { count: -1 } },
        { $project: { adType: "$_id", count: 1, converted: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /leads/top-boards
exports.getLeadsTopBoards = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Lead.aggregate([
        {
            $group: {
                _id: "$board",
                totalLeads: { $sum: 1 },
                converted: { $sum: { $cond: ["$convertedToBooking", 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$status", "LOST"] }, 1, 0] } },
            },
        },
        { $sort: { totalLeads: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "advertisingboards",
                localField: "_id",
                foreignField: "_id",
                as: "board",
            },
        },
        { $unwind: { path: "$board", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                boardId: "$_id",
                boardName: "$board.name",
                boardType: "$board.type",
                city: "$board.location.city",
                totalLeads: 1,
                converted: 1,
                lost: 1,
                _id: 0,
            },
        },
    ]);
    ok(res, data);
});

/* ─────────────────────────────────────────────────────────────────────────────
   BOARD LEAD ANALYTICS
   GET /api/v1/analytics/board-leads/*
───────────────────────────────────────────────────────────────────────────── */

// GET /board-leads/summary
exports.getBoardLeadsSummary = catchAsync(async (req, res) => {
    const dateMatch = buildDateMatch(req.query);
    const [data] = await BoardLead.aggregate([
        ...(dateMatch.createdAt ? [{ $match: dateMatch }] : []),
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } },
                followedUp: { $sum: { $cond: ["$isFollowedUp", 1, 0] } },
                notFollowedUp: { $sum: { $cond: ["$isFollowedUp", 0, 1] } },
                avgBudget: { $avg: "$budget.amount" },
                minBudget: { $min: "$budget.amount" },
                maxBudget: { $max: "$budget.amount" },
                totalBudget: { $sum: "$budget.amount" },
                negotiable: { $sum: { $cond: ["$budget.negotiable", 1, 0] } },
            },
        },
        {
            $addFields: {
                followUpRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$followedUp", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data || {});
});

// GET /board-leads/by-status
exports.getBoardLeadsByStatus = catchAsync(async (req, res) => {
    const data = await BoardLead.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                avgBudget: { $avg: "$budget.amount" },
                followedUp: { $sum: { $cond: ["$isFollowedUp", 1, 0] } },
            },
        },
        { $sort: { count: -1 } },
        { $project: { status: "$_id", count: 1, avgBudget: 1, followedUp: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /board-leads/by-source
exports.getBoardLeadsBySource = catchAsync(async (req, res) => {
    const data = await BoardLead.aggregate([
        {
            $group: {
                _id: "$source",
                count: { $sum: 1 },
                avgBudget: { $avg: "$budget.amount" },
            },
        },
        { $sort: { count: -1 } },
        { $project: { source: "$_id", count: 1, avgBudget: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /board-leads/by-ad-type
exports.getBoardLeadsByAdType = catchAsync(async (req, res) => {
    const data = await BoardLead.aggregate([
        {
            $group: {
                _id: "$campaign.adType",
                count: { $sum: 1 },
                avgBudget: { $avg: "$budget.amount" },
            },
        },
        { $sort: { count: -1 } },
        { $project: { adType: "$_id", count: 1, avgBudget: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /board-leads/budget-distribution
exports.getBoardLeadsBudgetDistribution = catchAsync(async (req, res) => {
    const [summary] = await BoardLead.aggregate([
        { $match: { "budget.amount": { $gt: 0 } } },
        {
            $group: {
                _id: null,
                avgBudget: { $avg: "$budget.amount" },
                minBudget: { $min: "$budget.amount" },
                maxBudget: { $max: "$budget.amount" },
                totalBudget: { $sum: "$budget.amount" },
                count: { $sum: 1 },
                negotiable: { $sum: { $cond: ["$budget.negotiable", 1, 0] } },
            },
        },
        { $project: { _id: 0 } },
    ]);

    // Bucket distribution: <10k, 10k-50k, 50k-100k, 100k-500k, >500k
    const buckets = await BoardLead.aggregate([
        { $match: { "budget.amount": { $gt: 0 } } },
        {
            $bucket: {
                groupBy: "$budget.amount",
                boundaries: [0, 10000, 50000, 100000, 500000, Infinity],
                default: "Other",
                output: { count: { $sum: 1 }, avgBudget: { $avg: "$budget.amount" } },
            },
        },
    ]);

    ok(res, { summary: summary || {}, buckets });
});

// GET /board-leads/follow-up-stats
exports.getBoardLeadsFollowUpStats = catchAsync(async (req, res) => {
    const data = await BoardLead.aggregate([
        {
            $addFields: {
                followUpDelayDays: {
                    $cond: [
                        { $and: ["$isFollowedUp", "$followedUpAt"] },
                        {
                            $divide: [
                                { $subtract: ["$followedUpAt", "$createdAt"] },
                                1000 * 60 * 60 * 24,
                            ],
                        },
                        null,
                    ],
                },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                followedUp: { $sum: { $cond: ["$isFollowedUp", 1, 0] } },
                avgFollowUpDelayDays: { $avg: "$followUpDelayDays" },
                minFollowUpDays: { $min: "$followUpDelayDays" },
                maxFollowUpDays: { $max: "$followUpDelayDays" },
            },
        },
        {
            $addFields: {
                notFollowedUp: { $subtract: ["$total", "$followedUp"] },
                followUpRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$followedUp", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data[0] || {});
});

// GET /board-leads/over-time
exports.getBoardLeadsOverTime = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month";
    const data = await BoardLead.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit } },
                count: { $sum: 1 },
                confirmed: { $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] } },
                avgBudget: { $avg: "$budget.amount" },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { period: "$_id", count: 1, confirmed: 1, avgBudget: 1, _id: 0 } },
    ]);
    ok(res, data);
});

/* ─────────────────────────────────────────────────────────────────────────────
   USER ANALYTICS
   GET /api/v1/analytics/users/*
───────────────────────────────────────────────────────────────────────────── */

// GET /users/summary
exports.getUsersSummary = catchAsync(async (req, res) => {
    const [data] = await User.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                withCompany: { $sum: { $cond: [{ $ifNull: ["$ofCompany", false] }, 1, 0] } },
                uniqueStates: { $addToSet: "$state" },
            },
        },
        {
            $addFields: {
                stateCount: { $size: "$uniqueStates" },
                withoutCompany: { $subtract: ["$total", "$withCompany"] },
            },
        },
        { $project: { _id: 0, uniqueStates: 0 } },
    ]);
    ok(res, data || {});
});

// GET /users/by-role
exports.getUsersByRole = catchAsync(async (req, res) => {
    const data = await User.aggregate([
        {
            $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "roleInfo",
            },
        },
        { $unwind: { path: "$roleInfo", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: "$roleInfo.name",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
        { $project: { role: "$_id", count: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /users/by-state
exports.getUsersByState = catchAsync(async (req, res) => {
    const data = await User.aggregate([
        { $match: { state: { $exists: true, $ne: "" } } },
        {
            $group: {
                _id: "$state",
                count: { $sum: 1 },
                withCompany: { $sum: { $cond: [{ $ifNull: ["$ofCompany", false] }, 1, 0] } },
            },
        },
        { $sort: { count: -1 } },
        { $project: { state: "$_id", count: 1, withCompany: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /users/by-company
exports.getUsersByCompany = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const data = await User.aggregate([
        { $match: { ofCompany: { $exists: true, $ne: null } } },
        {
            $group: {
                _id: "$ofCompany",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "companies",
                localField: "_id",
                foreignField: "_id",
                as: "company",
            },
        },
        { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
        { $project: { companyId: "$_id", companyName: "$company.name", count: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /users/growth-over-time
exports.getUsersGrowthOverTime = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month";
    const data = await User.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: { $dateTrunc: { date: "$_id", unit } }, // ObjectId contains creation time
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { period: "$_id", count: 1, _id: 0 } },
    ]);
    ok(res, data);
});

/* ─────────────────────────────────────────────────────────────────────────────
   COMPANY ANALYTICS
   GET /api/v1/analytics/companies/*
───────────────────────────────────────────────────────────────────────────── */

// GET /companies/summary
exports.getCompaniesSummary = catchAsync(async (req, res) => {
    const [data] = await Company.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                avgReview: { $avg: "$averageReview" },
                totalReviewCount: { $sum: "$review" },
                withReview: { $sum: { $cond: [{ $gt: ["$averageReview", 0] }, 1, 0] } },
            },
        },
        { $project: { _id: 0 } },
    ]);

    // Also count boards per company
    const boardStats = await AdvertisingBoard.aggregate([
        {
            $group: {
                _id: "$ofCompany",
                boardCount: { $sum: 1 },
                activeBoards: { $sum: { $cond: ["$isActive", 1, 0] } },
            },
        },
        {
            $group: {
                _id: null,
                companiesWithBoards: { $sum: 1 },
                avgBoardsPerCompany: { $avg: "$boardCount" },
                maxBoardsPerCompany: { $max: "$boardCount" },
            },
        },
        { $project: { _id: 0 } },
    ]);

    ok(res, { ...data, ...(boardStats[0] || {}) });
});

// GET /companies/rating-distribution
exports.getCompaniesRatingDistribution = catchAsync(async (req, res) => {
    const data = await Company.aggregate([
        { $match: { averageReview: { $exists: true, $gt: 0 } } },
        {
            $bucket: {
                groupBy: "$averageReview",
                boundaries: [1, 2, 3, 4, 5],
                default: "5+",
                output: {
                    count: { $sum: 1 },
                    companies: { $push: "$name" },
                },
            },
        },
    ]);
    ok(res, data);
});

// GET /companies/top-rated
exports.getTopRatedCompanies = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Company.aggregate([
        { $match: { averageReview: { $exists: true, $gt: 0 } } },
        { $sort: { averageReview: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "advertisingboards",
                let: { compId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$ofCompany", "$$compId"] } } },
                    { $count: "total" },
                ],
                as: "boardCount",
            },
        },
        {
            $project: {
                name: 1,
                email: 1,
                mobile: 1,
                averageReview: 1,
                review: 1,
                boardCount: { $arrayElemAt: ["$boardCount.total", 0] },
            },
        },
    ]);
    ok(res, data);
});

// GET /companies/boards-per-company
exports.getCompanyBoardsDistribution = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const data = await AdvertisingBoard.aggregate([
        {
            $group: {
                _id: "$ofCompany",
                totalBoards: { $sum: 1 },
                activeBoards: { $sum: { $cond: ["$isActive", 1, 0] } },
                digitalBoards: { $sum: { $cond: ["$isDigital", 1, 0] } },
                totalImpressions: { $sum: "$estimatedImpressionsPerDay" },
                avgBaseRate: { $avg: "$pricing.baseRate" },
            },
        },
        { $sort: { totalBoards: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: "companies",
                localField: "_id",
                foreignField: "_id",
                as: "company",
            },
        },
        { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                companyId: "$_id",
                companyName: "$company.name",
                totalBoards: 1,
                activeBoards: 1,
                digitalBoards: 1,
                totalImpressions: 1,
                avgBaseRate: 1,
                _id: 0,
            },
        },
    ]);
    ok(res, data);
});

/* ─────────────────────────────────────────────────────────────────────────────
   REVIEW ANALYTICS
   GET /api/v1/analytics/reviews/*
───────────────────────────────────────────────────────────────────────────── */

// GET /reviews/summary
exports.getReviewsSummary = catchAsync(async (req, res) => {
    const [data] = await Review.aggregate([
        {
            $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                avgRating: { $avg: "$rating" },
                minRating: { $min: "$rating" },
                maxRating: { $max: "$rating" },
                rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
                rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
                rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
                rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
                rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
                withMessage: { $sum: { $cond: [{ $ifNull: ["$message", false] }, 1, 0] } },
            },
        },
        { $project: { _id: 0 } },
    ]);
    ok(res, data || {});
});

// GET /reviews/by-rating
exports.getReviewsByRating = catchAsync(async (req, res) => {
    const data = await Review.aggregate([
        {
            $group: {
                _id: "$rating",
                count: { $sum: 1 },
                withMessage: { $sum: { $cond: [{ $ifNull: ["$message", false] }, 1, 0] } },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { rating: "$_id", count: 1, withMessage: 1, _id: 0 } },
    ]);
    ok(res, data);
});

// GET /reviews/by-company
exports.getReviewsByCompany = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const sortOrder = req.query.sort === "asc" ? 1 : -1;

    const data = await Review.aggregate([
        { $match: { ofCompany: { $exists: true, $ne: null } } },
        {
            $group: {
                _id: "$ofCompany",
                count: { $sum: 1 },
                avgRating: { $avg: "$rating" },
                minRating: { $min: "$rating" },
                maxRating: { $max: "$rating" },
            },
        },
        { $sort: { avgRating: sortOrder } },
        { $limit: limit },
        {
            $lookup: {
                from: "companies",
                localField: "_id",
                foreignField: "_id",
                as: "company",
            },
        },
        { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                companyId: "$_id",
                companyName: "$company.name",
                count: 1,
                avgRating: 1,
                minRating: 1,
                maxRating: 1,
                _id: 0,
            },
        },
    ]);
    ok(res, data);
});

// GET /reviews/over-time
exports.getReviewsOverTime = catchAsync(async (req, res) => {
    const unit = req.query.unit || "month";
    const data = await Review.aggregate([
        ...(buildDateMatch(req.query).createdAt ? [{ $match: buildDateMatch(req.query) }] : []),
        {
            $group: {
                _id: { $dateTrunc: { date: "$_id", unit } },
                count: { $sum: 1 },
                avgRating: { $avg: "$rating" },
            },
        },
        { $sort: { _id: 1 } },
        { $project: { period: "$_id", count: 1, avgRating: 1, _id: 0 } },
    ]);
    ok(res, data);
});
