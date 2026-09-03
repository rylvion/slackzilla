const fs = require("fs")
const http = require("http")
const path = require("path")
const crypto = require("crypto")
const { URL } = require("url")

require("dotenv").config({ path: path.join(__dirname, ".env") })
require("dotenv").config({ path: path.join(__dirname, "..", "bot", ".env") })
require("dotenv").config({ path: path.join(__dirname, "..", "src", ".env") })

const store = require("./database/store")
const { createAuth } = require("./lib/auth")
const { sendText, sendJson, sendHtml, parseBody } = require("./lib/http")
const {
    runDeployScript,
    runSystemctl,
    getRuntimeSnapshot,
    saveDeploymentState
} = require("./lib/system")

const { handlePublicPages } = require("./pages/public")
const { handleAdminPages } = require("./pages/admin")
const { handleStatusApi } = require("./api/status")
const { handleLogsApi } = require("./api/logs")
const { handleMetricsApi } = require("./api/metrics")
const { handleAdminApi } = require("./api/admin")
const { handleFeedbackApi } = require("./api/feedback")
const { handleControlApi } = require("./api/control")
const { handleCommandsApi } = require("./api/commands")
const { handleAskApi } = require("./api/ask")

const port = Number(process.env.PORT || 9000)
const projectDir = process.env.PROJECT_DIR || process.cwd()
const webhookSecret = process.env.WEBHOOK_SECRET
const deployBranch = process.env.BRANCH || "main"
const botServiceName = process.env.SERVICE_NAME || "slackzilla"
const webhookServiceName = process.env.WEBHOOK_SERVICE_NAME || "slackzilla-webhook"
const deployScript = path.join(__dirname, "deploy.sh")
const cookieSecure = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true"

const runtimeConfig = {
    port,
    projectDir,
    deployBranch,
    botServiceName,
    webhookServiceName,
    cookieSecure,
    webhookPath: "/webhook"
}

function validateEnvVar(name, value) {
    if (!value) {
        console.error(`Missing ${name} in server/.env`)
        process.exit(1)
    }
}

validateEnvVar("WEBHOOK_SECRET", webhookSecret)
validateEnvVar("ADMIN_PASSWORD_HASH", process.env.ADMIN_PASSWORD_HASH)
validateEnvVar("ADMIN_SESSION_SECRET", process.env.ADMIN_SESSION_SECRET)

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

function normaliseStatus(snapshot) {
    const deployment = store.readDeploymentState()
    const botMetrics = store.getBotMetrics()
    const systemUsedMemory = snapshot.systemTotalMemory !== null && snapshot.systemFreeMemory !== null
        ? snapshot.systemTotalMemory - snapshot.systemFreeMemory
        : null
    const memoryUsedPercent = snapshot.systemTotalMemory && systemUsedMemory !== null
        ? (systemUsedMemory / snapshot.systemTotalMemory) * 100
        : null
    const diskUsedPercent = snapshot.disk.total
        ? (snapshot.disk.used / snapshot.disk.total) * 100
        : null
    
    return {
        botOnline: snapshot.botOnline,
        uptimeText: formatDuration(snapshot.uptime),
        nodeVersion: snapshot.nodeVersion,
        platform: snapshot.platform,
        commit: snapshot.commit,
        branch: snapshot.branch,
        lastCommitAtText: snapshot.lastCommitAt ? new Date(snapshot.lastCommitAt).toLocaleString() : "unknown",
        lastDeploymentText: deployment.lastDeploymentAt ? new Date(deployment.lastDeploymentAt).toLocaleString() : "unknown",
        deploymentStatus: deployment.status,
        lastDeploymentOutput: (deployment.lastDeploymentOutput || []).join("\n").trim(),
        rssText: formatBytes(snapshot.memoryRss),
        cpuText: `${snapshot.cpuPercent.toFixed(2)}%`,
        memoryText: systemUsedMemory !== null ? `${formatBytes(systemUsedMemory)} / ${formatBytes(snapshot.systemTotalMemory)}` : "unavailable",
        processMemoryText: formatBytes(snapshot.memoryRss),
        loadText: snapshot.systemLoadAverage.map(value => value.toFixed(2)).join(" / "),
        lastDeploymentAt: deployment.lastDeploymentAt,
        lastDeploymentCommit: deployment.lastDeploymentCommit,
        lastDeploymentResult: deployment.lastDeploymentResult,
        systemTotalMemory: snapshot.systemTotalMemory,
        systemFreeMemory: snapshot.systemFreeMemory,
        memoryUsedPercent,
        diskTotal: snapshot.disk.total,
        diskFree: snapshot.disk.free,
        diskUsed: snapshot.disk.used,
        diskUsedPercent,
        networkRxBytes: snapshot.network.rxBytes,
        networkTxBytes: snapshot.network.txBytes,
        networkRxRate: snapshot.network.rxRate,
        networkTxRate: snapshot.network.txRate,
        commandsExecuted: botMetrics.commandsExecuted,
        uniqueUsers: botMetrics.uniqueUsers,
        uniqueChannels: botMetrics.uniqueChannels,
        commandStats: botMetrics.commandStats.slice(0, 12)
    }
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

function createStreamSet() {
    return new Set()
}

const logClients = createStreamSet()
const statusClients = createStreamSet()
const adminClients = createStreamSet()
const telemetryHistory = []
let latestStatusPayload = null

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
    const payload = normaliseStatus(snapshot)

    telemetryHistory.push({
        time: new Date().toISOString(),
        cpuPercent: payload.cpuText === "unavailable" ? null : Number.parseFloat(payload.cpuText),
        memoryUsedPercent: payload.memoryUsedPercent,
        diskUsedPercent: payload.diskUsedPercent,
        networkRxRate: payload.networkRxRate,
        networkTxRate: payload.networkTxRate
    })
    telemetryHistory.splice(0, Math.max(0, telemetryHistory.length - 120))
    payload.telemetryHistory = telemetryHistory
    latestStatusPayload = payload

    return payload
}

