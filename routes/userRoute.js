const express = require('express');
const { updateUser, getUserById, includeMeMiddleware, updatePasswordByVerifyingCurrentPassword } = require('../controllers/userController');
const { isLoggedIn } = require('../Middleware/isLoggedIn');
const Router = express.Router()

Router.use(isLoggedIn)
Router.use(includeMeMiddleware)
Router.route("/:id").get(getUserById)
Router.route("/operation/update-password").post(updatePasswordByVerifyingCurrentPassword)
// Router.route("/").patch(updateUser)


module.exports = Router;









