const fs = require("fs")
const http = require("http")
const path = require("path")
const crypto = require("crypto")
const { URL } = require("url")

require("dotenv").config({ path: path.join(__dirname, ".env") })

const { log } = require("../../src/utils/logger")
const store = require("./database/store")
const { createAuth } = require("./lib/auth")
const {
    runDeployScript,
    runSystemctl,
    getRuntimeSnapshot,
    saveDeploymentState
} = require("./lib/system")
const {
    formatBytes,
    formatDate,
    renderLandingPage,
    renderStatusPage,
    renderLogsPage,
    renderLoginPage,
    renderAdminDashboardPage,
    renderFeedbackPage,
    escapeHtml
} = require("./lib/pages")

const port = Number(process.env.PORT || 9000)
const projectDir = process.env.PROJECT_DIR || process.cwd()
const webhookSecret = process.env.WEBHOOK_SECRET
const deployBranch = process.env.BRANCH || "main"
const botServiceName =  process.env.SERVICE_NAME || "slackzilla"
const deployScript = path.join(__dirname, "deploy.sh")
const cookieSecure = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true"
const runtimeConfig = {
    port,
    projectDir,
    deployBranch,
    botServiceName,
    cookieSecure,
    webhookPath: "/webhook"
}

if (!webhookSecret) {
    console.error("Missing WEBHOOK_SECRET in server/.env")
    process.exit(1)
}

if (!process.env.ADMIN_PASSWORD_HASH) {
    console.error("Missing ADMIN_PASSWORD_HASH in server/.env")
    process.exit(1)
}

if (!process.env.ADMIN_SESSION_SECRET) {
    console.error("Missing ADMIN_SESSION_SECRET in server/.env")
    process.exit(1)
}

const auth = createAuth({
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
    cookieSecure
})

let cpuSample = {
    usage: process.cpuUsage(),
    hrtime: process.hrtime.bigint(),
    percent: 0
}

let runtimeSnapshot = getRuntimeSnapshot(cpuSample, projectDir, botServiceName)

function refreshRuntimeSnapshot() {
    runtimeSnapshot = getRuntimeSnapshot(cpuSample, projectDir, botServiceName)
    cpuSample = runtimeSnapshot.previousSample
    return runtimeSnapshot
}

function normalizeStatus(snapshot) {
    const deployment = store.readDeploymentState()

    return {
        botOnline: snapshot.botOnline,
        uptimeText: formatDuration(snapshot.uptime),
        nodeVersion: snapshot.nodeVersion,
        platform: snapshot.platform,
        commit: snapshot.commit,
        branch: snapshot.branch,
        lastCommitAtText: formatDate(snapshot.lastCommitAt),
        lastDeploymentText: formatDate(deployment.lastDeploymentAt),
        deploymentStatus: deployment.status,
        lastDeploymentOutput: (deployment.lastDeploymentOutput || []).join("\n").trim(),
        rssText: formatBytes(snapshot.memoryRss),
        cpuText: `${snapshot.cpuPercent.toFixed(2)}%`,
        memoryText: `${formatBytes(snapshot.memoryRss)} / ${formatBytes(snapshot.systemTotalMemory)}`,
        loadText: snapshot.systemLoadAverage.map(value => value.toFixed(2)).join(" / "),
        lastDeploymentAt: deployment.lastDeploymentAt,
        lastDeploymentCommit: deployment.lastDeploymentCommit,
        lastDeploymentResult: deployment.lastDeploymentResult,
        systemTotalMemory: snapshot.systemTotalMemory,
        systemFreeMemory: snapshot.systemFreeMemory
    }
}

function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds))
    const days = Math.floor(total / 86400)
    const hours = Math.floor((total % 86400) / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const secs = total % 60

    return [
        days > 0 ? `${days}d` : null,
        hours > 0 || days > 0 ? `${hours}h` : null,
        `${minutes}m`,
        `${secs}s`
    ].filter(Boolean).join(" ")
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
    res.statusCode = statusCode
    res.setHeader("Content-Type", contentType)
    res.end(text)
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(payload, null, 2))
}

function sendHtml(res, statusCode, html) {
    res.statusCode = statusCode
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.end(html)
}

