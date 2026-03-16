// controllers/advertisingBoardController.js
const AdvertisingBoard = require("../models/AdvertisingBoard");
const Company = require("../models/Company");
const appError = require("../utils/appError");
const mongoose = require("mongoose");
const S3Service = require("../services/aws/s3Service");
const catchAsync = require("../utils/catchAsyncWrapper");
const { getAll, getOne, deleteOne } = require("../utils/crud");

/**
 * multer: expects req.files with fields:
 * - coverImage (single)
 * - images (multiple)
 *
 * In routes: use multer.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'images', maxCount: 10 }])
 *
 * This controller expects file buffers in req.files (memory storage).
 */

/**
 * createAdvertisingBoard
 * Uploads coverImage + images to S3, saves keys & urls to DB.
 */
exports.createAdvertisingBoard = catchAsync(async (req, res, next) => {
    const {
        name,
        description,
        type,
        dimensions,
        pricing,
        location,
        isDigital,
        screenResolution,
        brightnessNits,
        populationK,
        estimatedFootfallPerDay,
        tags,
        contact
    } = req.body;
    console.log("Creating board with data:", req.body)

    // Helper to safely parse JSON strings if needed
    // Handles nested/escaped quotes by repeatedly parsing until stable
    const tryParse = (val) => {
        if (typeof val !== "string") return val;
        let trimmed = val.trim();
        if (trimmed === "") return "";

        let prev = "";
        let iterations = 0;
        const maxIterations = 10; // prevent infinite loops

        while (trimmed !== prev && iterations < maxIterations) {
            prev = trimmed;
            iterations++;

            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed !== "string") return parsed;
                trimmed = parsed;
            } catch (e) {
                // If JSON.parse fails, check if it's a quoted string we can unquote
                if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                    (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                    trimmed = trimmed.slice(1, -1);
                } else {
                    break;
                }
            }
        }

        return trimmed;
    };

    // Coerce/normalize common fields that may arrive as JSON-strings
    const _name = tryParse(name);
    const _type = tryParse(type);
    const _dimensions = tryParse(dimensions);
    const _pricing = tryParse(pricing);
    const _location = tryParse(location);
    const _contact = tryParse(contact);
    const _tags = tryParse(tags);
    const _isDigital = (typeof isDigital === "boolean") ? isDigital : (String(isDigital).toLowerCase() === "true");
    const _populationK = (typeof populationK === "undefined" || populationK === null) ? populationK : Number(populationK);
    const _estimatedFootfallPerDay = (typeof estimatedFootfallPerDay === "undefined" || estimatedFootfallPerDay === null) ? estimatedFootfallPerDay : Number(estimatedFootfallPerDay);

    console.log("Received create board request with body:", req.user);

    if (!req?.user?.ofCompany) {
        return next(new appError("please register your company on our site", 400));
    }

    const company = await Company.findById(req.user.ofCompany).setOptions({ __skipCompany: true });
    if (!company) {
        return next(new appError("company not found; please register your company", 400));
    }

    if (!_name === undefined || !_type === undefined) {
        // noop to keep lint happy
    }
    if (!_name || !_type || !_dimensions || !_dimensions.widthMeters || !_dimensions.heightMeters) {
        return next(new appError("Missing required board name/type/dimensions", 400));
    }

    // prepare availability same as before (you can import helper generateDailySlots or reuse previous code)
    let availabilitySlots = req.body.availability;
    if (!Array.isArray(availabilitySlots) || availabilitySlots.length === 0) {
        // fallback: generate 10 daily slots from tomorrow
        const generateDailySlots = (fromDate = new Date(), n = 10, price = (pricing && pricing.baseRate) || 0, currency = (pricing && pricing.currency) || "INR") => {
            const slots = [];
            let d = new Date(fromDate);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 1);
            for (let i = 0; i < n; i++) {
                const start = new Date(d);
                const end = new Date(d);
                end.setDate(end.getDate() + 1);
                end.setMilliseconds(end.getMilliseconds() - 1);
                slots.push({
                    startDate: start,
                    endDate: end,
                    price,
                    currency,
                    isAvailable: true
                });
                d.setDate(d.getDate() + 1);
            }
            return slots;
        };
        availabilitySlots = generateDailySlots(new Date(), 10, (pricing && pricing.baseRate) || 0);
    }

    // handle files: req.files expected (multer memoryStorage)
    const files = req.files || {};
    // coverImage: single
    let coverImageObj = null;
    if (files.coverImage && files.coverImage.length > 0) {
        const f = files.coverImage[0];
        const uploaded = await S3Service.uploadFile(f.buffer, f.originalname, f.mimetype, "advertising-boards");
        coverImageObj = { url: uploaded.url, key: uploaded.key };
    }

    // images: multiple
    const imagesArr = [];
    if (files.images && files.images.length > 0) {
        for (const f of files.images) {
            const uploaded = await S3Service.uploadFile(f.buffer, f.originalname, f.mimetype, "advertising-boards");
            imagesArr.push({ url: uploaded.url, key: uploaded.key });
        }
    }


    const board = await AdvertisingBoard.create({
        name: _name,
        description: tryParse(description),
        type: _type,
        dimensions: _dimensions,
        pricing: _pricing,
        location: _location,
        isDigital: !!_isDigital,
        screenResolution,
        brightnessNits,
        coverImage: coverImageObj,
        images: imagesArr,
        availability: availabilitySlots,
        populationK: _populationK,
        estimatedFootfallPerDay: _estimatedFootfallPerDay,
        tags: Array.isArray(_tags) ? _tags : (_tags ? (typeof _tags === 'string' ? String(_tags).split(",").map(t => t.trim()) : []) : []),
        contact: _contact,
        createdBy: req.user._id,
        ofCompany: req.user.ofCompany
    });

    // push to company.boards if applicable
    if (company.boards && Array.isArray(company.boards)) {
        company.boards.push(board._id);
        await company.save();
    }

    res.status(201).json({ status: true, data: board, msg: "Advertising board created with images uploaded to S3" });
});

