// api from https://uselessfacts.jsph.pl
const { log, cyan } = require("../utils/logger")
const { fetchWithTimeout } = require("../utils/fetcher")

const excuses = [
    "i was literlally just about to fetch a fun fact but then i got distracted by a squirrel outside my window and now im late",
    "my GPU overheated trying to render the concept of knowledge",
    "i queued for a fun fact but matchmaking is taking too long",
    "my sharingan saw the fact but it was already gone",
    "the secrets of life is 42, but i forgot the question",
    "the fun fact is encrypted and i forgot the key",
    "i was on my way to fetch a fun fact but on the way there, but then i had to take a detour to save a cat from a tree, and then i got lost in the woods, and now im late",
]

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        try {
            log.info("{user} is fetching API: {cmd}", command)

            const res = await fetchWithTimeout(
                "https://uselessfacts.jsph.pl/random.json?language=en",
                5000
            )

            const data = await res.json()

            log.success(
                "{user} fetched fact from API {0} ({1})",
                command,
                cyan(res.url),
                cyan(res.status)
            )

            const fact = data.text

            await respond(`🧠 did you know that ${fact}`)

        } catch (err) {
            log.error(
                "{user} failed {cmd}: {0}",
                command,
                err.message
            )

            await respond(
                `❌ couldn't fetch a fun fact right now\n\nHere's an excuse instead: ${
                    excuses[Math.floor(Math.random() * excuses.length)]
                }`
            )
        }
    })
}
