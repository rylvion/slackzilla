const { answerQuestion } = require("../../lib/rag/rag")
const { createRagTools } = require("../../lib/rag/rag-tools")
const { createRagToolContext } = require("../../lib/rag/rag-tool-context")

function handleAskApi({ req, res, url, context }) {
    if (url.pathname !== "/api/ask") return false

    if (req.method === "GET") {
        context.sendOk(res, {
            method: "POST",
            path: "/api/ask",
            body: {
                question: "Your question",
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

    return context.parseBody(req).then(async body => {
        context.sendSseHeaders(res)

        const send = (event, data) => {
            if (!res.writableEnded && !res.destroyed) context.sendSse(res, event, data)
        }

        const tools = createRagTools(createRagToolContext(context))

        const result = await answerQuestion({
            question: body.question,
            commandId: body.commandId,
            commandText: body.commandText,
            identity: {
                userId: body.userId,
                username: body.username,
                channelId: body.channelId,
                teamId: body.teamId
            },
            tools,
            onActivity: activity => send("activity", activity),
            onToken: token => send("token", { token })
        })

        send("complete", result)
        if (!res.writableEnded) res.end()
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
