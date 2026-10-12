const { getReleaseInfo } = require("../../lib/release-info")

function handleReleaseApi({ req, res, url, context }) {
    if (url.pathname !== "/api/release") return false

    if (req.method !== "GET") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", `Method '${req.method}' is not supported for this endpoint. Use GET request to select an available version on the \`availableVersions\` list.`)
        return true
    }

    const requestedVersion = url.searchParams.get("version")
    const result = getReleaseInfo(requestedVersion)

    if (requestedVersion && !result.version) {
        context.sendError(res, 404, "RELEASE_NOT_FOUND",  `No release information was found for version '${requestedVersion}'. Check the version identifier and ensure it exists in the release history.`, {
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
