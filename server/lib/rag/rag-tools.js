const TOOL_TIMEOUT_MS = 5000
const MAX_OUTPUT_BYTES = 32 * 1024
const BLOCKED_TOOL_COMMANDS = new Set(["ask"])

const toolDefinitions = [
    {
        type: "function",
        function: {
            name: "getStatus",
            description: "Get current bot, runtime and deployment status.",
            parameters: { type: "object", properties: {}, additionalProperties: false }
        }
    },
    {
        type: "function",
        function: {
            name: "runApiCommand",
            description: "Call an internal same-origin /api/ route using GET or POST. Existing authentication, CSRF, confirmation, rate limits and method checks apply. No external URLs or credential headers.",
            parameters: {
                type: "object",
                properties: {
                    method: { type: "string", enum: ["GET", "POST"] },
                    path: { type: "string", description: "Internal /api/ route." },
                    body: { type: "object", description: "Optional POST JSON body." },
                    headers: { type: "object", description: "Optional non-credential headers." }
                },
                required: ["method", "path"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "runTerminalCommand",
            description: "Run a registered public terminal command, not an OS shell command. Admin, arbitrary API and unregistered commands are unavailable.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Command name. Use help to list commands." },
                    args: { type: "array", items: { type: "string" }, description: "Command arguments." }
                },
                required: ["command"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getCommands",
            description: "Search command metadata or inspect a command by exact ID. No filters returns command IDs. Multiple filters are combined. Does not execute commands.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Exact command ID." },
                    command: { type: "string", description: "Slack command name, e.g. /sz-calc." },
                    description: { type: "string", description: "Description filter." },
                    category: { type: "string", description: "Category filter." },
                    usageHint: { type: "string", description: "Usage syntax filter." },
                    fuzzy: { type: "string", description: "Search all command metadata." }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getReleaseInfo",
            description: "Get the current version and release notes from package.json and release-history.json. Use for version and release questions. Format: v0.9.Y-beta or v1.0.0-release",
            parameters: {
                type: "object",
                properties: {
                    version: { type: "string", description: "Optional version to inspect." }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "runCommand",
            description: "Execute a registered Slackzilla command. Use when asked to run a command, not getCommands. Excludes /sz-ask to prevent recursive AI calls. Pass only the requested command content in text, transforming it first if requested. Never run blocked commands.",
            parameters: {
                type: "object",
                properties: {
                    commandId: { type: "string", description: "Registered command ID." },
                    text: {
                        type: "string",
                        description: "Content to pass to the command, without surrounding instructions.",
                        maximum: 500
                    }
                },
                required: ["commandId"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getLogs",
            description: "Get recent Slackzilla log entries for diagnosing failures. Maximum 10.",
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "integer", minimum: 1, default: 10, maximum: 10 }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getErrors",
            description: "Get recent structured server errors. Stack traces are excluded unless requested.",
            parameters: {
                type: "object",
                properties: {
                    includeStack: { type: "boolean", description: "Include stack traces when true." }
                },
                additionalProperties: false
            }
        }
    },
    // {
    //     type: "function",
    //     function: {
    //         name: "getMetrics",
    //         description: "Read current Slackzilla runtime and command metrics.",
    //         parameters: { type: "object", properties: {}, additionalProperties: false }
    //     }
    // },
    {
        type: "function",
        function: {
            name: "getRoutes",
            description: "List known HTTP API routes from the repository index.",
            parameters: { type: "object", properties: {}, additionalProperties: false }
        }
    }
]
const blockedKey = /(authorization|cookie|password|secret|token|api.?key|private.?key|environment|env)/i

function getToolHelp(toolName) {
    const definition = toolDefinitions.find(
        tool => tool.function.name === toolName
    )

    if (!definition) return null

    const { name, description, parameters } = definition.function
    const properties = parameters.properties || {}
    const required = parameters.required || []

    const lines = [
        `Tool: ${name}`,
        "",
        "Description:",
        description,
        "",
        "Parameters:"
    ]

    if (Object.keys(properties).length === 0) {
        lines.push("  None")
    } else {
        for (const [key, property] of Object.entries(properties)) {
            const isRequired = required.includes(key)
            const type = property.type || "any"

            lines.push("")
            lines.push(`  --${key}${isRequired ? " (required)" : ""}`)
            lines.push(`    Type: ${type}`)

            if (property.description) {
                lines.push(`    ${property.description}`)
            }

            if (property.minimum !== undefined) {
                lines.push(`    Minimum: ${property.minimum}`)
            }

            if (property.maximum !== undefined) {
                lines.push(`    Maximum: ${property.maximum}`)
            }

            if (property.default !== undefined) {
                lines.push(`    Default: ${property.default}`)
            }
        }
    }

    lines.push("")
    lines.push("Usage:")
    lines.push(`  npm run rag:use-tool -- --${name}`)

    if (Object.keys(properties).length > 0) {
        lines.push(`  npm run rag:use-tool -- --${name} --help`)
    }

    return lines.join("\n")
}

function sanitise(value, key = "", depth = 0) {
    if (blockedKey.test(key)) return "[redacted]"
    if (depth > 8) return "[depth limited]"
    if (typeof value === "string") {
        return value
            .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
            .replace(/(api[_-]?key|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    }
    if (Array.isArray(value)) return value.map(item => sanitise(item, key, depth + 1))
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).filter(([childKey]) => childKey !== "telemetryHistory").map(([childKey, childValue]) => [
            childKey,
            sanitise(childValue, childKey, depth + 1)
        ]))
    }
    return value
}

function limitOutput(data) {
    const safeData = sanitise(data)
    const serialised = JSON.stringify(safeData)

    if (Buffer.byteLength(serialised, "utf8") <= MAX_OUTPUT_BYTES) return safeData

    return {
        truncated: true,
        message: "Tool output exceeded the response limit",
        preview: serialised.slice(0, MAX_OUTPUT_BYTES)
    }
}

function withTimeout(task) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("tool request timed out")), TOOL_TIMEOUT_MS)

        Promise.resolve()
            .then(task).then(value => {
                clearTimeout(timer)
                resolve(value)
            })
            .catch(error => {
                clearTimeout(timer)
                reject(error)
            })
    })
}

