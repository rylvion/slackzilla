const { log, red, cyan } = require("../utils/logger")
const { fetchWithTimeout } = require("../utils/fetcher")

const excuses = [
    "i tried to fetch a meme but the internet gods said no",
    "my meme generator ran out of pixels",
    "the meme was too spicy and got quarantined",
    "i found a meme but it was copyrighted by a potato",
    "the meme escaped before i could grab it",
    "i queued for a meme but matchmaking put me in bronze",
    "my meme cache caught fire and now everything is chaos",
]

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        try {
            log.info("{user} is fetching API: {cmd}", command)

            const res = await fetchWithTimeout("https://meme-api.com/gimme")
            const data = await res.json()

            log.success(
                "{user} fetched meme from API {0} ({1})",
                command,
                cyan(res.url),
                cyan(res.status)
            )

            await respond(`🤣 *${data.title}*\n${data.url}`)

        } catch (err) {
            log.error("{user} failed {cmd}: {0}", command, red(err.message))
            await respond(`❌ couldn't fetch a meme right now\n\nHere's an excuse instead: ${excuses[Math.floor(Math.random() * excuses.length)]}`)
        }
    })
}
