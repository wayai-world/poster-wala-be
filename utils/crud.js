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


exports.getOne = (Model) => {
    return catchAsync(async (req, res, next) => {

        if (!req.params?.id) {
            return next(new appError("Please provide valid/entire data", 400
            ))
        }

        const doc = await Model.findById(req.params.id);
        if (!doc) return next(new appError("data not found.", 400
        ))

        res.status(200).json({
            status: "success",
            data: doc
        });



    })
}


exports.getAll = (Model) => {
    return catchAsync(async (req, res, next) => {

        // we need to delete empty objects from the query
        Object.keys(req.query).forEach(key => {
            if (req.query[key] === "") {
                delete req.query[key];
            }
        });

        const builder = new QueryBuilder(
            Model.find(),   // tenant automatically injected
            req.query,
            Model.schema
        )
            .filter()
            .sort()
            .fields()
            .pagination()
            .populate();

        const data = await builder.query;

        res.status(200).json({
            status: "success",
            data: data
        });



    })
}









