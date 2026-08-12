const {
    renderLoginPage,
    renderAdminDashboardPage,
    renderFeedbackPage
} = require("../../lib/pages")

function handleAdminPages({ req, res, url, context }) {
    if (!url.pathname.startsWith("/admin")) {
        return false
    }

    if (url.pathname === "/admin/login" && req.method === "GET") {
        const csrfToken = context.auth.issueLoginChallenge(req, res)
        const error = url.searchParams.get("error") || ""
        context.sendHtml(res, 200, renderLoginPage({ csrfToken, error }))
        return true
    }

    if (url.pathname === "/admin/login" && req.method === "POST") {
        return context.parseBody(req)
            .then(body => {
                req.body = body
                const result = context.auth.login(req, res, String(body.password || ""))

                if (!result.ok) {
                    context.sendHtml(res, result.status || 401, renderLoginPage({
                        csrfToken: context.auth.issueLoginChallenge(req, res),
                        error: result.message
                    }))
                    return true
                }

                res.statusCode = 302
                res.setHeader("Location", "/admin")
                res.end()
                return true
            })
            .catch(error => {
                context.sendHtml(res, 400, renderLoginPage({
                    csrfToken: "",
                    error: error.message
                }))
                return true
            })
    }

    if (url.pathname === "/admin/logout" && req.method === "POST") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        return context.parseBody(req)
            .then(body => {
                req.body = body

                if (!context.auth.verifyCsrf(req, session)) {
                    context.sendText(res, 403, "invalid csrf token")
                    return true
                }

                context.auth.logout(req, res)
                res.statusCode = 302
                res.setHeader("Location", "/")
                res.end()
                return true
            })
            .catch(error => {
                context.sendText(res, 400, error.message)
                return true
            })
    }

    const session = context.auth.requireSession(req, res)
    if (!session) {
        return true
    }

    if (url.pathname === "/admin" && req.method === "GET") {
        const summary = context.renderStatusPayload()
        const feedback = context.store.listFeedback({ status: "all" }).slice(0, 5)
        const commandStats = context.store.getCommandStats().slice(0, 8)
        const logs = context.splitLogLines(context.store.getLogSnapshot().content).slice(-20)

        context.sendHtml(res, 200, renderAdminDashboardPage({
            summary,
            feedback,
            commandStats,
            logs,
            runtimeConfig: context.runtimeConfig,
            csrfToken: session.csrfToken
        }))
        return true
    }

    if (url.pathname === "/admin/feedback" && req.method === "GET") {
        const query = url.searchParams.get("q") || ""
        const status = url.searchParams.get("status") || "all"
        const feedback = context.store.listFeedback({ query, status })
        const selectedId = url.searchParams.get("id") || ""
        const selectedFeedback = selectedId ? feedback.find(item => item.id === selectedId) || context.store.listFeedback({ status: "all" }).find(item => item.id === selectedId) : null

        context.sendHtml(res, 200, renderFeedbackPage({
            feedback,
            query,
            status,
            csrfToken: session.csrfToken,
            selectedFeedback
        }))
        return true
    }

    return false
}

module.exports = {
    handleAdminPages
}
