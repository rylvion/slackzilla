const { log, red } = require("../utils/logger.js")
const { fetchWithTimeout } = require("../utils/fetcher.js")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        try {
            const res = await fetchWithTimeout("https://zenquotes.io/api/random")

            const data = await res.json()

            log.success("{user} fetched a quote", command)

            await respond(
                `💬 "${data[0].q}" - ${data[0].a}`
            )

        } catch (err) {
            log.error(
                "{user} failed {cmd}: {0}",
                command,
                err.message
            )

            await respond("❌ couldn't fetch a quote right now... wisdom is temporarily offline")
        }
    })
}
