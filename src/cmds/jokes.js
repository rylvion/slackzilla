// from https://jokeapi.dev/
const { log, red } = require("../utils/logger.js")
const { fetchWithTimeout } = require("../utils/fetcher.js")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        try {
            const res = await fetchWithTimeout(
                "https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit"
            )

            const data = await res.json()

            if (data.error) {
                throw new Error(`API returned error: ${JSON.stringify(data)}`)
            }

            let joke

            if (data.type === "single") {
                joke = data.joke
            } else {
                joke = `${data.setup}\n\n${data.delivery}`
            }

            log.success("{user} fetched a joke", command)

            await respond(`😂 ${joke}`)

        } catch (err) {
            await respond("❌ couldn't fetch a joke right now... the humour engine broke")

            log.error(
                "{user} failed {cmd}: {0}",
                command,
                red(err.message)
            )
        }
    })
}