const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🔤 *case command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-case <camel|pascal|snake|kebab> <text>` - converts text into a different case\n\n" +
        "> *Examples:*\n" +
        "> `/sz-case camel hello world`\n" +
        "> `/sz-case pascal hello world`\n" +
        "> `/sz-case snake hello world`\n" +
        "> `/sz-case kebab hello world`"
    )
}

function splitWords(text) {
    return text
        .trim()
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
}

function toCamel(words) {
    return words
        .map((word, index) => index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join("")
}

function toPascal(words) {
    return words
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join("")
}

function toSnake(words) {
    return words.map(word => word.toLowerCase()).join("_")
}

function toKebab(words) {
    return words.map(word => word.toLowerCase()).join("-")
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

            await respond("❌ give me a case and some text")
            return
        }

        const [mode, ...rest] = text.split(/\s+/)
        const sourceText = rest.join(" ")
        const words = splitWords(sourceText)

        if (!mode || !sourceText || !words.length) {
            log.error("{user} used {cmd} with invalid input: {0}", command, text)

            await respond("❌ use `camel`, `pascal`, `snake`, or `kebab` followed by text")
            return
        }

        let result

        switch (mode.toLowerCase()) {
            case "camel":
                result = toCamel(words)
                break
            case "pascal":
                result = toPascal(words)
                break
            case "snake":
                result = toSnake(words)
                break
            case "kebab":
                result = toKebab(words)
                break
            default:
                log.error("{user} used {cmd} with invalid mode: {0}", command, mode)

                await respond("❌ use `camel`, `pascal`, `snake`, or `kebab`")
                return
        }

        log.success("{user} converted text via {cmd} to {0}", command, mode.toLowerCase())

        await respond(`🔤 ${mode.toLowerCase()}:
\`${result}\``)
    })
}