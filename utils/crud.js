const { default: mongoose } = require("mongoose");
const appError = require("./appError");
const catchAsync = require("./catchAsyncWrapper");
const QueryBuilder = require("./queryBuilder");

exports.deleteOne = (Model) => {
    return catchAsync(async (req, res, next) => {
        if (!req.params?.id) {
            return next(new appError("Please provide valid/entire data", 400
            ))
        }
        const doc = await Model.findByIdAndDelete(req.params.id)
        if (!doc) {
            return next(new appError('no data found   ', 404))
        }
        res.status(200).json({
            status: "success",
            data: null

        })
    })
}


exports.updateOne = (Model) => {
    return catchAsync(async (req, res, next) => {
        if (!req.params?.id) {
            return next(new appError("Please provide valid/entire data", 400
            ))
        }
        const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
            runValidators: true,
            new: true
        })

        if (!doc) {
            return next(new appError('data not found ', 404))
        }


        res.status(200).json({
            status: "success",
            data: {
                data: doc
            }

        })

    })
}


exports.createOne = (Model) => {
    return catchAsync(async (req, res, next) => {

        const doc = await Model.create(req.body);

        res.status(201).json({
            status: "success",
            data: {
                data: doc
            }
        });



    })
}


exports.getOne = (Model) =>
    catchAsync(async (req, res, next) => {
        let { id } = req.params;
        if (id === "me") {
            id = req.user.id;
        }

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return next(new appError("Invalid or missing ID.", 400));
        }

        const populateParams = req.query.populate?.split(",") || [];
        const selectFields =
            req.query.selectPopulate?.split(",").join(" ") || "-__v";

        let query = Model.findById(id);
        // let query = Model.findById(id )

        // 🧩 Dynamically handle nested populate
        const buildPopulate = (pathStr) => {
            const parts = pathStr.split(".");
            if (parts.length === 1) {
                return { path: parts[0], select: selectFields };
            }

            // Recursively build nested populate objects
            let populate = { path: parts.pop(), select: selectFields };
            while (parts.length) {
                populate = { path: parts.pop(), populate, select: selectFields };
            }
            return populate;
        };

        // Apply all populates dynamically
        for (const p of populateParams) {
            query = query.populate(buildPopulate(p));
        }

        const data = await query;



        if (!data) {
            return next(new appError("Data not found.", 404));
        }

        res.status(200).json({
            status: "success",
            data,
        });
    });


/**
 * Get all documents for the given model, with filtering, sorting, field selection, pagination, and population.
 * @param {mongoose.Model} Model - Mongoose model to query.
 * @returns {Function} Express middleware.
 */
exports.getAll = (Model) =>
    catchAsync(async (req, res, next) => {
        // Remove empty query parameters
        Object.keys(req.query).forEach((key) => {
            if (!req.query[key]) {
                delete req.query[key];
            }
        });

        // Build query features
        let features = new QueryBuilder(
            Model.find({}),
            req.query,
            Model.schema,
        )
            .filter()
            .sort()
            .fields()
            .pagination()
            .populate()

        // execute actions

        // Get total count for pagination

        // Execute query
        let data = await features.query;
        let count = await features?.totalResult.countDocuments() || data.length;

        const action = req.query.action;


        if (!data) {
            return next(new appError("failed to get all the data !!", 404));
        }
        // Send success response
        // res.json(
        //   new ApiResponse(
        //     200,
        //     data,
        //     MESSAGE_TEMPLATES.FETCH_SUCCESS(Model.modelName),
        //     count,
        //   ),
        // );
        res.status(200).json({
            status: "success",
            results: count,
            data,
        });
    });









