(function () {
    const state = window.__SLACKZILLA__ || {}
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || state.csrfToken || ""

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;")
    }

    function formatDate(value) {
        if (!value) return "unknown"
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
    }

    function ansiToHtml(text) {
        const map = {
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
        let open = []

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
                    const cls = map[code]
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

    function formatLogLine(raw) {
        const level = /\berror\b/i.test(raw)
            ? "error"
            : /\bsuccess\b/i.test(raw)
                ? "success"
                : /\bwarn\b/i.test(raw)
                    ? "warn"
                    : "info"

        return {
            raw,
            level,
            html: ansiToHtml(raw)
        }
    }

    function createTerminalLine(entry) {
        const node = document.createElement("div")
        node.className = "terminal-line"
        node.dataset.level = entry.level
        node.innerHTML = entry.html
        return node
    }

    function getTerminal() {
        return document.getElementById("log-terminal")
    }

    function getVisibleLines() {
        return Array.from(getTerminal()?.querySelectorAll(".terminal-line:not(.hidden)") || [])
    }

    function isAtBottom(el) {
        return el.scrollHeight - el.scrollTop - el.clientHeight < 24
    }

    function setScrollBottom(el) {
        el.scrollTop = el.scrollHeight
    }

    function filterTerminal() {
        const terminal = getTerminal()
        if (!terminal) return

        const query = (document.getElementById("log-search")?.value || "").toLowerCase()
        const level = document.getElementById("log-level")?.value || "all"

        for (const line of terminal.querySelectorAll(".terminal-line")) {
            const matchLevel = level === "all" || line.dataset.level === level
            const matchQuery = !query || line.textContent.toLowerCase().includes(query)
            line.classList.toggle("hidden", !(matchLevel && matchQuery))
        }
    }

    function appendLogLine(raw) {
        const terminal = getTerminal()
        if (!terminal) return

        const shouldScroll = isAtBottom(terminal)
        terminal.appendChild(createTerminalLine(formatLogLine(raw)))
        filterTerminal()

        const paused = document.body.dataset.logsPaused === "true"
        if (!paused && shouldScroll) {
            setScrollBottom(terminal)
        }
    }

    function renderInitialLogs(lines) {
        const terminal = getTerminal()
        if (!terminal) return

        terminal.innerHTML = ""
        for (const raw of lines) {
            terminal.appendChild(createTerminalLine(formatLogLine(raw)))
        }
        filterTerminal()
        setScrollBottom(terminal)
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
            throw new Error(data.error || response.statusText)
        }

        return data
    }

    function setupPublicStatus() {
        const source = new EventSource("/api/status/stream")
        const fields = {
            botOnline: document.querySelector('[data-field="botOnline"]'),
            uptime: document.querySelector('[data-field="uptime"]'),
            resources: document.querySelector('[data-field="resources"]'),
            deployment: document.querySelector('[data-field="deployment"]'),
            branch: document.querySelector('[data-field="branch"]'),
            commit: document.querySelector('[data-field="commit"]'),
            lastCommitAt: document.querySelector('[data-field="lastCommitAt"]'),
            nodeVersion: document.querySelector('[data-field="nodeVersion"]'),
            rss: document.querySelector('[data-field="rss"]'),
            cpu: document.querySelector('[data-field="cpu"]'),
            load: document.querySelector('[data-field="load"]'),
            platform: document.querySelector('[data-field="platform"]')
        }

        const commandStats = document.getElementById("status-command-stats")

        source.addEventListener("status", event => {
            const status = JSON.parse(event.data)

            if (fields.botOnline) fields.botOnline.textContent = status.botOnline
            if (fields.uptime) fields.uptime.textContent = status.uptimeText
            if (fields.resources) fields.resources.textContent = status.memoryText
            if (fields.deployment) fields.deployment.textContent = status.deploymentStatus
            if (fields.branch) fields.branch.textContent = status.branch
            if (fields.commit) fields.commit.textContent = status.commit
            if (fields.lastCommitAt) fields.lastCommitAt.textContent = status.lastCommitAtText
            if (fields.nodeVersion) fields.nodeVersion.textContent = status.nodeVersion
            if (fields.rss) fields.rss.textContent = status.rssText
            if (fields.cpu) fields.cpu.textContent = status.cpuText
            if (fields.load) fields.load.textContent = status.loadText
            if (fields.platform) fields.platform.textContent = status.platform
        })

        source.addEventListener("summary", event => {
            const payload = JSON.parse(event.data)
            if (!commandStats || !payload.commandStats) return

            const rows = payload.commandStats
                .slice(0, 8)
                .map(item => `
                    <tr>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.count)}</td>
                        <td>${escapeHtml(item.lastUser || "unknown")}</td>
                        <td>${escapeHtml(formatDate(item.lastUsedAt))}</td>
                    </tr>
                `)
                .join("") || `<tr><td colspan="4">No command usage recorded yet.</td></tr>`

            commandStats.innerHTML = `<table><tr><td>Command</td><td>Count</td><td>Last user</td><td>Last used</td></tr>${rows}</table>`
        })
    }

    function setupPublicLogs() {
        const initial = document.getElementById("initial-logs")
        const lines = initial ? JSON.parse(initial.textContent || "[]") : []
        renderInitialLogs(lines)

        const status = document.getElementById("log-status")
        const source = new EventSource("/api/logs/stream")

        source.addEventListener("snapshot", event => {
            const payload = JSON.parse(event.data)
            renderInitialLogs(payload.lines || [])
            if (status) status.textContent = "connected"
        })

        source.addEventListener("log", event => {
            const payload = JSON.parse(event.data)
            appendLogLine(payload.line)
        })

        source.onerror = () => {
            if (status) status.textContent = "reconnecting"
        }

        document.getElementById("log-search")?.addEventListener("input", filterTerminal)
        document.getElementById("log-level")?.addEventListener("change", filterTerminal)

        document.getElementById("log-pause")?.addEventListener("click", event => {
            const paused = document.body.dataset.logsPaused === "true"
            document.body.dataset.logsPaused = paused ? "false" : "true"
            event.currentTarget.textContent = paused ? "Pause" : "Resume"
        })

        document.getElementById("log-clear")?.addEventListener("click", () => {
            const search = document.getElementById("log-search")
            const level = document.getElementById("log-level")
            if (search) search.value = ""
            if (level) level.value = "all"
            filterTerminal()
        })

        document.getElementById("log-copy")?.addEventListener("click", async () => {
            const selection = getVisibleLines().map(line => line.textContent).join("\n")
            if (!selection) return
            await navigator.clipboard.writeText(selection)
        })

        document.getElementById("log-download")?.addEventListener("click", () => {
            const payload = getVisibleLines().map(line => line.textContent).join("\n")
            const blob = new Blob([payload], { type: "text/plain;charset=utf-8" })
            const link = document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.download = "slackzilla-logs.txt"
            link.click()
            URL.revokeObjectURL(link.href)
        })
    }

    function setupAdmin() {
        const data = document.getElementById("admin-data")
        const initial = data ? JSON.parse(data.textContent || "{}") : state
        const source = new EventSource("/api/admin/events")

        source.addEventListener("status", event => {
            const status = JSON.parse(event.data)
            updateAdminStatus(status)
        })

        source.addEventListener("summary", event => {
            const payload = JSON.parse(event.data)
            updateAdminSummary(payload)
        })

        source.addEventListener("deploy", event => {
            const payload = JSON.parse(event.data)
            const output = document.getElementById("deploy-output")
            if (output) output.textContent = (payload.lastDeploymentOutput || []).join("\n")
        })

        source.addEventListener("log", event => {
            const payload = JSON.parse(event.data)
            const terminal = document.getElementById("admin-log-terminal")
            if (terminal) terminal.textContent = payload.line
        })

        setupAdminActions(initial.csrfToken || csrfToken)
    }

    function updateAdminSummary(payload) {
        if (payload.status) updateAdminStatus(payload.status)

        const stats = document.getElementById("command-stats")
        if (stats && payload.commandStats) {
            const rows = payload.commandStats
                .slice(0, 8)
                .map(item => `
                    <tr>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.count)}</td>
                        <td>${escapeHtml(item.lastUser || "unknown")}</td>
                        <td>${escapeHtml(item.lastUsedAt || "unknown")}</td>
                    </tr>
                `)
                .join("") || `<tr><td colspan="4">No command usage recorded yet.</td></tr>`

            stats.innerHTML = `<tr><td>Command</td><td>Count</td><td>Last user</td><td>Last used</td></tr>${rows}`
        }

        const terminal = document.getElementById("admin-log-terminal")
        if (terminal && payload.logs) {
            terminal.textContent = payload.logs[payload.logs.length - 1] || terminal.textContent
        }

        const feedback = document.getElementById("recent-feedback")
        if (feedback && payload.feedback) {
            feedback.innerHTML = payload.feedback.map(item => `
                <article class="feedback-row">
                    <header><strong>${escapeHtml(item.username || item.userId || "anonymous")}</strong><span>${escapeHtml(formatDate(item.timestamp))}</span></header>
                    <p>${escapeHtml(item.message)}</p>
                    <footer><span class="chip">${escapeHtml(item.status)}</span><span class="mono">${escapeHtml(item.id)}</span></footer>
                </article>
            `).join("") || `<p>No feedback yet.</p>`
        }
    }

    function updateAdminStatus(status) {
        const update = (field, value) => {
            document.querySelector(`[data-field="${field}"]`)?.textContent = value
        }

        update("botOnline", status.botOnline)
        update("uptime", status.uptimeText)
        update("branch", status.branch)
        update("commit", status.commit)
    }

    function setupAdminActions(token) {
        const submitAction = async action => {
            const dangerous = ["restart", "stop", "redeploy"]
            if (dangerous.includes(action) && !confirm(`Are you sure you want to ${action} Slackzilla?`)) {
                return
            }

            await requestJson("/api/admin/control", {
                method: "POST",
                headers: {
                    "x-csrf-token": token
                },
                body: JSON.stringify({ action })
            })
        }

        document.querySelectorAll("[data-admin-action]").forEach(button => {
            button.addEventListener("click", async () => {
                const action = button.dataset.adminAction
                try {
                    await submitAction(action)
                } catch {
                    // keep UI responsive even if action fails
                }
            })
        })

        document.getElementById("feedback-filters")?.addEventListener("submit", event => {
            event.preventDefault()
            const search = document.getElementById("feedback-search")?.value || ""
            const status = document.getElementById("feedback-status")?.value || "all"
            window.location.search = `?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`
        })

        document.getElementById("feedback-list")?.addEventListener("click", async event => {
            const button = event.target.closest("[data-feedback-action]")
            if (!button) return

            const id = button.dataset.feedbackId
            const action = button.dataset.feedbackAction

            if (action === "delete" && !confirm("Delete this feedback entry?")) {
                return
            }

            try {
                await requestJson(`/api/admin/feedback/${id}`, {
                    method: "POST",
                    headers: {
                        "x-csrf-token": token
                    },
                    body: JSON.stringify({ action })
                })
                window.location.reload()
            } catch {
                // keep page state unchanged on request failure
            }
        })
    }

    if (document.body.classList.contains("app--status")) {
        setupPublicStatus()
    }

    if (document.body.classList.contains("app--logs")) {
        setupPublicLogs()
    }

    if (document.body.classList.contains("app--admin")) {
        setupAdmin()
    }
})()
