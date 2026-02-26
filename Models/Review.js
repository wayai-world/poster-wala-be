
const mongoose = require("mongoose")

const reviewSchema = mongoose.Schema({

    createdBy: {
        type: mongoose.mongo.ObjectId,
        ref: "user",
        required: [true, "Must have owner information , Please login again"]
    },
    rating: {
        type: Number,
        required: [true, "must have some rating "]
    },
    message: {
        type: String
    },
    ofCompany: {
        type: mongoose.mongo.ObjectId,
        ref: "company"
    }



})

const Review = mongoose.model("review", reviewSchema);
module.exports = Review;





















































