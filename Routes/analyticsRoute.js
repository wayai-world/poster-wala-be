// routes/analyticsRoute.js
// All analytics routes for the admin dashboard
// Base: /api/v1/analytics

const express = require("express");
const router = express.Router();
const a = require("../controllers/analyticsController");
const { isLoggedIn } = require("../Middleware/isLoggedIn");

// Apply auth to all analytics routes
router.use(isLoggedIn);

/* ─────────────────────────────────────────────────────────────────────────
   OVERVIEW — Platform-wide KPI snapshot
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/overview
*/
router.get("/overview", a.getOverview);

/* ─────────────────────────────────────────────────────────────────────────
   ADVERTISING BOARDS
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/boards/summary       – count, active/inactive, digital/physical
   GET /api/v1/analytics/boards/by-type       – group by board type (LED, Billboard…)
   GET /api/v1/analytics/boards/by-city       – board count per city
   GET /api/v1/analytics/boards/by-state      – board count per state
   GET /api/v1/analytics/boards/by-pricing-model  – PER_DAY | PER_SLOT | CPM | FLAT
   GET /api/v1/analytics/boards/occupancy     – occupied vs free + footfall/impressions
   GET /api/v1/analytics/boards/top-performing    – top boards by impressions
   GET /api/v1/analytics/boards/availability-stats – total/available/booked slots
   GET /api/v1/analytics/boards/orientation-split  – PORTRAIT | LANDSCAPE | SQUARE
   GET /api/v1/analytics/boards/created-over-time  – ?unit=month|week|day
*/
router.get("/boards/summary", a.getBoardsSummary);
router.get("/boards/by-type", a.getBoardsByType);
router.get("/boards/by-city", a.getBoardsByCity);
router.get("/boards/by-state", a.getBoardsByState);
router.get("/boards/by-pricing-model", a.getBoardsByPricingModel);
router.get("/boards/occupancy", a.getBoardsOccupancy);
router.get("/boards/top-performing", a.getTopPerformingBoards);
router.get("/boards/availability-stats", a.getBoardsAvailabilityStats);
router.get("/boards/orientation-split", a.getBoardsOrientationSplit);
router.get("/boards/created-over-time", a.getBoardsCreatedOverTime);

/* ─────────────────────────────────────────────────────────────────────────
   BOOKINGS
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/bookings/summary            – total, revenue, paid, avg
   GET /api/v1/analytics/bookings/by-status          – CONFIRMED|PENDING|CANCELLED|COMPLETED
   GET /api/v1/analytics/bookings/by-payment-status  – PAID|PARTIALLY_PAID|PENDING|REFUNDED
   GET /api/v1/analytics/bookings/revenue-over-time  – ?unit=month|week|day
   GET /api/v1/analytics/bookings/top-boards         – most booked + highest revenue boards
   GET /api/v1/analytics/bookings/avg-duration       – avg booking duration in days
   GET /api/v1/analytics/bookings/payment-methods    – BANK_TRANSFER|UPI|CARD|CASH breakdown
   GET /api/v1/analytics/bookings/cancellation-rate  – % cancelled per period
   GET /api/v1/analytics/bookings/revenue-by-company – revenue grouped by company
*/
router.get("/bookings/summary", a.getBookingsSummary);
router.get("/bookings/by-status", a.getBookingsByStatus);
router.get("/bookings/by-payment-status", a.getBookingsByPaymentStatus);
router.get("/bookings/revenue-over-time", a.getBookingsRevenueOverTime);
router.get("/bookings/top-boards", a.getTopBookedBoards);
router.get("/bookings/avg-duration", a.getBookingsAvgDuration);
router.get("/bookings/payment-methods", a.getBookingsPaymentMethods);
router.get("/bookings/cancellation-rate", a.getBookingsCancellationRate);
router.get("/bookings/revenue-by-company", a.getBookingsRevenueByCompany);

