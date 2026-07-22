const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🎲 *random command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-random <min> <max>` - generates a random number in the range\n\n" +
        "> *Examples:*\n" +
        "> `/sz-random 1 10`\n" +
        "> `/sz-random 10.5 20.5`\n" +
        "> `/sz-random -5 5`"
    )
}

function parseRange(text) {
    const parts = text.trim().split(/\s+/)

    if (parts.length < 2) {
        return null
    }

    const min = Number(parts[0])
    const max = Number(parts[1])

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return null
    }

    return min <= max ? { min, max } : { min: max, max: min }
}

function randomNumber(min, max) {
    if (Number.isInteger(min) && Number.isInteger(max)) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    return (Math.random() * (max - min) + min).toFixed(6)
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

        const range = text ? parseRange(text) : null

        if (!range) {
            log.error("{user} used {cmd} with invalid range: {0}", command, text || "<empty>")

            await respond("❌ give me two numbers like `1 10`")
            return
        }

        const value = randomNumber(range.min, range.max)

        log.success("{user} generated random number via {cmd}: {0}", command, value)

        await respond(`🎲 random number between ${range.min} and ${range.max}: *${value}*`)
    })
}