const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    const algorithms = crypto.getHashes().slice(0, 8).join(", ")

    return (
        "🔑 *hash command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-hash <algorithm> <text>` - hashes text with the chosen algorithm\n" +
        "> `/sz-hash <text>` - defaults to sha256\n\n" +
        "> *Examples:*\n" +
        "> `/sz-hash sha256 hello world`\n" +
        "> `/sz-hash hello world`\n\n" +
        `> *Supported algorithms:* ${algorithms}`
    )
}

function parseInput(text) {
    const parts = text.trim().split(/\s+/)

    if (parts.length < 2) {
        return {
            algorithm: "sha256",
            value: text.trim()
        }
    }

    const [maybeAlgorithm, ...rest] = parts
    const algorithm = maybeAlgorithm.toLowerCase()

    if (crypto.getHashes().some(hash => hash.toLowerCase() === algorithm)) {
        return {
            algorithm,
            value: rest.join(" ")
        }
    }

    return {
        algorithm: "sha256",
        value: text.trim()
    }
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

            await respond("❌ give me text to hash")
            return
        }

        const { algorithm, value } = parseInput(text)

        if (!value) {
            log.error("{user} used {cmd} with an empty value", command)

            await respond("❌ give me text to hash")
            return
        }

        if (!crypto.getHashes().some(hash => hash.toLowerCase() === algorithm)) {
            log.error("{user} requested unsupported hash algorithm {0}", command, algorithm)

            await respond(`❌ unsupported hash algorithm: ${algorithm}`)
            return
        }

        const digest = crypto.createHash(algorithm).update(value).digest("hex")

        log.success("{user} hashed text via {cmd} using {0}", command, algorithm)

        await respond(`🔑 ${algorithm}:
\`${digest}\``)
    })
}