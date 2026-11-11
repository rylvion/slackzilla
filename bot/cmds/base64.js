const { log } = require("../utils/logger")
const getHelp = () => "base64ify a text"

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()
        const params = command.text?.trim()

        if (params?.toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(getHelp())
            return
        }

        if (!params) {
            log.error("{user} used {cmd} with no params", command)

            await respond("❌ gimme some text to encode")
            return
        }

        try {
            const encoded = Buffer.from(params, "utf8").toString("base64")
            log.success("{user} encoded text via {cmd}", command)
            await respond(encoded)
        } catch (error) {
            log.error("{user} failed to encode params via {cmd}: {0}", command, error.message)
            await respond("❌ failed to encode text")
        }
    })
}