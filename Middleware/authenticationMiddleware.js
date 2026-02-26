const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const { asyncHandler, ApiError } = require("../utils/apiHelpers");
const User = require("../Models/User");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const als = require("../utils/als");

exports.verifyAuth = asyncHandler(async (req, res, next) => {
  let token;
  // console.log(
  //   "Headers received in verifyAuth:",
  //   req.headers,
  //   req.headers["x-tenant-id"],
  // );

  // skip if it is whitelisted public route
  if (req.skipAuthMiddleware) {
    console.log("Skipping verifyAuth due to skipAuthMiddleware flag");
    return next();
  }

  //changed made by bhavesh for verifying the apikeys
  // if (
  //   req.headers["x-tenant-id"] &&
  //   req.headers["x-api-key"] &&
  //   req.headers["x-api-key"] === process.env.LMS_API_KEY
  // ) {
  //   // console.log("came for verify", req.headers);
  //   // console.log("came into and skip");
  //   req.skipRoleMiddleware = true;
  //   req.tenantId = req.headers["x-tenant-id"];
  //   // mongoose.Query.prototype.setOptions({
  //   //   __tenant: req.headers["x-tenant-id"],
  //   //   setFromMiddleware: true,
  //   // });
  //   return als.run(
  //     {
  //       tenantId: req.headers["x-tenant-id"],
  //       setFromApiKey: true,
  //     },
  //     () => next(),
  //   );
  //   // console.log(
  //   //   "options after verify auth are",
  //   //   mongoose.Query.prototype.getOptions()
  //   // );

  //   // return next();
  // }

  // console.log("🔐 Running verifyAuth");

  // Extract token from Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // Or Extract token from cookies
  else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new ApiError(401, "Please log in to access this resource."));
  }

  // Decode JWT
  const decodedToken = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET,
  );

  // console.log("Decoded Token:", decodedToken);

  if (!decodedToken.tenantId) {
    // 🔥 Ensure JWT includes tenantId at login time
    return next(new ApiError(401, "Tenant ID missing in token!"));
  }

  const tenantId = decodedToken.tenantId;

  // Attach tenant to Mongoose Query options BEFORE any DB queries
  // mongoose.Query.prototype.setOptions({
  //   __tenant: tenantId,
  //   setFromAuth: true,
  // });

  // Load fresh user from database
  let user = await User.findById(decodedToken.id)
    .populate({
      path: "role",
      options: { __tenant: tenantId },
    })
    .setOptions({
      __tenant: tenantId,
    });

  // console.log("User Found:", user);

  if (!user) {
    return next(new ApiError(401, "User no longer exists."));
  }

  // Check if password changed after token issue time
  const isPasswordChanged = await user.changedPasswords(decodedToken.iat);
  if (isPasswordChanged) {
    return next(
      new ApiError(401, "Password changed recently. Please log in again."),
    );
  }

  // Attach user to request
  req.user = user;
  req.tenantId = user.tenantId; // helpful for logging and future middleware

  // now we need to add __user in mongosse option also
  // mongoose.Query.prototype.setOptions({
  //   ...{ ...mongoose.Query.prototype.getOptions() },
  //   __user: user,
  // });
  als.run(
    {
      tenantId,
      user,
    },
    () => next(),
  );

  // console.log(
  //   "options after verify auth are",
  //   mongoose.Query.prototype.getOptions()
  // );
  console.log("Headers received in verifyAuth: corssed");
});
