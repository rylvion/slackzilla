const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🔢 *count command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-count <text>` - counts characters, words, and lines\n\n" +
        "> *Examples:*\n" +
        "> `/sz-count hello world`\n" +
        "> `/sz-count line one\nline two`"
    )
}

function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length
}

function countLines(text) {
    return text.split(/\r?\n/).length
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        const text = command.text ?? ""

        if (text.trim().toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(getHelp())
            return
        }

        if (!text.trim()) {
            log.error("{user} used {cmd} with no text", command)

            await respond("❌ give me some text to count")
            return
        }

        const characters = Array.from(text).length
        const words = countWords(text)
        const lines = countLines(text)

        log.success("{user} counted text via {cmd}", command)

        await respond(`🔢 counts:
characters: ${characters}
words: ${words}
lines: ${lines}`)
    })
}