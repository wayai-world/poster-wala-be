const User = require("../models/User");
const appError = require("../utils/appError");
const { getOne, getAll, updateOne } = require("../utils/crud");

exports.includeMeMiddleware = (req, res, next) => {
    req.params.id = req.user.id;
    next();
}

exports.getUserById = getOne(User)
exports.updateUser = updateOne(User)
exports.getAllUser = getAll(User)

exports.updatePasswordByVerifyingCurrentPassword = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return next(new appError("Please provide current and new password", 400))
    }
    const user = await User.findById(req.user.id).select("+password");

    if (!user || !(await user.correctPass(currentPassword, user.password))) {
        return next(new appError("Your current password is wrong", 401))
    }

    user.password = newPassword;
    await user.save();
    res.status(200).json({
        status: "success",
        data: null
    })
}















