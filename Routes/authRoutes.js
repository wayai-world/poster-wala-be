const express = require("express");
const { login, signUp, forgotPassword, resetPassword } = require("../Controllers/authController");
const skipCompanyMiddleware = require("../Middleware/skipCompanyMiddleware");

const Router = express.Router()



Router.post('/login', skipCompanyMiddleware, login)
Router.post('/signup', skipCompanyMiddleware, signUp)
Router.post('/forgotPassword', forgotPassword)
Router.patch('/resetPassword/:token', resetPassword)







module.exports = Router;
















