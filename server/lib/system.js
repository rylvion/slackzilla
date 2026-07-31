const os = require("os")
const path = require("path")
const childProcess = require("child_process")

const { readDeploymentState, saveDeploymentState } = require("../database/store")

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
    const percent = elapsedMicros > 0 ? (cpuMicros / elapsedMicros) * 100 : 0

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
        return "unknown"
    }
}

function getRuntimeSnapshot(previousSample, projectDir, botServiceName) {
    const git = readGitInfo(projectDir)
    const deployment = readDeploymentState()
    const cpu = getProcessCpuPercent(previousSample)
    const memory = process.memoryUsage()

    return {
        botOnline: checkServiceStatus(botServiceName),
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
