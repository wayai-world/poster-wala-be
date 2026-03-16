const express = require("express");
const { login, signUp, forgotPassword, resetPassword, saveDeviceToken, sendNotification } = require("../controllers/authController");
const skipCompanyMiddleware = require("../Middleware/skipCompanyMiddleware");
const { isLoggedIn } = require("../Middleware/isLoggedIn");

const authRouter = express.Router()



authRouter.post('/login', skipCompanyMiddleware, login)
authRouter.post('/signup', skipCompanyMiddleware, signUp)
authRouter.post('/forgotPassword', forgotPassword)
authRouter.patch('/resetPassword/:token', resetPassword)
authRouter.post("/send-notification", skipCompanyMiddleware, sendNotification)

authRouter.use(isLoggedIn)
authRouter.post('/save-device-token', saveDeviceToken)






module.exports = authRouter;
















