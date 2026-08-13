function handleStatusApi({ req, res, url, context }) {
    if (url.pathname === "/api/status" && req.method === "GET") {
        context.sendOk(res, context.renderStatusPayload())
        return true
    }

    if (url.pathname === "/api/status/stream" && req.method === "GET") {
        const status = context.renderStatusPayload()
        context.registerStreamClient(context.statusClients, req, res)
        context.sendSse(res, "status", status)
        return true
    }

    return false
}

module.exports = {
    handleStatusApi
}
