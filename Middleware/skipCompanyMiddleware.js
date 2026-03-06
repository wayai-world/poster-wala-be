const { ApiError } = require("../utils/apiHelpers");
const als = require("../utils/als"); // ✅ ADD THIS
const catchAsync = require("../utils/catchAsyncWrapper");
const { isLoggedIn } = require("./isLoggedIn");

module.exports = catchAsync(async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const whitelistedRoutes = [
    { method: "POST", url: "/api/v1/auth/signup" },
    { method: "POST", url: "/api/v1/auth/login" },
    { method: "GET", url: "/api/v1/advertising-boards/*" },
    { method: "POST", url: "/api/v1/lead" },
    { method: "GET", url: "/api/v1/advertising-boards" }

  ];

  const cleanPath = req.originalUrl.split("?")[0];

  const isWhitelisted = whitelistedRoutes.some((route) => {
    if (route.method !== req.method) return false;

    if (route.url.endsWith("/*")) {
      const base = route.url.replace("/*", "");
      const parts = cleanPath.replace(base, "").split("/").filter(Boolean);
      return cleanPath.startsWith(base) && parts.length === 1;
    } else if (route.url.includes("*")) {
      const regex = new RegExp("^" + route.url.replace(/\*/g, "[^/]+") + "$");
      return regex.test(cleanPath);
    } else {
      console.log("Comparing route.url and cleanPath:", route.url, cleanPath);
      return route.url === cleanPath;
    }
  });
  console.log("🔄is whitelisted", isWhitelisted);

  if (!authHeader && isWhitelisted) {

    console.log("isWhitelisted:", isWhitelisted);

    if (!isWhitelisted) {
      return next(
        new ApiError(401, "Unauthorized: Tenant identification required"),
      );
    }


    // ✅ REPLACE GLOBAL MONGOOSE STATE WITH ALS
    als.run(
      {
        skipCompany: true,
        skipAuth: true
      },
      () => {
        req.skipAuth = true,
          req.skipCompany = true
        next();
      },
    );

    return; // IMPORTANT: prevent double next()
  } else {
    return isLoggedIn(req, res, next);
  }



  next();
});
