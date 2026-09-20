function handleTelemetryApi({ req, res, url, context }) {
    if (url.pathname === "/api/telemetry" && req.method === "GET") {
        context.sendOk(res, context.renderTelemetryPayload())
        return true
    }

    if (url.pathname === "/api/telemetry/stream" && req.method === "GET") {
        const telemetry = context.renderTelemetryPayload()
        
        context.registerStreamClient(context.telemetryClients, req, res)

        context.sendSse(res, "telemetry", telemetry)
        return true
    }

    return false
}

module.exports = {
    handleTelemetryApi
}