const fs = require("fs")
const path = require("path")

const dataDir = __dirname
const logDir = path.join(__dirname, "..", "logs")
const logFile = path.join(logDir, "slackzilla.log")
const feedbackFile = path.join(dataDir, "feedback.json")
const metricsFile = path.join(dataDir, "metrics.json")
const deploymentFile = path.join(dataDir, "deployment.json")

const defaultMetrics = {
    commands: {}
}

const defaultDeployment = {
    status: "idle",
    lastUpdatedAt: null,
    lastDeploymentAt: null,
    lastDeploymentCommit: null,
    lastDeploymentOutput: [],
    lastDeploymentResult: null
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

function saveFeedback(items) {
    writeJson(feedbackFile, items)
}

function addFeedback(entry) {
    const items = readFeedback()
    items.unshift(entry)
    saveFeedback(items)
    return entry
}

function updateFeedback(id, patch) {
    const items = readFeedback()
    const index = items.findIndex(item => item.id === id)

    if (index === -1) {
        return null
    }

    items[index] = {
        ...items[index],
        ...patch,
        updatedAt: new Date().toISOString()
    }

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
        if (status !== "all" && item.status !== status) {
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

function readMetrics() {
    return readJson(metricsFile, defaultMetrics)
}

function saveMetrics(metrics) {
    writeJson(metricsFile, metrics)
}

function recordCommandUsage(commandName, command) {
    const metrics = readMetrics()
    const key = String(commandName || "unknown").replace(/^\//, "")
    const existing = metrics.commands[key] || { count: 0, lastUsedAt: null, lastUser: null, lastUserId: null }

    metrics.commands[key] = {
        ...existing,
        count: existing.count + 1,
        lastUsedAt: new Date().toISOString(),
        lastUser: command?.user_name || null,
        lastUserId: command?.user_id || null
    }

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
    recordCommandUsage,
    getCommandStats,
    readDeploymentState,
    saveDeploymentState,
    setDeploymentOutput
}