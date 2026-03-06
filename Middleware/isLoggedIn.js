const jwt = require("jsonwebtoken");
const { promisify } = require('util');
const User = require("../models/User");
const catchAsync = require("../utils/catchAsyncWrapper");
const appError = require("../utils/appError");
const als = require("../utils/als");


exports.isLoggedIn = catchAsync(async (req, res, next) => {

    console.log("CAME INTO MIDDLEWARE");
    let token;
    if (req.skipAuth) {
        console.log("came in skip auth")
        return next()

    }
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        // allowing the access to the protected route if we have jwt cookie
        token = req.cookies.jwt;
    }


    if (!token) {
        return next(new appError('please login to get access', 401))
    }


    const decode = await promisify(jwt.verify)(token, process.env.JWT_SECRET_KEY)




    const freshUser = await User.findById(decode.id).setOptions({
        __skipCompany: true
    })
    // console.log("freshUser in isLoggedIn middleware:", freshUser);
    if (!freshUser) {
        return next(new appError('the user do  not exist ', 401))
    }




    if (await freshUser.changedPasswords(decode.iat)) {
        return next(new appError('password is changed need to login again', 401))
    }

    // future use 
    // console.log("user", req.user.role);
    // we meed to set it into als for future use in skipCompanyMiddleware
    // console.log("Setting user and company in ALS for isLoggedIn middleware", {
    //     user: freshUser._id,
    //     ofCompany: freshUser.ofCompany,
    //     role: freshUser.role
    // });


    als.run(
        {
            user: freshUser,
            ofCompany: freshUser.ofCompany,
            role: freshUser.role
        },
        () => {
            req.user = freshUser;
            ofCompany = freshUser.ofCompany;
            role = freshUser.role
            next();
        },
    );

    // const store = als.getStore();

    // store.user = freshUser;
    // store.ofCompany = freshUser.ofCompany;
    // store.role = freshUser.role;

    // req.user = freshUser;
    // next();



})


