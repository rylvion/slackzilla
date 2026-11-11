
const { createRagTools, getToolHelp } = require("../server/lib/rag/rag-tools")
const { createRagToolContext } = require("../server/lib/rag/rag-tool-context")
const util = require("util")
const context = require("../server/server")

function parseOptions(args) {
    const options = {}

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (!arg.startsWith("--")) continue

        const key = arg.slice(2)
        const value = args[i + 1]

        options[key] = !value || value.startsWith("--") ? true : value
        if (options[key] !== true) i++
    }

    return options
}

function printUsage(tools = createRagTools().definitions) {
    console.error("Usage:\n")
    for (const { function: fn } of tools) { if (fn?.name) console.error(`  npm run rag:use-tool -- --${fn.name}`) }
    console.error("\nuse --help or -h after the tool name for tool-specific options.")
}

async function main() {
    const args = process.argv.slice(2)
    const toolName = args.find(arg => arg.startsWith("--"))?.slice(2)

    if (!toolName) {
        printUsage()
        process.exit(1)
    }

    if (args.includes("--help") || args.includes("-h")) {
        const help = getToolHelp(toolName)
        if (help) {
            console.log(help)
            process.exit(0)
        }
        printUsage()
        process.exit(1)
    }

    const options = parseOptions(args)
    const tools = createRagTools(createRagToolContext(context))
    const validTools = tools.definitions.some(def => def.function?.name === toolName)

    if (!validTools) {
        console.error(`Unknown RAG tool: ${toolName}\n`)
        printUsage(tools)
        process.exit(1)
    }

    const toolArgs = {}

    if (toolName === "getCommands") for (const key of ["id", "command", "description", "category", "usageHint", "fuzzy"]) { if (options[key]) toolArgs[key] = options[key] }
    else if (toolName === "getReleaseInfo") { if (options.version) toolArgs.version = options.version}
    else if (toolName === "runCommand") {

        if (!options.commandId) {
            console.error("runCommand requires --commandId")
            process.exit(1)
        }

        Object.assign(toolArgs, { commandId: options.commandId, text: String(options.text || "").slice(0, 500) })
    
    } else if (toolName === "runTerminalCommand") {
        if (!options.command) {
            console.error("runTerminalCommand requires --command")
            process.exit(1)
        }

        Object.assign(toolArgs, {
            command: options.command,
            args: options.args ? options.args.split(",").map(value => value.trim()).filter(Boolean) : []
        })

    }else if (toolName === "runApiCommand") {
        if (!options.method || !options.path) {
            console.error("runApiCommand requires --method and --path")
            process.exit(1)
        }

        Object.assign(toolArgs, {
            method: options.method.toUpperCase(),
            path: options.path
        })

        if (options.body) {
            try {
                toolArgs.body = JSON.parse(options.body)
            } catch {
                console.error("runApiCommand --body must be valid JSON")
                process.exit(1)
            }
        }
    } else if (toolName === "getLogs" && options.limit) {
        toolArgs.limit = Number(options.limit)
    } else if (toolName === "getErrors" && options.includeStack) {
        toolArgs.includeStack = options.includeStack === true || options.includeStack === "true"
    }

    console.log(`RAG Tool: ${toolName}`)
    console.log(`Arguments: ${JSON.stringify(toolArgs)}\n`)

    const result = await tools.execute(toolName, toolArgs, activity => console.log(`[${activity.type}] ${activity.status} - ${activity.message}`))
    console.log(`\nResult:\n${util.inspect(result, { depth: null, colors: true, compact: false })}`)
}

main().catch(error => {
    console.error(`\nRAG tool failed: ${error.message}`)
    process.exit(1)
})
