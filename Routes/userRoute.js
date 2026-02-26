const express = require('express');
const { updateUser, getUserById } = require('../Controllers/userController');
const Router = express.Router()

Router.route("/").patch(updateUser)
Router.route("/:id").get(getUserById)


module.exports = Router;