function sendSseHeaders(res) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    })
    res.write("retry: 2500\n\n")
}

function sendSse(res, event, data) {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0

        req.on("data", chunk => {
            size += chunk.length
            if (size > 1024 * 1024) {
                reject(new Error("payload too large"))
                req.destroy()
                return
            }

            chunks.push(chunk)
        })

        req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8")
            const contentType = req.headers["content-type"] || ""

            if (contentType.includes("application/json")) {
                try {
                    resolve(raw ? JSON.parse(raw) : {})
                } catch (err) {
                    reject(err)
                }
                return
            }

            const form = new URLSearchParams(raw)
            resolve(Object.fromEntries(form.entries()))
        })

        req.on("error", reject)
    })
}

function verifyWebhookSignature(signature, body) {
    if (!signature || typeof signature !== "string") {
        return false
    }

    const expected = `sha256=${crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex")}`

    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)

    if (expectedBuffer.length !== signatureBuffer.length) {
        return false
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

function createStreamSet() {
    return new Set()
}

const logClients = createStreamSet()
const statusClients = createStreamSet()
const adminClients = createStreamSet()

function broadcast(clients, event, data) {
    for (const client of clients) {
        try {
            sendSse(client, event, data)
        } catch {
            clients.delete(client)
        }
    }
}

function registerStreamClient(clients, req, res, onClose) {
    sendSseHeaders(res)
    clients.add(res)

    req.on("close", () => {
        clients.delete(res)
        if (typeof onClose === "function") {
            onClose()
        }
    })
}

function splitLogLines(content) {
    return String(content || "").split(/\r?\n/).filter(Boolean)
}

function renderStatusPayload() {
    const snapshot = refreshRuntimeSnapshot()
    return normalizeStatus(snapshot)
}

function refreshAndBroadcastStatus() {
    const status = renderStatusPayload()
    broadcast(statusClients, "status", status)
    broadcast(adminClients, "status", status)
    broadcast(statusClients, "summary", {
        commandStats: store.getCommandStats().slice(0, 8)
    })
    broadcast(adminClients, "summary", buildAdminSummary())
    return status
}

function refreshAndBroadcastLogs() {
    const snapshot = store.getLogSnapshot()
    const lines = splitLogLines(snapshot.content)

    broadcast(logClients, "snapshot", {
        lines,
        size: snapshot.size
    })

    broadcast(adminClients, "logs", {
        lines: lines.slice(-50),
        size: snapshot.size
    })

    broadcast(adminClients, "summary", buildAdminSummary())

    return snapshot
}

function buildAdminSummary(csrfToken = "") {
    return {
        status: renderStatusPayload(),
        feedback: store.listFeedback({ status: "all" }).slice(0, 5),
        commandStats: store.getCommandStats().slice(0, 8),
        logs: splitLogLines(store.getLogSnapshot().content).slice(-20),
        runtimeConfig,
        csrfToken
    }
}

function watchLogs() {
    let previousSize = store.getLogSnapshot().size

    fs.watchFile(store.logFile, { interval: 500 }, (current, previous) => {
        if (current.size < previousSize) {
            previousSize = 0
        }

        if (current.size === previousSize) {
            return
        }

        const start = previousSize
        previousSize = current.size

        const buffer = Buffer.allocUnsafe(current.size - start)
        const fd = fs.openSync(store.logFile, "r")

        try {
            fs.readSync(fd, buffer, 0, buffer.length, start)
        } finally {
            fs.closeSync(fd)
        }

        const content = buffer.toString("utf8")
        const lines = splitLogLines(content)

        for (const line of lines) {
            broadcast(logClients, "log", { line })
            broadcast(adminClients, "log", { line })
        }
    })
}

function handleStatic(req, res, pathname) {
    if (!pathname.startsWith("/public/")) {
        return false
    }

    const filePath = path.normalize(path.join(__dirname, "public", pathname.slice("/public/".length)))
    const publicRoot = path.join(__dirname, "public")

    if (!filePath.startsWith(publicRoot)) {
        sendText(res, 403, "Forbidden\n")
        return true
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendText(res, 404, "Not found\n")
        return true
    }

    const ext = path.extname(filePath)
    const contentType = {
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon"
    }[ext] || "application/octet-stream"

    sendText(res, 200, fs.readFileSync(filePath), contentType)
    return true
}

function handleWebhook(req, res, url) {
    if (url.pathname !== "/webhook") {
        return false
    }

    if (req.method !== "POST") {
        sendText(res, 405, "Method not allowed\n")
        return true
    }

    const chunks = []
    let size = 0

    req.on("data", chunk => {
        size += chunk.length

        if (size > 1024 * 1024) {
            req.destroy()
            return
        }

        chunks.push(chunk)
    })

    req.on("end", async () => {
        const rawBody = Buffer.concat(chunks)
        const signature = req.headers["x-hub-signature-256"]
        const event = req.headers["x-github-event"]

        if (!verifyWebhookSignature(signature, rawBody)) {
            sendText(res, 401, "Invalid signature\n")
            return
        }

        let payload

        try {
            payload = JSON.parse(rawBody.toString("utf8"))
        } catch {
            sendText(res, 400, "Invalid JSON payload\n")
            return
        }

        if (event !== "push") {
            sendText(res, 202, "Ignored non-push event\n")
            return
        }

        const branchRef = `refs/heads/${deployBranch}`

        if (payload.ref !== branchRef) {
            sendText(res, 202, `Ignored push for ${payload.ref || "unknown ref"}\n`)
            return
        }

        const deployment = store.saveDeploymentState({
            status: "queued",
            lastDeploymentCommit: payload.after || null,
            lastDeploymentResult: "queued"
        })

        sendText(res, 202, `Accepted deploy for ${branchRef}\n`)
        broadcast(adminClients, "deploy", deployment)

        try {
            const result = await runDeployScript(deployScript, process.env, chunk => {
                store.appendLogChunk(chunk)
            })

            const state = store.saveDeploymentState({
                status: "success",
                lastDeploymentAt: new Date().toISOString(),
                lastDeploymentCommit: payload.after || null,
                lastDeploymentOutput: result.output.split(/\r?\n/).filter(Boolean),
                lastDeploymentResult: "success"
            })

            broadcast(adminClients, "deploy", state)
            refreshAndBroadcastStatus()
        } catch (err) {
            const state = store.saveDeploymentState({
                status: "failed",
                lastDeploymentAt: new Date().toISOString(),
                lastDeploymentCommit: payload.after || null,
                lastDeploymentOutput: [err.message],
                lastDeploymentResult: "failed"
            })

            broadcast(adminClients, "deploy", state)
            store.appendLogChunk(`deployment failed: ${err.message}\n`)
            refreshAndBroadcastStatus()
        }
    })

    return true
}

function handlePublicPages(req, res, url) {
    if (req.method !== "GET") {
        return false
    }

    if (url.pathname === "/") {
        const summary = renderStatusPayload()
        const commandStats = store.getCommandStats().slice(0, 5)
        const logs = splitLogLines(store.getLogSnapshot().content).slice(-8)
        sendHtml(res, 200, renderLandingPage({ summary, commandStats, logs }))
        return true
    }

    if (url.pathname === "/status") {
        const status = renderStatusPayload()
        const commandStats = store.getCommandStats().slice(0, 8)
        sendHtml(res, 200, renderStatusPage({ status, commandStats }))
        return true
    }

    if (url.pathname === "/logs") {
        const snapshot = store.getLogSnapshot()
        sendHtml(res, 200, renderLogsPage({ logs: splitLogLines(snapshot.content) }))
        return true
    }

    return false
}

function handleAdminPages(req, res, url) {
    if (!url.pathname.startsWith("/admin")) {
        return false
    }

    if (url.pathname === "/admin/login" && req.method === "GET") {
        const csrfToken = auth.issueLoginChallenge(req, res)
        const error = url.searchParams.get("error") || ""
        sendHtml(res, 200, renderLoginPage({ csrfToken, error }))
        return true
    }

    const session = auth.requireSession(req, res)

    if (!session) {
        return true
    }

    if (url.pathname === "/admin" && req.method === "GET") {
        const summary = renderStatusPayload()
        const feedback = store.listFeedback({ status: "all" }).slice(0, 5)
        const commandStats = store.getCommandStats().slice(0, 8)
        const logs = splitLogLines(store.getLogSnapshot().content).slice(-20)

        sendHtml(res, 200, renderAdminDashboardPage({ summary, feedback, commandStats, logs, runtimeConfig, csrfToken: session.csrfToken }))
        return true
    }

    if (url.pathname === "/admin/feedback" && req.method === "GET") {
        const feedback = store.listFeedback({
            query: url.searchParams.get("q") || "",
            status: url.searchParams.get("status") || "all"
        })

        sendHtml(res, 200, renderFeedbackPage({
            feedback,
            query: url.searchParams.get("q") || "",
            status: url.searchParams.get("status") || "all",
            csrfToken: session.csrfToken
        }))
        return true
    }

    return false
}

async function handleApi(req, res, url) {
    if (url.pathname === "/api/status" && req.method === "GET") {
        sendJson(res, 200, renderStatusPayload())
        return true
    }

    if (url.pathname === "/api/status/stream" && req.method === "GET") {
        const status = renderStatusPayload()
        registerStreamClient(statusClients, req, res)
        sendSse(res, "status", status)
        return true
    }

    if (url.pathname === "/api/logs" && req.method === "GET") {
        const snapshot = store.getLogSnapshot()
        sendJson(res, 200, {
            size: snapshot.size,
            lines: splitLogLines(snapshot.content)
        })
        return true
    }

    if (url.pathname === "/api/logs/download" && req.method === "GET") {
        const snapshot = store.getLogSnapshot()
        sendText(res, 200, snapshot.content, "text/plain; charset=utf-8")
        return true
    }

    if (url.pathname === "/api/logs/stream" && req.method === "GET") {
        const snapshot = store.getLogSnapshot()
        registerStreamClient(logClients, req, res)
        sendSse(res, "snapshot", {
            lines: splitLogLines(snapshot.content),
            size: snapshot.size
        })
        return true
    }

    if (url.pathname === "/api/admin/summary" && req.method === "GET") {
        const session = auth.requireSession(req, res)
        if (!session) return true

        sendJson(res, 200, buildAdminSummary(session.csrfToken))
        return true
    }

    if (url.pathname === "/api/admin/events" && req.method === "GET") {
        const session = auth.requireSession(req, res)
        if (!session) return true

        registerStreamClient(adminClients, req, res)
        sendSse(res, "summary", buildAdminSummary(session.csrfToken))
        return true
    }

    if (url.pathname === "/api/admin/feedback" && req.method === "GET") {
        const session = auth.requireSession(req, res)
        if (!session) return true

        const feedback = store.listFeedback({
            query: url.searchParams.get("q") || "",
            status: url.searchParams.get("status") || "all"
        })

        sendJson(res, 200, { feedback })
        return true
    }

    if (url.pathname.startsWith("/api/admin/feedback/") && req.method === "POST") {
        const session = auth.requireSession(req, res)
        if (!session) return true

        const body = await parseBody(req).catch(err => ({ __error: err }))
        if (body.__error) {
            sendJson(res, 400, { ok: false, error: body.__error.message })
            return true
        }

        req.body = body

        if (!auth.verifyCsrf(req, session)) {
            sendJson(res, 403, { ok: false, error: "invalid csrf token" })
            return true
        }

        const id = url.pathname.split("/").pop()
        const action = String(body.action || body.status || "").toLowerCase()

        if (action === "delete") {
            const ok = store.deleteFeedback(id)
            if (ok) {
                broadcast(adminClients, "summary", buildAdminSummary())
            }
            sendJson(res, ok ? 200 : 404, { ok })
            return true
        }

        if (action === "read" || action === "archive" || action === "unread") {
            const status = action === "read" ? "read" : action === "archive" ? "archived" : "unread"
            const updated = store.updateFeedback(id, { status })
            if (updated) {
                broadcast(adminClients, "summary", buildAdminSummary())
            }
            sendJson(res, updated ? 200 : 404, { ok: Boolean(updated), feedback: updated })
            return true
        }

        sendJson(res, 400, { ok: false, error: "invalid feedback action" })
        return true
    }

    if (url.pathname === "/api/admin/control" && req.method === "POST") {
        const session = auth.requireSession(req, res)
        if (!session) return true

        const body = await parseBody(req).catch(err => ({ __error: err }))
        if (body.__error) {
            sendJson(res, 400, { ok: false, error: body.__error.message })
            return true
        }

        req.body = body

        if (!auth.verifyCsrf(req, session)) {
            sendJson(res, 403, { ok: false, error: "invalid csrf token" })
            return true
        }

        const action = String(body.action || "").toLowerCase()

        try {
            if (action === "redeploy") {
                const result = await runDeployScript(deployScript, process.env, chunk => {
                    store.appendLogChunk(chunk)
                })

                const state = saveDeploymentState({
                    status: "success",
                    lastDeploymentAt: new Date().toISOString(),
                    lastDeploymentCommit: store.readDeploymentState().lastDeploymentCommit,
                    lastDeploymentOutput: result.output.split(/\r?\n/).filter(Boolean),
                    lastDeploymentResult: "success"
                })

                refreshAndBroadcastStatus()
                broadcast(adminClients, "deploy", state)
                broadcast(adminClients, "summary", buildAdminSummary())
                sendJson(res, 200, { ok: true, state })
                return true
            }

            if (["start", "stop", "restart"].includes(action)) {
                await runSystemctl(action, botServiceName)
                refreshAndBroadcastStatus()
                sendJson(res, 200, { ok: true, action })
                return true
            }

            if (action === "refresh") {
                const status = refreshAndBroadcastStatus()
                broadcast(adminClients, "summary", buildAdminSummary())
                sendJson(res, 200, { ok: true, status })
                return true
            }

            sendJson(res, 400, { ok: false, error: "unknown control action" })
            return true
        } catch (err) {
            const state = saveDeploymentState({
                status: "failed",
                lastDeploymentAt: new Date().toISOString(),
                lastDeploymentOutput: [err.message],
                lastDeploymentResult: "failed"
            })

            refreshAndBroadcastStatus()
            broadcast(adminClients, "deploy", state)
            broadcast(adminClients, "summary", buildAdminSummary())
            sendJson(res, 500, { ok: false, error: err.message })
            return true
        }
    }

    return false
}

async function handleLogin(req, res, url) {
    if (url.pathname === "/admin/login" && req.method === "POST") {
        const body = await parseBody(req).catch(err => ({ __error: err }))
        if (body.__error) {
            sendHtml(res, 400, renderLoginPage({ csrfToken: "", error: body.__error.message }))
            return true
        }

        req.body = body

        const result = auth.login(req, res, String(body.password || ""))

        if (!result.ok) {
            sendHtml(res, result.status || 401, renderLoginPage({ csrfToken: auth.issueLoginChallenge(req, res), error: result.message }))
            return true
        }

        res.statusCode = 302
        res.setHeader("Location", "/admin")
        res.end()
        return true
    }

    if (url.pathname === "/admin/logout" && req.method === "POST") {
        const session = auth.requireSession(req, res)
        if (!session) return true

        const body = await parseBody(req).catch(err => ({ __error: err }))
        if (body.__error) {
            sendText(res, 400, body.__error.message)
            return true
        }

        req.body = body

        if (!auth.verifyCsrf(req, session)) {
            sendText(res, 403, "invalid csrf token")
            return true
        }

        auth.logout(req, res)
        res.statusCode = 302
        res.setHeader("Location", "/")
        res.end()
        return true
    }

    return false
}

async function handleRequest(req, res) {
    const url = new URL(req.url, "http://localhost")

    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "same-origin")
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    if (handleStatic(req, res, url.pathname)) return
    if (handleWebhook(req, res, url)) return
    if (await handleLogin(req, res, url)) return
    if (handlePublicPages(req, res, url)) return
    if (await handleApi(req, res, url)) return
    if (handleAdminPages(req, res, url)) return

    sendText(res, 404, "Not found\n")
}

watchLogs()
refreshAndBroadcastStatus()
refreshAndBroadcastLogs()

setInterval(refreshAndBroadcastStatus, 5000)

http.createServer((req, res) => {
    handleRequest(req, res).catch(err => {
        log.error("dashboard server request failed: {0}", null, err.message)
        sendText(res, 500, "Internal server error\n")
    })
}).listen(port, () => {
    log.info("Slackzilla dashboard server listening on port {0}", null, port)
})