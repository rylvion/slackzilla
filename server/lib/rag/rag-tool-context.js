
const { loadIndex } = require("./rag")
const { listCommands, runCommand } = require("../command-runner")
const { getReleaseInfo } = require("../release-info")
const { executeCommand, getCommand } = require("../terminal/commands")

function createRagToolContext(context) {
    return {
        getStatus: () => {
            const { telemetryHistory, ...status } = context.renderStatusPayload()
            return status
        },

        getCommands: (args = {}) => {
            const commands = listCommands().map(({ id, cmd, description, category, usage_hint }) => ({ id, command: cmd, description, category, usageHint: usage_hint}))

            const { id, command, description, category, usageHint, fuzzy } = args
            if (!id && !command && !description && !category && !usageHint && !fuzzy) return commands.map(c => c.id)
            if (id) return commands.find(c => c.id === id) || null

            return commands.filter(c =>
                (!command || c.command === command) &&
                (!description || c.description?.toLowerCase().includes(description.toLowerCase())) &&
                (!category || c.category?.toLowerCase() === category.toLowerCase()) &&
                (!usageHint || c.usageHint?.toLowerCase().includes(usageHint.toLowerCase())) &&
                (!fuzzy || [c.id, c.command, c.description, c.category, c.usageHint]
                    .filter(Boolean).join(" ").toLowerCase().includes(fuzzy.toLowerCase()))
            )
        },

        getReleaseInfo,

        runApiCommand: async ({ method, path, body, headers = {} }) => {
            if (!/^\/api\//.test(path) || path.startsWith("//"))
                throw new Error("only internal /api/ routes are supported")

            const safeHeaders = {}
            for (const [name, value] of Object.entries(headers)) {
                if (/(authorization|cookie|csrf|password|secret|token|api[-_]?key)/i.test(name))
                    throw new Error(`header '${name}' is not permitted for RAG API requests`)
                safeHeaders[name] = String(value).slice(0, 512)
            }

            const response = await fetch(`http://127.0.0.1:${context.runtimeConfig.port}${path}`, {
                method,
                headers: {
                    Accept: "application/json",
                    ...safeHeaders,
                    ...(method === "POST" ? { "Content-Type": "application/json" } : {})
                },
                ...(method === "POST" && body !== undefined ? { body: JSON.stringify(body) } : {})
            })

            const text = await response.text()
            let parsed = text
            try { parsed = text ? JSON.parse(text) : null } catch {}

            return { status: response.status, ok: response.ok, body: parsed }
        },

        runCommand: (commandId, text) => runCommand(commandId, text, {
            userId: "rag-tool",
            username: "RAG tool",
            channelId: "api",
            teamId: "api"
        }),

        runTerminalCommand: (name, args = []) => {
            const command = getCommand(name)
            if (!command || command.permission !== "public") {
                const error = new Error(`terminal command '${name}' is not available to the RAG`)
                error.statusCode = 403
                throw error
            }
            return executeCommand(name, args, context, null)
        },

        getLogs: (limit = 20) => context.splitLogLines(context.store.getLogSnapshot().content).slice(-Math.min(10, limit)),
        getErrors: (includeStack = false) => context.getServerErrors().slice(0, 10).map(({ stack, ...error }) => includeStack ? { ...error, stack } : error),
        getMetrics: context.getBotMetrics,
        getRoutes: () => loadIndex().files.flatMap(file => (file.code?.routes || []).map(route => ({ ...route, file: file.path })) )
    }
}

module.exports = { createRagToolContext }
