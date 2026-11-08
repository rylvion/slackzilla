const fs = require("fs")
const path = require("path")
const { getReleaseInfo, listReleaseVersions } = require("../release-info")
const { listCommands: listSlackCommands, getCommand: getSlackCommand, runCommand } = require("../command-runner")
const { listRoutes } = require("../../api/routes")
const { loadIndex, retrieve } = require("../rag/rag")
const { PERMISSIONS } = require("./permissions")

const projectRoot = path.resolve(__dirname, "..", "..", "..")
const docsRoot = path.join(projectRoot, "docs")

function requireArgument(args, index, label) {
    const value = String(args[index] || "").trim()
    if (!value) {
        const error = new Error(`${label} is required`)
        error.code = "ARGUMENT_REQUIRED"
        error.statusCode = 400
        throw error
    }
    return value
}

function redactLogLine(value) {
    return String(value || "")
        .replace(/(password|passwd|token|csrf|session[_-]?cookie|set-cookie)\s*[:=]\s*([^\s,;]+)/gi, "$1: [REDACTED]")
        .replace(/(slackzilla_(?:admin_session|login_csrf))=[^;\s]+/gi, "$1=[REDACTED]")
        .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
}

function parseLogOptions(args) {
    const values = [...args]
    let mode = "tail"
    let limit = 10
    let start = null
    let end = null
    for (let index = 0; index < values.length; index += 1) {
        const value = String(values[index]).toLowerCase()
        if (value === "follow" || (value === "tail" && values[index + 1] === "--watch")) {
            mode = "follow"
            if (value === "tail") index += 1
        } else if (value === "head" || value === "--head") {
            mode = "head"
            const numberIndex = value === "head" ? ++index : index + 1
            limit = Number(values[numberIndex])
            index = numberIndex
        } else if (value === "tail" || value === "--tail") {
            mode = "tail"
            const numberIndex = value === "tail" ? ++index : index + 1
            limit = Number(values[numberIndex])
            index = numberIndex
        } else if (value === "--start") {
            start = Number(values[++index])
        } else if (value === "--end") {
            end = Number(values[++index])
        } else if (value !== "--watch") {
            const error = new Error(`unknown logs option '${values[index]}'`)
            error.code = "INVALID_ARGUMENT"
            error.statusCode = 400
            throw error
        }
    }
    if (mode !== "follow" && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
        const error = new Error("log limits must be whole numbers between 1 and 50")
        error.code = "INVALID_ARGUMENT"
        error.statusCode = 400
        throw error
    }
    if (start !== null || end !== null) {
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start + 1 > 50) {
            const error = new Error("log ranges must be positive, ordered, and contain no more than 50 entries")
            error.code = "INVALID_ARGUMENT"
            error.statusCode = 400
            throw error
        }
    }
    return { mode, limit, start, end }
}

function executeLogs(args, context) {
    const options = parseLogOptions(args)
    const lines = context.splitLogLines(context.store.getLogSnapshot().content)
    const entries = (options.start !== null
        ? lines.slice(options.start - 1, options.end)
        : options.mode === "head" ? lines.slice(0, options.limit) : lines.slice(-options.limit))
        .map((line, index) => ({ number: options.start !== null ? options.start + index : options.mode === "head" ? index + 1 : Math.max(1, lines.length - (options.limit || 0) + index + 1), text: redactLogLine(line) }))
    return { mode: options.mode, total: lines.length, entries }
}

function routeMatches(route, query) {
    const needle = String(query || "").toLowerCase()
    return !needle || [route.path, route.method, route.file].some(value => String(value || "").toLowerCase().includes(needle))
}

function listDocs() {
    const files = []
    function visit(directory, includeAllMarkdown = false) {
        if (!fs.existsSync(directory)) return
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name)
            if (entry.isDirectory()) visit(fullPath)
            else if (entry.isFile() && entry.name.endsWith(".md") && (includeAllMarkdown || entry.name.endsWith(".md"))) {
                files.push(path.relative(projectRoot, fullPath).replaceAll(path.sep, "/"))
            }
        }
    }
    visit(docsRoot)
    visit(path.join(projectRoot, "assets", "devlogs"))
    if (fs.existsSync(path.join(projectRoot, "README.md"))) files.push("README.md")
    return files.sort()
}

