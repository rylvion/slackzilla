const { getReleaseInfo } = require("../../lib/release-info")

function handleReleaseApi({ req, res, url, context }) {
    if (url.pathname !== "/api/release") return false

    if (req.method !== "GET") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "method not allowed")
        return true
    }

    const requestedVersion = url.searchParams.get("version")
    const result = getReleaseInfo(requestedVersion)

    if (requestedVersion && !result.version) {
        context.sendError(res, 404, "RELEASE_NOT_FOUND", "release version not found", {
            data: result
        })
        return true
    }

    context.sendOk(res, result)
    return true
}

module.exports = {
    handleReleaseApi
}
