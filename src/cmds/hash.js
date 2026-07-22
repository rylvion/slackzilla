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
        "> `/sz-hash hello world`\n" +
        "> `/sz-hash rand 32`\n" +
        "> `/sz-hash pbkdf2 sha512 600000 salt text`\n\n" +
        `> *Supported algorithms:* ${algorithms}, rand, pbkdf2`
    )
}

function parseInput(text) {
    const parts = text.trim().split(/\s+/)

    if (parts[0].toLowerCase() === "rand") {
        return {
            algorithm: "rand",
            value: parts[1] || "32"
        }
    }

    if (parts[0].toLowerCase() === "pbkdf2") {
        const [_, algo, iterations, salt, ...rest] = parts
        return {
            algorithm: "pbkdf2",
            pbkdf2Algo: algo,
            pbkdf2Iterations: parseInt(iterations),
            pbkdf2Salt: salt,
            value: rest.join(" ")
        }
    }

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

        const parsed = parseInput(text)
        const { algorithm, value } = parsed

        if (algorithm === "rand") {
            const size = parseInt(value)
            const buf = crypto.randomBytes(size)
            const hex = buf.toString("hex")
            await respond(`🔑 rand-${size}:\n\`${hex}\``)
            return
        }

        if (algorithm === "pbkdf2") {
            const { pbkdf2Algo, pbkdf2Iterations, pbkdf2Salt } = parsed
            if (!pbkdf2Algo || !pbkdf2Iterations || !pbkdf2Salt || !value) {
                await respond("❌ pbkdf2 usage: pbkdf2 <algorithm> <iterations> <salt> <text>")
                return
            }
            crypto.pbkdf2(value, pbkdf2Salt, pbkdf2Iterations, 64, pbkdf2Algo, (err, derivedKey) => {
                if (err) {
                    respond("❌ pbkdf2 error")
                    return
                }
                const hex = derivedKey.toString("hex")
                respond(`🔑 pbkdf2$${pbkdf2Algo}$${pbkdf2Iterations}$${pbkdf2Salt}$${hex}`)
            })
            return
        }

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

        await respond(`🔑 ${algorithm}:\n\`${digest}\``)
    })
}
