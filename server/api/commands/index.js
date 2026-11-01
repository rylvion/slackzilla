const { listCommands, getCommand, runCommand } = require("../../lib/command-runner")
const { createRateLimiter } = require("../../lib/rate-limit")

const commandRateLimiter = createRateLimiter({
    windowMs: 45_000, 
    maxRequests: 15,
    cooldownMs: 500
})

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
        context.sendError(res, 404, "COMMAND_NOT_FOUND", `No command was found matching '${id}'. Check \`/api/commands\` to ensure it exists in the available commands.`)
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
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", `Method '${req.method}' is not supported for this endpoint. Use POST to execute the command.`)
        return true
    }

    if (command.cmd === "/sz-ask") {
        context.sendError(res, 403, "COMMAND_NOT_AVAILABLE", "The /sz-ask command cannot be executed through the dashboard command runner. Head to the <a href=\"/ai\">AI page to chat with the codebase assistant</a>, or use /sz-ask directly within Slack.")
        return true
    }

    const rateLimit = commandRateLimiter.check(context.auth.getRequestIp(req))

    if (!rateLimit.allowed) {
        res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds))
        context.sendError(res, 429, "RATE_LIMITED", `Command rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds before executing another command.`, { retryAfter: rateLimit.retryAfterSeconds })
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
        context.sendError(res, 500, "COMMAND_FAILED", `Failed to execute command '${id}': ${error.message}`)
        return true
    })
}

module.exports = {
    handleCommandsApi
}
