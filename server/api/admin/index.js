function handleAdminApi({ req, res, url, context }) {
    if (url.pathname === "/api/admin/summary" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        context.sendOk(res, context.buildAdminSummary())
        return true
    }

    if (url.pathname === "/api/admin/summary/stream" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        context.registerStreamClient(context.adminClients, req, res)
        context.sendSse(res, "summary", context.buildAdminSummary())
        return true
    }

    if (url.pathname === "/api/admin/errors" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true
        context.sendOk(res, { errors: context.store.groupServerErrors() })
        return true
    }

    if (url.pathname === "/api/admin/errors/stream" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true
        context.registerStreamClient(context.serverErrorClients, req, res)
        context.sendSse(res, "snapshot", { errors: context.store.groupServerErrors() })
        return true
    }

    if (url.pathname === "/api/admin/events" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        const requestedLimit = Number(url.searchParams.get("limit") || 1000)
        const limit = Math.min(1000, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 1000))
        const level = url.searchParams.get("level")?.toLowerCase()

        let events = context.store.getServerEvents(1000)
        
        if (level === "critical") events = events.filter(event => (event.statusCode || 0) >= 400)
        else if (level === "successful") events = events.filter(event => event.statusCode >= 200 && event.statusCode < 400)

        const result = context.store.groupServerEvents(limit, events).slice(0, limit)

        context.sendOk(res, { events: result, count: result.length, limit, level: level || null })
        return true
    }

    if (url.pathname === "/api/admin/log-archives" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true
        context.sendOk(res, { archives: context.store.listLogArchives() })
        return true
    }



    return false
}

module.exports = {
    handleAdminApi
}
