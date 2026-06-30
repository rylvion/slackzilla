const { log, red } = require("../utils/logger.js")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        try {
            const res = await fetch("https://zenquotes.io/api/random")

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }

            const data = await res.json()

            log.success("{user} fetched a quote", command)

            await respond(
                `💬 "${data[0].q}" - ${data[0].a}`
            )

        } catch (err) {
            log.error(
                "{user} failed {cmd}: {0}",
                command,
                red(err.message)
            )

            await respond("❌ couldn't fetch a quote right now... wisdom is temporarily offline")
        }
    })
}