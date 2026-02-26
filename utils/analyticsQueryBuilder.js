// Enhanced Analytics Aggregation Builder for LMS
// Purpose: Dynamic MongoDB aggregation pipelines with advanced query capabilities
/*
NEW FEATURES:
- Multiple unwinds with preserveNullAndEmptyArrays
- Lookup (joins) with nested populations
- Conditional aggregations
- Custom computed fields
- Array operations (filter, map, reduce)
- Text search integration
- Geospatial queries
- Window functions
- Union/merge operations
- Redaction & projection control
*/

const mongoose = require("mongoose");

class AnalyticsAggregationBuilder {
  constructor(model, queryStr = {}, schema) {
    this.model = model;
    this.queryStr = queryStr;
    this.schema = schema;
    this.pipeline = [];

    this.page = parseInt(queryStr.page) || null;
    this.limit = parseInt(queryStr.limit) || null;
  }

  /* -------------------- Helpers -------------------- */

  isDateString(value) {
    return !isNaN(Date.parse(value));
  }

  castValue(val) {
    if (Array.isArray(val)) return val.map((v) => this.castValue(v));
    if (val === "") return val;
    if (!isNaN(val) && val !== "") return Number(val);
    if (this.isDateString(val)) return new Date(val);
    if (val === "true") return true;
    if (val === "false") return false;
    return val;
  }

  /**
   * 🔥 Schema-aware casting (ObjectId safe)
   */
  castBySchema(field, value) {
    if (!this.schema) return this.castValue(value);

    let path = this.schema.path(field);

    // handle nested arrays like enrolledCourses.courseId
    if (!path && field.includes(".")) {
      const [root, sub] = field.split(".");
      const rootPath = this.schema.path(root);
      path = rootPath?.schema?.path(sub);
    }

    // ObjectId casting
    if (
      path?.instance === "ObjectId" ||
      path?.caster?.instance === "ObjectId"
    ) {
      if (mongoose.Types.ObjectId.isValid(value)) {
        return new mongoose.Types.ObjectId(value);
      }
    }

    return this.castValue(value);
  }

