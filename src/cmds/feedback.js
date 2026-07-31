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

        log.info("{user} used {cmd}", command)

        const text = command.text?.trim()

        if (text?.toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(getHelp())
            return
        }

        if (!text) {
            log.error("{user} used {cmd} with no text", command)

            await respond("❌ send me some feedback first")
            return
        }

        const feedback = {
            id: crypto.randomUUID(),
            userId: command.user_id,
            username: command.user_name,
            message: text,
            timestamp: new Date().toISOString(),
            status: "unread"
        }

        addFeedback(feedback)

        log.success("{user} submitted feedback via {cmd}", command)

        await respond(`✅ thanks for the feedback. i saved it with id ${feedback.id}`)
    })
}