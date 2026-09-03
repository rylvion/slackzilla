const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🔐 *base64 command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-base64 <text>` - encodes text into base64\n\n" +
        "> *Examples:*\n" +
        "> `/sz-base64 hello world`\n" +
        "> `/sz-base64 Slackzilla is cool`"
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

            await respond("❌ gimme some text to encode")
            return
        }

        const encoded = Buffer.from(text, "utf8").toString("base64")

        log.success("{user} encoded text via {cmd}", command)

        await respond(`🔐 base64:
\`${encoded}\``)
    })
}