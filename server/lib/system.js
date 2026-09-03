const os = require("os")
const path = require("path")
const fs = require("fs")
const childProcess = require("child_process")

const { readDeploymentState, readBotState, saveDeploymentState } = require("../database/store")

let previousNetworkSample = null

function execCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const child = childProcess.spawn(command, args, {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            shell: Boolean(options.shell),
            stdio: ["ignore", "pipe", "pipe"]
        })

        let stdout = ""
        let stderr = ""

        child.stdout.on("data", chunk => {
            stdout += chunk.toString("utf8")
        })

        child.stderr.on("data", chunk => {
            stderr += chunk.toString("utf8")
        })

        child.on("error", reject)

        child.on("close", code => {
            if (code === 0) {
                resolve({ stdout, stderr, code })
                return
            }

            reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`))
        })
    })
}

function execSyncSafe(command, args, cwd) {
    const result = childProcess.spawnSync(command, args, {
        cwd,
        encoding: "utf8"
    })

    if (result.status !== 0) {
        throw new Error(result.stderr || `failed to run ${command}`)
    }

    return String(result.stdout || "").trim() || "unknown"
}

function readGitInfo(projectDir) {
    const cwd = projectDir || process.cwd()

    try {
        const commit = execSyncSafe("git", ["rev-parse", "--short", "HEAD"], cwd)
        const branch = execSyncSafe("git", ["branch", "--show-current"], cwd)
        const lastCommitAt = execSyncSafe("git", ["log", "-1", "--format=%cI"], cwd)

        return {
            commit,
            branch,
            lastCommitAt
        }
    } catch {
        return {
            commit: "unknown",
            branch: "unknown",
            lastCommitAt: null
        }
    }
}

function getProcessCpuPercent(previousSample) {
    const usage = process.cpuUsage(previousSample.usage)
    const elapsedMicros = Number(process.hrtime.bigint() - previousSample.hrtime) / 1000
    const cpuMicros = usage.user + usage.system
    const coreCount = Math.max(1, os.cpus().length)
    const percent = elapsedMicros > 0 ? (cpuMicros / elapsedMicros) * 100 / coreCount : 0

    return {
        usage,
        hrtime: process.hrtime.bigint(),
        percent: Number(percent.toFixed(2))
    }
}

function checkServiceStatus(serviceName) {
    if (!serviceName) {
        return "unknown"
    }

    try {
        const result = childProcess.spawnSync("systemctl", ["is-active", serviceName], {
            encoding: "utf8"
        })

        if (result.status === 0) {
            return String(result.stdout || "active").trim() || "active"
        }

        return String(result.stdout || result.stderr || "inactive").trim() || "inactive"
    } catch {
        try {
            if (process.platform === "win32") {
                const fallback = childProcess.spawnSync("tasklist", [], { encoding: "utf8" })
                if (fallback.status === 0 && /node\.exe/i.test(String(fallback.stdout || ""))) {
                    return "active"
                }
            } else {
                const fallback = childProcess.spawnSync("pgrep", ["-f", serviceName], { encoding: "utf8" })
                if (fallback.status === 0) {
                    return "active"
                }
            }
        } catch {
            // fall through to unknown
        }

        return "unknown"
    }
}

function getBotConnectionState() {
    const state = readBotState()
    const heartbeatAt = state.lastHeartbeatAt || state.updatedAt || null
    const heartbeatAgeMs = heartbeatAt ? Date.now() - new Date(heartbeatAt).getTime() : Number.POSITIVE_INFINITY
    const online = state.status === "online" && heartbeatAgeMs < 45000

    return {
        online,
        status: online ? "online" : "offline",
        heartbeatAgeMs,
        heartbeatAt,
        state
    }
}

function readNetworkBytes() {
    if (process.platform !== "win32") {
        try {
            const content = fs.readFileSync("/proc/net/dev", "utf8")
            return content
            .split(/\r?\n/)
            .slice(2)
            .reduce((totals, line) => {
                const separator = line.indexOf(":")
                if (separator === -1) return totals

                const values = line.slice(separator + 1).trim().split(/\s+/).map(Number)
                if (values.length < 9) return totals

                return {
                    rxBytes: totals.rxBytes + (values[0] || 0),
                    txBytes: totals.txBytes + (values[8] || 0)
                }
            }, { rxBytes: 0, txBytes: 0 })
        } catch {
            return null
        }
    }

    try {
        const result = childProcess.spawnSync("netstat", ["-e"], { encoding: "utf8" })
        const output = `${result.stdout || ""}\n${result.stderr || ""}`
        const labelled = output.match(/Bytes Received\s+(\d+)[\s\S]*?Bytes Sent\s+(\d+)/i)
        const table = output.match(/^Bytes\s+(\d+)\s+(\d+)\s*$/im)
        const received = labelled?.[1] || table?.[1]
        const sent = labelled?.[2] || table?.[2]

        if (!received || !sent) return null

        return {
            rxBytes: Number(received),
            txBytes: Number(sent)
        }
    } catch {
        return null
    }
}

function getNetworkUsage() {
    const current = readNetworkBytes()
    const now = Date.now()

    if (!current) {
        return {
            rxBytes: null,
            txBytes: null,
            rxRate: null,
            txRate: null
        }
    }

    const elapsedSeconds = previousNetworkSample
        ? Math.max((now - previousNetworkSample.at) / 1000, 0.001)
        : null
    const usage = {
        rxBytes: current.rxBytes,
        txBytes: current.txBytes,
        rxRate: elapsedSeconds ? Math.max(0, (current.rxBytes - previousNetworkSample.rxBytes) / elapsedSeconds) : 0,
        txRate: elapsedSeconds ? Math.max(0, (current.txBytes - previousNetworkSample.txBytes) / elapsedSeconds) : 0
    }

    previousNetworkSample = { ...current, at: now }
    return usage
}

function getDiskUsage(projectDir) {
    const candidates = [projectDir, process.cwd(), path.parse(process.cwd()).root]

    for (const candidate of candidates) {
        if (!candidate) continue

        try {
            const stats = fs.statfsSync(candidate)
        const total = Number(stats.blocks) * Number(stats.bsize)
        const free = Number(stats.bavail) * Number(stats.bsize)

            return {
                total,
                free,
                used: Math.max(0, total - free)
            }
        } catch {
            continue
        }
    }

    return { total: null, free: null, used: null }
}

function getRuntimeSnapshot(previousSample, projectDir, botServiceName) {
    const git = readGitInfo(projectDir)
    const deployment = readDeploymentState()
    const cpu = getProcessCpuPercent(previousSample)
    const memory = process.memoryUsage()
    const bot = getBotConnectionState(botServiceName)
    const disk = getDiskUsage(projectDir)
    const network = getNetworkUsage()

    return {
        botOnline: bot.status,
        botConnectionState: bot,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        commit: git.commit,
        branch: git.branch,
        lastCommitAt: git.lastCommitAt,
        lastDeploymentAt: deployment.lastDeploymentAt,
        lastDeploymentCommit: deployment.lastDeploymentCommit,
        lastDeploymentResult: deployment.lastDeploymentResult,
        memoryRss: memory.rss,
        memoryHeapUsed: memory.heapUsed,
        memoryHeapTotal: memory.heapTotal,
        systemTotalMemory: os.totalmem(),
        systemFreeMemory: os.freemem(),
        systemLoadAverage: os.loadavg(),
        cpuPercent: cpu.percent,
        disk,
        network,
        previousSample: cpu
    }
}

function runSystemctl(action, serviceName) {
    return execCommand("systemctl", [action, serviceName], { shell: false })
}

function runDeployScript(deployScript, env, onOutput) {
    return new Promise((resolve, reject) => {
        const child = childProcess.spawn("bash", [deployScript], {
            cwd: path.dirname(deployScript),
            env,
            stdio: ["ignore", "pipe", "pipe"]
        })

        const lines = []

        const handleChunk = chunk => {
            const text = chunk.toString("utf8")
            lines.push(text)

            if (typeof onOutput === "function") {
                onOutput(text)
            }
        }

        child.stdout.on("data", handleChunk)
        child.stderr.on("data", handleChunk)
        child.on("error", reject)

        child.on("close", code => {
            if (code === 0) {
                resolve({ code, output: lines.join("") })
                return
            }

            reject(new Error(`deploy script exited with code ${code}`))
        })
    })
}

module.exports = {
    execCommand,
    getRuntimeSnapshot,
    checkServiceStatus,
    runSystemctl,
    runDeployScript,
    saveDeploymentState
}