  parseList(str) {
    if (!str) return [];
    return String(str)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /* -------------------- MATCH / FILTER -------------------- */

  buildMatch() {
    const reserved = new Set([
      "page",
      "limit",
      "sort",
      "fields",
      "populate",
      "populateLimit",
      "populatePage",
      "selectPopulate",
      "action",
      "groupBy",
      "metrics",
      "dateGroup",
      "timeRange",
      "startDate",
      "endDate",
      "groupSort",
      "facet",
      "pivot",
      "flatten",
      "unwind",
      "lookup",
      "compute",
      "arrayFilter",
      "textSearch",
      "geoNear",
      "sample",
      "bucket",
      "bucketAuto",
      "graphLookup",
      "replaceRoot",
      "redact",
      "customStage",
      "having",
      "window",
      "unionWith",
      "setWindowFields",
    ]);

    const match = {};

    Object.entries(this.queryStr).forEach(([rawKey, rawVal]) => {
      if (reserved.has(rawKey)) return;
      if (rawVal === undefined || rawVal === null || rawVal === "") return;

      let parts = rawKey === "_id" ? [rawKey] : rawKey.split("_");
      let op = parts.length > 1 ? parts.pop() : "eq";
      let field = parts.join(".");

      let condition;

      switch (op) {
        case "eq":
          condition = this.castBySchema(field, rawVal);
          break;

        case "ne":
          condition = { $ne: this.castBySchema(field, rawVal) };
          break;

        case "gt":
          condition = { $gt: this.castBySchema(field, rawVal) };
          break;

        case "gte":
          condition = { $gte: this.castBySchema(field, rawVal) };
          break;

        case "lt":
          condition = { $lt: this.castBySchema(field, rawVal) };
          break;

        case "lte":
          condition = { $lte: this.castBySchema(field, rawVal) };
          break;

        case "between": {
          const [a, b] = String(rawVal).split(",");
          condition = {
            $gte: this.castBySchema(field, a),
            $lte: this.castBySchema(field, b),
          };
          break;
        }

        case "in":
          condition = {
            $in: this.parseList(rawVal).map((v) => this.castBySchema(field, v)),
          };
          break;

        case "nin":
          condition = {
            $nin: this.parseList(rawVal).map((v) =>
              this.castBySchema(field, v),
            ),
          };
          break;

        case "contains":
          condition = { $regex: rawVal, $options: "i" };
          break;

        case "startsWith":
          condition = { $regex: `^${rawVal}`, $options: "i" };
          break;

        case "endsWith":
          condition = { $regex: `${rawVal}$`, $options: "i" };
          break;

        case "exists":
          condition = { $exists: rawVal === "true" };
          break;

        case "type":
          condition = { $type: rawVal };
          break;

        case "size":
          condition = { $size: parseInt(rawVal) };
          break;

        case "all":
          condition = {
            $all: this.parseList(rawVal).map((v) =>
              this.castBySchema(field, v),
            ),
          };
          break;

        case "elemMatch":
          // Format: field_elemMatch=status:active,score_gte:80
          const conditions = rawVal.split(",").reduce((acc, cond) => {
            const [k, v] = cond.split(":");
            const [subField, subOp = "eq"] = k.split("_");
            if (subOp === "gte") acc[subField] = { $gte: this.castValue(v) };
            else if (subOp === "lte")
              acc[subField] = { $lte: this.castValue(v) };
            else if (subOp === "gt") acc[subField] = { $gt: this.castValue(v) };
            else if (subOp === "lt") acc[subField] = { $lt: this.castValue(v) };
            else acc[subField] = this.castValue(v);
            return acc;
          }, {});
          condition = { $elemMatch: conditions };
          break;

        default:
          condition = this.castBySchema(field, rawVal);
      }

      match[field] = condition;
    });

    // Date helpers
    if (this.queryStr.timeRange) {
      const [start, end] = this.queryStr.timeRange.split(",");
      match.createdAt = { $gte: new Date(start), $lte: new Date(end) };
    } else if (this.queryStr.startDate || this.queryStr.endDate) {
      match.createdAt = {};
      if (this.queryStr.startDate)
        match.createdAt.$gte = new Date(this.queryStr.startDate);
      if (this.queryStr.endDate)
        match.createdAt.$lte = new Date(this.queryStr.endDate);
    }

    if (Object.keys(match).length) {
      this.pipeline.push({ $match: match });
    }

    return this;
  }

  /* -------------------- TEXT SEARCH -------------------- */

  buildTextSearch() {
    if (!this.queryStr.textSearch) return this;

    const [query, ...options] = this.queryStr.textSearch.split("|");
    const searchStage = { $search: query };

    // Optional parameters: textSearch=query|language:en|caseSensitive:true
    options.forEach((opt) => {
      const [key, val] = opt.split(":");
      if (key === "language") searchStage.$language = val;
      if (key === "caseSensitive") searchStage.$caseSensitive = val === "true";
      if (key === "diacriticSensitive")
        searchStage.$diacriticSensitive = val === "true";
    });

    this.pipeline.push({ $match: { $text: searchStage } });

    // Add text score for sorting
    this.pipeline.push({
      $addFields: { textScore: { $meta: "textScore" } },
    });

    return this;
  }

  /* -------------------- GEO NEAR -------------------- */

  buildGeoNear() {
    if (!this.queryStr.geoNear) return this;

    // Format: geoNear=lat,lng,maxDistance|distanceField:distance|spherical:true
    const [coords, ...options] = this.queryStr.geoNear.split("|");
    const [lat, lng, maxDistance = 5000] = coords.split(",").map(Number);

    const geoNearStage = {
      near: { type: "Point", coordinates: [lng, lat] },
      distanceField: "distance",
      maxDistance: maxDistance,
      spherical: true,
    };

    options.forEach((opt) => {
      const [key, val] = opt.split(":");
      if (key === "distanceField") geoNearStage.distanceField = val;
      if (key === "spherical") geoNearStage.spherical = val === "true";
      if (key === "minDistance") geoNearStage.minDistance = Number(val);
    });

    // $geoNear must be first stage
    this.pipeline.unshift({ $geoNear: geoNearStage });

    return this;
  }

  /* -------------------- SAMPLE -------------------- */

  buildSample() {
    if (!this.queryStr.sample) return this;

    this.pipeline.push({ $sample: { size: parseInt(this.queryStr.sample) } });
    return this;
  }

  /* -------------------- UNWIND (Enhanced) -------------------- */

  buildUnwind() {
    if (!this.queryStr.unwind) return this;

    // Format: unwind=path1,path2|preserveNull:true|includeIndex:arrayIndex
    const [paths, ...options] = this.queryStr.unwind.split("|");
    const preserveNull = options.some((o) => o === "preserveNull:true");
    const indexMatch = options.find((o) => o.startsWith("includeIndex:"));
    const includeArrayIndex = indexMatch ? indexMatch.split(":")[1] : undefined;

    this.parseList(paths).forEach((path) => {
      const unwindStage = { path: `$${path}` };
      if (preserveNull) unwindStage.preserveNullAndEmptyArrays = true;
      if (includeArrayIndex) unwindStage.includeArrayIndex = includeArrayIndex;

      this.pipeline.push({ $unwind: unwindStage });
    });

    return this;
  }

  /* -------------------- LOOKUP (Enhanced) -------------------- */

  buildLookup() {
    if (!this.queryStr.lookup) return this;

    // Format: lookup=from:collection,localField:field,foreignField:field,as:alias|pipeline:match,project
    const lookups = this.queryStr.lookup.split(";");

    lookups.forEach((lookupStr) => {
      const [main, ...pipelineOpts] = lookupStr.split("|");
      const params = main.split(",").reduce((acc, param) => {
        const [key, val] = param.split(":");
        acc[key] = val;
        return acc;
      }, {});

      const lookupStage = {
        from: params.from,
        localField: params.localField,
        foreignField: params.foreignField,
        as: params.as || params.from,
      };

      // Add sub-pipeline if specified
      if (pipelineOpts.length) {
        const pipeline = [];
        pipelineOpts.forEach((opt) => {
          if (opt.startsWith("match:")) {
            const matchStr = opt.replace("match:", "");
            const matchObj = JSON.parse(matchStr);
            pipeline.push({ $match: matchObj });
          } else if (opt.startsWith("project:")) {
            const fields = opt.replace("project:", "").split(",");
            const projectObj = fields.reduce((acc, f) => {
              acc[f] = 1;
              return acc;
            }, {});
            pipeline.push({ $project: projectObj });
          } else if (opt.startsWith("limit:")) {
            pipeline.push({ $limit: parseInt(opt.replace("limit:", "")) });
          } else if (opt.startsWith("sort:")) {
            const sortFields = opt.replace("sort:", "").split(",");
            const sortObj = {};
            sortFields.forEach((f) => {
              if (f.startsWith("-")) sortObj[f.slice(1)] = -1;
              else sortObj[f] = 1;
            });
            pipeline.push({ $sort: sortObj });
          }
        });

        if (pipeline.length) {
          lookupStage.pipeline = pipeline;
          delete lookupStage.localField;
          delete lookupStage.foreignField;
        }
      }

      // Add let variables if specified
      if (params.let) {
        const letVars = params.let.split(";").reduce((acc, v) => {
          const [key, val] = v.split("=");
          acc[key] = `$${val}`;
          return acc;
        }, {});
        lookupStage.let = letVars;
      }

      this.pipeline.push({ $lookup: lookupStage });

      // Auto-unwind if specified
      if (params.unwind === "true") {
        this.pipeline.push({
          $unwind: {
            path: `$${params.as || params.from}`,
            preserveNullAndEmptyArrays: true,
          },
        });
      }
    });

    return this;
  }

  /* -------------------- COMPUTED FIELDS -------------------- */

  buildComputedFields() {
    if (!this.queryStr.compute) return this;

    // Format: compute=totalPrice:$multiply:price,quantity|fullName:$concat:firstName, ,lastName
    const computations = this.queryStr.compute.split(";");
    const addFields = {};

    computations.forEach((comp) => {
      const [fieldName, operator, ...args] = comp.split(":");

      switch (operator) {
        case "$concat":
          addFields[fieldName] = {
            $concat: args.map((a) => (a.startsWith("$") ? a : a)),
          };
          break;

        case "$multiply":
        case "$add":
        case "$subtract":
        case "$divide":
          addFields[fieldName] = {
            [operator]: args.map((a) =>
              a.startsWith("$") ? a : this.castValue(a),
            ),
          };
          break;

        case "$cond":
          // Format: status:$cond:$eq:$status,active,Active,Inactive
          const [condOp, field, value, ifTrue, ifFalse] = args;
          addFields[fieldName] = {
            $cond: {
              if: { [condOp]: [field, this.castValue(value)] },
              then: this.castValue(ifTrue),
              else: this.castValue(ifFalse),
            },
          };
          break;

        case "$arrayElemAt":
          addFields[fieldName] = {
            $arrayElemAt: [args[0], parseInt(args[1])],
          };
          break;

        case "$size":
          addFields[fieldName] = { $size: args[0] };
          break;

        case "$filter":
          // Format: activeStudents:$filter:$students,item,$eq:$$item.status,active
          const [input, as, filterOp, filterField, filterVal] = args;
          addFields[fieldName] = {
            $filter: {
              input: input,
              as: as,
              cond: { [filterOp]: [filterField, this.castValue(filterVal)] },
            },
          };
          break;

        case "$map":
          // Format: courseIds:$map:$enrolledCourses,course,$$course.courseId
          const [mapInput, mapAs, mapIn] = args;
          addFields[fieldName] = {
            $map: {
              input: mapInput,
              as: mapAs,
              in: mapIn,
            },
          };
          break;

        case "$reduce":
          // Format: totalRevenue:$reduce:$orders,0,$$value,$$this.amount
          const [reduceInput, initialValue, ...reduceExpr] = args;
          addFields[fieldName] = {
            $reduce: {
              input: reduceInput,
              initialValue: this.castValue(initialValue),
              in: { $add: [reduceExpr[0], reduceExpr[1]] },
            },
          };
          break;

        default:
          // Simple field reference
          addFields[fieldName] = args[0].startsWith("$")
            ? args[0]
            : this.castValue(args[0]);
      }
    });

    if (Object.keys(addFields).length) {
      this.pipeline.push({ $addFields: addFields });
    }

    return this;
  }

  /* -------------------- ARRAY FILTER -------------------- */

  buildArrayFilter() {
    if (!this.queryStr.arrayFilter) return this;

    // Format: arrayFilter=students:status:active|orders:amount_gte:100
    const filters = this.queryStr.arrayFilter.split("|");
    const addFields = {};

    filters.forEach((filter) => {
      const [arrayField, condField, condValue] = filter.split(":");
      const [field, op = "eq"] = condField.split("_");

      let condition;
      const itemVar = "$$item";

      switch (op) {
        case "eq":
          condition = {
            $eq: [`${itemVar}.${field}`, this.castValue(condValue)],
          };
          break;
        case "ne":
          condition = {
            $ne: [`${itemVar}.${field}`, this.castValue(condValue)],
          };
          break;
        case "gt":
          condition = {
            $gt: [`${itemVar}.${field}`, this.castValue(condValue)],
          };
          break;
        case "gte":
          condition = {
            $gte: [`${itemVar}.${field}`, this.castValue(condValue)],
          };
          break;
        case "lt":
          condition = {
            $lt: [`${itemVar}.${field}`, this.castValue(condValue)],
          };
          break;
        case "lte":
          condition = {
            $lte: [`${itemVar}.${field}`, this.castValue(condValue)],
          };
          break;
        case "in":
          condition = {
            $in: [
              `${itemVar}.${field}`,
              this.parseList(condValue).map((v) => this.castValue(v)),
            ],
          };
          break;
      }

      addFields[arrayField] = {
        $filter: {
          input: `$${arrayField}`,
          as: "item",
          cond: condition,
        },
      };
    });

    if (Object.keys(addFields).length) {
      this.pipeline.push({ $addFields: addFields });
    }

    return this;
  }

  /* -------------------- DATE BUCKET -------------------- */

  buildDateBucket() {
    if (!this.queryStr.dateGroup) return this;

    const [unit, field = "createdAt"] = this.queryStr.dateGroup.split(":");
    const validUnits = [
      "year",
      "quarter",
      "month",
      "week",
      "day",
      "hour",
      "minute",
    ];

    this.pipeline.push({
      $addFields: {
        __dateGroup: {
          $dateTrunc: {
            date: `$${field}`,
            unit: validUnits.includes(unit) ? unit : "month",
          },
        },
      },
    });

    return this;
  }

  /* -------------------- BUCKET / BUCKET AUTO -------------------- */

  buildBucket() {
    if (!this.queryStr.bucket && !this.queryStr.bucketAuto) return this;

    if (this.queryStr.bucket) {
      // Format: bucket=field:age,boundaries:0,18,30,50,100,default:Other
      const [fieldPart, boundariesPart, defaultPart] =
        this.queryStr.bucket.split(",");
      const field = fieldPart.split(":")[1];
      const boundaries = boundariesPart
        .split(":")[1]
        .split(";")
        .map((b) => this.castValue(b));
      const defaultBucket = defaultPart ? defaultPart.split(":")[1] : "Other";

      this.pipeline.push({
        $bucket: {
          groupBy: `$${field}`,
          boundaries: boundaries,
          default: defaultBucket,
          output: {
            count: { $sum: 1 },
            items: { $push: "$$ROOT" },
          },
        },
      });
    }

    if (this.queryStr.bucketAuto) {
      // Format: bucketAuto=field:age,buckets:5,granularity:R5
      const params = this.queryStr.bucketAuto.split(",").reduce((acc, p) => {
        const [k, v] = p.split(":");
        acc[k] = v;
        return acc;
      }, {});

      const bucketAutoStage = {
        groupBy: `$${params.field}`,
        buckets: parseInt(params.buckets || 5),
        output: {
          count: { $sum: 1 },
          items: { $push: "$$ROOT" },
        },
      };

      if (params.granularity) {
        bucketAutoStage.granularity = params.granularity;
      }

      this.pipeline.push({ $bucketAuto: bucketAutoStage });
    }

    return this;
  }

  /* -------------------- GROUP & METRICS (Enhanced) -------------------- */

  buildGroup() {
    const groupBy = this.parseList(this.queryStr.groupBy);
    const metrics = this.parseList(this.queryStr.metrics);

    if (!groupBy.length && !metrics.length) return this;

    let _id =
      groupBy.length === 1
        ? `$${groupBy[0]}`
        : groupBy.reduce((acc, g) => {
            acc[g] = g === "__dateGroup" ? "$__dateGroup" : `$${g}`;
            return acc;
          }, {});

    const accumulators = {};

    metrics.forEach((m) => {
      const [name, op = "count", field, ...extra] = m.split(":");

      switch (op) {
        case "sum":
          accumulators[name] = { $sum: `$${field}` };
          break;
        case "avg":
          accumulators[name] = { $avg: `$${field}` };
          break;
        case "min":
          accumulators[name] = { $min: `$${field}` };
          break;
        case "max":
          accumulators[name] = { $max: `$${field}` };
          break;
        case "first":
          accumulators[name] = { $first: `$${field}` };
          break;
        case "last":
          accumulators[name] = { $last: `$${field}` };
          break;
        case "push":
          accumulators[name] = { $push: `$${field}` };
          break;
        case "set":
        case "addToSet":
          accumulators[name] = { $addToSet: `$${field}` };
          break;
        case "stdDevPop":
          accumulators[name] = { $stdDevPop: `$${field}` };
          break;
        case "stdDevSamp":
          accumulators[name] = { $stdDevSamp: `$${field}` };
          break;
        case "mergeObjects":
          accumulators[name] = { $mergeObjects: `$${field}` };
          break;
        case "count":
        default:
          accumulators[name] = { $sum: 1 };
      }
    });

    this.pipeline.push({ $group: { _id, ...accumulators } });

    // flatten output
    if (this.queryStr.flatten === "true") {
      const addFields = {};
      if (typeof _id === "string") addFields[groupBy[0]] = "$_id";
      else
        groupBy.forEach((g) => {
          addFields[g] = `$_id.${g}`;
        });

      this.pipeline.push({ $addFields: addFields });
      this.pipeline.push({ $project: { _id: 0 } });
    }

    return this;
  }

  /* -------------------- HAVING (Post-Group Filter) -------------------- */

  buildHaving() {
    if (!this.queryStr.having) return this;

    // Format: having=count_gte:10,revenue_gt:1000
    const conditions = this.queryStr.having.split(",");
    const match = {};

    conditions.forEach((cond) => {
      const parts = cond.split("_");
      const op = parts.pop();
      const field = parts.join("_");

      const [, value] = cond.split(":");

      switch (op) {
        case "gte":
          match[field] = { $gte: this.castValue(value) };
          break;
        case "gt":
          match[field] = { $gt: this.castValue(value) };
          break;
        case "lte":
          match[field] = { $lte: this.castValue(value) };
          break;
        case "lt":
          match[field] = { $lt: this.castValue(value) };
          break;
        case "eq":
          match[field] = this.castValue(value);
          break;
        case "ne":
          match[field] = { $ne: this.castValue(value) };
          break;
      }
    });

    if (Object.keys(match).length) {
      this.pipeline.push({ $match: match });
    }

    return this;
  }

  /* -------------------- WINDOW FUNCTIONS -------------------- */

  buildWindowFields() {
    if (!this.queryStr.window) return this;

    // Format: window=partitionBy:department,sortBy:salary,rank:rank,rowNumber:rowNum
    const params = this.queryStr.window.split(",").reduce((acc, p) => {
      const [k, v] = p.split(":");
      acc[k] = v;
      return acc;
    }, {});

    const setWindowFieldsStage = {
      partitionBy: params.partitionBy ? `$${params.partitionBy}` : null,
      sortBy: {},
      output: {},
    };

    if (params.sortBy) {
      params.sortBy.split(";").forEach((s) => {
        if (s.startsWith("-")) setWindowFieldsStage.sortBy[s.slice(1)] = -1;
        else setWindowFieldsStage.sortBy[s] = 1;
      });
    }

    // Add window functions
    if (params.rank) {
      setWindowFieldsStage.output[params.rank] = { $rank: {} };
    }
    if (params.denseRank) {
      setWindowFieldsStage.output[params.denseRank] = { $denseRank: {} };
    }
    if (params.rowNumber) {
      setWindowFieldsStage.output[params.rowNumber] = {
        $documentNumber: {},
      };
    }
    if (params.sum) {
      const [field, outputName] = params.sum.split("=");
      setWindowFieldsStage.output[outputName || `${field}Sum`] = {
        $sum: `$${field}`,
        window: { documents: ["unbounded", "current"] },
      };
    }
    if (params.avg) {
      const [field, outputName] = params.avg.split("=");
      setWindowFieldsStage.output[outputName || `${field}Avg`] = {
        $avg: `$${field}`,
        window: { documents: ["unbounded", "current"] },
      };
    }

    this.pipeline.push({ $setWindowFields: setWindowFieldsStage });

    return this;
  }

  /* -------------------- PROJECTION -------------------- */

  buildProject() {
    if (!this.queryStr.fields) return this;

    const fields = this.parseList(this.queryStr.fields);
    const project = {};

    fields.forEach((f) => {
      if (f.startsWith("-")) project[f.slice(1)] = 0;
      else project[f] = 1;
    });

    if (Object.keys(project).length) {
      this.pipeline.push({ $project: project });
    }

    return this;
  }

  /* -------------------- REPLACE ROOT -------------------- */

  buildReplaceRoot() {
    if (!this.queryStr.replaceRoot) return this;

    this.pipeline.push({
      $replaceRoot: { newRoot: `$${this.queryStr.replaceRoot}` },
    });

    return this;
  }

  /* -------------------- GRAPH LOOKUP -------------------- */

  buildGraphLookup() {
    if (!this.queryStr.graphLookup) return this;

    // Format: graphLookup=from:employees,startWith:$reportsTo,connectFromField:reportsTo,connectToField:_id,as:reportingHierarchy,maxDepth:3
    const params = this.queryStr.graphLookup.split(",").reduce((acc, p) => {
      const [k, v] = p.split(":");
      acc[k] = v;
      return acc;
    }, {});

    const graphLookupStage = {
      from: params.from,
      startWith: params.startWith,
      connectFromField: params.connectFromField,
      connectToField: params.connectToField,
      as: params.as || "hierarchy",
    };

    if (params.maxDepth) {
      graphLookupStage.maxDepth = parseInt(params.maxDepth);
    }
    if (params.depthField) {
      graphLookupStage.depthField = params.depthField;
    }
    if (params.restrictSearchWithMatch) {
      graphLookupStage.restrictSearchWithMatch = JSON.parse(
        params.restrictSearchWithMatch,
      );
    }

    this.pipeline.push({ $graphLookup: graphLookupStage });

    return this;
  }

  /* -------------------- UNION WITH -------------------- */

  buildUnionWith() {
    if (!this.queryStr.unionWith) return this;

    // Format: unionWith=collection:otherUsers|pipeline:match,project
    const [collPart, ...pipelineOpts] = this.queryStr.unionWith.split("|");
    const coll = collPart.split(":")[1];

    const unionStage = { coll };

    if (pipelineOpts.length) {
      const pipeline = [];
      pipelineOpts.forEach((opt) => {
        if (opt.startsWith("match:")) {
          pipeline.push({ $match: JSON.parse(opt.replace("match:", "")) });
        } else if (opt.startsWith("project:")) {
          const fields = opt.replace("project:", "").split(",");
          const projectObj = fields.reduce((acc, f) => {
            acc[f] = 1;
            return acc;
          }, {});
          pipeline.push({ $project: projectObj });
        }
      });

      if (pipeline.length) unionStage.pipeline = pipeline;
    }

    this.pipeline.push({ $unionWith: unionStage });

    return this;
  }

  /* -------------------- CUSTOM STAGE -------------------- */

  buildCustomStage() {
    if (!this.queryStr.customStage) return this;

    // Format: customStage={"$addFields":{"custom":"value"}}
    try {
      const customStages = JSON.parse(this.queryStr.customStage);
      if (Array.isArray(customStages)) {
        this.pipeline.push(...customStages);
      } else {
        this.pipeline.push(customStages);
      }
    } catch (e) {
      console.error("Invalid customStage JSON:", e);
    }

    return this;
  }

  /* -------------------- SORT -------------------- */

  buildSort() {
    const sortStr = this.queryStr.groupSort || this.queryStr.sort;
    if (!sortStr) return this;

    const sortObj = {};
    sortStr.split(",").forEach((s) => {
      if (s.startsWith("-")) sortObj[s.slice(1)] = -1;
      else sortObj[s] = 1;
    });

    this.pipeline.push({ $sort: sortObj });
    return this;
  }

  /* -------------------- FACET / PAGINATION -------------------- */

  buildFacet() {
    if (!this.page && !this.limit && this.queryStr.facet !== "true")
      return this;

    const basePipeline = [...this.pipeline];
    const dataPipeline = [...basePipeline];

    if (this.page && this.limit) {
      dataPipeline.push({ $skip: (this.page - 1) * this.limit });
      dataPipeline.push({ $limit: this.limit });
    }

    this.pipeline = [
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: dataPipeline,
        },
      },
      {
        $addFields: {
          metadata: { $arrayElemAt: ["$metadata", 0] },
        },
      },
    ];

