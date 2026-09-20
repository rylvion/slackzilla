const { listCommands, loadIndex } = require("./rag")
const { runCommand } = require("../command-runner")
const { getReleaseInfo } = require("../release-info")


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

        runCommand: (commandId, text) => runCommand(commandId, text, {
            userId: "rag-tool",
            username: "RAG tool",
            channelId: "api",
            teamId: "api"
        }),

        getLogs: (limit = 20) =>
            context.splitLogLines(
                context.store.getLogSnapshot().content
            ).slice(-limit),

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