/**
 * updateBoard
 * - accepts new coverImage and/or images in req.files (multer memoryStorage)
 * - accepts removeImageKeys: JSON array of image keys to remove from DB and S3
 * - if new coverImage provided, replaces the old one in S3 and DB
 */
exports.updateBoard = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new appError("Invalid id", 400));
    }

    const board = await AdvertisingBoard.findById(id);
    if (!board) return next(new appError("Board not found", 404));

    /* =====================================================
       🔧 SANITIZER — handles FormData & bad values
    ===================================================== */
    const sanitize = (val) => {
        if (val === undefined || val === null) return undefined;

        if (typeof val === "string") {
            let v = val.trim();

            // ignore invalid string values
            if (v === "" || v === "undefined" || v === "null") return undefined;

            // remove wrapping quotes repeatedly
            while (
                (v.startsWith('"') && v.endsWith('"')) ||
                (v.startsWith("'") && v.endsWith("'"))
            ) {
                v = v.slice(1, -1).trim();
            }

            // try JSON parse
            try {
                const parsed = JSON.parse(v);
                return parsed;
            } catch { }

            return v;
        }

        return val;
    };

    const files = req.files || {};

    /* =====================================================
       1️⃣ Cover Image Replacement
    ===================================================== */
    if (files.coverImage?.length) {
        const f = files.coverImage[0];
        const oldKey = board.coverImage?.key || null;

        const uploaded = await S3Service.replaceFile(
            f.buffer,
            f.originalname,
            f.mimetype,
            oldKey,
            "advertising-boards"
        );

        board.coverImage = { url: uploaded.url, key: uploaded.key };
    }

    /* =====================================================
       2️⃣ Upload New Images
    ===================================================== */
    if (files.images?.length) {
        for (const f of files.images) {
            const uploaded = await S3Service.uploadFile(
                f.buffer,
                f.originalname,
                f.mimetype,
                "advertising-boards"
            );
            board.images.push({ url: uploaded.url, key: uploaded.key });
        }
    }

    /* =====================================================
       3️⃣ Remove Images
    ===================================================== */
    let removeImageKeys = sanitize(req.body.removeImageKeys);

    if (removeImageKeys) {
        if (typeof removeImageKeys === "string") {
            removeImageKeys = removeImageKeys.split(",").map((k) => k.trim());
        }

        if (Array.isArray(removeImageKeys)) {
            for (const key of removeImageKeys) {
                try {
                    await S3Service.deleteFile(key);
                } catch { }
            }

            board.images = board.images.filter(
                (img) => !removeImageKeys.includes(img.key)
            );
        }
    }

    /* =====================================================
       4️⃣ Field Update Logic (Safe & Stable)
    ===================================================== */
    const objectFields = ["dimensions", "pricing", "location", "contact"];
    const arrayFields = ["tags", "availability"];
    const enumFields = ["type", "orientation"];

    const mutableFields = [
        "name",
        "description",
        "type",
        "dimensions",
        "pricing",
        "location",
        "isDigital",
        "screenResolution",
        "brightnessNits",
        "populationK",
        "estimatedFootfallPerDay",
        "tags",
        "contact",
        "availability",
        "isActive",
        "isPublished",
        "orientation",
    ];

    for (const field of mutableFields) {
        if (!(field in req.body)) continue;

        let value = sanitize(req.body[field]);

        // Skip invalid values
        if (value === undefined) continue;

        /* ---------- ENUM FIELDS ---------- */
        if (enumFields.includes(field)) {
            if (typeof value === "string") value = value.trim();
        }

        /* ---------- OBJECT FIELDS ---------- */
        if (objectFields.includes(field)) {
            if (typeof value === "string") {
                try {
                    value = JSON.parse(value);
                } catch {
                    continue; // skip invalid object
                }
            }

            if (typeof value !== "object" || Array.isArray(value)) continue;
        }

        /* ---------- ARRAY FIELDS ---------- */
        if (arrayFields.includes(field)) {
            if (typeof value === "string") {
                try {
                    value = JSON.parse(value);
                } catch {
                    value = value.split(",").map((v) => v.trim());
                }
            }

            if (!Array.isArray(value)) continue;
        }

        board[field] = value;
    }

    /* =====================================================
       Save Document
    ===================================================== */
    await board.save();

    /* =====================================================
       Stable Response Shape
    ===================================================== */
    res.status(200).json({
        status: "success",
        data: board,
        msg: "Board updated successfully",
    });
});


exports.getAllBoards = getAll(AdvertisingBoard);
exports.getBoardById = getOne(AdvertisingBoard);
exports.deleteBoardById = deleteOne(AdvertisingBoard);