function searchDocs(args) {
    const values = [...args]
    let limit = 20
    let verbose = true
    for (let index = 0; index < values.length; index += 1) {
        if (values[index] === "--no-verbose") {
            values.splice(index, 1)
            index -= 1
            verbose = false
        } else if (values[index] === "--sources") {
            const parsed = Number(values[index + 1])
            if (!Number.isInteger(parsed) || parsed < 1) {
                const error = new Error("--sources requires a positive integer")
                error.code = "INVALID_ARGUMENT"
                error.statusCode = 400
                throw error
            }
            limit = parsed
            values.splice(index, 2)
            index -= 1
        }
    }
    const needle = requireArgument(values, 0, "search query").toLowerCase()
    return listDocs().map(source => {
        const content = fs.readFileSync(path.join(projectRoot, source), "utf8")
        const index = content.toLowerCase().indexOf(needle)

        if (index === -1) return null

        const before = content.slice(0, index)
        const line = before.split(/\r?\n/).length
        const heading = before.split(/\r?\n/).reverse().find(item => /^#{1,6}\s+/.test(item))?.replace(/^#{1,6}\s+/, "").trim() || null

        return { source, heading, line, ...(verbose ? { excerpt: content.slice(Math.max(0, index - 100), index + needle.length + 180).replace(/\s+/g, " ").trim() } : {}) }
    }).filter(Boolean).slice(0, limit)
}

function executeApi(args) {
    const action = String(args[0] || "list").toLowerCase()
    const routes = listRoutes()
    if (action === "list") {
        const method = args.includes("--method") ? args[args.indexOf("--method") + 1] : null
        const searchIndex = args.indexOf("--search")
        const search = searchIndex >= 0 ? args[searchIndex + 1] : null
        return {
            routes: routes.filter(route => (!method || [route.method, ...(route.methods || [])].some(value => String(value || "").toUpperCase() === String(method).toUpperCase())) && routeMatches(route, search))
                .slice(0, 100)
        }
    }
    if (action === "inspect") {
        const target = requireArgument(args, 1, "route path")
        const matches = routes.filter(route => route.path === target)
        if (!matches.length) {
            const error = new Error(`no indexed route matches '${target}'`)
            error.code = "ROUTE_NOT_FOUND"
            error.statusCode = 404
            throw error
        }
        return { inspect: true, routes: matches }
    }
    const error = new Error("api supports: list, inspect <path>")
    error.code = "USAGE_ERROR"
    error.statusCode = 400
    throw error
}

function executeDocs(args) {
    const action = String(args[0] || "list").toLowerCase()
    if (action === "list") return { documents: listDocs() }
    if (action === "search") return { results: searchDocs(args.slice(1)) }
    const error = new Error("docs supports: list, search <text>")
    error.code = "USAGE_ERROR"
    error.statusCode = 400
    throw error
}

function normaliseRagToolName(name) {
    const aliases = { getCommand: "getCommands" }
    return aliases[String(name || "")] || String(name || "")
}

function parseRagToolArguments(values, definition) {
    const args = values.filter(value => value !== "--")
    if (!args.length) return {}

    if (args.length === 1 && !args[0].startsWith("--")) {
        try {
            const parsed = JSON.parse(args[0])
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
        } catch {
            // ignore json parse errors
        }
    }

    const properties = definition.parameters?.properties || {}
    const result = {}
    for (let index = 0; index < args.length; index += 1) {
        const flag = args[index]
        if (!flag.startsWith("--")) throw new Error("RAG tool arguments must be JSON or --flag value pairs")

        const propertyName = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
        const property = properties[propertyName]
        if (!property) throw new Error(`unknown RAG tool argument '${flag}'`)
        const next = args[index + 1]

        if (property.type === "boolean" && (!next || next.startsWith("--"))) {
            result[propertyName] = true
            continue
        }

        if (!next || next.startsWith("--")) throw new Error(`${flag} requires a value`)
        index += 1

        if (property.type === "integer") {
            const value = Number(next)
            if (!Number.isInteger(value)) throw new Error(`${flag} requires an integer`)
            result[propertyName] = value

        } else if (["object", "array"].includes(property.type)) {
            try { result[propertyName] = JSON.parse(next)}
            catch { throw new Error(`${flag} requires valid JSON`)}
        
        } else {
            result[propertyName] = next
        }
    }
    return result
}

async function executeRag(args, context) {
    const action = String(args[0] || "status").toLowerCase()
    const index = loadIndex()
    if (["tools", "inspect", "execute"].includes(action)) {
        const { createRagTools } = require("../rag/rag-tools")
        const { createRagToolContext } = require("../rag/rag-tool-context")
        const tools = createRagTools(createRagToolContext(context))
        const definitions = tools.definitions.map(definition => definition.function)

        if (action === "tools") return { tools: definitions }

        const requestedToolName = requireArgument(args, 1, "RAG tool name")
        const toolName = normaliseRagToolName(requestedToolName)
        const definition = definitions.find(tool => tool.name === toolName)
        if (!definition) {
            const error = new Error(`unknown RAG tool '${requestedToolName}'`)
            error.code = "RAG_TOOL_NOT_FOUND"
            error.statusCode = 404
            throw error
        }
        if (action === "inspect") return { tool: definition }

        try {
            const toolArguments = parseRagToolArguments(args.slice(2), definition)
            return { tool: toolName, result: await tools.execute(toolName, toolArguments) }
        } catch (error) {
            error.code = error.code || "RAG_TOOL_ARGUMENTS_INVALID"
            error.statusCode = error.statusCode || 400
            throw error
        }
    }
    if (action === "status") return { version: index.version, generatedAt: index.generatedAt, files: index.files.length }
    if (action === "sources") {
        let limit = 100
        let types = []
        let search = ""
        for (let cursor = 1; cursor < args.length; cursor += 1) {
            const option = String(args[cursor]).toLowerCase()
            if (option === "--limit") {
                limit = Number(args[++cursor])
                if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be a whole number between 1 and 500")
            } else if (option === "--type") {
                types = String(args[++cursor] || "").toLowerCase().split(",").map(type => type.trim()).filter(Boolean)
                if (!types.length) throw new Error("--type requires one or more comma-separated file types")
            } else if (option === "--search") {
                search = String(args[++cursor] || "").trim().toLowerCase()
                if (!search) throw new Error("--search requires a source path or filename fragment")
            } else {
                throw new Error("rag sources supports: --type TYPE[,TYPE...] --search TEXT --limit N")
            }
        }

        const aliases = new Map([
            ["js", [".js", ".mjs", ".cjs"]], ["javascript", [".js", ".mjs", ".cjs"]],
            ["jsx", [".jsx"]], ["json", [".json"]], ["md", [".md"]], ["markdown", [".md"]],
            ["html", [".html"]], ["yml", [".yml", ".yaml"]], ["yaml", [".yml", ".yaml"]]
        ])
        const filtered = index.files.filter(file => {
            const pathName = String(file.path || "").toLowerCase()
            const fileType = String(file.type || "").toLowerCase()
            if (search && !pathName.includes(search)) return false
            if (!types.length) return true
            return types.some(type => {
                const extensions = aliases.get(type) || [type.startsWith(".") ? type : `.${type}`]
                return extensions.some(extension => pathName.endsWith(extension)) || extensions.some(extension => fileType === extension.slice(1)) || fileType === type
            })
        }).slice(0, limit)
        return { sources: filtered.map(file => file.path), count: filtered.length, limit, types, search: search || null }
    }
    if (action === "search") {
        const query = requireArgument(args, 1, "search query")
        return {
            results: retrieve(query, 10).map(result => ({
                path: result.relativePath,
                lines: `${result.start}-${result.end}`,
                heading: result.heading || "unsectioned",
                score: result.score,
                text: result.text.replace(/\s+/g, " ").slice(0, 360)
            }))
        }
    }
    const error = new Error("rag supports: status, sources [--type TYPE[,TYPE...]] [--search TEXT] [--limit N], search <text>, tools, inspect <tool>, execute <tool> [JSON | --flag value...]")
    error.code = "USAGE_ERROR"
    error.statusCode = 400
    throw error
}

const adminControls = [
    { id: "refresh", description: "refresh the application status snapshot", mutating: false },
    { id: "logout", description: "end the current administrator session", mutating: true },
    { id: "reset-telemetry", description: "reset telemetry history", mutating: true },
    { id: "delete-log", description: "clear the server log", mutating: true },
    { id: "rotate-logs", description: "archive and rotate the server log", mutating: true },
    { id: "redeploy", description: "run the configured deployment script", mutating: true },
    { id: "start", description: "start the configured bot service", mutating: true },
    { id: "stop", description: "stop the configured bot service", mutating: true },
    { id: "restart", description: "restart the configured bot service", mutating: true }
]

const getAdminControl = id => adminControls.find(control => control.id === String(id || "").toLowerCase()) || null


function executeSudo(args, context) {
    const action = String(args[0] || "").toLowerCase()
    if (!action || action === "--help") return { controls: adminControls }
    if (action === "controls" || action === "list") return { controls: adminControls }
    if (action === "status") {
        const summary = context.buildAdminSummary() || {}
        const status = summary.status || summary
        return { status: {
            authenticated: status.authenticated,
            botOnline: status.botOnline,
            uptimeText: status.uptimeText,
            deploymentStatus: status.deploymentStatus,
            deploymentBannerStatus: status.deploymentBannerStatus,
            deploymentBannerError: status.deploymentBannerError,
            platform: status.platform,
            nodeVersion: status.nodeVersion,
            branch: summary.runtimeConfig?.deployBranch
        } }
    }
    if (action === "inspect") {
        const control = getAdminControl(args[1])
        if (!control) {
            const error = new Error(`unknown admin control '${args[1] || ""}'`)
            error.code = "CONTROL_NOT_FOUND"
            error.statusCode = 404
            throw error
        }
        return { control }
    }
    if (action === "execute") {
        const control = getAdminControl(args[1])
        if (!control) {
            const error = new Error(`unknown admin control '${args[1] || ""}'`)
            error.code = "CONTROL_NOT_FOUND"
            error.statusCode = 404
            throw error
        }
        if (control.id !== "refresh") {
            const error = new Error(`control '${control.id}' requires the existing admin control API and explicit confirmation`)
            error.code = "CONTROL_CONFIRMATION_REQUIRED"
            error.statusCode = 409
            throw error
        }
        context.refreshAndBroadcastStatus()
        return { action: control.id, refreshed: true }
    }
    if (action === "logout") return { action: "logout" }
    const error = new Error("sudo supports: status, controls, inspect <id>, execute refresh, logout")
    error.code = "USAGE_ERROR"
    error.statusCode = 400
    throw error
}

async function executeSlackCommand(args, context, session) {
    const action = String(args[0] || "list").toLowerCase()
    if (action === "list") return {
        commands: listSlackCommands().map(command => ({
            name: command.id,
            usage: command.usage_hint || "(no arguments)",
            description: command.description
        }))
    }
    if (action === "dir") {
        const commands = listSlackCommands().map(command => ({
            id: command.id,
            name: command.id,
            description: command.description,
            usage: command.usage_hint || "",
            entry: command.usage_hint ? "<DIR>" : "<CMD>"
        }))
        return { directory: { items: [{ name: ".", entry: "<DIR>" }, { name: "..", entry: "<DIR>" }, ...commands], count: commands.length + 2 }, commands }
    }
    const id = requireArgument(args, 1, "command id")
    const command = getSlackCommand(id)
    if (!command) {
        const error = new Error(`unknown Slack command '${id}'`)
        error.code = "COMMAND_NOT_FOUND"
        error.statusCode = 404
        throw error
    }
    if (action === "inspect") return { command }
    if (action === "execute") {
        if (command.cmd === "/sz-ask") {
            const error = new Error("this command must be used through the AI page")
            error.code = "COMMAND_NOT_AVAILABLE"
            error.statusCode = 403
            throw error
        }
        const result = await runCommand(command.id, args.slice(2).join(" "), {
            userId: "terminal-user",
            username: "Terminal User",
            channelId: "terminal",
            teamId: "slackzilla"
        })
        return { id: result.id, command: result.command, responses: result.responses }
    }
    const error = new Error("command supports: list, inspect <id>, execute <id> [arguments]")
    error.code = "USAGE_ERROR"
    error.statusCode = 400
    throw error
}

const commands = {
    help: {
        description: "list available terminal command families",
        usage: "help",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ list }) => ({ commands: list })
    },
    version: {
        description: "return the current or a historical Slackzilla release and its notes",
        usage: "version [--verbose] [VERSION]",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ args }) => {
            if (args.includes("--help")) return { versions: listReleaseVersions() }
            const verbose = args.includes("--verbose")
            const versions = args.filter(arg => arg !== "--verbose")
            const requestedVersion = versions[0]
            if (versions.length > 1) {
                const error = new Error("version accepts one release identifier and the optional --verbose flag")
                error.code = "INVALID_ARGUMENT"
                error.statusCode = 400
                throw error
            }
            const release = getReleaseInfo(requestedVersion)
            if (requestedVersion && !release.version) {
                const error = new Error(`release '${requestedVersion}' was not found`)
                error.code = "RELEASE_NOT_FOUND"
                error.statusCode = 404
                throw error
            }
            const changes = Array.isArray(release.changes) ? release.changes : []
            return {
                ...release,
                changes: verbose ? changes : changes.slice(0, 15),
                changesTotal: changes.length,
                truncated: !verbose && changes.length > 15
            }
        }
    },
    status: {
        description: "return the public application status summary",
        usage: "status",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ context }) => context.renderStatusSummary()
    },
    uptime: {
        description: "return the public application uptime",
        usage: "uptime",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ context }) => ({ uptimeText: context.renderStatusSummary().uptimeText })
    },
    logs: {
        description: "inspect recent public server log entries",
        usage: "logs [--head N | --tail N | --start N --end N] | logs follow",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ args, context }) => executeLogs(args, context)
    },
    api: {
        description: "discover indexed API routes",
        usage: "api list | api inspect <path>",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ args }) => executeApi(args)
    },
    docs: {
        description: "list and search Markdown documentation",
        usage: "docs list | docs search <text> [--sources N] [--no-verbose]",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ args }) => executeDocs(args)
    },
    rag: {
        description: "inspect and search the local RAG index",
        usage: "rag status | sources [--type TYPE[,TYPE...]] [--search TEXT] [--limit N] | search <text> | tools | inspect <tool> | execute <tool> [JSON | --flag value...]",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ args, context }) => executeRag(args, context)
    },
    command: {
        description: "list and inspect Slack command metadata",
        usage: "command list | command inspect <id>",
        permission: PERMISSIONS.PUBLIC,
        execute: ({ args, context, session }) => executeSlackCommand(args, context, session)
    },
    sudo: {
        description: "inspect or execute approved administrative controls",
        usage: "sudo status | controls | inspect <id> | execute refresh | logout",
        permission: PERMISSIONS.ADMIN,
        execute: ({ args, context }) => executeSudo(args, context)
    }
}


const listCommands = () => Object.entries(commands).map(([name, command]) => ({name, description: command.description, usage: command.usage, permission: command.permission}))
const getCommand = name => commands[name] || null


async function executeCommand(name, args, context, session) {
    const command = getCommand(name)
    if (!command) {
        const error = new Error("command is not registered")
        error.code = "COMMAND_NOT_FOUND"
        error.statusCode = 404
        throw error
    }
    return command.execute({ args, context, session, list: listCommands() })
}

module.exports = { listCommands, getCommand, executeCommand, getAdminControl, executeLogs, parseLogOptions, redactLogLine }
