const fs = require("fs")
const path = require("path")
const ejs = require("ejs")

const viewsDir = path.join(__dirname, "..", "views")

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
}

function serializeState(state) {
    return JSON.stringify(state).replaceAll("<", "\\u003c")
}

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"]
    let index = 0
    let value = Number(bytes) || 0

    while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index += 1
    }

    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(value) {
    if (!value) {
        return "unknown"
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function ansiToHtml(text) {
    const classes = {
        31: "ansi-red",
        32: "ansi-green",
        33: "ansi-yellow",
        34: "ansi-blue",
        35: "ansi-purple",
        36: "ansi-cyan",
        90: "ansi-dim",
        1: "ansi-bold"
    }

    const tokens = String(text || "").split(/(\x1b\[[0-9;]*m)/g)
    let html = ""
    const open = []

    for (const token of tokens) {
        if (!token) continue

        if (/^\x1b\[[0-9;]*m$/.test(token)) {
            const codes = token.slice(2, -1).split(";").map(Number)

            if (codes.includes(0)) {
                while (open.length) {
                    html += "</span>"
                    open.pop()
                }
                continue
            }

            for (const code of codes) {
                const cls = classes[code]
                if (!cls) continue
                html += `<span class="${cls}">`
                open.push(cls)
            }

            continue
        }

        html += escapeHtml(token)
    }

    while (open.length) {
        html += "</span>"
        open.pop()
    }

    return html
}

function renderTemplate(relativePath, data = {}) {
    const filePath = path.join(viewsDir, relativePath)
    const template = fs.readFileSync(filePath, "utf8")
    return ejs.render(template, {
        escapeHtml,
        serializeState,
        formatBytes,
        formatDate,
        ansiToHtml,
        csrfToken: "",
        ...data
    }, {
        filename: filePath
    })
}

function renderLayout(pageTemplate, data = {}) {
    const body = renderTemplate(pageTemplate, data)
    return renderTemplate("layouts/main.ejs", {
        ...data,
        body
    })
}

function renderLandingPage(data) {
    return renderLayout("pages/public/home.ejs", {
        title: "Slackzilla | Dashboard",
        active: "home",
        ...data,
        state: data.summary || {}
    })
}

function renderStatusPage(data) {
    return renderLayout("pages/public/status.ejs", {
        title: "Slackzilla | Uptime",
        active: "status",
        ...data,
        state: data.status || {}
    })
}

function renderLogsPage(data) {
    return renderLayout("pages/public/logs.ejs", {
        title: "Slackzilla | Logs",
        active: "logs",
        ...data,
        state: { logs: data.logs || [] }
    })
}

function renderLoginPage(data) {
    return renderLayout("pages/admin/login.ejs", {
        title: "Slackzilla | Admin",
        active: "admin",
        ...data,
        state: { csrfToken: data.csrfToken || "" }
    })
}

function renderAdminDashboardPage(data) {
    return renderLayout("pages/admin/dashboard.ejs", {
        title: "Slackzilla | Admin Panel",
        active: "admin",
        admin: true,
        ...data,
        state: {
            summary: data.summary || {},
            feedback: data.feedback || [],
            commandStats: data.commandStats || [],
            logs: data.logs || [],
            csrfToken: data.csrfToken || ""
        }
    })
}

function renderFeedbackPage(data) {
    return renderLayout("pages/admin/feedback.ejs", {
        title: "Slackzilla | Feedback",
        active: "admin",
        admin: true,
        ...data,
        state: {
            feedback: data.feedback || [],
            query: data.query || "",
            status: data.status || "all",
            csrfToken: data.csrfToken || "",
            selectedFeedback: data.selectedFeedback || null
        }
    })
}

function renderDocsPage() {
    return renderLayout("pages/public/docs.ejs", {
        title: "Slackzilla | Docs",
        active: "docs",
        state: {}
    })
}

function renderApiDocsPage() {
    return renderLayout("pages/public/api.ejs", {
        title: "Slackzilla | API",
        active: "api",
        state: {}
    })
}

module.exports = {
    escapeHtml,
    serializeState,
    formatBytes,
    formatDate,
    ansiToHtml,
    renderLandingPage,
    renderStatusPage,
    renderLogsPage,
    renderLoginPage,
    renderAdminDashboardPage,
    renderFeedbackPage,
    renderDocsPage,
    renderApiDocsPage
}
