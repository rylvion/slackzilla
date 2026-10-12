function handleMetricsApi({ req, res, url, context }) {
    if (url.pathname !== "/api/metrics") return false

    if (req.method !== "GET") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", `Method '${req.method}' is not supported. Use GET to retrieve bot metrics.`)
        return true
    }

    try {
        context.sendOk(res, context.getBotMetrics())
    } catch (error) {
        context.recordServerError(error, "metrics")
        context.sendError(res, 500, "METRICS_RETRIEVAL_FAILED", `Failed to retrieve bot metrics: ${error.message}`)
    }

    return true
}

module.exports = {
    handleMetricsApi
}