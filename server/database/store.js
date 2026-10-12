const fs = require("fs")
const path = require("path")

const dataDir = __dirname
const logDir = path.join(__dirname, "..", "logs")
const logFile = path.join(logDir, "slackzilla.log")
const logArchiveDir = path.join(logDir, "archive")
const feedbackFile = path.join(dataDir, "feedback.json")
const metricsFile = path.join(dataDir, "metrics.json")
const deploymentFile = path.join(dataDir, "deployment.json")
const botStateFile = path.join(dataDir, "bot-state.json")
const serverErrorsFile = path.join(dataDir, "server-errors.json")

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

function readLogLines() {
    return String(getLogSnapshot().content || "").split(/\r?\n/).filter(Boolean)
}

function writeLogLines(lines) {
    ensureDir(logFile)
    fs.writeFileSync(logFile, lines.length ? `${lines.join("\n")}\n` : "")
    return getLogSnapshot()
}

function deleteLogLines(start, end) {
    const lines = readLogLines()
    const first = Math.max(1, Number(start) || 1)
    const last = Math.min(lines.length, Number(end) || first)
    return writeLogLines(lines.filter((_, index) => index + 1 < first || index + 1 > last))
}

function deleteLastLogLines(count) {
    const lines = readLogLines()
    return writeLogLines(lines.slice(0, Math.max(0, lines.length - Math.max(1, Number(count) || 1))))
}

function clearLog() {
    return writeLogLines([])
}

function deleteLogFile() {
    ensureDir(logFile)
    fs.writeFileSync(logFile, "")
    return {size: 0, content: "" }
}

function listLogArchives() {
    if (!fs.existsSync(logArchiveDir)) return []
    try {
        return fs.readdirSync(logArchiveDir)
            .filter(name => name.endsWith(".log"))
            .map(name => {
                try {
                    return getArchiveMetadata(name)
                } catch (error) {
                    if (error.code === "ENOENT") return null
                    throw error
                }
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    } catch (error) {
        if (error.code === "ENOENT") return []
        throw error
    }
}

function rotateLog() {
    ensureDir(logFile)

    const archive = path.join(logArchiveDir, `slackzilla-${new Date().toISOString().replace(/[:.]/g, "-")}.log` )

    ensureDir(archive)

    if (fs.existsSync(logFile)) {
        fs.copyFileSync(logFile, archive)
    } else {
        fs.writeFileSync(archive, "")
    }

    clearLog()

    return path.basename(archive)
}

function restoreLogArchive(name, saveCurrent = false) {
    const DEBUG = true
    const safeName = path.basename(String(name || ""))

    if (!safeName || safeName !== name || !safeName.endsWith(".log")) {
        throw new Error("invalid log archive")
    }

    const archive = path.join(logArchiveDir, safeName)

    if (!fs.existsSync(archive)) {
        throw new Error("log archive not found")
    }

    ensureDir(logFile)

    if (saveCurrent && fs.existsSync(logFile)) {
        const currentStat = fs.statSync(logFile)

        if (currentStat.size > 0) {
            const currentBackup = path.join(logArchiveDir, `slackzilla-before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.log`)

            ensureDir(currentBackup)
            fs.copyFileSync(logFile, currentBackup)

            DEBUG && console.log("[STORE] current log backed up:", currentBackup)
        }
    }

    const temporary = `${logFile}.restore-${process.pid}-${Date.now()}.tmp`

    try {
        fs.copyFileSync(archive, temporary)
        fs.renameSync(temporary, logFile)

        DEBUG && console.log("[STORE] archive restored to:", logFile)
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }

    return getLogSnapshot()
}

function deleteLogArchive(name) {
    const safeName = path.basename(String(name || ""))

    if (!safeName || safeName !== name || !safeName.endsWith(".log")) {
        throw new Error("invalid log archive")
    }

    const archive = path.join(logArchiveDir, safeName)

    if (!fs.existsSync(archive)) {
        throw new Error("log archive not found")
    }

    fs.unlinkSync(archive)

    return {
        name: safeName,
        deleted: true
    }
}

function getArchiveMetadata(name) {
    const filePath = path.join(logArchiveDir, name)
    const stat = fs.statSync(filePath)
    const content = fs.readFileSync(filePath, "utf8")
    return {
        name,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        bytes: stat.size,
        lines: content.split(/\r?\n/).filter(Boolean).length
    }
}

function getServerErrors() {
    const errors = readJson(serverErrorsFile, [])
    return Array.isArray(errors) ? errors : []
}

function recordServerError(error) {
    const errors = getServerErrors()
    errors.unshift(error)
    writeJson(serverErrorsFile, errors.slice(0, 200))
    return error
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
    readLogLines,
    deleteLogLines,
    deleteLastLogLines,
    clearLog,
    deleteLogFile,
    deleteLogArchive,
    listLogArchives,
    rotateLog,
    restoreLogArchive,
    getServerErrors,
    recordServerError,
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
