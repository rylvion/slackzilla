const { log } = require("../utils/logger")

function getHelp() {
    return (
        "⏱️ *unix command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-unix <timestamp>` - converts a unix timestamp to a readable date\n" +
        "> `/sz-unix <date>` - converts a readable date to unix seconds\n\n" +
        "> *Examples:*\n" +
        "> `/sz-unix 1721644800`\n" +
        "> `/sz-unix 2026-07-22 12:00`\n" +
        "> `/sz-unix July 22 2026 12:00 PM`"
    )
}

function isTimestamp(text) {
    return /^-?\d+(?:\.\d+)?$/.test(text)
}

function formatDate(date) {
    return date.toLocaleString()
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

        if (!text) {
            log.error("{user} used {cmd} with no text", command)

            await respond("❌ give me a unix timestamp or a date string")
            return
        }

        if (isTimestamp(text)) {
            const numeric = Number(text)
            const millis = Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric
            const date = new Date(millis)

            if (Number.isNaN(date.getTime())) {
                log.error("{user} used {cmd} with invalid timestamp: {0}", command, text)

                await respond("❌ that timestamp does not look valid")
                return
            }

            const unixSeconds = Math.floor(date.getTime() / 1000)

            log.success("{user} converted unix timestamp via {cmd}", command)

            await respond(`⏱️ unix: ${unixSeconds}
ms: ${date.getTime()}
date: ${formatDate(date)}
iso: ${date.toISOString()}`)
            return
        }

        const date = new Date(text)

        if (Number.isNaN(date.getTime())) {
            log.error("{user} used {cmd} with invalid date: {0}", command, text)

            await respond("❌ i could not parse that date")
            return
        }

        const unixSeconds = Math.floor(date.getTime() / 1000)

        log.success("{user} converted date via {cmd}", command)

        await respond(`📅 date: ${formatDate(date)}
unix: ${unixSeconds}
ms: ${date.getTime()}
iso: ${date.toISOString()}`)
    })
}