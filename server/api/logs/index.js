function handleLogsApi({ req, res, url, context }) {
    if (!["/api/logs", "/api/logs/download", "/api/logs/stream"].includes(url.pathname)) return false

    if (req.method !== "GET") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", `Method '${req.method}' is not supported. Use GET to retrieve, download, or stream logs.`)
        return true
    }

    try {
        if (url.pathname === "/api/logs") {
            const snapshot = context.store.getLogSnapshot()
            context.sendOk(res, {
                size: snapshot.size,
                lines: context.splitLogLines(snapshot.content)
            })
            return true
        }

        if (url.pathname === "/api/logs/download") {
            const snapshot = context.store.getLogSnapshot()

            res.writeHead(200, {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": 'attachment; filename="slackzilla.log"'
            })

            res.end(snapshot.content)
            return true
        }

        if (url.pathname === "/api/logs/stream") {
            const snapshot = context.store.getLogSnapshot()
            context.registerStreamClient(context.logClients, req, res)
            context.sendSse(res, "snapshot", {
                lines: context.splitLogLines(snapshot.content),
                size: snapshot.size
            })
            return true
        }
    } catch (error) {
        context.recordServerError(error, `logs:${url.pathname}`)
        if (!res.headersSent) {
            context.sendError(res, 500, "LOG_RETRIEVAL_FAILED", `Failed to process ${url.pathname}: ${error.message}`)
        } else if (!res.writableEnded && !res.destroyed) {
            res.end()
        }
        return true
    }

    return false
}

module.exports = {
    handleLogsApi
}