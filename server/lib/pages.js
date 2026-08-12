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

    return new Date(value).toLocaleString()
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

function shell({ title, active, body, state = {}, admin = false, csrfToken = "" }) {
    const nav = [
        { href: "/logs", label: "Logs", key: "logs" },
        { href: "/status", label: "Uptime", key: "status" },
        { href: "/api", label: "API", key: "api" },
        { href: "/docs", label: "Docs", key: "docs" },
        { href: "/", label: "Home", key: "home" },
        { href: "/admin", label: "Admin", key: "admin" }
    ]

    const topStatus = String(state.botOnline || state.summary?.botOnline || "offline")
    const online = ["active", "online"].includes(topStatus.toLowerCase())
    const statusClass = online ? "dot" : "dot dot--red"

    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Slackzilla server dashboard" />
        <meta name="csrf-token" content="${escapeHtml(csrfToken)}" />
        <title>${escapeHtml(title)}</title>
        <link rel="stylesheet" href="/public/css/dashboard.css" />
        <script>window.__SLACKZILLA__=${serializeState(state)}</script>
    </head>
    <body class="app app--${escapeHtml(active)}">
        <header>
            <span>SLACKZILLA</span>
            <div class="header-meta">rylvion.hackclub.app</div>
        </header>

        <div class="layout ${admin ? "layout--admin" : ""}">
            <aside class="sidebar">
                <div class="sidebar-title">NAVIGATION</div>
                <nav>
                    ${nav.map(item => `<a class="${active === item.key ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
                </nav>

                <div class="sidebar-footer">
                    <div class="footer-title">STATUS</div>
                    <div class="status"><span class="${statusClass}"></span>${escapeHtml(topStatus)}</div>
                </div>
            </aside>

            <main>
                ${body}
            </main>
        </div>

        <script src="/public/js/dashboard.js" defer></script>
    </body>
</html>`
}

function panel(title, content, classes = "") {
    return `<section class="panel ${classes}"><h2>${escapeHtml(title)}</h2>${content}</section>`
}

function renderCommandTable(commandStats = []) {
    const rows = commandStats.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.count)}</td>
            <td>${escapeHtml(item.lastUser || "unknown")}</td>
            <td>${escapeHtml(formatDate(item.lastUsedAt))}</td>
        </tr>
    `).join("") || `<tr><td colspan="4">No command usage recorded yet.</td></tr>`

    return `
        <table>
            <tr><td>Command</td><td>Count</td><td>Last user</td><td>Last used</td></tr>
            ${rows}
        </table>
    `
}

function renderFeedbackPreview(feedback = []) {
    return feedback.map(item => {
        const user = item.username || item.userId || "anonymous"
        const statusTone = item.status === "responded" ? "responded" : item.status === "read" ? "read" : "unread"
        return `
            <article class="feedback-row">
                <header>
                    <strong>${escapeHtml(user)}</strong>
                    <span>${escapeHtml(formatDate(item.timestamp))}</span>
                </header>
                <p>${escapeHtml(item.message)}</p>
                <footer>
                    <span class="chip chip--${escapeHtml(statusTone)}">${escapeHtml(item.status)}</span>
                    <span class="mono">${escapeHtml(item.id)}</span>
                </footer>
            </article>
        `
    }).join("") || `<p>No feedback yet.</p>`
}

function renderFeedbackState(item = {}) {
    const status = String(item.status || "unread").toLowerCase()
    const label = status === "responded" ? "Responded" : status === "read" ? "Read" : "Unread"

    return `<span class="chip chip--${escapeHtml(status)}">${escapeHtml(label)}</span>`
}

function renderFeedbackActions(item = {}) {
    const status = String(item.status || "unread").toLowerCase()
    const markAction = status === "unread" ? "read" : "unread"

    return `
        <div class="feedback-actions">
            <button class="button" data-feedback-action="${escapeHtml(markAction)}" data-feedback-id="${escapeHtml(item.id)}" type="button">${status === "unread" ? "Mark as Read" : "Mark as Unread"}</button>
            <button class="button" data-feedback-action="open" data-feedback-id="${escapeHtml(item.id)}" type="button">Open</button>
            <button class="button" data-feedback-action="delete" data-feedback-id="${escapeHtml(item.id)}" type="button">Delete</button>
        </div>
    `
}

function renderLandingPage({ summary, commandStats = [], logs = [] }) {
    const details = `
        <p>The hosted dashboard is now running on the same port as the webhook server, sharing real-time health, logs, deployments, and admin controls.</p>
        <p>You can manage the bot, read command usage, and watch the current log stream without opening the server by hand.</p>
        <div class="chips">
            <span class="chip">branch ${escapeHtml(summary.branch)}</span>
            <span class="chip">commit ${escapeHtml(summary.commit)}</span>
            <span class="chip">node ${escapeHtml(summary.nodeVersion)}</span>
        </div>
    `

    const quick = `
        <table>
            <tr><td>Bot</td><td>${escapeHtml(summary.botOnline)}</td></tr>
            <tr><td>Uptime</td><td>${escapeHtml(summary.uptimeText)}</td></tr>
            <tr><td>Deployment</td><td>${escapeHtml(summary.deploymentStatus)}</td></tr>
            <tr><td>Last Deploy</td><td>${escapeHtml(summary.lastDeploymentText)}</td></tr>
        </table>
    `

    const recentLogs = logs.map(line => `<div class="terminal-line">${ansiToHtml(line)}</div>`).join("") || `<div class="terminal-line">No log data yet.</div>`

    return shell({
        title: "Slackzilla | Dashboard",
        active: "home",
        state: summary,
        body: `
            ${panel("SERVER DASHBOARD", details)}
            ${panel("BOT CONTROL SURFACE", `
                <p>Open the admin panel for authenticated actions like restart, redeploy, and feedback triage.</p>
                <div class="toolbar toolbar--stacked">
                    <a class="button" href="/admin">Open admin</a>
                    <a class="button button--ghost" href="/status">Open status</a>
                    <a class="button button--ghost" href="/logs">Open logs</a>
                    <a class="button button--ghost" href="/admin/feedback">Open feedback</a>
                </div>
            `)}
            ${panel("QUICK STATUS", quick)}
            ${panel("TOP COMMANDS", renderCommandTable(commandStats.slice(0, 5)))}
            ${panel("ROUTES", `
                <ul>
                    <li><h3>Status</h3><p>Live health metrics from <span class="mono">/api/status/stream</span>.</p></li>
                    <li><h3>Logs</h3><p>Streaming terminal output from <span class="mono">/api/logs/stream</span>.</p></li>
                    <li><h3>Admin</h3><p>Authenticated controls for deploy/restart, feedback triage, and command stats.</p></li>
                </ul>
            `)}
            ${panel("RECENT SIGNALS", `
                <div class="terminal terminal--mini">${recentLogs}</div>
            `)}
        `
    })
}

function renderStatusPage({ status, commandStats = [] }) {
    return shell({
        title: "Slackzilla | Uptime",
        active: "status",
        state: status,
        body: `
            ${panel("UPTIME", `
                <div class="status-line"><span class="${["active", "online"].includes(String(status.botOnline).toLowerCase()) ? "dot" : "dot dot--red"}"></span>${escapeHtml(status.botOnline)}</div>
            `)}

            ${panel("SYSTEM", `
                <table>
                    <tr><td>Uptime</td><td data-field="uptime">${escapeHtml(status.uptimeText)}</td></tr>
                    <tr><td>Node.js</td><td data-field="nodeVersion">${escapeHtml(status.nodeVersion)}</td></tr>
                    <tr><td>Platform</td><td data-field="platform">${escapeHtml(status.platform)}</td></tr>
                    <tr><td>Branch</td><td data-field="branch">${escapeHtml(status.branch)}</td></tr>
                    <tr><td>Commit</td><td data-field="commit">${escapeHtml(status.commit)}</td></tr>
                    <tr><td>Last Commit</td><td data-field="lastCommitAt">${escapeHtml(status.lastCommitAtText)}</td></tr>
                </table>
            `)}

            ${panel("STATISTICS", `
                <table>
                    <tr><td>Memory</td><td data-field="resources">${escapeHtml(status.memoryText)}</td></tr>
                    <tr><td>RSS</td><td data-field="rss">${escapeHtml(status.rssText)}</td></tr>
                    <tr><td>CPU</td><td data-field="cpu">${escapeHtml(status.cpuText)}</td></tr>
                    <tr><td>Load</td><td data-field="load">${escapeHtml(status.loadText)}</td></tr>
                    <tr><td>Deploy Status</td><td data-field="deployment">${escapeHtml(status.deploymentStatus)}</td></tr>
                    <tr><td>Last Deploy</td><td>${escapeHtml(status.lastDeploymentText)}</td></tr>
                </table>
            `)}

            ${panel("TOP COMMANDS", `<div id="status-command-stats">${renderCommandTable(commandStats)}</div>`)}

            ${panel("DEPLOYMENT SNAPSHOT", `
                <table>
                    <tr><td>Commit</td><td>${escapeHtml(status.commit)}</td></tr>
                    <tr><td>Branch</td><td>${escapeHtml(status.branch)}</td></tr>
                    <tr><td>Last commit</td><td>${escapeHtml(status.lastCommitAtText)}</td></tr>
                    <tr><td>Result</td><td>${escapeHtml(status.lastDeploymentResult || "unknown")}</td></tr>
                </table>
            `)}
        `
    })
}

function renderLogsPage({ logs }) {
    return shell({
        title: "Slackzilla | Logs",
        active: "logs",
        state: { logs },
        body: `
            <section class="panel panel--logs-header">
                <h2>LOGS</h2>
                <div class="toolbar">
                    <input id="log-search" class="input" type="search" placeholder="Search logs" autocomplete="off" />
                    <select id="log-level" class="input">
                        <option value="all">All levels</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="error">Error</option>
                        <option value="warn">Warn</option>
                    </select>
                    <button class="button" id="log-pause" type="button">Pause</button>
                    <button class="button" id="log-clear" type="button">Clear</button>
                    <button class="button" id="log-copy" type="button">Copy</button>
                    <button class="button" id="log-download" type="button">Download</button>
                </div>
            </section>

            <section class="panel panel--terminal">
                <div class="terminal-meta"><span>live feed</span><span id="log-status">connected</span></div>
                <div id="log-terminal" class="terminal" tabindex="0" aria-live="polite"></div>
            </section>

            <script type="application/json" id="initial-logs">${serializeState(logs)}</script>
        `
    })
}

function renderLoginPage({ csrfToken, error = "" }) {
    return shell({
        title: "Slackzilla | Admin",
        active: "admin",
        state: { csrfToken },
        body: `
            <section class="panel panel--auth">
                <h2>ADMIN LOGIN</h2>
                <p>Enter the actual admin password. The hash in the environment is only used for verification.</p>
                ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
                <form method="post" action="/admin/login" class="stack-form">
                    <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}" />
                    <label>
                        <span>Password</span>
                        <input class="input" type="password" name="password" required autofocus />
                    </label>
                    <button class="button" type="submit">Unlock</button>
                </form>
            </section>
        `
    })
}

function renderAdminDashboardPage({ summary, feedback, commandStats, logs, runtimeConfig, csrfToken }) {
    const latestLogs = logs.map(line => `<div class="terminal-line">${ansiToHtml(line)}</div>`).join("") || `<div class="terminal-line">No logs yet</div>`

    return shell({
        title: "Slackzilla | Admin Panel",
        active: "admin",
        admin: true,
        csrfToken,
        state: { summary, feedback, commandStats, logs, csrfToken },
        body: `
            <div id="admin-action-status" class="action-status">Ready.</div>
            ${panel("ADMIN PANEL", `
                <p>Secure controls for service operations, deploy flow, inbox moderation, and the bot's runtime details.</p>
                <div class="toolbar toolbar--stacked">
                    <button class="button" data-admin-action="start" type="button">Start bot</button>
                    <button class="button" data-admin-action="stop" type="button">Stop bot</button>
                    <button class="button" data-admin-action="restart" type="button">Restart bot</button>
                    <button class="button" data-admin-action="redeploy" type="button">Redeploy</button>
                    <button class="button" data-admin-action="refresh" type="button">Refresh</button>
                    <button class="button button--ghost" data-admin-action="refresh-status" type="button">Refresh status</button>
                    <button class="button button--ghost" data-admin-action="refresh-logs" type="button">Refresh logs</button>
                </div>
            `)}

            ${panel("LIVE STATUS", `
                <table id="admin-status-list">
                    <tr><td>Bot</td><td data-field="botOnline">${escapeHtml(summary.botOnline)}</td></tr>
                    <tr><td>Uptime</td><td data-field="uptime">${escapeHtml(summary.uptimeText)}</td></tr>
                    <tr><td>Branch</td><td data-field="branch">${escapeHtml(summary.branch)}</td></tr>
                    <tr><td>Commit</td><td data-field="commit">${escapeHtml(summary.commit)}</td></tr>
                    <tr><td>Deployment</td><td data-field="deployment">${escapeHtml(summary.deploymentStatus)}</td></tr>
                </table>
                <pre id="deploy-output">${escapeHtml(summary.lastDeploymentOutput || "No deployment output yet")}</pre>
            `)}

            ${panel("RUNTIME CONFIG", `
                <table>
                    <tr><td>Port</td><td>${escapeHtml(runtimeConfig.port)}</td></tr>
                    <tr><td>Project dir</td><td class="mono">${escapeHtml(runtimeConfig.projectDir)}</td></tr>
                    <tr><td>Deploy branch</td><td>${escapeHtml(runtimeConfig.deployBranch)}</td></tr>
                    <tr><td>Bot service</td><td>${escapeHtml(runtimeConfig.botServiceName)}</td></tr>
                    <tr><td>Cookie secure</td><td>${escapeHtml(String(runtimeConfig.cookieSecure))}</td></tr>
                    <tr><td>Webhook path</td><td class="mono">${escapeHtml(runtimeConfig.webhookPath)}</td></tr>
                </table>
            `)}

            ${panel("COMMAND STATS", `
                <table id="command-stats">
                    <tr><td>Command</td><td>Count</td><td>Last user</td><td>Last used</td></tr>
                    ${(commandStats || []).slice(0, 8).map(item => `
                        <tr>
                            <td>${escapeHtml(item.name)}</td>
                            <td>${escapeHtml(item.count)}</td>
                            <td>${escapeHtml(item.lastUser || "unknown")}</td>
                            <td>${escapeHtml(formatDate(item.lastUsedAt))}</td>
                        </tr>
                    `).join("") || `<tr><td colspan="4">No command usage recorded yet.</td></tr>`}
                </table>
            `)}

            ${panel("RECENT FEEDBACK", `
                <div id="recent-feedback">
                    ${(feedback || []).map(item => `
                        <article class="feedback-row feedback-row--compact" data-feedback-id="${escapeHtml(item.id)}">
                            <header>
                                <strong>${escapeHtml(item.username || item.userId || "anonymous")}</strong>
                                <span>${escapeHtml(formatDate(item.timestamp))}</span>
                            </header>
                            <p>${escapeHtml(item.message)}</p>
                            <footer>
                                ${renderFeedbackState(item)}
                                <span class="mono">${escapeHtml(item.id)}</span>
                                <a class="button button--ghost" href="/admin/feedback?id=${encodeURIComponent(item.id)}">Open</a>
                            </footer>
                        </article>
                    `).join("") || `<p>No feedback yet.</p>`}
                </div>
            `)}

            ${panel("LIVE LOG SNAPSHOT", `<div id="admin-log-terminal" class="terminal terminal--mini">${latestLogs}</div><p><a href="/logs">Open full logs</a></p>`)}

            <form method="post" action="/admin/logout" class="logout-form">
                <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}" />
                <button class="button" type="submit">Logout</button>
            </form>

            <script type="application/json" id="admin-data">${serializeState({ summary, feedback, commandStats, logs, csrfToken })}</script>
        `
    })
}

function renderFeedbackDetail(item) {
    if (!item) {
        return `<p class="note">Select a feedback item to view details and send a response.</p>`
    }

    const status = String(item.status || "unread").toLowerCase()
    const response = item.response || ""

    return `
        <article class="feedback-detail" data-feedback-id="${escapeHtml(item.id)}">
            <header class="feedback-detail__header">
                <div>
                    <div class="summary">Feedback ID</div>
                    <h3 class="mono">${escapeHtml(item.id)}</h3>
                </div>
                ${renderFeedbackState(item)}
            </header>

            <dl class="detail-list">
                <div><dt>Submitted</dt><dd>${escapeHtml(formatDate(item.timestamp))}</dd></div>
                <div><dt>From</dt><dd>${escapeHtml(item.username || item.userId || "anonymous")}</dd></div>
                <div><dt>User ID</dt><dd class="mono">${escapeHtml(item.userId || "unknown")}</dd></div>
                <div><dt>Status</dt><dd>${escapeHtml(status)}</dd></div>
            </dl>

            <section class="feedback-detail__section">
                <h4>Feedback</h4>
                <p class="feedback-detail__message">${escapeHtml(item.message)}</p>
            </section>

            <div class="toolbar toolbar--stacked">
                <button class="button" data-feedback-action="${status === "unread" ? "read" : "unread"}" data-feedback-id="${escapeHtml(item.id)}" type="button">${status === "unread" ? "Mark as Read" : "Mark as Unread"}</button>
                <button class="button button--ghost" data-feedback-action="refresh" data-feedback-id="${escapeHtml(item.id)}" type="button">Refresh</button>
            </div>

            <section class="feedback-detail__section">
                <h4>Response</h4>
                <label class="stack-form">
                    <span>Write a response to the Slack user</span>
                    <textarea class="input feedback-response" id="feedback-response-${escapeHtml(item.id)}" rows="8" maxlength="4000" placeholder="Type your response here">${escapeHtml(response)}</textarea>
                </label>
                <div class="toolbar">
                    <button class="button" data-feedback-action="respond" data-feedback-id="${escapeHtml(item.id)}" type="button">Send Response</button>
                </div>
                ${item.responseSentAt ? `<p class="note">Response sent at ${escapeHtml(formatDate(item.responseSentAt))}</p>` : ""}
                ${item.responseError ? `<p class="error">${escapeHtml(item.responseError)}</p>` : ""}
            </section>
        </article>
    `
}

function renderFeedbackPage({ feedback, query, status, csrfToken, selectedFeedback = null }) {
    const rows = feedback.map(item => {
        const user = item.username || item.userId || "anonymous"

        return `<article class="feedback-row" data-feedback-id="${escapeHtml(item.id)}">
            <header><strong>${escapeHtml(user)}</strong><span>${escapeHtml(formatDate(item.timestamp))}</span></header>
            <p>${escapeHtml(item.message)}</p>
            <footer>
                ${renderFeedbackState(item)}
                <span class="mono">${escapeHtml(item.id)}</span>
                <div class="feedback-actions">
                    <a class="button button--ghost" href="/admin/feedback?id=${encodeURIComponent(item.id)}">Open</a>
                    <button class="button" data-feedback-action="${item.status === "unread" ? "read" : "unread"}" data-feedback-id="${escapeHtml(item.id)}" type="button">${item.status === "unread" ? "Read" : "Unread"}</button>
                    <button class="button" data-feedback-action="respond" data-feedback-id="${escapeHtml(item.id)}" type="button">Respond</button>
                    <button class="button" data-feedback-action="delete" data-feedback-id="${escapeHtml(item.id)}" type="button">Delete</button>
                </div>
            </footer>
        </article>`
    }).join("") || "<p>No feedback found.</p>"

    return shell({
        title: "Slackzilla | Feedback",
        active: "admin",
        admin: true,
        csrfToken,
        state: { feedback, query, status, csrfToken, selectedFeedback },
        body: `
            <div id="admin-action-status" class="action-status">Ready.</div>
            ${panel("FEEDBACK INBOX", `
                <form id="feedback-filters" class="toolbar">
                    <input id="feedback-search" class="input" name="q" value="${escapeHtml(query)}" placeholder="Search feedback" />
                    <select id="feedback-status" class="input" name="status">
                        <option value="all"${status === "all" ? " selected" : ""}>All</option>
                        <option value="unread"${status === "unread" ? " selected" : ""}>Unread</option>
                        <option value="read"${status === "read" ? " selected" : ""}>Read</option>
                        <option value="responded"${status === "responded" ? " selected" : ""}>Responded</option>
                    </select>
                    <button class="button" type="submit">Filter</button>
                </form>
            `)}

            ${selectedFeedback ? panel("SELECTED FEEDBACK", renderFeedbackDetail(selectedFeedback)) : ""}

            <section class="feedback-list" id="feedback-list">${rows}</section>
            <form method="post" action="/admin/logout" class="logout-form">
                <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}" />
                <button class="button" type="submit">Logout</button>
            </form>
        `
    })
}

function renderDocsPage() {
    return shell({
        title: "Slackzilla | Docs",
        active: "docs",
        state: {},
        body: `
            ${panel("SERVER OVERVIEW", `
                <p>Slackzilla runs as two cooperating processes: the Slack bot handles commands and heartbeats, while the dashboard server serves public pages, APIs, admin tools, and deployment hooks.</p>
                <p>The live system is intentionally modular so status, logs, feedback, and deployment logic can evolve without a single giant entry point.</p>
            `)}
            ${panel("OPERATIONS", `
                <ul>
                    <li><h3>Bot</h3><p>Handles slash commands, app mentions, and feedback capture.</p></li>
                    <li><h3>Dashboard</h3><p>Serves public status, live logs, admin pages, API docs, and webhook deployment handling.</p></li>
                    <li><h3>Storage</h3><p>Uses simple JSON and log files under <span class="mono">server/database</span> and <span class="mono">server/logs</span>.</p></li>
                </ul>
            `)}
        `
    })
}

function renderApiDocsPage() {
    const endpoints = [
        {
            method: "GET",
            path: "/api/status",
            auth: "Public",
            purpose: "Return the current bot and server status snapshot.",
            request: "No request body.",
            response: `{
  "ok": true,
  "data": {
    "botOnline": "online",
    "uptimeText": "26m 8s",
    "nodeVersion": "v22.22.1",
    "platform": "linux"
  }
}`
        },
        {
            method: "GET",
            path: "/api/logs",
            auth: "Public",
            purpose: "Return the current log snapshot and line count.",
            request: "No request body.",
            response: `{
  "ok": true,
  "data": {
    "size": 12345,
    "lines": ["[01/01/2026 ...] Slackzilla online"]
  }
}`
        },
        {
            method: "GET",
            path: "/api/admin/summary",
            auth: "Admin session + CSRF not required for reads",
            purpose: "Return the authenticated admin dashboard snapshot.",
            request: "Requires an authenticated admin cookie.",
            response: `{
  "ok": true,
  "data": {
    "status": { "botOnline": "online" },
    "feedback": [],
    "commandStats": []
  }
}`
        },
        {
            method: "GET",
            path: "/api/admin/feedback",
            auth: "Admin session cookie",
            purpose: "Return a filtered list of feedback entries.",
            request: "Optional query parameters: q, status.",
            response: `{
  "ok": true,
  "data": {
    "feedback": []
  }
}`
        },
        {
            method: "GET",
            path: "/api/admin/feedback/:id",
            auth: "Admin session cookie",
            purpose: "Return a single feedback entry by ID.",
            request: "Replace :id with the feedback ID from the inbox.",
            response: `{
  "ok": true,
  "data": {
    "feedback": {
      "id": "a71c28fa-863d-447e-84a3-627bd5120572"
    }
  }
}`
        },
        {
            method: "POST",
            path: "/api/admin/feedback/:id",
            auth: "Admin session + CSRF",
            purpose: "Update feedback state or send a response DM.",
            request: `{
  "action": "respond",
  "response": "Thanks for the report"
}`,
            response: `{
  "ok": true,
  "data": {
    "feedback": { "status": "responded" }
  }
}`
        },
        {
            method: "POST",
            path: "/api/admin/control",
            auth: "Admin session + CSRF",
            purpose: "Trigger bot and deployment actions from the dashboard.",
            request: `{
  "action": "refresh-status"
}`,
            response: `{
  "ok": true,
  "data": {
    "status": { "botOnline": "online" }
  }
}`
        }
    ]

    return shell({
        title: "Slackzilla | API",
        active: "api",
        state: {},
        body: `
            ${panel("API OVERVIEW", `
                <p>The API is split into separate route modules for status, logs, feedback, admin summary, and control actions.</p>
                <p>All JSON endpoints return a predictable envelope: <span class="mono">ok: true</span> on success and <span class="mono">ok: false</span> with a stable error code on failure.</p>
            `)}
            ${panel("ENDPOINTS", endpoints.map(endpoint => `
                <div class="endpoint">
                    <div class="endpoint-header">
                        <span class="method ${endpoint.method.toLowerCase()}">${escapeHtml(endpoint.method)}</span>
                        <span class="endpoint-url">${escapeHtml(endpoint.path)}</span>
                    </div>
                    <table>
                        <tr><td>Purpose</td><td>${escapeHtml(endpoint.purpose)}</td></tr>
                        <tr><td>Authentication</td><td>${escapeHtml(endpoint.auth)}</td></tr>
                        <tr><td>Request</td><td><pre>${escapeHtml(endpoint.request)}</pre></td></tr>
                        <tr><td>Response</td><td><pre>${escapeHtml(endpoint.response)}</pre></td></tr>
                    </table>
                </div>
            `).join(""))}
            ${panel("ERRORS", `
                <p>Errors follow the same shape everywhere:</p>
                <pre>${escapeHtml(JSON.stringify({ ok: false, error: "Feedback not found", code: "FEEDBACK_NOT_FOUND" }, null, 2))}</pre>
            `)}
        `
    })
}

module.exports = {
    escapeHtml,
    serializeState,
    formatBytes,
    formatDate,
    renderLandingPage,
    renderStatusPage,
    renderLogsPage,
    renderLoginPage,
    renderAdminDashboardPage,
    renderFeedbackPage,
    renderFeedbackDetail,
    renderDocsPage,
    renderApiDocsPage
}
