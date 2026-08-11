(function () {
    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;")
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

    function renderTerminal(target, lines) {
        if (!target) return

        target.innerHTML = lines.map(line => `<div class="terminal-line">${ansiToHtml(line)}</div>`).join("") || `<div class="terminal-line line-muted">No log data yet.</div>`
    }

    function updateMainActive() {
        const links = document.querySelectorAll("main > nav a")
        if (!links.length) return

        const hash = window.location.hash || "#overview"
        links.forEach(link => {
            link.classList.toggle("active", link.getAttribute("href") === hash)
        })
    }

    function loadLogFile() {
        return fetch("../../data/slackzilla.log")
            .then(response => response.text())
            .then(text => text.split(/\r?\n/).filter(Boolean))
    }

    function setupLogsPage() {
        const terminal = document.getElementById("log-terminal")
        const search = document.getElementById("log-search")
        const level = document.getElementById("log-level")
        const status = document.getElementById("log-status")

        let rawLines = []

        const applyFilters = () => {
            if (!terminal) return

            const query = (search?.value || "").toLowerCase()
            const selectedLevel = level?.value || "all"

            const visible = rawLines.filter(line => {
                const matchesQuery = !query || line.toLowerCase().includes(query)
                const matchesLevel = selectedLevel === "all" || (
                    selectedLevel === "error" && /error/i.test(line)
                ) || (
                    selectedLevel === "warn" && /warn/i.test(line)
                ) || (
                    selectedLevel === "success" && /success|online/i.test(line)
                ) || selectedLevel === "info"

                return matchesQuery && matchesLevel
            })

            renderTerminal(terminal, visible)
        }

        loadLogFile()
            .then(lines => {
                rawLines = lines
                renderTerminal(terminal, rawLines)
                if (status) status.textContent = "loaded"
            })
            .catch(() => {
                if (terminal) terminal.innerHTML = `<div class="terminal-line error">failed to load default log</div>`
                if (status) status.textContent = "offline"
            })

        search?.addEventListener("input", applyFilters)
        level?.addEventListener("change", applyFilters)
        document.getElementById("log-clear")?.addEventListener("click", () => {
            if (search) search.value = ""
            if (level) level.value = "all"
            applyFilters()
        })

        document.getElementById("log-copy")?.addEventListener("click", async () => {
            const payload = (terminal?.innerText || "").trim()
            if (!payload) return
            await navigator.clipboard.writeText(payload)
        })

        document.getElementById("log-download")?.addEventListener("click", () => {
            const payload = (terminal?.innerText || "").trim()
            const blob = new Blob([payload], { type: "text/plain;charset=utf-8" })
            const link = document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.download = "slackzilla-logs.txt"
            link.click()
            URL.revokeObjectURL(link.href)
        })
    }

    function setupDocsPage() {
        const terminal = document.getElementById("recent-signals")
        if (!terminal) return

        loadLogFile()
            .then(lines => {
                const recent = lines.slice(-8)
                renderTerminal(terminal, recent)
            })
            .catch(() => {
                terminal.innerHTML = `<div class="terminal-line error">failed to load recent signals</div>`
            })
    }

    window.addEventListener("DOMContentLoaded", () => {
        updateMainActive()

        if (document.body.classList.contains("app--logs")) {
            setupLogsPage()
        }

        if (document.body.classList.contains("app--docs")) {
            setupDocsPage()
        }
    })

    window.addEventListener("hashchange", updateMainActive)
})()