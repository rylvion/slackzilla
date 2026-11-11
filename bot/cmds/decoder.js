const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    const algorithms = "base64, hex, rand, pbkdf2"

    return `
> \`/sz-decode <algorithm> <input>\` - decodes input using the chosen algorithm
> \`/sz-decode base64 aGVsbG8gd29ybGQ=\`
> \`/sz-decode hex 7774682061726520796f7520616374206465636f64696e6720747320726e\`
> \`/sz-decode pbkdf2 pbkdf2$sha512$600000$salt$abcdef...\`

> *supported algorithms:* ${algorithms}
> *Note:* If you want more algorithms, please use /sz-feedback to request them`
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
                await respond(decoded)
                log.success("{user} decoded base64 via {cmd}", command)
                
            } catch {
                await respond("❌ invalid base64")
            }
            return
        }

        if (algorithm === "hex") {
            try {
                const decoded = Buffer.from(value, "hex").toString("utf8")
                log.success("{user} decoded hex via {cmd}", command)
                await respond(decoded)
            } catch {
                await respond("❌ invalid hex string")
            }
            return
        }

        if (algorithm === "rand") {
            try {
                const decoded = Buffer.from(value, "hex").toString("utf8")
                log.success("{user} decoded rand via {cmd}", command)
                await respond(decoded)
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
                await respond(
                    `🔓 pbkdf2:\n` +
                    `• algorithm: \`${algo}\`\n` +
                    `• iterations: \`${iterations}\`\n` +
                    `• salt: \`${salt}\`\n` +
                    `• password: \`${hex}\` (psst, cannot be reversed hahhaa i scemmer)\n`
                )
            } catch {
                await respond("❌ invalid pbkdf2 hex output")
            }
            return
        }

        if (crypto.getHashes().some(h => h.toLowerCase() === algorithm.toLowerCase())) {
            await respond(`❌ ${algorithm} is a one-way hash and cannot be decoded`)
            return
        }

        await respond(`❌ unsupported decode algorithm: ${algorithm}`)
    })
}
