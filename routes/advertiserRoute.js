// routes/advertisingBoards.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const advertisingBoardController = require("../controllers/advertisingBoardController");
const { isLoggedIn } = require("../Middleware/isLoggedIn");
const skipCompanyMiddleware = require("../Middleware/skipCompanyMiddleware");
// const auth = require("../middleware/auth"); // your auth middleware

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(skipCompanyMiddleware);
// For create: accept coverImage (single) and images (multiple)
router.post(
    "/",
    upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "images", maxCount: 10 }]),
    isLoggedIn,
    advertisingBoardController.createAdvertisingBoard
);

// For update: same
router.patch(
    "/:id",
    upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "images", maxCount: 10 }]),
    isLoggedIn,
    advertisingBoardController.updateBoard
);

router.get("/", isLoggedIn, advertisingBoardController.getAllBoards);
router.get("/:id", isLoggedIn, advertisingBoardController.getBoardById);
router.delete("/:id", isLoggedIn, advertisingBoardController.deleteBoardById);

module.exports = router;