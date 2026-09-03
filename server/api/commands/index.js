const { listCommands, getCommand, runCommand } = require("../../lib/command-runner")

function handleCommandsApi({ req, res, url, context }) {
    if (url.pathname === "/api/commands" && req.method === "GET") {
        context.sendOk(res, {
            commands: listCommands().map(command => ({
                id: command.id,
                command: command.cmd,
                description: command.description,
                category: command.category,
                usageHint: command.usage_hint
            }))
        })
        return true
    }

    if (!url.pathname.startsWith("/api/commands/")) return false

    const id = decodeURIComponent(url.pathname.slice("/api/commands/".length))
    const command = getCommand(id)
    if (!command) {
        context.sendError(res, 404, "COMMAND_NOT_FOUND", "command not found")
        return true
    }

    if (req.method === "GET") {
        context.sendOk(res, {
            id: command.id,
            command: command.cmd,
            description: command.description,
            category: command.category,
            usageHint: command.usage_hint,
            help: `Use ${command.cmd} ${command.usage_hint || ""}`.trim()
        })
        return true
    }

    if (req.method !== "POST") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "method not allowed")
        return true
    }

    return context.parseBody(req).then(async body => {
        const result = await runCommand(id, body.text || body.arguments || "", {
            userId: body.userId,
            username: body.username,
            channelId: body.channelId,
            teamId: body.teamId
        })
        context.sendOk(res, result)
        return true
    }).catch(error => {
        context.sendError(res, 500, "COMMAND_FAILED", error.message)
        return true
    })
}

module.exports = {
    handleCommandsApi
}
