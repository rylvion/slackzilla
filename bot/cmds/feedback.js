const crypto = require("crypto")
const { log } = require("../utils/logger")
const { addFeedback } = require("../../server/database/store")

function getHelp() {
    return (
        "📝 *feedback command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-feedback <message>` - sends feedback to the bot author\n\n" +
        "> *Examples:*\n" +
        "> `/sz-feedback the logs page feels amazing`\n" +
        "> `/sz-feedback add a dark mode toggle to the admin sidebar`"
    )
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const text = command.text?.trim()
        
        const cmd = {
            ...command,
            user_name: ["Terminal User", "API user", "RAG tool"].includes(command.user_name)? command.user_name : "Anonymous User",
            user_id: ["terminal-user", "api-user", "rag-tool"].includes(command.user_id) ? command.user_id: "anonymous-user"
        }

        if (text?.toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", cmd)

            await respond(getHelp())
            return
        }

        if (!text) {
            log.error("{user} used {cmd} with no text", cmd)
            await respond("❌ send me some feedback first")
            return
        }
        
        try {
            const feedback = {
                id: crypto.randomUUID(),
                userId: command.user_id,
                username: command.user_name,
                message: text,
                timestamp: new Date().toISOString(),
                status: "unread"
            }

            addFeedback(feedback)
            log.success("{user} submitted feedback via {cmd}", cmd)
            await respond(`✅ thanks for the feedback. i saved it with id \`${feedback.id}\`. Make sure to save it`)
        } catch (error) {
            log.error("{user} failed to submit feedback via {cmd}: {0}", cmd, error)
            await respond("❌ failed to submit feedback. please try again later.")
        }
    })
}