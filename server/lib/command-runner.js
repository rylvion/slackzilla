const fs = require("fs")
const path = require("path")

const commandsPath = path.join(__dirname, "..", "..", "bot", "data", "commands.json")
const commands = JSON.parse(fs.readFileSync(commandsPath, "utf8"))

function listCommands() {
    return Object.entries(commands)
        .filter(([, meta]) => meta && typeof meta === "object")
        .map(([id, meta]) => ({ id, ...meta }))
}

function getCommand(id) {
    const meta = commands[id]
    return meta && typeof meta === "object" ? { id, ...meta } : null
}

function waitForResponse(responses, timeoutMs = 15000) {
    if (responses.length > 0) return Promise.resolve()

    return new Promise((resolve, reject) => {
        const startedAt = Date.now()
        const check = () => {
            if (responses.length > 0) {
                resolve()
                return
            }

            if (Date.now() - startedAt >= timeoutMs) {
                reject(new Error("command returned no response"))
                return
            }

            setTimeout(check, 25)
        }

        check()
    })
}

function runCommand(id, text = "", identity = {}) {
    const meta = getCommand(id)
    if (!meta) {
        throw new Error(`unknown command: ${id}`)
    }

    const filePath = path.join(__dirname, "..", "..", "bot", "cmds", meta.file)
    if (!fs.existsSync(filePath)) {
        throw new Error(`missing command implementation: ${meta.file}`)
    }

    const register = require(filePath)
    let handler = null
    const fakeApp = {
        command(commandName, callback) {
            if (commandName === meta.cmd) handler = callback
        }
    }

    register(fakeApp, meta)
    if (!handler) {
        throw new Error(`command did not register ${meta.cmd}`)
    }

    const responses = []
    const command = {
        command: meta.cmd,
        text: String(text || ""),
        user_id: identity.userId || "api-user",
        user_name: identity.username || "API user",
        channel_id: identity.channelId || "api",
        team_id: identity.teamId || "api"
    }

    const result = Promise.resolve(handler({
        ack: async () => {},
        respond: async response => {
            responses.push(response)
            return response
        },
        command
    })).then(() => waitForResponse(responses).then(() => ({
        id,
        command: meta.cmd,
        responses
    })))

    return Promise.race([
        result,
        new Promise((resolve, reject) => setTimeout(() => reject(new Error("command timed out")), 15000))
    ])
}

module.exports = {
    listCommands,
    getCommand,
    runCommand
}
