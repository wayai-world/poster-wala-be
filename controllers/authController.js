const User = require("../models/User");
const appError = require("../utils/appError");
const catchAsync = require("../utils/catchAsyncWrapper");
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require("../utils/sendMail");
const Role = require("../models/Roles");
const Company = require("../models/Company");
const { default: mongoose } = require("mongoose");
const { ROLES, MODULES, MESSAGES, STATUS_CODES } = require("../constants/constants");
const admin = require('./../firebase');
const MAX_MULTICAST = 500; // FCM sendMulticast limit


function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}


const createTokenSendRes = (id, res, statusCode, data) => {

    let token = jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRIR_IN
    });
    let cookieOptions = {
        expires: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
        ),


        // secure: true,
        httpOnly: true,
        // sameSite: "None",
        path: "/",
    };
    if (process.env.NODE_ENV == 'production') {

        cookieOptions.secure = true
    }
    res.cookie('jwt', token, cookieOptions);

    // we will set cookies 
    res.status(statusCode).json({
        status: true,
        data,
        token

    })
}


exports.login = catchAsync(async (req, res, next) => {

    const { email, password } = req.body;


    if (!email || !password) {
        return next(new appError("please enter credential for get into in ", 400));
    }

    const user = await User.findOne({ email }).select('+password').populate({
        path: "ofCompany",
        options: { __skipCompany: true }
    })


    if (!user || !await user.correctPass(password, user.password)) {

        return next(new appError("please enter valid email id and password", 400));
    }
    user.password = undefined
    createTokenSendRes(user.id, res, 200, { user, company: user?.company || {} })

})


exports.signUp = catchAsync(async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
        let createdUser;
        let createdCompany;

        await session.withTransaction(async () => {
            const {
                name,
                email,
                mobile,
                state,
                district,
                pinCode,
                password,
                addressLine1,

                // company details
                companyName,
                companyDescription,
                companyAddress,
                address2,
                companyMobile,
                companyEmail
            } = req.body;

            // ✅ Validation
            if (
                !name ||
                !email ||
                !mobile ||
                !state ||
                !district ||
                !pinCode ||
                !password ||
                !addressLine1
            ) {
                throw new appError("Please fill all the fields", 400);
            }

            // ✅ Prevent duplicate users
            const existingUser = await User.findOne({ email }).session(session).setOptions({
                __skipCompany: true
            });
            if (existingUser) {
                throw new appError("User already exists", 400);
            }

            // ✅ Fetch role
            const roleDoc = await Role.findOne({ name: ROLES.USER }).session(session);
            if (!roleDoc) {
                throw new appError(MESSAGES.NOT_FOUND(MODULES.ROLE), 500);
            }

            // ✅ Create user
            const [user] = await User.create(
                [
                    {
                        fullName: name,
                        email,
                        mobile,
                        state,
                        district,
                        pinCode,
                        addressLine1,
                        password,
                        role: roleDoc._id
                    }
                ],
                { session }
            );

            // ✅ Create company
            const [company] = await Company.create(
                [
                    {
                        name: companyName,
                        description: companyDescription,
                        address: companyAddress,
                        address2,
                        mobile: companyMobile,
                        email: companyEmail,
                        createdBy: user._id
                    }
                ],
                { session }
            );

            // ✅ Link company to user
            user.ofCompany = company._id;
            // set option to skip company population in pre save hook

            await user.save({ session, validateBeforeSave: false });

            createdUser = user;
            createdCompany = company;
        });

        // ✅ Transaction committed successfully
        session.endSession();

        createdUser.password = undefined;

        createTokenSendRes(
            createdUser._id,
            res,
            STATUS_CODES.OK,
            { user: createdUser, company: createdCompany }
        );

    } catch (err) {
        session.endSession();
        next(err);
    }
});




exports.forgotPassword = catchAsync(async (req, res, next) => {

    const { email } = req.body;
    if (!email) {
        return next(new appError("please enter email for changing the password", 400));
    }

    // we need to find the user from DB and set password reset token in enc format
    const user = await User.findOne({ email })
    if (!user) {
        return next(new appError("user do not exist with this mail ID,please register with your mail ID", 400));
    }

    try {
        const token = user.setPasswordRestToken();
        console.log(token);
        let message = `to reset the passwored click heare ${req.protocol}://${req.hostName}/api/v1/resetPassword/${token} `;

        console.log("the token is ", token);
        // saving the user to database
        await user.save({ validateBeforeSave: false })
        // we will send the message of route and token on email address and 
        await sendEmail()
    } catch (error) {
        console.log(error);
        user.passwordResetToken = undefined;
        user.expiresIn = undefined;
        await user.save();
        return next(new appError("please try to change the password after some time", 404))
    }


    res.status(200).json({
        status: 'success',
        message: "check your email to reset password !!"
    })




})




