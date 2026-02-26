
const express = require("express");
const { createCompany, updateCompany, getCompany, getAllCompany, deleteCompany } = require("../controllers/companyController");
const { isLoggedIn } = require("../Middleware/isLoggedIn");
const giveAccess = require("../Middleware/giveAccessTo");
const { createReview, getAllReview, checkUserDeletingReview } = require("../controllers/reviewController");
const Router = express.Router()

Router.use(isLoggedIn)

Router.route('/')
    .get(getAllReview)
    .post(giveAccess("USER"), createReview); // Create a new review

Router.route('/:id')
    .delete(giveAccess(["USER"]), checkUserDeletingReview, deleteCompany); // Delete a company by ID








module.exports = Router;
















