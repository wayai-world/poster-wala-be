
const mongoose = require("mongoose")
const { ROLES } = require("../constants/constants")

const roleSchema = mongoose.Schema({

    name: {
        type: String,
        required: true,
        unique: true,
        enum: [ROLES.ADMIN, ROLES.USER, ROLES.SUPER_ADMIN]
    },
    description: {
        type: String
    },




})

const Role = mongoose.model("role", roleSchema);
module.exports = Role;





















































