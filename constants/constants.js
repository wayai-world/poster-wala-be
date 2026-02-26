
const ROLES = {
    USER: "USER",
    ADVERTISER: "ADVERTISER",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN"
}

const MESSAGES = {
    NOT_FOUND: (module) => `${module} not found`,
}

const MODULES = {
    USER: "User",
    ROLE: "Role",
    POSTER: "Poster",
    COMPANY: "Company"
}

const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500

}



module.exports = {
    ROLES,
    MESSAGES,
    MODULES,
    STATUS_CODES,
}













