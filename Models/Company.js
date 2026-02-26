
const mongoose = require("mongoose")

const companySchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, "name of your company ?"],
        maxLength: [25, "Please Choose Shorter name "],
        minLenght: [2, "Name is to too short"],
        trim: true
    },
    address: {
        type: String,
        required: [true, "address is required"],
        maxLength: [250, "Please Choose Shorter address "],
        minLenght: [25, "address is to too short"],
        trim: true
    },
    address2: {
        type: String,
        maxLength: [250, "Please Choose Shorter address "],
        minLenght: [50, "address is to too short"],
        trim: true
    },
    mobile: {
        type: String,
        required: [true, "Please provide commpany mobile number"]

    },
    email: {
        type: String,
        required: [true, "please provide your company email"]

    },
    // Dim
    // geo location
    review: {
        type: Number
    },
    averageReview: {
        type: Number
    },
    createdBy: {
        type: mongoose.mongo.ObjectId,
        ref: "user",
        required: [true, "Must have owner information , Please login again"]
    },

    posters: {
        type: [mongoose.mongo.ObjectId],
        ref: "poster"

    }


})

const Company = mongoose.model("company", companySchema);
module.exports = Company;





















































