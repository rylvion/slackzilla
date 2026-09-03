const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    return (
        "🆔 *uuid command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-uuid` - generates a random uuid v4\n\n" +
        "> *Examples:*\n" +
        "> `/sz-uuid`\n" +
        "> `/sz-uuid help`"
    )
}

function createUuid() {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }

    const bytes = crypto.randomBytes(16)

    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = bytes.toString("hex")

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20)
    ].join("-")
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        if (command.text?.trim().toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(getHelp())
            return
        }

        const uuid = createUuid()

        log.success("{user} generated a uuid via {cmd}", command)

        await respond(`🆔 ${uuid}`)
    })
}