const mongoose = require("mongoose");
const als = require("../utils/als");

const TENANT_FIELD = "ofCompany";

// -------------------- QUERY HOOK --------------------
const originalExec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.exec = function (...args) {
  const store = als.getStore();
  const opts = this.getOptions?.() || {};
  // console.log("Query exec options are", store);

  // console.log("Tenant id in middleware", store?.tenantId);
  const company = opts.__company || store?.ofCompany;
  const skipCompany = opts.__skipCompany || store?.skipCompany || false;
  const user = opts.__user || store?.user;
  // console.log("store data is", store);

  if (!skipCompany && !company) {
    throw new Error("TenantId required! Multi-Tenant Protection Triggered");
  }

  // inject user into options (like your plugin)
  if (user) {
    this.setOptions({ __user: user });
  }

  // enforce tenant filter (READ / UPDATE / DELETE)
  if (!skipCompany && company) {
    this.where({ [TENANT_FIELD]: company });
  }

  return originalExec.apply(this, args);
};

// -------------------- SAVE HOOK (CREATE) --------------------
const originalSave = mongoose.Model.prototype.save;

mongoose.Model.prototype.save = function (...args) {
  const store = als.getStore();
  const company = store?.ofCompany;

  if (company) {
    this[TENANT_FIELD] = company;
  }

  return originalSave.apply(this, args);
};

// -------------------- INSERT MANY --------------------
const originalInsertMany = mongoose.Model.insertMany;

mongoose.Model.insertMany = function (docs, options, callback) {
  const store = als.getStore();
  const company = store?.ofCompany;

  if (company && Array.isArray(docs)) {
    docs.forEach((d) => (d[TENANT_FIELD] = company));
  }

  return originalInsertMany.call(this, docs, options, callback);
};

// -------------------- BULK WRITE --------------------
const originalBulkWrite = mongoose.Model.bulkWrite;

mongoose.Model.bulkWrite = function (operations, options, callback) {
  const store = als.getStore();
  const company = store?.ofCompany;

  if (company && Array.isArray(operations)) {
    operations.forEach((op) => {
      const key = Object.keys(op)[0]; // insertOne, updateOne, deleteOne etc.

      if (key === "insertOne" && op.insertOne.document) {
        op.insertOne.document.ofCompany = company;
      }

      if (op[key]?.filter) {
        op[key].filter.ofCompany = company;
      }
    });
  }

  return originalBulkWrite.call(this, operations, options, callback);
};

// -------------------- AGGREGATE --------------------
const originalAggregate = mongoose.Model.aggregate;

mongoose.Model.aggregate = function (pipeline = [], options = {}) {
  const store = als.getStore();
  const company = store?.ofCompany;

  if (!company) {
    return originalAggregate.call(this, pipeline, options);
  }

  const tenantMatch = {
    $match: {
      ofCompany: new mongoose.Types.ObjectId(company),
    },
  };

  // ✅ CASE 1: pipeline starts with $facet
  if (pipeline[0]?.$facet) {
    pipeline[0].$facet.data.unshift(tenantMatch);
    pipeline[0].$facet.metadata.unshift({ $count: "total" });
  }
  // ✅ CASE 2: normal pipeline
  else {
    pipeline.unshift(tenantMatch);
  }

  return originalAggregate.call(this, pipeline, options);
};

// -------------------- RAW COLLECTION PROTECTION --------------------
const originalCollection = mongoose.Model.prototype.collection;

Object.defineProperty(mongoose.Model.prototype, "collection", {
  get() {
    const coll = originalCollection;

    const store = als.getStore();
    const company = store?.ofCompany;

    if (!company) return coll;

    return new Proxy(coll, {
      get(target, prop) {
        const value = target[prop];

        if (typeof value !== "function") return value;

        return function (...args) {
          const query = args[0];

          if (query && typeof query === "object") {
            query.ofCompany = company;
          }

          return value.apply(target, args);
        };
      },
    });
  },
});
