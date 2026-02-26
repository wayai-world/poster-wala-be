const Company = require("../Models/Company");
const User = require("../Models/User");
const appError = require("../utils/appError");
const catchAsync = require("../utils/catchAsyncWrapper");
const { updateOne, getOne, getAll, deleteOne } = require("../utils/CRUDfactory");

exports.createCompany = catchAsync(async (req, res, next) => {
    const user = req?.user;
    const {
        name,
        address,
        address2,
        mobile,
        email,
    } = req.body;
    const company = await Company.create({
        name,
        address,
        address2,
        mobile,
        email,
        createdBy: user._id
    })

    if (!company) {
        return next(new appError("please Try again , something went wrong", 500))
    }

    await User.findByIdAndUpdate(user?._id, {
        company: company._id
    })



    res.status(200).send({
        status: true,
        msg: "Company created successfully"
    })
})

exports.updateCompany = updateOne(Company)

exports.getCompany = getOne(Company)
// exports.deleteCompany

exports.getAllCompany = getAll(Company)

exports.deleteCompany = deleteOne(Company)




















