
const express = require("express");
const { createCompany, updateCompany, getCompany, getAllCompany, deleteCompany } = require("../controllers/companyController");
const { isLoggedIn } = require("../Middleware/isLoggedIn");
const giveAccess = require("../Middleware/giveAccessTo");
const Router = express.Router()

Router.use(isLoggedIn)

Router.route('/')
    .get(getAllCompany) // Fetch all companies
    .post(giveAccess("ADVERTISER"), createCompany); // Create a new company

Router.route('/:id')
    .get(getCompany) // Fetch a single company by ID
    .patch(giveAccess(["ADVERTISER"]), updateCompany) // Update a company by ID
    .delete(giveAccess(["ADVERTISER"]), deleteCompany); // Delete a company by ID








module.exports = Router;
















