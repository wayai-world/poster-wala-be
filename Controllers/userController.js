const User = require("../Models/User");
const { getOne, getAll, updateOne } = require("../utils/CRUDfactory");


exports.getUserById = getOne(User)
exports.updateUser = updateOne(User)
exports.getAllUser = getAll(User)

















