const { loadIndex } = require("./rag")
const { listCommands } = require("../command-runner")
const { runCommand } = require("../command-runner")
const { getReleaseInfo } = require("../release-info")
const { executeCommand: executeTerminalCommand, getCommand: getTerminalCommand } = require("../terminal/commands")


function createRagToolContext(context) {
    return {
        getStatus: () => {
            const { telemetryHistory, ...status } = context.renderStatusPayload()
            return status
        },

        getCommands: (args = {}) => {
            const commands = listCommands()

            const { id, command, description, category, usageHint, fuzzy } = args

            const mappedCommands = commands.map(command => ({
                id: command.id,
                command: command.cmd,
                description: command.description,
                category: command.category,
                usageHint: command.usage_hint
            }))

            const hasFilter = id || command || description || category || usageHint || fuzzy

            if (!hasFilter) { return mappedCommands.map(command => command.id) }
            if (id) { return mappedCommands.find(command => command.id === id) || null }

            return mappedCommands.filter(command => {
                if (args.command && command.command !== args.command) { return false }
                if (description && !command.description?.toLowerCase().includes(description.toLowerCase()) ) { return false }
                if ( category && command.category?.toLowerCase() !== category.toLowerCase() ) { return false }

                if ( usageHint && !command.usageHint?.toLowerCase().includes(usageHint.toLowerCase()) ) { return false }

                if (fuzzy) {
                    const haystack = [
                        command.id,
                        command.command,
                        command.description,
                        command.category,
                        command.usageHint
                    ].filter(Boolean).join(" ").toLowerCase()

                    if (!haystack.includes(fuzzy.toLowerCase())) { return false }
                }
                return true
            })
        },

        getReleaseInfo,

        runApiCommand: async ({ method, path, body, headers = {} }) => {
            if (!/^\/api\//.test(path) || path.startsWith("//")) throw new Error("only internal /api/ routes are supported")
            const safeHeaders = {}
            for (const [name, value] of Object.entries(headers || {})) {
                if (/(authorization|cookie|csrf|password|secret|token|api[-_]?key)/i.test(name)) throw new Error(`header '${name}' is not permitted for RAG API requests`)
                safeHeaders[name] = String(value).slice(0, 512)
            }
            const response = await fetch(`http://127.0.0.1:${context.runtimeConfig.port}${path}`, {
                method,
                headers: { Accept: "application/json", ...safeHeaders, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
                ...(method === "POST" && body !== undefined ? { body: JSON.stringify(body) } : {})
            })
            const text = await response.text()
            let parsed = text
            try { parsed = text ? JSON.parse(text) : null }
            catch { /* preserve useful plain-text responses */ }
            return { status: response.status, ok: response.ok, body: parsed }
        },

        runCommand: (commandId, text) => runCommand(commandId, text, {
            userId: "rag-tool",
            username: "RAG tool",
            channelId: "api",
            teamId: "api"
        }),

        runTerminalCommand: async (commandName, args = []) => {
            const command = getTerminalCommand(commandName)
            if (!command || command.permission !== "public") {
                const error = new Error(`terminal command '${commandName}' is not available to the RAG`)
                error.statusCode = 403
                throw error
            }

            return executeTerminalCommand(commandName, args, context, null)
        },

        getLogs: (limit = 20) =>
            context.splitLogLines(
                context.store.getLogSnapshot().content
            ).slice(-Math.min(10, limit)),

        getErrors: (includeStack = false) =>
            context.getServerErrors().slice(0, 10).map(error => {
                const { stack, ...safeError } = error
                return includeStack ? error : safeError
            }),

        getMetrics: context.getBotMetrics,

        getRoutes: () =>
            loadIndex().files.flatMap(file =>
                (file.code?.routes || []).map(route => ({
                    ...route,
                    file: file.path
                }))
            )
    }
}

module.exports = {
    createRagToolContext
}
