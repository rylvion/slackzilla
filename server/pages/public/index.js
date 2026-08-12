const {
    renderLandingPage,
    renderStatusPage,
    renderLogsPage,
    renderDocsPage,
    renderApiDocsPage
} = require("../../lib/pages")

function handlePublicPages({ req, res, url, context }) {
    if (req.method !== "GET") {
        return false
    }

    if (url.pathname === "/") {
        const summary = context.renderStatusPayload()
        const commandStats = context.store.getCommandStats().slice(0, 5)
        const logs = context.splitLogLines(context.store.getLogSnapshot().content).slice(-8)
        context.sendHtml(res, 200, renderLandingPage({ summary, commandStats, logs }))
        return true
    }

    if (url.pathname === "/status") {
        const status = context.renderStatusPayload()
        const commandStats = context.store.getCommandStats().slice(0, 8)
        context.sendHtml(res, 200, renderStatusPage({ status, commandStats }))
        return true
    }

    if (url.pathname === "/logs") {
        const snapshot = context.store.getLogSnapshot()
        context.sendHtml(res, 200, renderLogsPage({ logs: context.splitLogLines(snapshot.content) }))
        return true
    }

    if (url.pathname === "/api") {
        context.sendHtml(res, 200, renderApiDocsPage())
        return true
    }

    if (url.pathname === "/docs") {
        context.sendHtml(res, 200, renderDocsPage())
        return true
    }

    return false
}

module.exports = {
    handlePublicPages
}
