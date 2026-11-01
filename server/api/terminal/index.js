const { createRateLimiter } = require("../../lib/rate-limit")
const { executeCommand, getAdminControl, getCommand, listCommands } = require("../../lib/terminal/commands")
const { parseCommandRequest } = require("../../lib/terminal/parser")
const { canExecuteCommand } = require("../../lib/terminal/permissions")
const { handleControlApi } = require("../control")

const terminalRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
    cooldownMs: 500
})

function handleTerminalApi({ req, res, url, context }) {
    if (url.pathname !== "/api/terminal") return false

    if (req.method === "GET") {
        context.sendOk(res, {commands: listCommands().map(command => ({name: command.name, description: command.description}))})
        return true
    }

    if (req.method !== "POST") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "method not allowed")
        return true
    }

    const session = context.auth.getSessionFromRequest(req)
    const rateLimit = terminalRateLimiter.check(session ? `session:${session.sessionId}` : `ip:${context.auth.getRequestIp(req)}`)
    if (!rateLimit.allowed) {
        res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds))
        context.sendError(res, 429, "RATE_LIMITED", "terminal request limit exceeded", {
            retryAfter: rateLimit.retryAfterSeconds
        })
        return true
    }

    return context.parseBody(req).then(async body => {
        req.body = body
        const request = parseCommandRequest(body)
        const command = getCommand(request.name)

        if (!command) {
            context.sendError(res, 404, "COMMAND_NOT_FOUND", "terminal command is not registered")
            return true
        }

        if (command.permission === "admin" && !session) {
            context.sendError(res, 401, "AUTH_REQUIRED", "administrator authentication is required for this command")
            return true
        }

        if (command.permission === "admin" && !context.auth.verifyCsrf(req, session)) {
            context.sendError(res, 403, "CSRF_INVALID", "csrf token is missing or invalid")
            return true
        }

        if (!canExecuteCommand(command, session)) {
            context.sendError(res, 403, "COMMAND_FORBIDDEN", "terminal command is not permitted")
            return true
        }

        if (request.name === "sudo" && request.args[0]?.toLowerCase() === "reauth") {
            const control = getAdminControl(request.args[1])
            if (!control || !control.mutating) {
                context.sendError(res, 400, "REAUTH_NOT_REQUIRED", "fresh authentication is only available for mutating controls")
                return true
            }
            const token = context.auth.issueReauthenticationToken(req, session, control.id, body.password)
            if (!token) {
                context.sendError(res, 401, "INVALID_CREDENTIALS", "master password verification failed")
                return true
            }
            context.sendOk(res, { operation: control.id, reauthToken: token })
            return true
        }

        if (request.name === "sudo" && ["execute", "logout"].includes(request.args[0]?.toLowerCase())) {
            const controlId = request.args[0].toLowerCase() === "logout" ? "logout" : request.args[1]
            const control = getAdminControl(controlId)
            if (control?.mutating) {
                if (!body.reauthToken || body.confirmed !== true || !context.auth.consumeReauthenticationToken(req, session, control.id, body.reauthToken)) {
                    context.sendError(res, 403, "REAUTH_REQUIRED", "fresh master-password verification and explicit confirmation are required")
                    return true
                }
            }

            const controlResponse = {
                statusCode: 200,
                headers: {},
                setHeader(name, value) {
                    const existing = Object.keys(this.headers).find(key => key.toLowerCase() === name.toLowerCase())
                    this.headers[existing || name] = value
                },
                getHeader(name) {
                    const key = Object.keys(this.headers).find(item => item.toLowerCase() === name.toLowerCase())
                    return key ? this.headers[key] : undefined
                },
                end(payload) { this.payload = JSON.parse(payload) }
            }
            req.body = { action: control?.id || controlId, confirmed: body.confirmed === true, ...body.controlPayload }
            await handleControlApi({req, res: controlResponse, url: new URL("http://localhost/api/admin/control"), context})
            for (const [name, value] of Object.entries(controlResponse.headers)) res.setHeader(name, value)
            if (!controlResponse.payload?.ok) {
                const statusCode = controlResponse.statusCode || 400
                const error = controlResponse.payload?.error || "control execution failed"
                context.sendError(res, statusCode, controlResponse.payload?.code || "CONTROL_FAILED", error)
                return true
            }
            context.sendOk(res, controlResponse.payload.data)
            return true
        }

        const data = await executeCommand(request.name, request.args, context, session)
        context.sendOk(res, {command: request.name, data})

        return true
        
    }).catch(error => {
        const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400
        const code = error.code || "TERMINAL_FAILED"
        const message = statusCode >= 500 ? "terminal command failed" : (statusCode === 400 ? "invalid terminal request" : error.message)
        context.sendError(res, statusCode, code, message)
        return true
    })
}

module.exports = {
    handleTerminalApi,
    terminalRateLimiter
}
