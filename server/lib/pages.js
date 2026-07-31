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

function shell({ title, active, body, state = {}, admin = false, csrfToken = "" }) {
    const nav = [
        { href: "/logs", label: "Logs", key: "logs" },
        { href: "/status", label: "Uptime", key: "status" },
        { href: "/api/status", label: "API", key: "api" },
        { href: "/", label: "Docs", key: "home" },
        { href: "/admin", label: "Admin", key: "admin" }
    ]

    const topStatus = String(state.botOnline || state.summary?.botOnline || "unknown")
    const online = topStatus.toLowerCase() === "active"
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
        return `
            <article class="feedback-row">
                <header>
                    <strong>${escapeHtml(user)}</strong>
                    <span>${escapeHtml(formatDate(item.timestamp))}</span>
                </header>
                <p>${escapeHtml(item.message)}</p>
                <footer>
                    <span class="chip">${escapeHtml(item.status)}</span>
                    <span class="mono">${escapeHtml(item.id)}</span>
                </footer>
            </article>
        `
    }).join("") || `<p>No feedback yet.</p>`
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

    const recentLogs = logs.map(line => `<div class="terminal-line">${escapeHtml(line)}</div>`).join("") || `<div class="terminal-line">No log data yet.</div>`

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
                <div class="status-line"><span class="${status.botOnline === "active" ? "dot" : "dot dot--red"}"></span>${escapeHtml(status.botOnline)}</div>
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
                <p>This hosted dashboard requires authentication.</p>
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
    const latestLog = logs[logs.length - 1] || "No logs yet"

    return shell({
        title: "Slackzilla | Admin Panel",
        active: "admin",
        admin: true,
        csrfToken,
        state: { summary, feedback, commandStats, logs, csrfToken },
        body: `
            ${panel("ADMIN PANEL", `
                <p>Secure controls for service operations, deploy flow, inbox moderation, and the bot's runtime details.</p>
                <div class="toolbar toolbar--stacked">
                    <button class="button" data-admin-action="start" type="button">Start bot</button>
                    <button class="button" data-admin-action="stop" type="button">Stop bot</button>
                    <button class="button" data-admin-action="restart" type="button">Restart bot</button>
                    <button class="button" data-admin-action="redeploy" type="button">Redeploy</button>
                    <button class="button" data-admin-action="refresh" type="button">Refresh</button>
                </div>
            `)}

            ${panel("LIVE STATUS", `
                <table id="admin-status-list">
                    <tr><td>Bot</td><td data-field="botOnline">${escapeHtml(summary.botOnline)}</td></tr>
                    <tr><td>Uptime</td><td data-field="uptime">${escapeHtml(summary.uptimeText)}</td></tr>
                    <tr><td>Branch</td><td data-field="branch">${escapeHtml(summary.branch)}</td></tr>
                    <tr><td>Commit</td><td data-field="commit">${escapeHtml(summary.commit)}</td></tr>
                    <tr><td>Deployment</td><td>${escapeHtml(summary.deploymentStatus)}</td></tr>
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

            ${panel("RECENT FEEDBACK", `<div id="recent-feedback">${renderFeedbackPreview(feedback)}</div>`)}

            ${panel("LIVE LOG SNAPSHOT", `<div id="admin-log-terminal" class="terminal terminal--mini">${escapeHtml(latestLog)}</div><p><a href="/logs">Open full logs</a></p>`)}

            <form method="post" action="/admin/logout" class="logout-form">
                <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}" />
                <button class="button" type="submit">Logout</button>
            </form>

            <script type="application/json" id="admin-data">${serializeState({ summary, feedback, commandStats, logs, csrfToken })}</script>
        `
    })
}

function renderFeedbackPage({ feedback, query, status, csrfToken }) {
    const rows = feedback.map(item => {
        const user = item.username || item.userId || "anonymous"

        return `<article class="feedback-row" data-feedback-id="${escapeHtml(item.id)}">
            <header><strong>${escapeHtml(user)}</strong><span>${escapeHtml(formatDate(item.timestamp))}</span></header>
            <p>${escapeHtml(item.message)}</p>
            <footer>
                <span class="chip">${escapeHtml(item.status)}</span>
                <span class="mono">${escapeHtml(item.id)}</span>
                <div class="feedback-actions">
                    <button class="button" data-feedback-action="read" data-feedback-id="${escapeHtml(item.id)}" type="button">Read</button>
                    <button class="button" data-feedback-action="archive" data-feedback-id="${escapeHtml(item.id)}" type="button">Archive</button>
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
        state: { feedback, query, status, csrfToken },
        body: `
            ${panel("FEEDBACK INBOX", `
                <form id="feedback-filters" class="toolbar">
                    <input id="feedback-search" class="input" name="q" value="${escapeHtml(query)}" placeholder="Search feedback" />
                    <select id="feedback-status" class="input" name="status">
                        <option value="all"${status === "all" ? " selected" : ""}>All</option>
                        <option value="unread"${status === "unread" ? " selected" : ""}>Unread</option>
                        <option value="read"${status === "read" ? " selected" : ""}>Read</option>
                        <option value="archived"${status === "archived" ? " selected" : ""}>Archived</option>
                    </select>
                    <button class="button" type="submit">Filter</button>
                </form>
            `)}
            <section class="feedback-list" id="feedback-list">${rows}</section>
            <form method="post" action="/admin/logout" class="logout-form">
                <input type="hidden" name="csrf" value="${escapeHtml(csrfToken)}" />
                <button class="button" type="submit">Logout</button>
            </form>
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
    renderFeedbackPage
}
