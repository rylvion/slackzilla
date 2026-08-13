function handleLogsApi({ req, res, url, context }) {
    if (url.pathname === "/api/logs" && req.method === "GET") {
        const snapshot = context.store.getLogSnapshot()
        context.sendOk(res, {
            size: snapshot.size,
            lines: context.splitLogLines(snapshot.content)
        })
        return true
    }

    if (url.pathname === "/api/logs/download" && req.method === "GET") {
        const snapshot = context.store.getLogSnapshot()
        context.sendText(res, 200, snapshot.content, "text/plain; charset=utf-8")
        return true
    }

    if (url.pathname === "/api/logs/stream" && req.method === "GET") {
        const snapshot = context.store.getLogSnapshot()
        context.registerStreamClient(context.logClients, req, res)
        context.sendSse(res, "snapshot", {
            lines: context.splitLogLines(snapshot.content),
            size: snapshot.size
        })
        return true
    }

    return false
}

module.exports = {
    handleLogsApi
}
