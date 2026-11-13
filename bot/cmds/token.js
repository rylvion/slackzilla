const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🔐 *token command help*\n" +
        "gets a random token of a given length (from 1 to 256 characters, default: 32)\n\n" +
        "> *Usage:*\n" +
        "> `/sz-token` - generates a 32 character token\n" +
        "> `/sz-token <length>` - generates a token with a custom length\n\n" +
        "> `/sz-token help` - shows this help message"
    )
}

function parseLength(param) {
    if (!param) return 32

    const length = Number.parseInt(param, 10)
    if (!Number.isFinite(length) || length < 1 || length > 256) return null

    return length
}


const createToken = length => crypto.randomBytes(Math.ceil((length * 3) / 4)).toString("base64url").slice(0, length)

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const length = parseLength(command.text?.trim())

        if (command.text?.trim().toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(getHelp())
            return
        }

        if (length === null) {
            log.error("{user} used {cmd} with invalid length: {0}", command, command.text?.trim() || "<empty>")

            await respond("i couldnt infer a valid length so the default of 32 will be used\n \> give me a length between 1 and 256\n `/sz-token 32`")
            return
        }

        const token = createToken(length)
        log.success("{user} generated a token via {cmd} ({0} chars)", command, length)
        await respond(token)
    })
}