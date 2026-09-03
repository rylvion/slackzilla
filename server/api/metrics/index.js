function handleMetricsApi({ req, res, url, context }) {
    if (url.pathname !== "/api/metrics" || req.method !== "GET") {
        return false
    }

    context.sendOk(res, context.getBotMetrics())
    return true
}

module.exports = {
    handleMetricsApi
}