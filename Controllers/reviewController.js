const Poster = require("../Models/AdvertisingBoard");
const Review = require("../Models/Review");
const appError = require("../utils/appError");
const catchAsync = require("../utils/catchAsyncWrapper");
const { createOne, getAll, deleteOne } = require("../utils/CRUDfactory");

exports.createReview = catchAsync(async (req, res, next) => {
    if (!req.params?.id) {
        return next(new appError("please try again ", 400))
    }
    const {
        rating,
        message
    } = req.body;
    if (!rating || !message) {
        return next(new appError("please provide entire data to create review", 400))
    }
    const poster = await Poster.findById(req.params?.id);

    if (!poster) {
        return next(new appError("No data found please try again", 400))

    }
    const review = await Review.create({
        createdBy: req.user?._id,
        rating,
        message,
    })
    poster.review = review._id;

    poster.reviewCount = poster.reviewCount + 1;
    poster.totalRatingCount = poster.totalRatingCount + rating;

    await poster.save()

    res.status(201).send({
        status: true,
        msg: "Review Created "
    })
})



exports.getAllReview = getAll(Review);



exports.checkUserDeletingReview = catchAsync(async (req, res, next) => {

    if (req.params?.id) {
        next(new appError("please pass entire data", 400))
    }


    const review = await Review.findById(req.params?.id);

    if (review.createdBy != req.user._id) {
        return next(new appError("You are not creator of this review", 400))
    }

    next()
})
exports.deleteReview = deleteOne(Review)

















