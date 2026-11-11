const { answerQuestion } = require("../../lib/rag/ai")
const { createRagTools } = require("../../lib/rag/rag-tools")
const { createRagToolContext } = require("../../lib/rag/rag-tool-context")
const { createRateLimiter } = require("../../lib/rate-limit")

const standardAskRateLimiter = createRateLimiter({
    windowMs: 5 * 60_000,
    maxRequests: 10,
    cooldownMs: 5_000
})

const adminAskRateLimiter = createRateLimiter({
    windowMs: 10 * 60_000,
    maxRequests: 50,
    cooldownMs: 5_000
})

function handleAskApi({ req, res, url, context }) {
    if (url.pathname !== "/api/ask") return false

    if (req.method === "GET") {
        context.sendOk(res, {
            method: "POST",
            path: "/api/ask",
            body: {
                question: "Your question",
                includeCodebaseContext: true,
                commandId: "optional command ID",
                commandText: "optional command arguments",
                identity: {
                    userId: "optional user ID",
                    username: "optional username",
                    channelId: "optional channel ID",
                    teamId: "optional team ID"
                }
            }
        })
        return true
    }

    if (req.method !== "POST") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "method not allowed")
        return true
    }

    const session = context.auth.getSessionFromRequest(req)
    const isAdmin = Boolean(session)
    const rateLimiter = isAdmin ? adminAskRateLimiter : standardAskRateLimiter
    const clientKey = isAdmin? `admin:${session.sessionId}` : `ip:${context.auth.getRequestIp(req)}`

    const rateLimit = rateLimiter.check(clientKey)

    if (!rateLimit.allowed) {
        res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds))
        context.sendError(res, 429, "RATE_LIMITED", `AI request limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`, { retryAfter: rateLimit.retryAfterSeconds })
        return true
    }

    return context.parseBody(req).then(async body => {
        context.sendSseHeaders(res)

        const controller = new AbortController()
        const handleDisconnect = () => { if (!res.writableEnded) controller.abort()}

        res.on("close", handleDisconnect)

        const send = (event, data) => {if (!controller.signal.aborted && !res.writableEnded && !res.destroyed) context.sendSse(res, event, data)}

        try {
            const tools = createRagTools(createRagToolContext(context))

            const result = await answerQuestion({
                question: body.question,
                includeCodebaseContext: body.includeCodebaseContext !== false,
                commandId: body.commandId,
                commandText: body.commandText,
                identity: {
                    userId: body.userId,
                    username: body.username,
                    channelId: body.channelId,
                    teamId: body.teamId
                },
                tools,
                signal: controller.signal,
                onActivity: activity => send("activity", activity),
                onToken: token => send("token", { token })
            })

            if (!controller.signal.aborted) {
                send("complete", result)
                if (!res.writableEnded && !res.destroyed) res.end()
            }
        } catch (error) {
            if (controller.signal.aborted || error.name === "AbortError") {
                return true
            }

            if (!res.headersSent) {
                context.sendError(res, 500, "ASK_FAILED", `Failed to process the RAG/LLM request: ${error.message}`)
            } else if (!res.writableEnded && !res.destroyed) {
                context.sendSse(res, "error", { error: `Failed to process the RAG request: ${error.message}` })
                res.end()
            }
        } finally {
            res.removeListener("close", handleDisconnect)
        }

        return true
    }).catch(error => {
        if (!res.headersSent) {
            context.sendError(res, 500, "ASK_FAILED", `Failed to process the RAG/LLM request: ${error.message}`)
        } else if (!res.writableEnded && !res.destroyed) {
            context.sendSse(res, "error", { error: `Failed to process the RAG request: ${error.message}` })
            res.end()
        }
        return true
    })
}

module.exports = {
    handleAskApi
}
