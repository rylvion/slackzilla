// api from https://uselessfacts.jsph.pl

const excuses = [
    "i was literlally just about to fetch a fun fact but then i got distracted by a squirrel outside my window and now im late",
    "my GPU overheated trying to render the concept of knowledge",
    "i queued for a fun fact but matchmaking is taking too long",
    "my sharingan saw the fact but it was already gone",
    "the secrets of life is 42, but i forgot the question",
    "the fun fact is encrypted and i forgot the key",
    "i was on my way to fetch a fun fact but on the way there, but then i had to take a detour to save a cat from a tree, and then i got lost in the woods, and now im late",
]

async function fetchWithTimeout(url, timeout = 5000) {
    const controller = new AbortController()

    const id = setTimeout(() => controller.abort(), timeout)

    try {
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(id)
        return res
    } catch (err) {
        clearTimeout(id)
        throw err
    }
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond }) => {
        await ack()

        try {
            const res = await fetchWithTimeout("https://uselessfacts.jsph.pl/random.json?language=en")

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }

            const data = await res.json()
            const fact = data.text

            await respond(`🧠 did you know that ${fact}`)
        } catch (err) {
            console.error("funfact error:", err)

            const excuse = excuses[Math.floor(Math.random() * excuses.length)]

            await respond(
                `❌ couldn't fetch a fun fact right now\n\nHere's an excuse instead: ${excuse}`
            )
        }
    })
}