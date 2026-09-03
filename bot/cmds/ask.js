const { log } = require("../utils/logger")
const { answerQuestion, listCommands } = require("../../server/lib/rag")

function getHelp() {
    return (
        "🤖 *Slackzilla AI help*\n" +
        "> *Usage:*\n" +
        "> `/sz-ask <question>` - asks Slackzilla AI a question\n" +
        "> `/sz-ask help` - shows this help message\n" +
        "> *Examples:*\n" +
        "> `/sz-ask how do I hash some text?`\n" +
        "> `/sz-ask what does /sz-roll do?`\n" +
        "> `/sz-ask what is Slackzilla?`\n"
    )
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const question = command.text?.trim()

        log.info(
            "{user} executed {cmd} command with arguments: {0}",
            command,
            question || "(none)"
        )

        if (!question || question.toLowerCase() === "help") {
            await respond(getHelp())
            return
        }

        try {
            await respond("🤔 Thinking...")
            const requestedCommand = question.match(/(?:run|execute)\s+(\/sz-[\w-]+)(?:\s+(.+))?$/i)
            const requestedCommandMeta = requestedCommand && listCommands().find(item => item.cmd.toLowerCase() === requestedCommand[1].toLowerCase())
            const result = await answerQuestion({
                question,
                commandId: requestedCommandMeta?.id,
                commandText: requestedCommand?.[2],
                identity: {
                    userId: command.user_id,
                    username: command.user_name,
                    channelId: command.channel_id
                }
            })

            await respond(result.answer)

            log.success(
                "{user} successfully completed {cmd} command",
                command
            )
        } catch (error) {
            log.error(
                "{user} failed to execute {cmd}: {0}",
                command,
                error.message
            )

            await respond(
                "❌ I couldn't get an answer right now. Please try again later."
            )
        }
    })
}