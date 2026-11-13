const { log, cyan } = require("../utils/logger.js")
const { fetchWithTimeout } = require("../utils/fetcher.js")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()


        try {
            const res = await fetchWithTimeout("https://zenquotes.io/api/random")
            const data = await res.json()

            log.success("{user} fetched a quote ({0}) from {1}", command, data[0].q, cyan("https://zenquotes.io/api/random"))

            await respond(`"${data[0].q}" - ${data[0].a}`)

        } catch (err) {
            log.error("{user} failed {cmd}: {0}", command, err.message)
            await respond("❌ couldn't fetch a quote right now... wisdom is temporarily offline")
        }
    })
}
