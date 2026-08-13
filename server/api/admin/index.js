function handleAdminApi({ req, res, url, context }) {
    if (url.pathname === "/api/admin/summary" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        context.sendOk(res, context.buildAdminSummary(session.csrfToken))
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
