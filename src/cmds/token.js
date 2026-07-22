const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🔐 *token command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-token` - generates a 32 character token\n" +
        "> `/sz-token <length>` - generates a token with a custom length\n\n" +
        "> *Examples:*\n" +
        "> `/sz-token`\n" +
        "> `/sz-token 16`\n" +
        "> `/sz-token 64`"
    )
}

function parseLength(text) {
    if (!text) {
        return 32
    }

    const length = Number.parseInt(text, 10)

    if (!Number.isFinite(length) || length < 1 || length > 256) {
        return null
    }

    return length
}

function createToken(length) {
    const byteLength = Math.ceil((length * 3) / 4) + 2
    return crypto.randomBytes(byteLength).toString("base64url").slice(0, length)
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        const length = parseLength(command.text?.trim())

        if (command.text?.trim().toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(getHelp())
            return
        }

        if (length === null) {
            log.error("{user} used {cmd} with invalid length: {0}", command, command.text?.trim() || "<empty>")

            await respond("❌ give me a length between 1 and 256")
            return
        }

        const token = createToken(length)

        log.success("{user} generated a token via {cmd} ({0} chars)", command, length)

        await respond(`🔐 token (${length} chars):
\`${token}\``)
    })
}