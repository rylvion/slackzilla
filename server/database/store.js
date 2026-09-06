const fs = require("fs")
const path = require("path")

const dataDir = __dirname
const logDir = path.join(__dirname, "..", "logs")
const logFile = path.join(logDir, "slackzilla.log")
const feedbackFile = path.join(dataDir, "feedback.json")
const metricsFile = path.join(dataDir, "metrics.json")
const deploymentFile = path.join(dataDir, "deployment.json")
const botStateFile = path.join(dataDir, "bot-state.json")

const defaultMetrics = {
    commands: {},
    users: {},
    channels: {},
    events: []
}

const defaultDeployment = {
    status: "idle",
    lastUpdatedAt: null,
    lastDeploymentAt: null,
    lastDeploymentCommit: null,
    lastDeploymentOutput: [],
    lastDeploymentResult: null
}

const defaultBotState = {
    status: "offline",
    pid: null,
    startedAt: null,
    lastHeartbeatAt: null,
    version: null,
    nodeVersion: null,
    platform: null,
    commandCount: null
}

function ensureDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function readJson(filePath, fallback) {
    try {
        const content = fs.readFileSync(filePath, "utf8")
        return JSON.parse(content)
    } catch {
        return structuredClone(fallback)
    }
}

function writeJson(filePath, data) {
    ensureDir(filePath)
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function appendLogLine(line) {
    ensureDir(logFile)
    fs.appendFileSync(logFile, `${line}\n`)
}

function appendLogChunk(chunk) {
    ensureDir(logFile)
    fs.appendFileSync(logFile, String(chunk))
}

function getLogSnapshot(maxBytes = 256 * 1024) {
    if (!fs.existsSync(logFile)) {
        return {
            content: "",
            size: 0
        }
    }

    const stat = fs.statSync(logFile)
    const start = Math.max(0, stat.size - maxBytes)
    const buffer = Buffer.allocUnsafe(stat.size - start)
    const fd = fs.openSync(logFile, "r")

    try {
        fs.readSync(fd, buffer, 0, buffer.length, start)
    } finally {
        fs.closeSync(fd)
    }

    return {
        content: buffer.toString("utf8"),
        size: stat.size
    }
}

function readJsonArray(filePath) {
    const data = readJson(filePath, [])
    return Array.isArray(data) ? data : []
}

function readFeedback() {
    return readJsonArray(feedbackFile)
}

function normaliseFeedbackEntry(entry = {}) {
    const status = String(entry.status || "unread").toLowerCase()
    const normalisedStatus = ["unread", "read", "responded"].includes(status) ? status : "unread"

    return {
        id: entry.id,
        userId: entry.userId || null,
        username: entry.username || null,
        message: String(entry.message || "").trim(),
        timestamp: entry.timestamp || new Date().toISOString(),
        status: normalisedStatus,
        response: typeof entry.response === "string" ? entry.response : "",
        responseSentAt: entry.responseSentAt || null,
        responseError: entry.responseError || null,
        updatedAt: entry.updatedAt || entry.timestamp || new Date().toISOString()
    }
}

function saveFeedback(items) {
    writeJson(feedbackFile, items.map(normaliseFeedbackEntry))
}

function addFeedback(entry) {
    const items = readFeedback()
    const normalised = normaliseFeedbackEntry(entry)
    items.unshift(normalised)
    saveFeedback(items)
    return normalised
}

function updateFeedback(id, patch) {
    const items = readFeedback()
    const index = items.findIndex(item => item.id === id)

    if (index === -1) {
        return null
    }

    const current = normaliseFeedbackEntry(items[index])
    const nextStatus = String(patch.status || current.status).toLowerCase()
    items[index] = normaliseFeedbackEntry({
        ...current,
        ...patch,
        status: ["unread", "read", "responded"].includes(nextStatus) ? nextStatus : current.status,
        updatedAt: new Date().toISOString()
    })

    saveFeedback(items)
    return items[index]
}

function deleteFeedback(id) {
    const items = readFeedback()
    const filtered = items.filter(item => item.id !== id)

    if (filtered.length === items.length) {
        return false
    }

    saveFeedback(filtered)
    return true
}

function listFeedback({ query = "", status = "all" } = {}) {
    const q = query.trim().toLowerCase()
    const items = readFeedback().filter(item => {
        const currentStatus = String(item.status || "unread").toLowerCase()

        if (status !== "all" && currentStatus !== status) {
            return false
        }

        if (!q) {
            return true
        }

        const haystack = [item.id, item.userId, item.username, item.message]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()

        return haystack.includes(q)
    })

    return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

function readBotState() {
    return readJson(botStateFile, defaultBotState)
}

function saveBotState(patch) {
    const state = {
        ...defaultBotState,
        ...readBotState(),
        ...patch,
        lastUpdatedAt: new Date().toISOString()
    }

    writeJson(botStateFile, state)
    return state
}

function getBotState() {
    return readBotState()
}

function recordBotHeartbeat(patch = {}) {
    const now = new Date().toISOString()

    return saveBotState({
        ...patch,
        status: "online",
        lastHeartbeatAt: now
    })
}

function readMetrics() {
    return readJson(metricsFile, defaultMetrics)
}

function saveMetrics(metrics) {
    writeJson(metricsFile, metrics)
}

function recordServerEvent(event = {}) {
    const metrics = readMetrics()
    metrics.serverEvents = Array.isArray(metrics.serverEvents) ? metrics.serverEvents : []
    metrics.serverEvents.unshift({
        source: "server",
        time: new Date().toISOString(),
        method: event.method || null,
        path: event.path || null,
        type: event.type || "request",
        statusCode: Number(event.statusCode) || null
    })
    metrics.serverEvents = metrics.serverEvents.slice(0, 1000)
    saveMetrics(metrics)
}

function getServerEvents(limit = 100) {
    const metrics = readMetrics()
    return (metrics.serverEvents || []).slice(0, limit)
}

function recordCommandUsage(commandName, command) {
    const metrics = readMetrics()
    const key = String(commandName || "unknown").replace(/^\//, "")
    const existing = metrics.commands[key] || { count: 0, lastUsedAt: null, lastUser: null, lastUserId: null }
    const userId = command?.user_id || null
    const channelId = command?.channel_id || null

    metrics.commands[key] = {
        ...existing,
        count: existing.count + 1,
        lastUsedAt: new Date().toISOString(),
        lastUser: command?.user_name || null,
        lastUserId: command?.user_id || null
    }

    metrics.users = metrics.users || {}
    metrics.channels = metrics.channels || {}
    metrics.events = Array.isArray(metrics.events) ? metrics.events : []

    if (userId) {
        metrics.users[userId] = {
            name: command?.user_name || null,
            lastUsedAt: new Date().toISOString()
        }
    }

    if (channelId) {
        metrics.channels[channelId] = {
            lastUsedAt: new Date().toISOString()
        }
    }

    metrics.events.unshift({
        command: key,
        user: command?.user_name || null,
        userId,
        channelId,
        time: new Date().toISOString()
    })
    metrics.events = metrics.events.slice(0, 1000)

    saveMetrics(metrics)
}

function getCommandStats() {
    const metrics = readMetrics()
    return Object.entries(metrics.commands)
        .map(([name, value]) => ({
            name,
            ...value
        }))
        .sort((a, b) => b.count - a.count)
}

function getBotMetrics() {
    const metrics = readMetrics()
    const commandStats = getCommandStats()

    return {
        commandsExecuted: commandStats.reduce((sum, cmd) => sum + (cmd.count || 0), 0),
        uniqueUsers: Object.keys(metrics.users || {}).length,
        uniqueChannels: Object.keys(metrics.channels || {}).length,
        commandStats,
        recentActivity: (metrics.events || []).slice(0, 50)
    }
}

function readDeploymentState() {
    return readJson(deploymentFile, defaultDeployment)
}

function saveDeploymentState(patch) {
    const state = {
        ...defaultDeployment,
        ...readDeploymentState(),
        ...patch,
        lastUpdatedAt: new Date().toISOString()
    }

    writeJson(deploymentFile, state)
    return state
}

function setDeploymentOutput(lines) {
    return saveDeploymentState({
        lastDeploymentOutput: lines
    })
}

module.exports = {
    logFile,
    appendLogLine,
    appendLogChunk,
    getLogSnapshot,
    addFeedback,
    updateFeedback,
    deleteFeedback,
    listFeedback,
    readBotState,
    saveBotState,
    getBotState,
    recordBotHeartbeat,
    recordCommandUsage,
    getCommandStats,
    getBotMetrics,
    recordServerEvent,
    getServerEvents,
    readDeploymentState,
    saveDeploymentState,
    setDeploymentOutput
}