const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🎲 *roll command help*\n" 
        + "> *Usage:*\n" 
        + "> `/sz-roll` - rolls a d6 (default)\n"
        + "> `/sz-roll 20` - rolls a d20 (up to 20 sides)\n"
        + "> `/sz-roll 2d6` - rolls two d6 dice\n"
        + "> `/sz-roll 2d20+5` - rolls two d20 dice and add 5\n\n"
        + "> **Examples:**\n"
        + "> • /sz-roll d8\n"
        + "> • /sz-roll 3d10\n"
        + "> • /sz-roll 1d20+10\n"
    )
}

function parseRange(text) {
    const parts = text.replace(/,/g, " ").trim().split(/\s+/)

    if (parts.length < 2) return null

    const min = Number(parts[0])
    const max = Number(parts[1])
    
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    return min <= max ? { min, max } : { min: max, max: min }
}

function randomNumber(min, max) {
    if (Number.isInteger(min) && Number.isInteger(max)) return Math.floor(Math.random() * (max - min + 1)) + min
    return (Math.random() * (max - min) + min).toFixed(6)
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

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

        log.success("{user} generated random number via {cmd}:", command, value)

        await respond(randomNumber(range.min, range.max))
    })
}