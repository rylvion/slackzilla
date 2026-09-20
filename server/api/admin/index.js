function handleAdminApi({ req, res, url, context }) {
    if (url.pathname === "/api/admin/summary" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        context.sendOk(res, context.buildAdminSummary(session.csrfToken))
        return true
    }

    if (url.pathname === "/api/admin/server-events" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        const requestedLimit = Number(url.searchParams.get("limit") || 1000)
        const limit = Math.min(1000, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 1000))
        const events = context.store.getServerEvents(limit)
        context.sendOk(res, { events, count: events.length, limit })
        return true
    }

    if (url.pathname === "/api/admin/events" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        context.registerStreamClient(context.adminClients, req, res)
        context.sendSse(res, "summary", context.buildAdminSummary(session.csrfToken))
        return true
    }

    return false
}

module.exports = {
    handleAdminApi
}
