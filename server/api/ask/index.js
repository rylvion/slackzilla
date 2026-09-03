const { answerQuestion } = require("../../lib/rag")

function handleAskApi({ req, res, url, context }) {
    if (url.pathname !== "/api/ask") return false

    if (req.method === "GET") {
        context.sendOk(res, {
            method: "POST",
            path: "/api/ask",
            body: {
                question: "Your question",
                commandId: "optional command ID",
                commandText: "optional command arguments"
            }
        })
        return true
    }

    if (req.method !== "POST") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "method not allowed")
        return true
    }

    return context.parseBody(req).then(async body => {
        const result = await answerQuestion({
            question: body.question,
            commandId: body.commandId,
            commandText: body.commandText,
            identity: {
                userId: body.userId,
                username: body.username,
                channelId: body.channelId,
                teamId: body.teamId
            }
        })
        context.sendOk(res, result)
        return true
    }).catch(error => {
        context.sendError(res, 500, "ASK_FAILED", error.message)
        return true
    })
}

module.exports = {
    handleAskApi
}
