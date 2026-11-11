const { log, cyan } = require("../utils/logger")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()
        try {
            const text = command.text?.trim()

            if (!text) {
                log.warn("{user} used {cmd} with no text", command)
                await respond(" you didn't give me anything to echo")
                return
            }

            log.success("{user} echoed text via {cmd}", command)
            await respond(text)

        } catch (err) {
            log.error("{user} failed {cmd}: {0}", command, err.message)

            await respond(`something went wrong trying to echo your message`)
        }
    })
}