    return this;
  }

  /* -------------------- MULTI-FACET (Advanced Analytics) -------------------- */

  buildMultiFacet() {
    if (!this.queryStr.multiFacet) return this;

    // Format: multiFacet=byStatus:groupBy=status&metrics=count,byDepartment:groupBy=department&metrics=avgSalary:avg:salary
    const facets = this.queryStr.multiFacet.split(",");
    const facetStages = {};

    facets.forEach((facet) => {
      const [name, query] = facet.split(":");
      const params = new URLSearchParams(query);

      const facetPipeline = [];
      const groupBy = params.get("groupBy");
      const metrics = params.get("metrics");

      if (groupBy && metrics) {
        const _id = `$${groupBy}`;
        const accumulators = {};

        metrics.split(";").forEach((m) => {
          const [metricName, op = "count", field] = m.split(":");
          if (op === "count") accumulators[metricName] = { $sum: 1 };
          else if (op === "sum")
            accumulators[metricName] = { $sum: `$${field}` };
          else if (op === "avg")
            accumulators[metricName] = { $avg: `$${field}` };
          else if (op === "min")
            accumulators[metricName] = { $min: `$${field}` };
          else if (op === "max")
            accumulators[metricName] = { $max: `$${field}` };
        });

        facetPipeline.push({ $group: { _id, ...accumulators } });
      }

      if (params.get("sort")) {
        const sortObj = {};
        params
          .get("sort")
          .split(";")
          .forEach((s) => {
            if (s.startsWith("-")) sortObj[s.slice(1)] = -1;
            else sortObj[s] = 1;
          });
        facetPipeline.push({ $sort: sortObj });
      }

      if (params.get("limit")) {
        facetPipeline.push({ $limit: parseInt(params.get("limit")) });
      }

      facetStages[name] = facetPipeline;
    });

    this.pipeline.push({ $facet: facetStages });

    return this;
  }

  /* -------------------- BUILD -------------------- */

  build() {
    return this.buildMatch()
      .buildTextSearch()
      .buildGeoNear()
      .buildSample()
      .buildUnwind()
      .buildLookup()
      .buildComputedFields()
      .buildArrayFilter()
      .buildDateBucket()
      .buildBucket()
      .buildGroup()
      .buildHaving()
      .buildWindowFields()
      .buildGraphLookup()
      .buildUnionWith()
      .buildCustomStage()
      .buildProject()
      .buildReplaceRoot()
      .buildSort()
      .buildMultiFacet()
      .buildFacet().pipeline;
  }
}

module.exports = AnalyticsAggregationBuilder;
