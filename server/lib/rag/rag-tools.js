const TOOL_TIMEOUT_MS = 5000
const MAX_OUTPUT_BYTES = 32 * 1024
const BLOCKED_TOOL_COMMANDS = new Set(["ask"])

const toolDefinitions = [
    {
        type: "function",
        function: {
            name: "getStatus",
            description: "Read the current Slackzilla status and deployment state.",
            parameters: { type: "object", properties: {}, additionalProperties: false }
        }
    },
    {
        type: "function",
        function: {
            name: "runApiCommand",
            description: "Call an internal same-origin Slackzilla API route from the RAG. Use GET or POST with an /api/ path only. Existing endpoint authentication, CSRF, confirmation, rate limits, and method checks still apply; no external URLs or credential headers are accepted.",
            parameters: {
                type: "object",
                properties: {
                    method: { type: "string", enum: ["GET", "POST"] },
                    path: { type: "string", description: "Internal route beginning with /api/." },
                    body: { type: "object", description: "Optional JSON request body for POST." },
                    headers: { type: "object", description: "Optional non-credential request headers." }
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
            description: "Run a registered public Slackzilla terminal command. This uses the terminal command registry, not an operating-system shell. Administrative commands, arbitrary API requests, and unregistered commands are not available to the RAG.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Registered terminal command name, such as status, uptime, logs, docs, rag, api, or command, use help to see all available commands." },
                    args: { type: "array", items: { type: "string" }, description: "Arguments for the registered terminal command." }
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
            description: "Search and inspect registered Slackzilla commands. With no filters, return only the command IDs. Use filters to find commands by id, command, description, category, or usage hint. Multiple filters are combined. Use fuzzy to search text across command metadata. Use an exact id when you need the full details of one command. This tool only provides command metadata; use runCommand to execute a command.",
            parameters: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "Exact command ID to inspect."
                    },
                    command: {
                        type: "string",
                        description: "Filter by the Slack command name, such as /sz-calc."
                    },
                    description: {
                        type: "string",
                        description: "Filter or search command descriptions."
                    },
                    category: {
                        type: "string",
                        description: "Filter by command category, such as utility or entertainment."
                    },
                    usageHint: {
                        type: "string",
                        description: "Filter by command usage syntax."
                    },
                    fuzzy: {
                        type: "string",
                        description: "Fuzzy text search across command ID, command name, description, category, and usage hint."
                    }
                },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getReleaseInfo",
            description: "Read the current Slackzilla version and versioned release notes from package.json and release-history.json. Use this for questions about the latest version or what changed in a release. It also identifies bot/cmds/release.js as the implementation of /sz-release.",
            parameters: {
                type: "object",
                properties: { version: { type: "string" } },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "runCommand",
            description: "Run a registered Slackzilla command and return its output. All registered commands are available by default except commands explicitly blocked from AI tool execution. The /sz-ask command is blocked because it would recursively invoke the AI assistant. When the user asks to run or execute a command, call this tool instead of getCommands or inferring the output. Use commandId for the command to run and text only for the content that should be passed to that command. Do not include surrounding instructions about using the command unless the user explicitly asks for them to be included. If the user asks you to format, rewrite, summarise, or otherwise transform content before passing it to the command, apply that transformation first. Keep command arguments focused on the requested action and content, then use the command's output as evidence when generating the final answer. For example, 'run the info command' uses commandId 'info'. Do not attempt to run a blocked command.",
            parameters: {
                type: "object",
                properties: {
                    commandId: { type: "string" },
                    text: {
                        type: "string",
                        description: "Content to pass to the command. Exclude instructions about how to use the command unless explicitly requested.",
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
            description: "Read up to the latest 10 entries from the Slackzilla log for diagnosing current failures.",
            parameters: {
                type: "object",
                properties: { limit: { type: "integer", minimum: 1, default: 10, maximum: 10 } },
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getErrors",
            description: "Read the latest 10 structured server errors from /api/admin/errors. Timestamps, source, name and message are included by default; request stack traces only when explicitly needed.",
            parameters: {
                type: "object",
                properties: {
                    includeStack: { type: "boolean", description: "Include stack traces in the response." }
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
            description: "List known Slackzilla HTTP routes from the current repository index.",
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