exports.resetPassword = catchAsync(async (req, res, next) => {
    const password = req.body.password;
    const passwordConfirm = req.body.passwordConfirm;
    if (!password) {
        return next(new appError("please enter password to be set", 400))
    }
    let token = req.params.token;


    // we need to create hash and then find it in database 

    token = crypto.createHash('sha256').update(token).digest('hex');
    let user = await User.findOne({
        passwordResetToken: token, passwordExpires: { $gt: Date.now() }
    })

    if (!user) {
        return next(new appError("please enter valid token or token has been expired", 400))
    }

    user.password = password;

    user.passwordResetToken = undefined;
    user.passwordExpires = undefined;

    await user.save();

    createTokenSendRes(user._id, res, 200, "your password is changed")









})


exports.saveDeviceToken = catchAsync(async (req, res, next) => {
    const { deviceToken, platform } = req.body;
    if (!deviceToken) return next(new appError("Missing deviceToken", 400));

    let user = await User.findById(req.user.id);

    if (!user) {
        return next(new appError("user not found", 404));
    }

    // avoid duplicates
    if (!user.deviceTokens.some(t => t.token === deviceToken)) {
        user.deviceTokens.push({ token: deviceToken, platform });
        await user.save();
    }

    return res.status(200).json({
        status: 'success',
        message: "device token saved successfully"
    });

})



// Send notification via Firebase Admin (multicast with token cleanup)
exports.sendNotification = async (req, res) => {
    try {
        const { userId, title, body, data } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({
                success: false,
                message: 'userId, title and body are required',
            });
        }

        // 1) Find user
        const user = await User.findById(userId);

        if (!user || !user.deviceTokens?.length) {
            return res.status(404).json({
                success: false,
                message: 'No device tokens found for user',
            });
        }

        // 2) Collect tokens
        const tokens = user.deviceTokens.map((d) => d.token).filter(Boolean);

        if (!tokens.length) {
            return res.status(400).json({
                success: false,
                message: 'No valid device tokens to send',
            });
        }

        // 3) Chunk tokens by MAX_MULTICAST (500)
        const chunks = chunkArray(tokens, MAX_MULTICAST);

        const results = {
            successCount: 0,
            failureCount: 0,
            responses: [],
        };

        // Keep track of tokens to remove (invalid / unregistered)
        const tokensToRemove = new Set();

        // 4) Send each chunk
        for (const chunk of chunks) {
            const message = {
                tokens: chunk,
                notification: {
                    title,
                    body,
                },
                data: data || {},
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                        },
                    },
                },
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            results.successCount += response.successCount;
            results.failureCount += response.failureCount;
            results.responses.push(response);

            // 5) Inspect responses and mark tokens to remove if unregistered / invalid
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const err = resp.error;
                    const token = chunk[idx];
                    // Common error codes: messaging/registration-token-not-registered, messaging/invalid-registration-token
                    if (err) {
                        console.warn('FCM send error for token', token, err.code, err.message);
                        if (
                            err.code === 'messaging/registration-token-not-registered' ||
                            err.code === 'messaging/invalid-registration-token' ||
                            err.code === 'messaging/invalid-argument'
                        ) {
                            tokensToRemove.add(token);
                        }
                    }
                }
            });
        }

        // 6) Remove invalid tokens from user.deviceTokens
        if (tokensToRemove.size > 0) {
            user.deviceTokens = user.deviceTokens.filter((d) => !tokensToRemove.has(d.token));
            await user.save();
            console.log('Removed invalid tokens:', Array.from(tokensToRemove));
        }

        return res.status(200).json({
            success: true,
            message: 'Notification send attempted',
            successCount: results.successCount,
            failureCount: results.failureCount,
            details: results.responses,
        });
    } catch (error) {
        console.error('Send notification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send notification',
            error: error.message,
        });
    }
};