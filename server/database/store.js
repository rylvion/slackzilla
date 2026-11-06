const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

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
    lastDeploymentResult: null,
    bannerStatus: "idle",
    bannerVersion: null,
    bannerError: null,
    bannerVisibleUntil: null
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


const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true })

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

const readLogLines = () => String(getLogSnapshot().content || "").split(/\r?\n/).filter(Boolean)

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

const clearLog = () => writeLogLines([])

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
    if (!safeName || safeName !== name || !safeName.endsWith(".log")) throw new Error("invalid log archive")

    const archive = path.join(logArchiveDir, safeName)

    if (!fs.existsSync(archive)) throw new Error("log archive not found")
    fs.unlinkSync(archive)

    return {name: safeName, deleted: true}
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

const fingerprint = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")

function groupServerErrors(source = getServerErrors()) {
    const groups = new Map()
    for (const error of source) {
        const normalised = {
            name: error.name || "Error",
            message: error.message || "",
            code: error.code || null,
            stack: error.stack || ""
        }
        const groupId = `error-${fingerprint(normalised)}`
        const group = groups.get(groupId) || {
            id: groupId,
            fingerprint: groupId,
            name: normalised.name,
            message: normalised.message,
            stack: normalised.stack,
            occurrences: [],
            count: 0,
            firstSeen: null,
            lastSeen: null
        }
        const occurrence = { id: error.id, time: error.time, source: error.source }
        group.occurrences.push(occurrence)
        group.count = group.occurrences.length
        const times = group.occurrences.map(item => new Date(item.time).getTime()).filter(Number.isFinite)
        group.firstSeen = times.length ? new Date(Math.min(...times)).toISOString() : null
        group.lastSeen = times.length ? new Date(Math.max(...times)).toISOString() : null
        groups.set(groupId, group)
    }
    return [...groups.values()].sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0))
}

function recordServerError(error) {
    const errors = getServerErrors()
    errors.unshift(error)
    writeJson(serverErrorsFile, errors.slice(0, 200))
    return error
}


const deleteServerError = id => deleteServerErrors([id]).deleted === 1

function deleteServerErrors(ids) {
    const errors = getServerErrors()
    const idSet = new Set(ids)
    const remaining = errors.filter(error => !idSet.has(error.id))
    const deleted = errors.length - remaining.length
    if (deleted) writeJson(serverErrorsFile, remaining)
    return { deleted, missing: ids.length - deleted }
}


function deleteServerErrorGroup(groupId) {
    const group = groupServerErrors().find(item => item.id === groupId)
    if (!group) return { deleted: 0, missing: 1 }
    return deleteServerErrors(group.occurrences.map(item => item.id))
}


function readJsonArray(filePath) {
    const data = readJson(filePath, [])
    return Array.isArray(data) ? data : []
}

const readFeedback = () => readJsonArray(feedbackFile)

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

const saveFeedback = items => writeJson(feedbackFile, items.map(normaliseFeedbackEntry))

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

const readBotState = () => readJson(botStateFile, defaultBotState)
const getBotState = () => readBotState()

function saveBotState(patch) {
    const state = {...defaultBotState, ...readBotState(), ...patch, lastUpdatedAt: new Date().toISOString()}
    writeJson(botStateFile, state)
    return state
}

const recordBotHeartbeat = (patch = {}) => saveBotState({ ...patch, status: "online", lastHeartbeatAt: new Date().toISOString() })
const readMetrics = () => readJson(metricsFile, defaultMetrics)
const saveMetrics = (metrics) => writeJson(metricsFile, metrics)

function recordServerEvent(event = {}) {
    const metrics = readMetrics()
    metrics.serverEvents = Array.isArray(metrics.serverEvents) ? metrics.serverEvents : []
    metrics.serverEvents.unshift({
        id: event.id || crypto.randomUUID(),
        source: event.source || "server",
        time: event.time || new Date().toISOString(),
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
    const events = Array.isArray(metrics.serverEvents) ? metrics.serverEvents : []
    let changed = false
    for (const event of events) {
        if (!event.id) {
            event.id = crypto.randomUUID()
            changed = true
        }
    }
    if (changed) saveMetrics(metrics)
    return events.slice(0, limit)
}

function groupServerEvents(limit = 100, source = null) {
    const groups = new Map()
    for (const event of (source || getServerEvents(limit))) {
        const groupingPath = event.path || null
        const signature = {
            method: event.method || null,
            path: groupingPath,
            type: event.type || "request",
            statusCode: event.statusCode || null,
            source: event.source || "server"
        }
        const groupId = `event-${fingerprint(signature)}`
        const group = groups.get(groupId) || {
            id: groupId,
            signature: groupId,
            method: signature.method,
            path: signature.path,
            type: signature.type,
            statusCode: signature.statusCode,
            source: signature.source,
            occurrences: [],
            count: 0
        }
        group.occurrences.push({ id: event.id, time: event.time, source: event.source || "server", path: event.path })
        group.count = group.occurrences.length
        groups.set(groupId, group)
    }
    return [...groups.values()].sort((a, b) => new Date(b.occurrences[0]?.time || 0) - new Date(a.occurrences[0]?.time || 0))
}


const deleteServerEvent = id => deleteServerEvents([id]).deleted === 1

function deleteServerEvents(ids) {
    const metrics = readMetrics()
    const events = Array.isArray(metrics.serverEvents) ? metrics.serverEvents : []
    const idSet = new Set(ids)
    const remaining = events.filter(event => !idSet.has(event.id))
    const deleted = events.length - remaining.length
    if (deleted) {
        metrics.serverEvents = remaining
        saveMetrics(metrics)
    }
    return { deleted, missing: ids.length - deleted }
}

function deleteServerEventGroup(groupId) {
    const group = groupServerEvents(1000).find(item => item.id === groupId)
    if (!group) return { deleted: 0, missing: 1 }
    return deleteServerEvents(group.occurrences.map(item => item.id))
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

const getCommandStats = () => Object.entries(readMetrics().commands).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.count - a.count)

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

const readDeploymentState = () => readJson(deploymentFile, defaultDeployment)

function saveDeploymentState(patch) {
    const state = {...defaultDeployment, ...readDeploymentState(), ...patch, lastUpdatedAt: new Date().toISOString() }
    writeJson(deploymentFile, state)
    return state
}

const setDeploymentOutput = lines => saveDeploymentState({ lastDeploymentOutput: lines })

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
    groupServerErrors,
    recordServerError,
    deleteServerError,
    deleteServerErrors,
    deleteServerErrorGroup,
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
    groupServerEvents,
    deleteServerEvent,
    deleteServerEvents,
    deleteServerEventGroup,
    readDeploymentState,
    saveDeploymentState,
    setDeploymentOutput
}
