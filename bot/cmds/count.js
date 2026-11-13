const { log } = require("../utils/logger")

const getHelp = () => "count characters, words, and lines in a text"

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length
const countLines = (text) => text.split(/\r?\n/).length

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

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

        await respond(`
characters: ${characters}
words: ${words}
lines: ${lines}`)
    })
}