function buildAdminSummary(csrfToken = "") {
    return {
        status: latestStatusPayload || renderStatusPayload(),
        feedback: store.listFeedback({ status: "all" }).slice(0, 5),
        commandStats: store.getBotMetrics().commandStats.slice(0, 8),
        serverEvents: store.getServerEvents(50),
        logs: splitLogLines(store.getLogSnapshot().content).slice(-20),
        runtimeConfig,
        csrfToken
    }
}

function refreshAndBroadcastStatus() {
    const status = renderStatusPayload()
    broadcast(statusClients, "status", status)
    broadcast(adminClients, "status", status)
    broadcast(statusClients, "summary", {
        commandStats: store.getBotMetrics().commandStats.slice(0, 8)
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

function watchLogs() {
    let previousSize = store.getLogSnapshot().size

    fs.watchFile(store.logFile, { interval: 500 }, (current) => {
        if (current.size < previousSize) { previousSize = 0 }
        if (current.size === previousSize) { return }

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
        for (const line of splitLogLines(content)) {
            broadcast(logClients, "log", { line })
            broadcast(adminClients, "log", { line })
        }
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

function handleStatic(req, res, pathname) {
    if (req.method !== "GET") {
        return false
    }

    let filePath
    let rootPath

    if (pathname.startsWith("/public/")) {
        rootPath = path.join(__dirname, "public")
        filePath = path.normalize(
            path.join(rootPath, pathname.slice("/public/".length))
        )
    } else if (pathname.startsWith("/assets/attachments/")) {
        rootPath = path.join(__dirname, "..", "assets")
        filePath = path.normalize(
            path.join(rootPath, pathname.slice("/assets/".length))
        )
    } else if (pathname.startsWith("/assets/")) {
        rootPath = path.join(__dirname, "client", "dist")
        filePath = path.normalize(
            path.join(rootPath, pathname.slice(1))
        )
    } else if (pathname === "/favicon.svg") {
        rootPath = path.join(__dirname, "client", "dist")
        filePath = path.join(rootPath, "favicon.svg")
    } else {
        return false
    }

    if (!filePath.startsWith(rootPath)) {
        sendText(res, 403, "Forbidden\n")
        return true
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendText(res, 404, "Not found\n")
        return true
    }

    const ext = path.extname(filePath)

    const contentType = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2"
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
        } catch (error) {
            const state = store.saveDeploymentState({
                status: "failed",
                lastDeploymentAt: new Date().toISOString(),
                lastDeploymentCommit: payload.after || null,
                lastDeploymentOutput: [error.message],
                lastDeploymentResult: "failed"
            })

            broadcast(adminClients, "deploy", state)
            store.appendLogChunk(`deployment failed: ${error.message}\n`)
            refreshAndBroadcastStatus()
        }
    })

    return true
}

const context = {
    store,
    auth,
    runtimeConfig,
    deployScript,
    sendText,
    sendJson,
    sendHtml,
    sendOk: (res, data, statusCode) => {
        sendJson(res, statusCode || 200, {
            ok: true,
            data
        })
    },
    sendError: (res, statusCode, code, error, details = {}) => {
        sendJson(res, statusCode, {
            ok: false,
            code,
            error,
            ...details
        })
    },
    parseBody,
    sendSse,
    registerStreamClient,
    broadcast,
    statusClients,
    logClients,
    adminClients,
    splitLogLines,
    getBotMetrics: () => store.getBotMetrics(),
    renderStatusPayload,
    buildAdminSummary,
    refreshAndBroadcastStatus,
    refreshAndBroadcastLogs,
    runDeployScript,
    runSystemctl,
    saveDeploymentState
}

async function handleApi(req, res, url) {
    if (await handleCommandsApi({ req, res, url, context })) return true
    if (await handleAskApi({ req, res, url, context })) return true
    if (await handleStatusApi({ req, res, url, context })) return true
    if (await handleLogsApi({ req, res, url, context })) return true
    if (await handleMetricsApi({ req, res, url, context })) return true
    if (await handleAdminApi({ req, res, url, context })) return true
    if (await handleFeedbackApi({ req, res, url, context })) return true
    if (await handleControlApi({ req, res, url, context })) return true
    return false
}

function handleReactApp(req, res, pathname) {
    if (req.method !== "GET") return false

    if (
        pathname.startsWith("/api/") ||
        pathname === "/webhook" ||
        pathname.startsWith("/public/") ||
        pathname.startsWith("/assets/")
    ) {
        return false
    }

    if (pathname === "/admin" || pathname === "/admin/feedback") {
        const session = auth.requireSession(req, res)
        if (!session) return true
    }

    const browserRoutes = new Set([
        "/",
        "/status",
        "/commands",
        "/logs",
        "/api",
        "/ai",
        "/docs",
        "/sitemap",
        "/admin",
        "/admin/login"
    ])
    const statusCode = browserRoutes.has(pathname) ? 200 : 404

    const distRoot = path.join(__dirname, "client", "dist")
    const indexPath = path.join(distRoot, "index.html")

    if (!fs.existsSync(indexPath)) {
        return false
    }

    sendText(
        res,
        statusCode,
        fs.readFileSync(indexPath),
        "text/html; charset=utf-8"
    )

    return true
}

async function handleAdminLogin(req, res, url) {
    if (url.pathname !== "/admin/login") return false

    if (req.method === "GET") {
        if (auth.getSessionFromRequest(req)) {
            res.statusCode = 302
            res.setHeader("Location", "/admin")
            res.end()
            return true
        }
        auth.issueLoginChallenge(req, res)
        return false
    }

    if (req.method !== "POST") return false

    const body = await parseBody(req)
    const result = auth.login(req, res, String(body.password || ""))

    if (!result.ok) {
        sendJson(res, result.status || 401, {
            ok: false,
            error: result.message
        })
        return true
    }

    sendJson(res, 200, { ok: true, data: { redirect: "/admin" } })
    return true
}

async function handleRequest(req, res) {
    const url = new URL(req.url, "http://localhost")

    res.once("finish", () => {
        try {
            store.recordServerEvent({ method: req.method, path: url.pathname, statusCode: res.statusCode })
        } catch {
            // Telemetry must not prevent the request from being served.
        }
    })

    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "same-origin")
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    if (handleStatic(req, res, url.pathname)) return
    if (handleWebhook(req, res, url)) return
    if (await handleAdminLogin(req, res, url)) return
    if (await handleApi(req, res, url)) return
    if (handleReactApp(req, res, url.pathname)) return
    sendText(res, 404, "Not found\n")
}

watchLogs()
refreshAndBroadcastStatus()
refreshAndBroadcastLogs()

setInterval(refreshAndBroadcastStatus, 1000)

http.createServer((req, res) => {
    Promise.resolve(handleRequest(req, res)).catch(error => {
        console.error("DASHBOARD REQUEST FAILED:", error)
        store.appendLogChunk(`dashboard server request failed: ${error.message}\n`)
        sendText(res, 500, "Internal server error\n")
    })
}).listen(port, () => {
    const msg = `dashboard server listening on port ${port}\nVisit http${process.env.NODE_ENV === "production" ? "s" : ""}://${cookieSecure? "your-domain-here.com" : "localhost"}:${port} in your browser to see the dashboard.\n`
    console.log(msg)
    store.appendLogChunk(msg)
})
