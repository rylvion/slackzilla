const { createRagTools } = require("../server/lib/rag/rag-tools")
const { createRagToolContext } = require("../server/lib/rag/rag-tool-context")

const context = require("../server/server")

function parseOptions(args) {
    const options = {}

    for (let index = 0; index < args.length; index++) {
        const arg = args[index]

        if (!arg.startsWith("--")) continue

        const key = arg.slice(2)
        const value = args[index + 1]

        if (!value || value.startsWith("--")) {
            options[key] = true
            continue
        }

        options[key] = value
        index++
    }

    return options
}

function printUsage() {
    console.error("Usage:")
    console.error("")
    console.error("  npm run rag:use-tool -- --getStatus")
    console.error("  npm run rag:use-tool -- --getCommands")
    console.error("  npm run rag:use-tool -- --getCommands --id calculator")
    console.error("  npm run rag:use-tool -- --getCommands --command /sz-calc")
    console.error("  npm run rag:use-tool -- --getCommands --category utility")
    console.error("  npm run rag:use-tool -- --getCommands --fuzzy calculator")
    console.error("  npm run rag:use-tool -- --getReleaseInfo")
    console.error("  npm run rag:use-tool -- --runCommand --commandId calculator --text \"2 + 2\"")
    console.error("  npm run rag:use-tool -- --getLogs --limit 20")
    console.error("  npm run rag:use-tool -- --getMetrics")
    console.error("  npm run rag:use-tool -- --getRoutes")
}

async function main() {
    const args = process.argv.slice(2)
    const toolName = args.find(arg => arg.startsWith("--"))?.slice(2)

    if (!toolName || args.includes("--help") || args.includes("-h")) {
        printUsage()
        process.exit(1)
    }

    const options = parseOptions(args)

    const ragContext = createRagToolContext(context)
    const tools = createRagTools(ragContext)

    if (!tools.definitions.some(definition =>
        definition.function?.name === toolName
    )) {
        console.error(`Unknown RAG tool: ${toolName}`)
        console.error("")
        printUsage()
        process.exit(1)
    }

    const toolArgs = {}

    if (toolName === "getCommands") {
        for (const key of [
            "id",
            "command",
            "description",
            "category",
            "usageHint",
            "fuzzy"
        ]) {
            if (options[key]) {
                toolArgs[key] = options[key]
            }
        }
    }

    if (toolName === "getReleaseInfo" && options.version) {
        toolArgs.version = options.version
    }

    if (toolName === "runCommand") {
        if (!options.commandId) {
            console.error("runCommand requires --commandId")
            process.exit(1)
        }

        toolArgs.commandId = options.commandId
        toolArgs.text = String(options.text || "").slice(0, 500)
    }

    if (toolName === "getLogs" && options.limit) {
        toolArgs.limit = Number(options.limit)
    }

    console.log(`RAG Tool: ${toolName}`)
    console.log(`Arguments: ${JSON.stringify(toolArgs)}`)
    console.log("")

    const result = await tools.execute(
        toolName,
        toolArgs,
        activity => {
            console.log(
                `[${activity.type}] ${activity.status} - ${activity.message}`
            )
        }
    )

    console.log("")
    console.log("Result:")
    console.log(JSON.stringify(result, null, 2))
}

main().catch(error => {
    console.error("")
    console.error(`RAG tool failed: ${error.message}`)
    process.exit(1)
})