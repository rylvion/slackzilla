const crypto = require("crypto")
const { log } = require("../utils/logger")

function getHelp() {
    const algorithms = crypto.getHashes().slice(0, 8).join(", ")

    return (
        `> Default: sha256, supported algorithms: ${algorithms}, rand, pbkdf2, base64, hex\n` +
        "> `/sz-hash pbkdf2 sha512 600000 salt password` - pbkdf2 <algorithm> <iterations> <salt?> <password>"
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
        "sha3-224": "RSA-SSHA3-224",
        "sha3-256": "RSA-SHA3-256"
    }

    return map[lower] || algo
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
        const [_, algo, iterations, ...rest] = parts

        if (rest.length >= 2) {
            const salt = rest.shift()

            return {
                algorithm: "pbkdf2",
                pbkdf2Algo: algo,
                pbkdf2Iterations: parseInt(iterations),
                pbkdf2Salt: salt,
                value: rest.join(" ")
            }
        }

        return {
            algorithm: "pbkdf2",
            pbkdf2Algo: algo,
            pbkdf2Iterations: parseInt(iterations),
            pbkdf2Salt: crypto.randomBytes(32).toString("hex"),
            value: rest.join(" ")
        }
    }

    if (parts[0].toLowerCase() === "base64") {
        return {
            algorithm: "base64",
            value: parts.slice(1).join(" ")
        }
    }

    if (parts[0].toLowerCase() === "hex") {
        return {
            algorithm: "hex",
            value: parts.slice(1).join(" ")
        }
    }

    if (parts.length < 2) {
        return {
            algorithm: normaliseAlgorithm("sha256"),
            value: text.trim()
        }
    }

    const [maybeAlgorithm, ...rest] = parts
    const algorithm = normaliseAlgorithm(maybeAlgorithm.toLowerCase())

    if (crypto.getHashes().some(hash => hash.toLowerCase() === algorithm.toLowerCase())) {
        return {
            algorithm,
            value: rest.join(" ")
        }
    }

    return {
        algorithm: normaliseAlgorithm("sha256"),
        value: text.trim()
    }
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
            await respond("❌ gimme some text to hash")
            return
        }

        const parsed = parseInput(text)
        const algorithm = normaliseAlgorithm(parsed.algorithm)
        const value = parsed.value

       if (algorithm === "rand") {
            const size = Number(value || 32)
            
            if (!Number.isInteger(size) || size < 1 || size > 1024) {
                await respond("❌ rand size must be between 1 and 1024 bytes")
                return
            }
            const buf = crypto.randomBytes(size)
            const hex = buf.toString("hex")
            await respond(hex)
            return
        }

        if (algorithm === "pbkdf2") {
            const { pbkdf2Algo, pbkdf2Iterations, pbkdf2Salt } = parsed
            if (!pbkdf2Algo || !pbkdf2Iterations || !value) {
                await respond("❌ pbkdf2 usage: pbkdf2 <algorithm> <iterations> <text>")
                return
            }
            crypto.pbkdf2(value, pbkdf2Salt, pbkdf2Iterations, 64, pbkdf2Algo, (err, derivedKey) => {
                if (err) {
                    respond("❌ pbkdf2 error")
                    return
                }
                const hex = derivedKey.toString("hex")
                respond(`pbkdf2$${pbkdf2Algo}$${pbkdf2Iterations}$${pbkdf2Salt}$${hex}`)
            })
            return
        }

        if (algorithm === "base64") {
            if (!value) {
                await respond("❌ gimme some text to encode")
                return
            }

            const encoded = Buffer.from(value).toString("base64")
            await respond(encoded)
            return
        }

        if (algorithm === "hex") {
            if (!value) {
                await respond("❌ gimme some text to encode")
                return
            }

            const encoded = Buffer.from(value).toString("hex")
            await respond(encoded)
            return
        }

        if (!value) {
            log.error("{user} used {cmd} with an empty value", command)
            await respond("❌ gimme some text to hash")
            return
        }

        if (!crypto.getHashes().some(hash => hash.toLowerCase() === algorithm.toLowerCase())) {
            log.error("{user} requested unsupported hash algorithm {0}", command, algorithm)
            await respond(`❌ unsupported hash algorithm: ${algorithm}`)
            return
        }

        const digest = crypto.createHash(algorithm).update(value).digest("hex")
        log.success("{user} hashed text via {cmd} using {0}", command, algorithm)
        await respond(digest)
    })
}
