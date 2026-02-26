const mongoose = require("mongoose");
// const connectDB = require("../config/db");

class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = ""
  ) {
    // next( new apiError(400,"nkjnfdas",))
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      success: this.success,
      message: this.message,
      errors: this.errors,
      data: this.data,
    };
  }
}

class ApiResponse {
  constructor(statusCode, data, message = "Success", count = 1) {
    this.statusCode = statusCode;
    this.count = count;
    this.message = message;
    this.success = statusCode < 400; // any HTTP status below 400 is considered success
    this.data = data;
  }
}

// const asyncHandler = (requestHandler) => {
//   return async (req, res, next) => {
//     try {
//       if (mongoose.connection.readyState !== 1) {
//         console.log("Reconnecting to database...");
//         await connectDB();
//       }
//       await requestHandler(req, res, next);
//     } catch (error) {
//       next(error);
//     }
//   };
// };

module.exports = { ApiResponse, ApiError };
