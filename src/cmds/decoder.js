const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    const algorithms = crypto.getHashes().slice(0, 8).join(", ")

    return (
        "🔓 *decode command help*\n" +
        "> *Usage:*\n" +
        "> `/sz-decode <algorithm> <text>` - decodes text using the chosen algorithm\n\n" +
        "> *Examples:*\n" +
        "> `/sz-decode base64 aGVsbG8gd29ybGQ=`\n" +
        "> `/sz-decode hex 68656c6c6f`\n" +
        "> `/sz-decode pbkdf2 pbkdf2$sha512$600000$salt$abcdef...`\n" +
        "> `/sz-decode sha256 68656c6c6f...`\n\n" +
        `> *Supported algorithms:* ${algorithms}, rand, pbkdf2, base64, hex`
    )
}

function normaliseAlgorithm(algo) {
    const lower = algo.toLowerCase()

    if (lower.startsWith("rsa-")) return algo.toUpperCase()

    const map = {
        md5: "RSA-MD5",
        ripemd160: "RSA-RIPEMD160",
        sha1: "RSA-SHA1",
        "sha1-2": "RSA-SHA1-2",
        sha224: "RSA-SHA224",
        sha256: "RSA-SHA256",
        "sha3-224": "RSA-SHA3-224",
        "sha3-256": "RSA-SHA3-256"
    }

    return map[lower] || algo
}

function parseInput(text) {
    const parts = text.trim().split(/\s+/)
    const algorithm = normaliseAlgorithm(parts[0].toLowerCase())
    const value = parts.slice(1).join(" ")
    return { algorithm, value }
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
            await respond("❌ gimme some text to decode")
            return
        }

        const parsed = parseInput(text)
        const algorithm = normaliseAlgorithm(parsed.algorithm)
        const value = parsed.value

        if (!value) {
            log.error("{user} used {cmd} with an empty value", command)
            await respond("❌ gimme some text to decode")
            return
        }

        if (algorithm === "base64") {
            try {
                const decoded = Buffer.from(value, "base64").toString("utf8")
                await respond(`🔓 base64:\n\`${decoded}\``)
            } catch {
                await respond("❌ invalid base64")
            }
            return
        }

        if (algorithm === "hex") {
            try {
                const decoded = Buffer.from(value, "hex").toString("utf8")
                await respond(`🔓 hex:\n\`${decoded}\``)
            } catch {
                await respond("❌ invalid hex string")
            }
            return
        }

        if (algorithm === "rand") {
            try {
                const decoded = Buffer.from(value, "hex").toString("utf8")
                await respond(`🔓 rand:\n\`${decoded}\``)
            } catch {
                await respond("❌ invalid rand hex output")
            }
            return
        }

        if (algorithm === "pbkdf2") {
            if (!value.startsWith("pbkdf2$")) {
                await respond("❌ invalid pbkdf2 format")
                return
            }

            const parts = value.split("$")
            if (parts.length < 5) {
                await respond("❌ invalid pbkdf2 format")
                return
            }

            const [, algo, iterations, salt, hex] = parts

            try {
                const decoded = Buffer.from(hex, "hex").toString("utf8")
                await respond(
                    `🔓 pbkdf2:\n` +
                    `• algorithm: \`${algo}\`\n` +
                    `• iterations: \`${iterations}\`\n` +
                    `• salt: \`${salt}\`\n` +
                    `• decoded: \`${decoded}\``
                )
            } catch {
                await respond("❌ invalid pbkdf2 hex output")
            }
            return
        }

        if (crypto.getHashes().some(h => h.toLowerCase() === algorithm.toLowerCase())) {
            try {
                const decoded = Buffer.from(value, "hex").toString("utf8")
                await respond(`🔓 ${algorithm}:\n\`${decoded}\``)
            } catch {
                await respond(`❌ cannot decode ${algorithm} hex digest`)
            }
            return
        }

        await respond(`❌ unsupported decode algorithm: ${algorithm}`)
    })
}