function createRagTools({ getStatus, getCommands, getReleaseInfo, runCommand, runApiCommand, runTerminalCommand, getLogs, getErrors, getMetrics, getRoutes } = {}) {
    const handlers = {
        getStatus,
        getCommands,
        getReleaseInfo: async args => getReleaseInfo?.(args?.version),
        runApiCommand: async args => {
            const method = String(args?.method || "GET").toUpperCase()
            const path = String(args?.path || "")
            if (!runApiCommand || !["GET", "POST"].includes(method) || !path.startsWith("/api/") || path.startsWith("//")) {
                return { success: false, status: 400, error: "only GET or POST requests to internal /api/ routes are supported" }
            }
            const headers = args?.headers && typeof args.headers === "object" ? args.headers : {}
            const blockedHeader = Object.keys(headers).find(name => /(authorization|cookie|csrf|password|secret|token|api[-_]?key)/i.test(name))
            if (blockedHeader) return { success: false, status: 403, error: `header '${blockedHeader}' is not permitted for RAG API requests` }
            try {
                return { success: true, method, path, response: await runApiCommand({ method, path, body: args?.body, headers }) }
            } catch (error) {
                return { success: false, method, path, status: error.statusCode || 502, error: error.message || "API request failed" }
            }
        },
        runCommand: async args => {
            const commandId = String(args?.commandId || "").trim()
            const text = String(args?.text || "").slice(0, 500)

            if (BLOCKED_TOOL_COMMANDS.has(commandId)) {
                return { success: false, status: 403, error: "command is blocked from AI tool use" }
            }

            if (typeof runCommand !== "function") {
                return { success: false, status: 503, error: "command output is unavailable" }
            }

            return {
                success: true,
                commandId,
                output: await runCommand(commandId, text)
            }
        },
        runTerminalCommand: async args => {
            const command = String(args?.command || "").trim().toLowerCase()
            const commandArgs = Array.isArray(args?.args) ? args.args.slice(0, 8).map(value => String(value).slice(0, 2048)) : []

            if (!command || typeof runTerminalCommand !== "function") {
                return { success: false, status: 400, error: "a registered public terminal command is required" }
            }

            try {
                return {
                    success: true,
                    command,
                    args: commandArgs,
                    output: await runTerminalCommand(command, commandArgs)
                }
            } catch (error) {
                return {
                    success: false,
                    command,
                    args: commandArgs,
                    status: Number.isInteger(error.statusCode) ? error.statusCode : 400,
                    error: error.message || "terminal command failed"
                }
            }
        },
        getLogs: async args => {
            const limit = Math.min(10, Math.max(1, Number(args?.limit) || 10))
            const result = await getLogs?.(limit)
            return Array.isArray(result) ? result.slice(-limit) : result
        },
        getErrors: async args => {
            const result = await getErrors?.(Boolean(args?.includeStack))
            return Array.isArray(result) ? result.slice(0, 10) : result
        },
        getMetrics,
        getRoutes
    }
    const endpoints = {
        getStatus: "/api/status",
        getCommands: "/api/commands",
        getReleaseInfo: "/api/release",
        runApiCommand: "/api/",
        runCommand: "/api/commands/:id",
        runTerminalCommand: "/api/terminal",
        getLogs: "/api/logs",
        getErrors: "/api/admin/errors",
        getMetrics: "/api/metrics",
        getRoutes: "/api/routes"
    }

    return {
        definitions: toolDefinitions,
        async execute(name, args = {}, onActivity, signal) {
            const handler = handlers[name]
            const endpoint = endpoints[name]
            const startedAt = Date.now()

            if (!handler || !endpoint) {
                return { success: false, status: 400, error: "unknown read-only API tool" }
            }

            const isCommandTool = name === "runCommand" || name === "runTerminalCommand"
            const eventType = isCommandTool ? "command_tool" : "api_request"
            const emit = (status, message, extra = {}) => {
                if (typeof onActivity === "function") {
                    onActivity({ type: eventType, activityId: name, status, message, metadata: { endpoint, ...extra } })
                }
            }

            const activityName = name === "runCommand"
                ? `COMMAND ${args?.commandId || "unknown"}`
                : name === "runTerminalCommand"
                    ? `TERMINAL ${args?.command || "unknown"}`
                    : `GET ${endpoint}`
            emit("started", activityName)

            try {
                const data = await withTimeout(() => handler(args))
                const durationMs = Date.now() - startedAt
                const responseStatus = Number(data?.status) || 200
                const failed = responseStatus >= 400
                emit(failed ? "failed" : "completed", isCommandTool
                    ? `${activityName} ${failed ? "rejected" : "completed"} (${durationMs}ms)`
                    : `GET ${endpoint} ${responseStatus} (${durationMs}ms)`, { status: responseStatus, durationMs })
                if (isCommandTool) {
                    const { output, ...rest } = data

                    return {
                        ...rest,
                        endpoint,
                        status: responseStatus,
                        data: limitOutput(output ?? data.data ?? data)
                    }
                }

                return { success: !failed, endpoint, status: responseStatus, data: limitOutput(data) }
            } catch (error) {
                const durationMs = Date.now() - startedAt
                emit("failed", isCommandTool
                    ? `${activityName} failed (${durationMs}ms)`
                    : `GET ${endpoint} 502 (${durationMs}ms)`, { status: 502, durationMs })
                return { success: false, endpoint, status: 502, error: "API request failed" }
            }
        }
    }
}

module.exports = {
    createRagTools,
    getToolHelp
}
