const { loadIndex } = require("../../lib/rag/rag")

function listRoutes() {
    return loadIndex().files.flatMap(file => (file.code?.routes || []).map(route => ({
        ...route,
        file: file.path
    })))
}

function handleRoutesApi({ req, res, url, context }) {
    if (url.pathname !== "/api/routes") return false

    if (req.method !== "GET") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "method not allowed")
        return true
    }

    context.sendOk(res, { routes: listRoutes() })
    return true
}

module.exports = {
    handleRoutesApi,
    listRoutes
}
