require("dotenv").config({ path: "./bot/.env" })

const { answerQuestion } = require("../server/lib/rag/rag")

const useAi = process.argv.includes("--ai")

const question = process.argv
    .slice(2)
    .filter(argument => argument !== "--ai")
    .join(" ")
    .trim()

if (!question) {
    console.error('Usage: npm run rag -- [--ai] "your repository question"')
    process.exit(1)
}

const line = "═".repeat(100)

const printSection = (title, value = "") => {
    process.stderr.write(
        `\n${line}\n` +
        `${title}\n` +
        `${line}\n` +
        `${value}\n`
    )
}

const printObject = (object, fields = []) => {
    if (!object || typeof object !== "object") {
        process.stderr.write(`${object ?? ""}\n`)
        return
    }

    if (fields.length) {
        for (const field of fields) {
            const value = object[field]

            if (value === undefined) continue

            if (typeof value === "object") {
                process.stderr.write(
                    `${field}: ${JSON.stringify(value, null, 2)}\n`
                )
            } else {
                process.stderr.write(`${field}: ${value}\n`)
            }
        }

        return
    }

    process.stderr.write(`${JSON.stringify(object, null, 2)}\n`)
}

answerQuestion({
    question,

    onActivity: activity => {
        const type = activity.type || activity.event || "ACTIVITY"

        printSection(type.toUpperCase())

        printObject(activity, ["status", "message", "query", "sources", "count", "tokens", "contextTokens", "contextBudget" ])
    },

    onToken: token => {
        process.stdout.write(token)
    }
}, useAi)
    .then(result => {
        process.stdout.write("\n")

        printSection("RETRIEVED SOURCES")

        if (!result.sources?.length) {
            process.stderr.write("No sources\n")
        } else {
            result.sources.forEach((source, index) => {
                process.stderr.write(
                    `\n[${index + 1}] ${source.file || source.path || "Unknown file"}\n`
                )

                if (source.lines) {
                    process.stderr.write(`Lines: ${source.lines}\n`)
                }

                if (source.score !== undefined) {
                    process.stderr.write(`Score: ${source.score}\n`)
                }

                if (source.content) {
                    process.stderr.write(`\n${source.content}\n`)
                }
            })
        }

        printSection("CODEBASE CONTEXT")

        const printValue = (value, depth = 0) => {
            const indent = "  ".repeat(depth)

            if (value === null || value === undefined) {
                process.stderr.write(`${indent}${value}\n`)
                return
            }

            if (typeof value !== "object") {
                process.stderr.write(`${indent}${value}\n`)
                return
            }

            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    process.stderr.write(`${indent}[${index}]\n`)
                    printValue(item, depth + 1)
                })

                return
            }

            for (const [key, item] of Object.entries(value)) {
                if (typeof item === "object" && item !== null) {
                    process.stderr.write(`${indent}${key}:\n`)
                    printValue(item, depth + 1)
                } else {
                    process.stderr.write(`${indent}${key}: ${item}\n`)
                }
            }
        }

        printValue(result.context)

        printSection("FINAL ANSWER", result.answer || "")

        printSection("SUMMARY")

        process.stderr.write(
            `AI enabled:     ${useAi}\n` +
            `Question:       ${question}\n` +
            `Sources:        ${result.sources?.length || 0}\n` +
            `Activities:     ${result.activities?.length || 0}\n` +
            `Answer length:  ${result.answer?.length || 0}\n`
        )
    })
    .catch(error => {
        console.error(error.stack || error.message)
        process.exitCode = 1
    })