const User = require("../models/User");
const { getOne, getAll, updateOne } = require("../utils/crud");


exports.getUserById = getOne(User)
exports.updateUser = updateOne(User)
exports.getAllUser = getAll(User)

