/* ─────────────────────────────────────────────────────────────────────────
   LEADS
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/leads/summary                 – total, converted, conversion rate
   GET /api/v1/analytics/leads/by-status               – NOT_STARTED|CONTACTED|…|LOST
   GET /api/v1/analytics/leads/by-source               – WEBSITE|WHATSAPP|SALES|OTHER
   GET /api/v1/analytics/leads/conversion-rate-over-time – monthly trend
   GET /api/v1/analytics/leads/by-ad-type              – IMAGE|VIDEO|POSTER|BANNER
   GET /api/v1/analytics/leads/top-boards              – boards with most leads
*/
router.get("/leads/summary", a.getLeadsSummary);
router.get("/leads/by-status", a.getLeadsByStatus);
router.get("/leads/by-source", a.getLeadsBySource);
router.get("/leads/conversion-rate-over-time", a.getLeadsConversionOverTime);
router.get("/leads/by-ad-type", a.getLeadsByAdType);
router.get("/leads/top-boards", a.getLeadsTopBoards);

/* ─────────────────────────────────────────────────────────────────────────
   BOARD LEADS
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/board-leads/summary             – total, followup rate, avg budget
   GET /api/v1/analytics/board-leads/by-status           – NEW|CONTACTED|QUALIFIED|CONFIRMED…
   GET /api/v1/analytics/board-leads/by-source           – WEBSITE|API|WHATSAPP|EMAIL…
   GET /api/v1/analytics/board-leads/by-ad-type          – IMAGE|VIDEO|POSTER|BANNER|HTML
   GET /api/v1/analytics/board-leads/budget-distribution – buckets + avg/min/max
   GET /api/v1/analytics/board-leads/follow-up-stats     – followed-up %, avg delay days
   GET /api/v1/analytics/board-leads/over-time           – ?unit=month|week|day
*/
router.get("/board-leads/summary", a.getBoardLeadsSummary);
router.get("/board-leads/by-status", a.getBoardLeadsByStatus);
router.get("/board-leads/by-source", a.getBoardLeadsBySource);
router.get("/board-leads/by-ad-type", a.getBoardLeadsByAdType);
router.get("/board-leads/budget-distribution", a.getBoardLeadsBudgetDistribution);
router.get("/board-leads/follow-up-stats", a.getBoardLeadsFollowUpStats);
router.get("/board-leads/over-time", a.getBoardLeadsOverTime);

/* ─────────────────────────────────────────────────────────────────────────
   USERS
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/users/summary           – total, with/without company, state count
   GET /api/v1/analytics/users/by-role           – count per role (ADMIN|USER|SUPER_ADMIN)
   GET /api/v1/analytics/users/by-state          – user count per state
   GET /api/v1/analytics/users/by-company        – user count per company
   GET /api/v1/analytics/users/growth-over-time  – monthly registration trend
*/
router.get("/users/summary", a.getUsersSummary);
router.get("/users/by-role", a.getUsersByRole);
router.get("/users/by-state", a.getUsersByState);
router.get("/users/by-company", a.getUsersByCompany);
router.get("/users/growth-over-time", a.getUsersGrowthOverTime);

/* ─────────────────────────────────────────────────────────────────────────
   COMPANIES
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/companies/summary               – total, avg rating, boards stats
   GET /api/v1/analytics/companies/rating-distribution   – bucket by rating band
   GET /api/v1/analytics/companies/top-rated             – ?limit=10
   GET /api/v1/analytics/companies/boards-per-company    – board count & revenue per company
*/
router.get("/companies/summary", a.getCompaniesSummary);
router.get("/companies/rating-distribution", a.getCompaniesRatingDistribution);
router.get("/companies/top-rated", a.getTopRatedCompanies);
router.get("/companies/boards-per-company", a.getCompanyBoardsDistribution);

/* ─────────────────────────────────────────────────────────────────────────
   REVIEWS
───────────────────────────────────────────────────────────────────────────
   GET /api/v1/analytics/reviews/summary      – total, avg rating, 1-5 distribution
   GET /api/v1/analytics/reviews/by-rating    – count per star value
   GET /api/v1/analytics/reviews/by-company   – avg rating per company (?sort=asc|desc)
   GET /api/v1/analytics/reviews/over-time    – monthly submission trend
*/
router.get("/reviews/summary", a.getReviewsSummary);
router.get("/reviews/by-rating", a.getReviewsByRating);
router.get("/reviews/by-company", a.getReviewsByCompany);
router.get("/reviews/over-time", a.getReviewsOverTime);

module.exports = router;
