/**
 * Advanced Query Builder for Mongoose
 * Supports filtering, sorting, pagination, populate & operators
 */

class QueryBuilder {
    constructor(query, queryStr, schema) {
        this.originalOptions = query.getOptions(); // preserve tenant options
        this.query = query;
        this.queryStr = queryStr;
        this.schema = schema; // e.g. User.schema
    }

    // -------------------- HELPERS --------------------

    isDateString(value) {
        return !isNaN(Date.parse(value));
    }

    castValue(val) {
        if (Array.isArray(val)) return val.map((v) => this.castValue(v));
        if (!isNaN(val) && val !== "") return Number(val);
        if (this.isDateString(val)) return new Date(val);
        if (val === "true") return true;
        if (val === "false") return false;
        return val;
    }

    getFieldType(field) {
        try {
            return this.schema?.path(field)?.instance || "Mixed";
        } catch {
            return "Mixed";
        }
    }

    // -------------------- CONDITION BUILDER --------------------

    buildCondition(field, operator, value) {
        switch (operator) {
            // Comparison
            case "eq":
                return { [field]: this.castValue(value) };
            case "ne":
                return { [field]: { $ne: this.castValue(value) } };
            case "gt":
                return { [field]: { $gt: this.castValue(value) } };
            case "gte":
                return { [field]: { $gte: this.castValue(value) } };
            case "lt":
                return { [field]: { $lt: this.castValue(value) } };
            case "lte":
                return { [field]: { $lte: this.castValue(value) } };

            case "between": {
                const [min, max] = value.split(",");
                return {
                    [field]: {
                        $gte: this.castValue(min),
                        $lte: this.castValue(max),
                    },
                };
            }

            // String operators
            case "contains":
                return { [field]: { $regex: value, $options: "i" } };

            case "ncontains":
                return { [field]: { $not: { $regex: value, $options: "i" } } };

            case "startsWith":
                return { [field]: { $regex: `^${value}`, $options: "i" } };

            case "endsWith":
                return { [field]: { $regex: `${value}$`, $options: "i" } };

            // Array operators
            case "in":
                return { [field]: { $in: this.castValue(value.split(",")) } };

            case "nin":
                return { [field]: { $nin: this.castValue(value.split(",")) } };

            case "all":
                return { [field]: { $all: this.castValue(value.split(",")) } };

            case "size":
                return { [field]: { $size: parseInt(value) } };

            // Nested array element match
            case "elemMatchElement": {
                const [nestedKey, op, nestedVal] = value.split(":");

                const mongoOps = {
                    eq: "$eq",
                    ne: "$ne",
                    lt: "$lt",
                    lte: "$lte",
                    gt: "$gt",
                    gte: "$gte",
                    in: "$in",
                    nin: "$nin",
                };

                const mongoOp = mongoOps[op] || "$eq";

                return {
                    [field]: {
                        $elemMatch: {
                            [nestedKey]: { [mongoOp]: this.castValue(nestedVal) },
                        },
                    },
                };
            }

            case "elemMatchEntire": {
                const [nestedKey, op, nestedVal] = value.split(":");

                const mongoOps = {
                    eq: "$eq",
                    ne: "$ne",
                    lt: "$lt",
                    lte: "$lte",
                    gt: "$gt",
                    gte: "$gte",
                    in: "$in",
                    nin: "$nin",
                };

                const mongoOp = mongoOps[op] || "$eq";

                return {
                    [field]: {
                        $not: {
                            $elemMatch: {
                                [nestedKey]: { [mongoOp]: this.castValue(nestedVal) },
                            },
                        },
                    },
                };
            }

            default:
                throw new Error(`Unsupported operator: ${operator}`);
        }
    }

    // -------------------- FILTER --------------------

    filter() {
        let mongoQuery = {};

        Object.entries(this.queryStr).forEach(([key, value]) => {
            const reserved = [
                "page",
                "limit",
                "sort",
                "fields",
                "populate",
                "populateLimit",
                "populatePage",
                "selectPopulate",
                "action",
                "search"
            ];

            if (reserved.includes(key)) return;

            // Parse operator
            let parts = key === "_id" ? [key] : key.split("__");
            let operator = parts.length > 1 ? parts.pop() : null;
            let field = parts.join(".");

            field = field.replace(/\[(\d+)\]/g, ".$1"); // array support

            if (!operator) {
                const type = this.getFieldType(field);
                operator = ["Number", "Date", "Boolean", "ObjectId"].includes(type)
                    ? "eq"
                    : "contains";
            }

            const condition = this.buildCondition(field, operator, value);
            mongoQuery = { ...mongoQuery, ...condition };
        });

        this.query = this.query.find(mongoQuery);

        // Preserve tenant options
        this.query.setOptions({ ...this.originalOptions });

        return this;
    }

    // -------------------- SORT --------------------

    sort() {
        if (this.queryStr.sort) {
            const sortBy = this.queryStr.sort.split(",").join(" ");
            this.query = this.query.sort(sortBy);
        }
        return this;
    }

    // -------------------- FIELD LIMIT --------------------

    fields() {
        if (this.queryStr.fields) {
            const fields = this.queryStr.fields.split(",").join(" ");
            this.query = this.query.select(fields);
        }
        return this;
    }

    // -------------------- PAGINATION --------------------

    pagination() {
        const page = parseInt(this.queryStr.page) || 1;
        const limit = parseInt(this.queryStr.limit) || 100;
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);
        return this;
    }

    // -------------------- POPULATE --------------------

    populate() {
        if (!this.queryStr.populate) return this;

        const page = parseInt(this.queryStr.populatePage) || 1;
        const limit = parseInt(this.queryStr.populateLimit) || 10;
        const skip = (page - 1) * limit;

        const path = this.queryStr.populate.split(",").join(" ");
        const select =
            this.queryStr.selectPopulate?.split(",").join(" ") || "-__v";

        this.query = this.query.populate({
            path,
            select,
            options: { limit, skip, ...this.originalOptions },
            strictPopulate: false,
        });

        return this;
    }
}

module.exports = QueryBuilder;
