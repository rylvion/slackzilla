import { FitAddon } from "@xterm/addon-fit"
import { Terminal as XTerm } from "@xterm/xterm"
import { useEffect, useRef, useState } from "react"
import PageShell from "../components/PageShell"
import { packageInfo } from "../components/utils/package"
import { getCsrfToken, getJson, refreshSession, useSession } from "../components/utils/api"
import "@xterm/xterm/css/xterm.css"
import "../css/terminal.css"

const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[38;5;117m",
    blue: "\x1b[38;5;75m",
    BLUE: "\x1b[38;5;33m",
    green: "\x1b[38;5;84m",
    muted: "\x1b[38;5;245m",
    muted_bold: "\x1b[38;5;245m\x1b[1m",
    purple: "\x1b[38;5;141m",
    red: "\x1b[38;5;210m",
    RED: "\x1b[38;5;196m",
    orange: "\x1b[38;5;208m",
    ORANGE: "\x1b[38;5;202m",
    white: "\x1b[38;5;255m",
    yellow: "\x1b[38;5;228m"
}

function parseInput(value) {
    const tokens = []
    let token = ""
    let quote = null
    let escaped = false

    for (const character of String(value)) {
        if (escaped) {
            token += character
            escaped = false
        }
        else if (character === "\\") escaped = true
        else if (quote) {
            if (character === quote) quote = null
            else token += character
        } else if ((character === "'" || character === "\"") && !token) quote = character
        else if (character === "'" || character === "\"") token += character
        else if (/\s/.test(character)) {
            if (token) {
                tokens.push(token)
                token = ""
            }
        } else {
            token += character
        }
    }

    if (escaped) token += "\\"
    if (token) tokens.push(token)
    return tokens
}

const serverUsage = {
    version: ["version", "version [--verbose]", "version [--verbose] VERSION"],
    api: ["api get PATH", "api post PATH --headers \"Name: value\" --body JSON", "api list [--method METHOD] [--search TEXT]", "api inspect PATH"],
    logs: ["logs", "logs --head N", "logs --tail N", "logs --start N --end N", "logs follow"],
    storage: ["storage", "cd storage", "storage/ session | local: dir | view KEY | delete KEY"],
    docs: ["docs list", "docs search TEXT [--sources N] [--no-verbose]"],
    rag: ["rag status", "rag analyse FILE [CHUNKS]", "rag sources [--type TYPE[,TYPE...]] [--search TEXT] [--limit N]", "rag search TEXT", "rag tools", "rag inspect TOOL", "rag execute TOOL [JSON | --flag value... ]"],
    command: ["command list", "command inspect ID", "command execute ID [arguments]"],
    sudo: ["sudo status", "sudo controls", "sudo inspect ID", "sudo execute refresh", "sudo logout"]
}

const colour = (text, colourName) => `${ANSI[colourName]}${text}${ANSI.reset}`

function highlightCommand(command) {
    const match = command.match(/^(\s*)(\S+)/)
    if (!match) return command

    let result = match[1] + colour(match[2], "orange")
    let quote = null, buffer = "", token = ""
    const rest = command.slice(match[0].length)

    const flush = () => {
        if (token) result += /^-(?:-|[^\s])/.test(token) ? colour(token, "muted") : token
        token = ""
    }

    for (let i = 0; i < rest.length; i++) {
        const char = rest[i]

        if (quote) {
            buffer += char
            if (char === "\\" && i + 1 < rest.length) buffer += rest[++i]
            else if (char === quote) {
                result += colour(buffer, "green")
                buffer = ""
                quote = null
            }
        } else if (char === '"' || char === "'") {
            flush()
            let slashes = 0
            for (let j = i - 1; j >= 0 && rest[j] === "\\"; j--) slashes++

            if (slashes % 2) token += char
            else quote = char, buffer = char
        } else if (/\s/.test(char)) {
            flush()
            result += char
        } else token += char
    }

    flush()
    return result + (buffer ? colour(buffer, "green") : "")
}

function promptText(identity = "noob", contexts = []) {
    if (contexts.length) {
        const context = contexts.map(item => item.label).join("/")
        return `${colour(context, "cyan")}${colour("> ", "green")}`
    }
    return [
        colour("slackzilla", "green"),
        colour(`@${identity}`, "cyan"),
        colour(":~", "purple"),
        colour("$ ", "green")
    ].join("")
}

function displayHeader() {
    const separator = colour("=".repeat(50), "muted")

    const bootMessages = [
        "Terminal environment initialised",
        "Session storage loaded",
        "Command registry loaded",
        "Keyboard shortcuts mapped",
        "Input handler ready",
        "Backend API connected"
    ]

    return [
        separator,
        `${colour(" SLACKZILLA TERMINAL", "green")}  ${colour(packageInfo.version, "cyan")}`,
        separator,
        ` ${colour("Copyright (c) 2026 rylvion. MIT License.", "muted")}`,
        "",
        ...bootMessages.map(message => ` ${colour("[ OK ]", "purple")}  ${colour(message, "muted")}`),
        "",
        ` ${colour("Type", "green")} ${colour("'help'", "cyan")} ${colour("to list available commands.", "green")}`,
        separator,
        ""
    ].join("\r\n")
}

const refresh = () => window.location.reload()

const localCommands = [
    {
        aliases: ["help", "h"], 
        description: "list available local commands",
        run: () => [
            "",
            colour("COMMANDS", "purple"),
            "",
            ...localCommands.map(command => `  ${colour(command.aliases[0].padEnd(8), "cyan")} ${colour(command.description, "muted")}`),
            ...[...serverCommands].map(([name, description]) => `  ${colour(name.padEnd(8), "cyan")} ${colour(description, "muted")}`),
            ""
        ].join("\r\n"),
        noHelp: true
    },
    {
        aliases: ["cls", "clear"],
        description: "clear the visible terminal output",
        run: () => null,
        noHelp: true
    
    },
    {
        aliases: ["whoami", "identity"],
        description: "display the current terminal identity",
        run: (_args, identity = "noob") => `${colour("identity", "muted")}  ${colour(identity, "green")}`,
    },
    {
        aliases: ["ver"],
        description: "display the Slackzilla version or release notes",
        run: () => [
            colour("SLACKZILLA", "purple"),
            `  ${colour("version", "muted")}  ${colour(packageInfo.version, "green")}`,
            `  ${colour("about", "muted")}    ${colour(packageInfo.description, "white")}`
        ].join("\r\n"),
    },
    {
        aliases: ["terminal", "term"],
        description: "display the terminal environment information",
        run: () => displayHeader(),
    },
    {
        aliases: ["refresh", "reload", "re"],
        description: "reload the terminal environment",
        run: () => {
            refresh()
            return `${colour("[INFO]", "BLUE")} ${colour("Reloading terminal...", "blue")}`
        },
    },
    {
        aliases: ["time", "timestamp"],
        description: "convert a timestamp or show the current time",
        run: args => {
            const readable = args.includes("--readable") || args.includes("-r")
            const value = args.find(arg => arg !== "--readable" && arg !== "-r")
            const timestamp = value !== undefined ? Number(value) : Date.now()
            const date = new Date(Math.abs(timestamp) < 10_000_000_000 ? timestamp * 1000 : timestamp)

            if (Number.isNaN(date.getTime())) throw new Error("invalid timestamp")

            if (!readable) return colour(date.toISOString(), "cyan")

            const formatted = date.toUTCString()
            const match = formatted.match(/^(.+ \d{4}) (\d{2}:\d{2}:\d{2}) GMT$/)

            if (!match) return formatted

            return `${match[1]} ${colour(match[2], "purple")} GMT`
        }
    },
    {
        aliases: ["history"],
        description: "show commands entered in this terminal session",
        run: () => null, // handled in executeCommand
        noHelp: true
    },

] 

const commandMap = new Map(localCommands.flatMap(command => command.aliases.map(alias => [alias.toLowerCase(), command])))
const serverCommands = new Map([
    ["version", "return the current or a historical Slackzilla release and its notes"],
    ["status", "return the public application status summary"],
    ["uptime", "return the public application uptime"],
    ["logs", "inspect recent public server log entries"],
    ["storage", "inspect browser session and local storage"],
    ["api", "discover indexed API routes"],
    ["docs", "list and search documentation"],
    ["rag", "inspect and search the RAG index"],
    ["command", "list and inspect Slack command metadata"],
    ["sudo", "list administrative controls"]
])

let terminalSnapshot = ""
let privilegedOperationActive = false
const queuedPrivilegedCommands = new Set()

function privilegedCommandKey(command) {
    const tokens = parseInput(command).map(token => token.toLowerCase())
    if (tokens[0] !== "sudo") return null
    if (tokens[1] === "logout") return "sudo execute logout"
    if (tokens[1] !== "execute" || !tokens[2] || tokens[2] === "refresh") return null
    return tokens.join(" ")
}

function Terminal() {
    const containerRef = useRef(null)
    const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches)
    const { authenticated } = useSession()
    const identity = authenticated ? "hecker" : "noob"
    const identityRef = useRef(identity)
    const authenticatedRef = useRef(authenticated)
    useEffect(() => {
        identityRef.current = identity
        authenticatedRef.current = authenticated
    }, [identity, authenticated])

    useEffect(() => {
        const mobileQuery = window.matchMedia("(max-width: 700px)")
        const handleViewportChange = event => setMobile(event.matches)

        mobileQuery.addEventListener("change", handleViewportChange)
        return () => mobileQuery.removeEventListener("change", handleViewportChange)
    }, [])

    useEffect(() => {
        if (mobile) return undefined

        const container = containerRef.current
        if (!container) return undefined

        const terminal = new XTerm({
            convertEol: true,
            cursorBlink: true,
            cursorStyle: "bar",
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
            fontSize: 14,
            scrollback: 1000,
            theme: {
                background: "#090e0b",
                foreground: "#d5e8d9",
                cursor: "#50fa7b",
                cursorAccent: "#090e0b",
                selectionBackground: "#24472e",
                black: "#090e0b",
                red: "#ff6b6b",
                green: "#50fa7b",
                yellow: "#e8f58a",
                blue: "#8be9fd",
                magenta: "#bd93f9",
                cyan: "#75e6b3",
                white: "#d5e8d9",
                brightBlack: "#52705a",
                brightRed: "#ff8585",
                brightGreen: "#8affaa",
                brightYellow: "#f3ffad",
                brightBlue: "#a4e9ff",
                brightMagenta: "#d6acff",
                brightCyan: "#a4ffd0",
                brightWhite: "#ffffff"
            }
        })
        let transcript = ""
        let restoringTranscript = false
        const originalWrite = terminal.write.bind(terminal)
        const originalWriteln = terminal.writeln.bind(terminal)
        terminal.write = data => {
            if (!restoringTranscript) transcript += String(data)
            return originalWrite(data)
        }
        terminal.writeln = data => {
            if (!restoringTranscript) transcript += `${String(data)}\r\n`
            return originalWriteln(data)
        }

        const fitAddon = new FitAddon()
        let persisted
        try {persisted = JSON.parse(sessionStorage.getItem("slackzilla-terminal-state") || "null")}
        catch {persisted = null}
        const input = {
            buffer: "",
            cursor: 0,
            history: Array.isArray(persisted?.history) ? persisted.history.filter(item => typeof item === "string").slice(-100) : [],
            historyIndex: 0,
            draft: typeof persisted?.draft === "string" ? persisted.draft : ""
        }
        input.buffer = typeof persisted?.buffer === "string" ? persisted.buffer : ""
        input.cursor = Math.min(Number.isInteger(persisted?.cursor) ? persisted.cursor : input.buffer.length, input.buffer.length)
        let suppressNextWordDelete = false
        let runningRequest = null
        let commandQueue = Promise.resolve()
        let pendingPrompt = null
        const contextStack = Array.isArray(persisted?.contexts)
            ? persisted.contexts.filter(item => item && typeof item.family === "string").slice(0, 4)
            : []

        terminal.loadAddon(fitAddon)
        terminal.open(container)
        const restoredOutput = terminalSnapshot || (typeof persisted?.output === "string" ? persisted.output : "")
        if (restoredOutput) {
            restoringTranscript = true
            originalWrite(restoredOutput)
            restoringTranscript = false
            transcript = restoredOutput
            terminalSnapshot = ""
        }

        
        function fitTerminal() {
            if (!container.clientWidth || !container.clientHeight) return

            requestAnimationFrame(() => {
                if (!container.isConnected) return
                fitAddon.fit()
            })
        }

        const writePrompt = () => terminal.write(promptText(identityRef.current, contextStack))

        function clearTerminalOutput() {
            terminal.clear()
            transcript = ""
            terminalSnapshot = ""
            try {
                const current = JSON.parse(sessionStorage.getItem("slackzilla-terminal-state") || "{}")
                sessionStorage.setItem("slackzilla-terminal-state", JSON.stringify({ ...current, output: "" }))
            } catch {
                // ignore session storage errors
            }
        }

        function redrawInput() {
            terminal.write(`\r\x1b[2K${promptText(identityRef.current, contextStack)}${highlightCommand(input.buffer)}`)
            const charactersToMove = input.buffer.length - input.cursor
            if (charactersToMove > 0) terminal.write(`\x1b[${charactersToMove}D`)
        }

        function writeDirectory(items) {
            terminal.write([
                ...items.map(item => `  ${colour(item.entry || "<CMD>", "yellow")} ${colour(item.name, "cyan")}${item.description ? `  ${colour(item.description, "muted")}` : ""}`),
                colour(`${items.length} item${items.length === 1 ? "" : "s"}`, "muted"),
                ""
            ].join("\r\n"))
            writePrompt()
        }

        function storageKeys(kind) {
            const source = kind === "session" ? window.sessionStorage : window.localStorage
            return Array.from({ length: source.length }, (_, index) => source.key(index)).filter(Boolean).sort()
        }

        function storageDirectory(kind) {
            if (!kind) return [
                { name: ".", entry: "<DIR>" }, { name: "..", entry: "<DIR>" },
                { name: "session", entry: "<DIR>" }, { name: "local", entry: "<DIR>" }
            ]
            const source = kind === "session" ? window.sessionStorage : window.localStorage
            return [
                { name: ".", entry: "<DIR>" }, { name: "..", entry: "<DIR>" },
                ...storageKeys(kind).map(name => {
                    if (!authenticatedRef.current) return { name, entry: "<CMD>" }
                    const value = source.getItem(name)
                    return { name, entry: "<CMD>", description: `= ${value === null ? "(missing)" : value}` }
                })
            ]
        }

        function formatApiBody(text) {
            try { return JSON.stringify(JSON.parse(text), null, 2) }
            catch { return text || "(empty response)" }
        }

        function parseApiHeaders(value) {
            if (!value) return {}
            return Object.fromEntries(value.split(/\r?\n|,(?=\s*[^:]+:)/).map(item => {
                const separator = item.indexOf(":")
                if (separator < 1) throw new Error("headers must use 'Name: value' format")
                return [item.slice(0, separator).trim(), item.slice(separator + 1).trim()]
            }))
        }

        async function executeApiRequest(action, args) {
            const route = args[0]
            if (!route || !route.startsWith("/api/") || route.startsWith("//")) throw new Error("api requests require a same-origin /api/ route")
            const publicGetRoutes = new Set(["/api/status", "/api/session", "/api/routes", "/api/commands", "/api/release", "/api/logs"])
            const isAdminRoute = route.startsWith("/api/admin/") || route === "/api/control"
            if (action === "get" && !publicGetRoutes.has(route) && !isAdminRoute) throw new Error(`GET route '${route}' is not permitted through the public terminal`)
            const headersIndex = args.indexOf("--headers")
            const bodyIndex = args.indexOf("--body")
            const headers = parseApiHeaders(headersIndex >= 0 ? args[headersIndex + 1] : "")
            if (isAdminRoute) {
                const csrf = await getCsrfToken()
                if (!csrf) throw new Error("administrator session required")
                if (!headers["X-CSRF-Token"] && !headers["x-csrf-token"]) headers["X-CSRF-Token"] = csrf
            }
            const options = { method: action.toUpperCase(), headers: { Accept: "application/json", ...headers } }
            if (action === "post") {
                if (bodyIndex < 0 || !args[bodyIndex + 1]) throw new Error("api post requires --body JSON")
                try { options.body = JSON.stringify(JSON.parse(args[bodyIndex + 1])) }
                catch { throw new Error("api post body must be valid JSON") }
                if (!Object.keys(options.headers).some(key => key.toLowerCase() === "content-type")) options.headers["Content-Type"] = "application/json"
            }
            const response = await fetch(route, options)
            const text = await response.text()
            terminal.writeln(`${colour(`HTTP ${response.status}`, response.ok ? "green" : "red")}\r\n${formatApiBody(text)}`)
            if (!response.ok) throw new Error(`API request failed with HTTP ${response.status}`)
        }

        function rootDirectory() {
            const entries = [
                ...localCommands.map(command => ({ name: command.aliases[0], entry: "<CMD>", description: command.description })),
                ...[...serverCommands.keys()].map(name => ({ name, entry: ["api", "command", "logs", "rag", "storage"].includes(name) ? "<DIR>" : "<CMD>", description: serverCommands.get(name) }))
            ]
            for (const name of ["api", "logs", "rag", "storage"]) {
                if (!entries.some(item => item.name === name)) entries.push({ name, entry: "<DIR>", description: serverCommands.get(name) || `open the ${name} context` })
            }
            return entries
        }

        function commandDirectory() {
            return [
                { name: ".", entry: "<DIR>" },
                { name: "..", entry: "<DIR>" },
                { name: "list", entry: "<CMD>", description: "list Slack commands" },
                { name: "inspect", entry: "<DIR>", description: "inspect a Slack command" },
                { name: "execute", entry: "<DIR>", description: "execute a Slack command" }
            ]
        }

        function apiDirectory() {
            return [
                { name: ".", entry: "<DIR>" },
                { name: "..", entry: "<DIR>" },
                { name: "get", entry: "<DIR>", description: "GET an allow-listed same-origin API route" },
                { name: "post", entry: "<DIR>", description: "POST through an existing protected API route" },
                { name: "list", entry: "<CMD>", description: "list indexed API routes" },
                { name: "inspect", entry: "<DIR>", description: "inspect an indexed API route" }
            ]
        }

        function ragDirectory() {
            return [
                { name: ".", entry: "<DIR>" },
                { name: "..", entry: "<DIR>" },
                { name: "status", entry: "<CMD>", description: "show RAG index status" },
                { name: "analyse", entry: "<DIR>", description: "analyse an indexed repository file" },
                { name: "sources", entry: "<CMD>", description: "list indexed source files" },
                { name: "search", entry: "<CMD>", description: "search indexed source content" },
                { name: "tools", entry: "<DIR>", description: "list executable RAG tools" },
                { name: "inspect", entry: "<DIR>", description: "inspect a RAG tool definition" },
                { name: "execute", entry: "<DIR>", description: "execute a RAG tool with JSON arguments" }
            ]
        }

        async function ragToolDirectory() {
            const result = await getJson("/api/terminal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: "rag", args: ["tools"] })
            })
            return (result.data.tools || []).map(tool => ({
                name: tool.name,
                entry: "<CMD>",
                description: tool.description
            }))
        }

        function setInput(value) {
            input.buffer = value
            input.cursor = value.length
            redrawInput()
        }

        function deleteWordBeforeCursor() {
            const beforeCursor = input.buffer.slice(0, input.cursor)
            const trimmed = beforeCursor.replace(/\s+$/, "")
            const wordStart = trimmed.lastIndexOf(" ") + 1
            input.buffer = input.buffer.slice(0, wordStart) + input.buffer.slice(input.cursor)
            input.cursor = wordStart
            redrawInput()
        }

        function moveWord(direction) {
            if (direction === "left") {
                const beforeCursor = input.buffer.slice(0, input.cursor).trimEnd()
                const lastWordIndex = beforeCursor.search(/\S+\s*$/)
                input.cursor = lastWordIndex === -1 ? 0 : lastWordIndex
            } else if (direction === "right") {
                const afterCursor = input.buffer.slice(input.cursor)
                const nextWordIndex = afterCursor.search(/\S/)

                if (nextWordIndex === -1) {
                    input.cursor = input.buffer.length
                } else {
                    const remaining = afterCursor.slice(nextWordIndex)
                    const nextWhitespaceIndex = remaining.search(/\s/)
                    input.cursor += nextWordIndex + (nextWhitespaceIndex === -1 ? remaining.length : nextWhitespaceIndex)
                }

            } else {
                return
            }

            redrawInput()
        }

        function requestPrompt(label, secret = false) {
            return new Promise(resolve => {
                pendingPrompt = { label, secret, value: "", cursor: 0, resolve }
                terminal.write(label)
            })
        }

        function redrawPrompt() {
            const prompt = pendingPrompt
            if (!prompt) return

            const lines = prompt.label.split("\r\n")
            terminal.write("\r")
            if (lines.length > 1) terminal.write(`\x1b[${lines.length - 1}A`)
            lines.forEach((line, index) => {
                terminal.write(`\x1b[2K${line}`)
                if (index < lines.length - 1) terminal.write("\r\n")
            })
            terminal.write(prompt.secret ? "*".repeat(prompt.value.length) : prompt.value)

            const remaining = prompt.value.length - prompt.cursor
            if (remaining > 0) terminal.write(`\x1b[${remaining}D`)
        }
    
        function finishPrompt(value) {
            const prompt = pendingPrompt
            pendingPrompt = null
            terminal.write("\r\n")
            prompt.resolve(value)
        }

        async function loginWithMasterPassword() {
            const password = await requestPrompt("Master Password Login: ", true)
            if (password === null) {
                writePrompt()
                return false
            }

            try {
                await fetch("/admin/login", { headers: { Accept: "text/html" } })
                const response = await fetch("/admin/login", {
                    method: "POST",
                    headers: { Accept: "application/json", "Content-Type": "application/json" },
                    body: JSON.stringify({ password })
                })
                const result = await response.json()
                if (!response.ok || result.ok === false) throw new Error(result.error || "invalid credentials")
                terminal.writeln(`${colour("SUCCESS! Welcome back", "green")} ${colour("administrator", "purple")}`)
                terminal.writeln(`${colour("Session:", "muted")} ${colour("active", "green")}`)
                terminal.writeln(`${colour("CSRF token:", "muted")} ${colour("available", "green")}`)
                await refreshSession()
                return true
            } catch (error) {
                terminal.writeln(`${colour("[ERROR] ", "red")}${colour(error.message || "authentication failed", "red")}`)
                writePrompt()
                return false
            }
        }

        async function executeCommand(raw) {
            const cmd = raw.trim()
            if (!cmd) {
                writePrompt()
                return
            }

            if (input.history[input.history.length - 1] !== cmd) input.history.push(cmd)
            input.historyIndex = input.history.length

            let tokens = parseInput(cmd)
            let [commandName] = tokens

            if (contextStack.length) {
                const lowerCommand = commandName.toLowerCase()
                if (lowerCommand === "exit" || lowerCommand === "cd.." || (lowerCommand === "cd" && tokens[1] === "..")) {
                    contextStack.pop()
                    writePrompt()
                    return
                }
                const context = contextStack.at(-1)
                if (context.family === "command" && context.action !== "slack" && lowerCommand === "cd" && tokens[1]) {
                    const targetName = tokens[1].toLowerCase()
                    if (!context.action && ["inspect", "execute"].includes(targetName)) {
                        contextStack.push({
                            family: "command",
                            action: targetName,
                            label: targetName,
                            usage: targetName === "execute" ? "dir | cd NAME | <command-id> [arguments] | exit" : "<command-id> | exit"
                        })
                        writePrompt()
                        return
                    }
                    if (context.action !== "execute") {
                        throw new Error(`'${tokens[1]}' is not a directory in the current context`)
                    }
                    const listing = await getJson("/api/terminal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ command: "command", args: ["dir"] })
                    })
                    const target = listing.data.commands?.find(item => item.id === tokens[1])
                    if (!target) throw new Error(`unknown virtual command directory '${tokens[1]}'`)
                    if (target.entry !== "<DIR>") throw new Error(`'${tokens[1]}' is a command, not a directory`)
                    contextStack.push({ family: "command", action: "slack", id: target.id, label: target.id, usage: "<arguments> | exit" })
                    writePrompt()
                    return
                }
                if (context.family === "api" && lowerCommand === "cd" && tokens[1]) {
                    const targetName = tokens[1].toLowerCase()
                    if (["inspect", "get", "post"].includes(targetName)) {
                        contextStack.push({ family: "api", action: targetName, label: targetName, usage: targetName === "inspect" ? "<route-path> | exit" : `${targetName} PATH${targetName === "post" ? " --headers \"Name: value\" --body JSON" : ""} | exit` })
                        writePrompt()
                        return
                    }
                    throw new Error(`'${tokens[1]}' is not a directory in the current context`)
                }
                if (context.family === "rag" && lowerCommand === "cd" && tokens[1]) {
                    const targetName = tokens[1].toLowerCase()
                    if (["analyse", "tools", "inspect", "execute"].includes(targetName)) {
                        const usage = targetName === "analyse"
                            ? "analyse FILE | exit"
                            : targetName === "tools"
                                ? "dir | exit"
                                : `${targetName} TOOL${targetName === "execute" ? " [JSON]" : ""} | exit`
                        contextStack.push({ family: "rag", action: targetName, label: targetName, usage })
                        writePrompt()
                        return
                    }
                    throw new Error(`'${tokens[1]}' is not a directory in the current context`)
                }
                if (context.family === "storage" && lowerCommand === "cd" && tokens[1]) {
                    const parts = tokens[1].split("/").filter(Boolean)
                    const currentContext = contextStack.at(-1)
                    let current = currentContext.kind || null
                    if (current) contextStack.pop()
                    for (const part of parts) {
                        if (part === ".") continue
                        if (part === "..") current = null
                        else if (["session", "local"].includes(part)) current = part
                        else throw new Error(`'${part}' is not a storage directory`)
                    }
                    if (!current) { writePrompt(); return }
                    if (contextStack.at(-1)?.kind !== current) contextStack.push({ family: "storage", kind: current, label: current, usage: "dir | view KEY | delete KEY | cd .. | exit" })
                    writePrompt()
                    return
                }
                if (context.family === "logs") {
                    if (lowerCommand === "dir") {
                        writeDirectory([
                            { name: ".", entry: "<DIR>" }, { name: "..", entry: "<DIR>" },
                            { name: "head", entry: "<CMD>" }, { name: "tail", entry: "<CMD>" }, { name: "follow", entry: "<CMD>" }
                        ])
                        return
                    }
                    if (["head", "tail", "follow"].includes(lowerCommand)) {
                        tokens = lowerCommand === "follow" ? ["logs", "follow"] : ["logs", `--${lowerCommand}`, ...(tokens.slice(1).length ? tokens.slice(1) : ["10"])]
                        commandName = tokens[0]
                    }
                }
                if (context.family === "command" && !context.action && lowerCommand === "inspect" && tokens.length === 1) {
                    contextStack.push({ family: "command", action: "inspect", label: "inspect", usage: "<command-id> | exit" })
                    writePrompt()
                    return
                }
                if (lowerCommand === "dir") {
                    if (context.family === "command" && !context.action) {
                        writeDirectory(commandDirectory())
                        return
                    }
                    if (context.family === "command" && context.action === "execute") {
                        const listing = await getJson("/api/terminal", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ command: "command", args: ["dir"] })
                        })
                        writeDirectory(listing.data.directory.items)
                        return
                    }
                    if (context.family === "command" && context.action === "inspect") {
                        writeDirectory([{ name: ".", entry: "<DIR>" }, { name: "..", entry: "<DIR>" }])
                        return
                    }
                    if (context.family === "api" && !context.action) {
                        writeDirectory(apiDirectory())
                        return
                    }
                    if (context.family === "rag" && !context.action) {
                        writeDirectory(ragDirectory())
                        return
                    }
                    if (context.family === "rag" && context.action === "tools") {
                        writeDirectory(await ragToolDirectory())
                        return
                    }
                    if (context.family === "rag" && context.action === "analyse") {
                        const listing = await getJson("/api/terminal", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ command: "rag", args: ["sources", "--limit", "500"] })
                        })
                        writeDirectory([
                            { name: ".", entry: "<DIR>" },
                            { name: "..", entry: "<DIR>" },
                            ...listing.data.sources.map(file => ({ name: file, entry: "<CMD>", description: "analyse indexed file" }))
                        ])
                        return
                    }
                    if (context.family === "rag" && ["inspect", "execute"].includes(context.action)) {
                        writeDirectory(await ragToolDirectory())
                        return
                    }
                    if (context.family === "storage") {
                        writeDirectory(storageDirectory(context.kind))
                        return
                    }
                }
                if (context.action !== "slack" && commandName.toLowerCase() === "help") {
                    terminal.write(`${colour(context.family.toUpperCase(), "purple")}\r\n${colour(context.usage, "cyan")}\r\n`)
                    writePrompt()
                    return
                }
                if (context.family === "api") {
                    tokens = context.action
                        ? ["api", context.action, ...(lowerCommand === context.action ? tokens.slice(1) : tokens)]
                        : ["api", ...tokens]
                } else if (context.family === "rag") {
                    tokens = context.action
                        ? ["rag", context.action, ...(lowerCommand === context.action ? tokens.slice(1) : tokens)]
                        : ["rag", ...tokens]
                } else if (context.family === "command") {
                    if (!context.action && commandName.toLowerCase() === "execute" && tokens.length === 1) {
                        contextStack.push({
                            family: "command",
                            action: "execute",
                            label: "execute",
                            usage: "<command-id> [arguments] | exit"
                        })
                        writePrompt()
                        return
                    }
                    tokens = lowerCommand === "dir"
                        ? ["command", "dir"]
                        : context.action === "execute"
                        ? ["command", "execute", ...tokens]
                        : context.action === "inspect"
                            ? ["command", "inspect", ...tokens]
                            : context.action === "slack"
                                ? ["command", "execute", context.id, ...tokens]
                                : ["command", ...tokens]
                }
                commandName = tokens[0]

                if (context.family === "storage") {
                    const action = lowerCommand
                    const key = tokens[1]
                    if (["view", "delete"].includes(action) && !key) throw new Error(`${action} requires a storage key`)
                    const kind = context.kind
                    if (kind === "cookies") {
                        if (action !== "view" && action !== "dir") throw new Error("cookies are read-only")
                        if (action === "view") throw new Error("cookie values are not available through the terminal")
                    } else if (action === "view") {
                        const source = kind === "session" ? sessionStorage : localStorage
                        const value = source.getItem(key)
                        if (value === null) throw new Error(`storage key '${key}' was not found`)
                        terminal.writeln(formatApiBody(value))
                    } else if (action === "delete") {
                        if (kind === "session" && key === "slackzilla-terminal-state") throw new Error("terminal state is protected")
                        const source = kind === "session" ? sessionStorage : localStorage
                        if (source.getItem(key) === null) throw new Error(`storage key '${key}' was not found`)
                        source.removeItem(key)
                        terminal.writeln(`${colour("deleted", "green")} ${key}`)
                    } else if (action !== "dir") throw new Error("storage supports: dir, view KEY, delete KEY")
                    if (action !== "dir") { writePrompt(); return }
                }
            }

            const command = commandMap.get(commandName.toLowerCase())
            const args = tokens.slice(1)

            if (commandName.toLowerCase() === "sudo" && !authenticatedRef.current && !args.length) {
                await loginWithMasterPassword()
                return
            }

            if (!contextStack.length && ["cd", "cd.."].includes(commandName.toLowerCase())) {
                if (commandName.toLowerCase() === "cd.." || args[0] === "..") {
                    writePrompt()
                    return
                }
                const targetName = args[0]?.toLowerCase()
                if (["api", "command", "logs", "rag", "storage"].includes(targetName)) {
                    contextStack.push({
                        family: targetName,
                        label: targetName,
                        usage: targetName === "api" ? "dir | cd get | cd post | list | inspect <path> | help | exit" : targetName === "command" ? "dir | cd NAME | list | inspect [id] | execute | help | exit" : targetName === "logs" ? "dir | head N | tail N | follow | exit" : targetName === "rag" ? "dir | status | analyse FILE | sources | search | tools | inspect TOOL | execute TOOL [JSON | --flag value...] | exit" : "dir | cd session | cd local | exit"
                    })
                    writePrompt()
                    return
                }
                throw new Error(`'${args[0] || ""}' is not a directory`)
            }

            if (!contextStack.length && commandName.toLowerCase() === "dir" && !args.length) {
                writeDirectory(rootDirectory())
                return
            }

            if (!contextStack.length && ["api", "command", "rag"].includes(commandName.toLowerCase()) && !args.length) {
                const family = commandName.toLowerCase()
                contextStack.push({
                    family,
                    label: family,
                    usage: family === "api" ? "dir | cd get | cd post | list | inspect <path> | help | exit" : family === "rag" ? "dir | status | analyse FILE | sources | search | tools | inspect TOOL | execute TOOL [JSON | --flag value...] | exit" : "dir | cd NAME | list | inspect [id] | execute | help | exit"
                })
                writePrompt()
                return
            }

            if (!contextStack.length && commandName.toLowerCase() === "cd" && args[0]?.toLowerCase() === "storage") {
                contextStack.push({ family: "storage", label: "storage", usage: "dir | cd session | cd local | exit" })
                writePrompt()
                return
            }

            if (!contextStack.length && commandName.toLowerCase() === "storage" && !args.length) {
                contextStack.push({ family: "storage", label: "storage", usage: "dir | cd session | cd local | exit" })
                writePrompt()
                return
            }

            if ((!contextStack.length || contextStack.at(-1)?.family === "logs") && commandName.toLowerCase() === "logs" && (args[0] === "follow" || (args[0] === "tail" && args[1] === "--watch"))) {
                const request = { cancelled: false, controller: new AbortController() }
                runningRequest = request
                const stream = new EventSource("/api/logs/stream")
                const render = payload => (payload.lines || []).slice(-50).forEach(line => terminal.writeln(line))
                stream.addEventListener("snapshot", event => { try { render(JSON.parse(event.data)) } catch { terminal.writeln("[ERROR] unable to decode log snapshot") } })
                stream.addEventListener("log", event => { try { terminal.writeln(JSON.parse(event.data).line || "") } catch { terminal.writeln("[ERROR] unable to decode log entry") } })
                await new Promise(resolve => {
                    request.finish = () => { stream.close(); resolve() }
                    request.controller.signal.addEventListener("abort", request.finish, { once: true })
                    stream.onerror = () => { if (!request.cancelled) request.finish() }
                })
                if (runningRequest === request) runningRequest = null
                writePrompt()
                return
            }

            if ((commandName.toLowerCase() === "api" && ["get", "post"].includes(args[0]?.toLowerCase())) ||
                (contextStack.at(-1)?.family === "api" && ["get", "post"].includes(tokens[1]?.toLowerCase()))) {
                const directApi = commandName.toLowerCase() === "api"
                const action = directApi ? args.shift().toLowerCase() : tokens[1].toLowerCase()
                const apiArgs = directApi ? args : tokens.slice(2)
                await executeApiRequest(action, apiArgs)
                writePrompt()
                return
            }

            if (commandName.toLowerCase() === "version" && args.includes("--help")) {
                try {
                    const result = await getJson("/api/terminal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ command: "version", args: ["--help"] })
                    })
                    terminal.write(`${formatServerOutput(result.data)}\r\n`)
                } catch (error) {
                    terminal.writeln(`${colour("[ERROR] ", "red")}${colour(error.message || "version lookup failed", "red")}`)
                }
                writePrompt()
                return
            }

            if ((commandName.toLowerCase() === "help" && args[0]) || (!command && args.includes("--help"))) {
                const family = commandName.toLowerCase() === "help" ? args[0].toLowerCase() : commandName.toLowerCase()
                const usage = serverUsage[family]
                if (usage) {
                    terminal.write(`${colour(family.toUpperCase(), "purple")}\r\n${usage.map(item => `  ${colour(item, "cyan")}`).join("\r\n")}\r\n`)
                    writePrompt()
                    return
                }
            }

            if (!command && !serverCommands.has(commandName.toLowerCase())) {
                terminal.writeln(`${colour("[ERROR] Unrecognised command ", "red")}${colour(`'${commandName}'`, "purple")}${colour(". Type ", "red")}${colour("'help'", "cyan")}${colour(" for available commands.", "red")}`)
                writePrompt()
                return
            }

            if (!command) {
                const isPrivilegedCommand = commandName.toLowerCase() === "sudo" && (
                    args[0]?.toLowerCase() === "logout" ||
                    (args[0]?.toLowerCase() === "execute" && args[1]?.toLowerCase() !== "refresh")
                )
                if (isPrivilegedCommand) {
                    if (privilegedOperationActive) return
                    privilegedOperationActive = true
                }
                const request = { controller: new AbortController(), cancelled: false }
                runningRequest = request
                
                terminal.writeln(`${colour("[INFO]", "BLUE")} ${colour(`executing ${commandName.toLowerCase()}...`, "cyan")}`)

                try {
                    const csrfToken = commandName.toLowerCase() === "sudo" ? await getCsrfToken() : null
                    if (commandName.toLowerCase() === "sudo" && !csrfToken) throw new Error("administrator session required")
                    const isLogout = commandName.toLowerCase() === "sudo" && args[0]?.toLowerCase() === "logout"
                    const controlArgs = isLogout ? ["execute", "logout"] : args
                    const isMutatingControl = commandName.toLowerCase() === "sudo" && controlArgs[0]?.toLowerCase() === "execute" && controlArgs[1]?.toLowerCase() !== "refresh"
                    let requestBody = { command: commandName, args: controlArgs }
                    if (isMutatingControl) {
                        await getJson("/api/terminal", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRF-Token": csrfToken
                            },
                            body: JSON.stringify({ command: "sudo", args: ["inspect", controlArgs[1]] })
                        })
                        const password = await requestPrompt(`Privileged Operation: ${controlArgs[1]}\r\nMaster Password Required: `, true)
                        if (password === null) return
                        const confirmation = await requestPrompt(`Confirm execution of ${controlArgs[1]}? [y/N] `)
                        if (!/^y(?:es)?$/i.test(confirmation || "")) {
                            terminal.writeln(`${colour("[WARNING]", "ORANGE")} ${colour("Operation cancelled.", "orange")}`)
                            return
                        }
                        const reauth = await getJson("/api/terminal", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRF-Token": csrfToken
                            },
                            body: JSON.stringify({ command: "sudo", args: ["reauth", controlArgs[1]], password })
                        })
                        await new Promise(resolve => setTimeout(resolve, 550))
                        requestBody = { command: commandName, args: controlArgs, reauthToken: reauth.reauthToken, confirmed: true }
                    }
                    const timeout = setTimeout(() => request.controller.abort(), 10_000)
                    let result
                    try {
                        result = await getJson("/api/terminal", {
                            method: "POST",
                            signal: request.controller.signal,
                            headers: {
                                "Content-Type": "application/json",
                                ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
                            },
                            body: JSON.stringify(requestBody)
                        })
                    } finally {
                        clearTimeout(timeout)
                    }

                    if (!request.cancelled) {
                        terminal.write(formatServerOutput(result.data))
                        terminal.write("\r\n")
                        if (commandName.toLowerCase() === "sudo" && controlArgs[1]?.toLowerCase() === "logout") {
                            await refreshSession()
                            contextStack.length = 0
                        }
                    }
                } catch (error) {
                    if (!request.cancelled) {
                        const message = error.name === "AbortError"? "terminal request timed out": error.message || "terminal request failed"
                        terminal.writeln(`${colour("[ERROR] ", "red")}${colour(message, "red")}`)
                    }
                } finally {
                    if (isPrivilegedCommand) privilegedOperationActive = false
                    if (runningRequest === request) {
                        runningRequest = null
                        if (!request.cancelled) writePrompt()
                    }
                }
                return
            }

            if (["cls", "clear"].includes(commandName.toLowerCase())) {
                clearTerminalOutput()
                writePrompt()
                return
            }

            if (["version", "ver"].includes(commandName.toLowerCase()) && args.length) {
                try {
                    const result = await getJson("/api/terminal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ command: "version", args })
                    })
                    terminal.write(`${formatServerOutput(result.data)}\r\n`)
                } catch (error) {
                    terminal.writeln(`${colour("[ERROR] ", "red")}${colour(error.message || "release lookup failed", "red")}`)
                }
                writePrompt()
                return
            }

            if (args.includes("--help") && !command.aliases.includes("help") && !command.noHelp) {
                terminal.write([
                    colour(command.aliases[0].toUpperCase(), "purple"),
                    `  ${colour("aliases", "muted")}       ${colour(command.aliases.join(", "), "cyan")}`,
                    `  ${colour("description", "muted")}  ${colour(command.description, "white")}`,
                    ""
                ].join("\r\n"))

                writePrompt()
                return
            }

            if (commandName.toLowerCase() === "history") {
                if (args[0] === "--clear" || args[0] === "-c") {
                    input.history.length = 0
                    input.historyIndex = 0
                    terminal.write(`${colour("[INFO] ", "BLUE")}${colour("Command history cleared.", "blue")}\r\n`)
                    writePrompt()
                    return
                }

                terminal.write(input.history.map((item, index) => `  ${index + 1}  ${item}`).join("\r\n") + "\r\n")
                writePrompt()
                return
            }

            try {
                const output = command.run(args, identityRef.current)
                if (output) terminal.write(`${output}\r\n`)
            } catch (error) {
                terminal.writeln(`${colour("[ERROR] ", "red")}${colour(error.message || "command failed", "red")}`)
            }

            writePrompt()
        }

        function enqueueCommand(raw) {
            const command = raw.trim()
            if (!command) return
            const privilegedKey = privilegedCommandKey(command)
            if (privilegedKey && queuedPrivilegedCommands.has(privilegedKey)) return
            if (privilegedKey) queuedPrivilegedCommands.add(privilegedKey)
            commandQueue = commandQueue.then(async () => {
                terminal.write("\r\n")
                await executeCommand(command)
            }).catch(error => {
                terminal.writeln(`${colour("[ERROR] ", "red")}${colour(error.message || "command failed", "red")}`)
                writePrompt()
            }).finally(() => {
                if (privilegedKey) queuedPrivilegedCommands.delete(privilegedKey)
            })
        }

        function formatRagAnalysis(data) {
            const analysis = data.analysis || {}
            const imports = analysis.imports || {}
            const counts = analysis.counts || {}
            const lines = [
                colour("RAG ANALYSIS", "purple"),
                "",
                `${colour("FILE", "purple")}  ${colour(data.file || "unknown", "cyan")}`,
                `  ${colour("type", "muted")}      ${colour(data.type || "unknown", "white")}`,
                `  ${colour("size", "muted")}      ${colour(data.size || "unknown", "white")}`,
                `  ${colour("modified", "muted")}  ${colour(data.modified || "unknown", "white")}`,
                "",
                colour("SUMMARY", "purple"),
                ...[
                    ["imports", counts.imports],
                    ["functions", counts.functions],
                    ["routes", counts.routes],
                    ["relevant symbols", counts.relevantSymbols],
                    ["dependencies", counts.dependencies],
                    ["dependants", counts.dependants],
                    ["code excerpts", counts.sourceExcerpts]
                ].map(([label, count]) => `  ${colour(label.padEnd(18), "muted")} ${colour(String(count ?? 0), "cyan")}`)
            ]

            const addSection = (title, items, render) => {
                lines.push("", colour(title, "purple"))
                if (!items?.length) {
                    lines.push(`  ${colour("none", "muted")}`)
                    return
                }
                lines.push(...items.map(render))
            }

            if (analysis.warnings?.length) {
                lines.push("", colour("WARNINGS", "purple"))
                lines.push(...analysis.warnings.map(warning => `  ${colour(warning, "red")}`))
            }

            const renderImport = item => {
                const binding = [item.importedName, item.importedAs].filter(Boolean).join(" as ")
                return `  ${colour(String(item.line ?? "?").padStart(4), "muted")}  ${colour(item.source || "unknown", "cyan")}${binding ? `  ${colour(binding, "white")}` : ""}`
            }

            for (const [title, key] of [["BUILT-IN IMPORTS", "builtIn"], ["EXTERNAL IMPORTS", "external"], ["LOCAL IMPORTS", "local"]]) addSection(title, imports[key], renderImport)

            addSection("FUNCTIONS", analysis.functions, item => `  ${colour(String(item.line ?? "?").padStart(4), "muted")}-${colour(String(item.endLine ?? item.line ?? "?").padEnd(4), "muted")}  ${colour(item.name || "anonymous", "cyan")}${item.async ? colour("  async", "yellow") : ""}`)
            addSection("ROUTES", analysis.routes, item => `  ${colour(String(item.line ?? "?").padStart(4), "muted")}  ${colour(String(item.method || "GET").padEnd(8), "cyan")} ${colour(item.path || "unknown", "white")}`)
            addSection("RELEVANT SYMBOLS", analysis.relevantSymbols, item => `  ${colour(String(item.line ?? "?").padStart(4), "muted")}  ${colour(String(item.kind || "symbol").padEnd(10), "yellow")} ${colour(item.name || "anonymous", "cyan")}`)
            addSection("DEPENDENCIES", analysis.dependencies, item => `  ${colour(item, "white")}`)
            addSection("DEPENDANTS", analysis.dependants, item => `  ${colour(item, "white")}`)

            lines.push("", colour("CODE EXCERPTS", "purple"))
            if (!analysis.sourceExcerpts?.length) {
                lines.push(`  ${colour("none", "muted")}`)
            } else {
                for (const excerpt of analysis.sourceExcerpts) {
                    lines.push(`  ${colour(`LINES ${excerpt.lines}`, "cyan")}`)
                    lines.push(...String(excerpt.text || "").split(/\r?\n/).map((line, index) =>
                        `  ${colour(String((excerpt.start || 1) + index).padStart(4), "muted")}  ${colour(line, "white")}`
                    ))
                    lines.push("")
                }
            }

            return lines.join("\r\n")
        }

        function formatServerOutput(data) {
            if (!data || typeof data !== "object") return colour("request completed", "green")

            if (data.botOnline !== undefined || data.nodeVersion || data.platform) {
                return [
                    colour("STATUS", "purple"),
                    `  ${colour("bot", "muted")}  ${colour(data.botOnline ? "online" : "offline", data.botOnline ? "green" : "red")}`,
                    `  ${colour("server", "muted")}  ${colour(data.platform || "unknown", "cyan")}`,
                    `  ${colour("node", "muted")}  ${colour(data.nodeVersion || "unknown", "white")}`,
                    `  ${colour("uptime", "muted")}  ${colour(data.uptimeText || "unknown", "green")}`,
                    `  ${colour("deployment", "muted")}  ${colour(data.deploymentStatus || "unknown", data.deploymentStatus === "failed" ? "red" : "green")}`,
                    ...(data.deploymentBannerError
                        ? [colour("DEPLOYMENT ERROR", "red"), colour(data.deploymentBannerError, "red")]
                        : [])
                ].join("\r\n")
            }

            if (data.uptimeText) return `${colour("uptime", "muted")}  ${colour(data.uptimeText, "green")}`
            if (Array.isArray(data.versions)) return [
                colour("VERSION", "purple"),
                `  ${colour("version [--verbose] [VERSION]", "cyan")}`,
                `  ${colour("version --help", "cyan")}`,
                "",
                colour("AVAILABLE VERSIONS", "purple"),
                ...data.versions.map(version => `  ${colour(version, "cyan")}`)
            ].join("\r\n")
            if (data.directory) return [
                ...data.directory.items.map(item => `  ${colour(item.entry || "<CMD>", "yellow")} ${colour(item.name, "cyan")}${item.description ? `  ${colour(item.description, "muted")}` : ""}`),
                colour(`${data.directory.count} item${data.directory.count === 1 ? "" : "s"}`, "muted")
            ].join("\r\n")
            if (data.analysis && data.file) return formatRagAnalysis(data)
            if (Array.isArray(data.entries)) return data.entries.map(entry => `  ${colour(String(entry.number).padStart(5), "muted")} ${colour(entry.text, "white")}`).join("\r\n") || colour("no log entries found", "muted")
            if (data.version) {
                const lines = [
                    colour("SLACKZILLA", "purple"), 
                    `  ${colour("version", "muted")}  ${colour(data.version, "green")}`, 
                    `  ${colour("current", "muted")}   ${colour(data.currentVersion || data.version, "cyan")}`,
                    `  ${colour("summary", "muted")}  ${colour(data.summary || "unavailable", "white")}`
                ]
                if (Array.isArray(data.changes)) {
                    lines.push(colour(`changes${data.truncated ? ` (showing 15 of ${data.changesTotal})` : ""}`, "muted"), ...data.changes.map(change => `  - ${colour(change, "white")}`))
                }
                return lines.join("\r\n")
            }

            if (Array.isArray(data.commands) && data.commands.every(command => command.name && command.description)) return [colour("BACKEND COMMANDS", "purple"), "", ...data.commands.map(command => `  ${colour(command.name.padEnd(8), "cyan")} ${colour(command.entry || "<CMD>", "yellow")} ${colour(command.usage || "(usage unavailable)", "yellow")}  ${colour(command.description, "muted")}`)].join("\r\n")
            if (Array.isArray(data.commands))                   return data.commands.map(command => `  ${colour(command.id || command.name || "command", "cyan")} ${colour(command.description || command.cmd || "", "muted")}`).join("\r\n") || colour("no commands found", "muted")
            if (Array.isArray(data.responses))                  return data.responses.map(response => colour(typeof response === "string" ? response : response.text || JSON.stringify(response), "white")).join("\r\n") || colour("command returned no response", "muted")
            if (data.inspect && Array.isArray(data.routes))     return colour(JSON.stringify(data.routes.length === 1 ? data.routes[0] : data.routes, null, 2), "white")
            if (Array.isArray(data.routes))                     return data.routes.map(route => `  ${colour(String(route.methods?.join(", ") || route.method || "GET").padEnd(10), "cyan")} ${colour(route.path || "unknown", "white")}`).join("\r\n") || colour("no routes found", "muted")
            if (Array.isArray(data.documents))                  return data.documents.map(document => `  ${colour(document, "white")}`).join("\r\n") || colour("no documents found", "muted")
            if (Array.isArray(data.controls))                   return [colour("ADMIN CONTROLS", "purple"), "", ...data.controls.map(control => `  ${colour(control.id, "cyan")} ${colour(control.mutating ? "[mutating]" : "[read-only]", control.mutating ? "yellow" : "green")} ${colour(control.description || "unavailable", "muted")}`)].join("\r\n")
            if (data.status && typeof data.status === "object") return [
                colour("ADMIN STATUS", "purple"),
                ...Object.entries(data.status).map(([key, value]) => `  ${colour(key, "muted")}  ${colour(typeof value === "object" ? JSON.stringify(value) : String(value ?? "unavailable"), "white")}`)
            ].join("\r\n")
            if (Array.isArray(data.tools)) return [colour("RAG TOOLS", "purple"), "", ...data.tools.map(tool => `  ${colour(tool.name || "unknown", "cyan")}  ${colour(tool.description || "unavailable", "muted")}`)].join("\r\n")
            if (data.result && typeof data.tool === "string") return [
                colour(`RAG TOOL ${data.tool}`, "purple"),
                colour(JSON.stringify(data.result, null, 2), "white")
            ].join("\r\n")
            if (data.tool && typeof data.tool === "object") return colour(JSON.stringify(data.tool, null, 2), "white")
            
                if (Array.isArray(data.results)) return data.results.map(result => {
                const source = result.source || result.path || "result"
                const location = result.line ? `:${result.line}` : result.lines ? `:${result.lines}` : ""
                const heading = result.heading ? ` ${result.heading}` : ""
                return `  ${colour(`${source}${location}`, "cyan")}${colour(heading, "purple")}\r\n    ${colour(result.excerpt || result.text || "", "muted")}`
            }).join("\r\n") || colour("no results found", "muted")

            if (Array.isArray(data.sources)) return data.sources.map(source => `  ${colour(source, "white")}`).join("\r\n") || colour("no sources found", "muted")
            
            if (data.control) return [
                colour("ADMIN CONTROL", "purple"),
                `  ${colour("id", "muted")}  ${colour(data.control.id || "unavailable", "cyan")}`,
                `  ${colour("description", "muted")}  ${colour(data.control.description || "unavailable", "white")}`,
                `  ${colour("mutation", "muted")}  ${colour(data.control.mutating ? "mutating" : "read-only", data.control.mutating ? "yellow" : "green")}`
            ].join("\r\n")

            if (data.command) return colour(JSON.stringify(data, null, 2), "white")

            return [colour("STATUS", "purple"), ...Object.entries(data).map(([key, value]) => `  ${colour(key, "muted")}  ${colour(typeof value === "object" ? JSON.stringify(value) : String(value), "white")}`)].join("\r\n")
        }

        function handleData(data) {
            if (pendingPrompt) {
                const prompt = pendingPrompt

                if (data === "\u0003" || data === "\u001b") { // ctrl+c or escape
                    pendingPrompt = null
                    terminal.write("^C\r\n")
                    prompt.resolve(null)
                    return
                }

                if (data === "\r") return finishPrompt(prompt.value)

                if (data === "\u0017" || data === "\b") { // ctrl+w or backspace
                    prompt.value = ""
                    prompt.cursor = 0
                    redrawPrompt()
                    return
                }

                if (data === "\u001b[1;5D" || data === "\u001b[1;5C") { // ctrl+left arrow / ctrl+right arrow
                    prompt.cursor = data.endsWith("D") ? 0 : prompt.value.length
                    redrawPrompt()
                    return
                }

                if (data === "\u001b[D" || data === "\u001b[C") { // left arrow / right arrow
                    const direction = data.endsWith("D") ? -1 : 1
                    if (prompt.cursor + direction >= 0 && prompt.cursor + direction <= prompt.value.length) {
                        prompt.cursor += direction
                        terminal.write(data)
                    }
                    return
                }

                if (data === "\u007f" || data === "\u001b[3~") { // backspace or delete
                    const backspace = data === "\u007f"
                    if (backspace ? prompt.cursor > 0 : prompt.cursor < prompt.value.length) {
                        prompt.value = prompt.value.slice(0, prompt.cursor - (backspace ? 1 : 0)) + prompt.value.slice(prompt.cursor + (backspace ? 0 : 1))
                        if (backspace) prompt.cursor--
                        redrawPrompt()
                    }
                    return
                }

                if (data.length > 1) {
                    for (const character of data) handleData(character)
                    return
                }

                if (data >= " " && data !== "\u007f") {
                    prompt.value = prompt.value.slice(0, prompt.cursor) + data + prompt.value.slice(prompt.cursor)
                    prompt.cursor++
                    redrawPrompt()
                }

                return
            }

            if (runningRequest && data !== "\u0003" && data !== "\u000c") return  // ignore input while a request is running, except for ctrl+c (cancel) and ctrl+l (clear)

            if (suppressNextWordDelete && (data === "\u0017" || data === "\u007f")) { // ctrl+w or backspace
                suppressNextWordDelete = false
                return
            }

            if (data.includes("\n")) { // handle pasted input or multi-line input
                const lines = data.split(/\r?\n/)
                const commands = [`${input.buffer}${lines.shift() || ""}`.trim(), ...lines.map(line => line.trim())].filter(Boolean)
                input.buffer = ""
                input.cursor = 0
                commands.forEach(enqueueCommand)
                return
            }

            if (data === "\r") { // enter
                enqueueCommand(input.buffer)
                input.buffer = ""
                input.cursor = 0
                return
            }

            if (data === "\u001b") { // escape
                input.buffer = ""
                input.cursor = 0
                redrawInput()
                return
            }

            if (data === "\u0003") { // ctrl+c
                if (runningRequest) {
                    runningRequest.cancelled = true
                    runningRequest.controller.abort()
                    runningRequest = null
                    terminal.write("^C\r\n")
                    writePrompt()
                    return
                }

                const selection = terminal.getSelection()
                if (selection) {
                    navigator.clipboard.writeText(selection).catch(error => console.error("Failed to copy terminal selection:", error))
                    terminal.clearSelection()
                    return
                }

                terminal.write("^C\r\n")
                input.buffer = ""
                input.cursor = 0
                if (contextStack.length) contextStack.pop()
                writePrompt()
                return
            }

            if (data === "\u000c") { // ctrl+l
                clearTerminalOutput()
                redrawInput()
                return
            }

            if (data === "\u007f") { // backspace
                if (!input.cursor) return
                input.buffer = input.buffer.slice(0, input.cursor - 1) + input.buffer.slice(input.cursor)
                input.cursor--
                redrawInput()
                return
            }

            if (data === "\u001b[D" || data === "\u001b[C") { // left arrow / right arrow
                const direction = data.endsWith("D") ? -1 : 1
                if (input.cursor + direction >= 0 && input.cursor + direction <= input.buffer.length) {
                    input.cursor += direction
                    terminal.write(data)
                }
                return
            }

            if (data === "\u001b[A") { // up arrow
                if (input.historyIndex === input.history.length) input.draft = input.buffer
                if (input.historyIndex > 0) setInput(input.history[--input.historyIndex])
                return
            }

            if (data === "\u001b[B") { // down arrow
                if (input.historyIndex < input.history.length - 1) setInput(input.history[++input.historyIndex])
                else if (input.historyIndex < input.history.length) {
                    input.historyIndex = input.history.length
                    setInput(input.draft)
                }
                return
            }

            if (data.length > 1) {
                for (const character of data) handleData(character)
                return
            }

            if (data.length === 1 && data >= " " && data !== "\u007f") { 
                input.buffer = input.buffer.slice(0, input.cursor) + data + input.buffer.slice(input.cursor)
                input.cursor++
                redrawInput()
            }
        }

        terminal.attachCustomKeyEventHandler(event => { // custom key handling for ctrl + key combinations
            if (pendingPrompt && event.type === "keydown" && event.ctrlKey && ["Backspace", "ArrowLeft", "ArrowRight"].includes(event.key)) return true

            if (event.ctrlKey && event.key.toLowerCase() === "c") { // ctrl + c
                if (event.type === "keydown" && terminal.hasSelection()) {
                    navigator.clipboard.writeText(terminal.getSelection()).catch(error => console.error("Failed to copy terminal selection:", error))
                    return false
                }
                return true
            }

            if (event.type === "keydown" && event.key === "Escape") { // escape
                input.buffer = ""
                input.cursor = 0
                redrawInput()
                return false
            }

            if (event.type === "keydown" && event.ctrlKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) { // ctrl + left arrow / ctrl + right arrow
                moveWord(event.key === "ArrowLeft" ? "left" : "right")
                return false
            }

            if (event.type === "keydown" && event.ctrlKey && event.key === "Backspace") { // ctrl + backspace
                if (pendingPrompt) {
                    pendingPrompt.value = ""
                    pendingPrompt.cursor = 0
                    redrawPrompt()
                    return false
                }

                deleteWordBeforeCursor()
                suppressNextWordDelete = true
                setTimeout(() => { suppressNextWordDelete = false }, 100)
                return false
            }

            if (event.type === "keydown" && event.ctrlKey && event.key === "r") { // ctrl + r
                refresh()
                terminal.writeln(`${colour("[INFO]", "blue")}  Reloading terminal...\r\n`)
                return false
            }

            return true
        })

        terminal.element?.addEventListener("contextmenu", async event => {
            event.preventDefault()
            try {
                const text = await navigator.clipboard.readText()
                if (!text) return

                for (const character of text) handleData(character)
            } catch (error) {
                console.error("Failed to paste clipboard text:", error)
            }
        })

        const dataDisposable = terminal.onData(handleData)
        const resizeObserver = new ResizeObserver(fitTerminal)
        resizeObserver.observe(container)
        fitTerminal()
        terminal.focus()
        if (!restoredOutput) {
            terminal.write(displayHeader())
            writePrompt()
        }

        return () => {
            if (runningRequest) {
                runningRequest.cancelled = true
                runningRequest.controller.abort()
            }
            try {
                terminalSnapshot = transcript
                sessionStorage.setItem("slackzilla-terminal-state", JSON.stringify({
                    buffer: input.buffer,
                    cursor: input.cursor,
                    draft: input.draft,
                    history: input.history.slice(-100),
                    contexts: contextStack,
                    output: transcript.slice(-250000)
                }))
            } catch {
                // ignore session storage errors
            }
            dataDisposable.dispose()
            resizeObserver.disconnect()
            terminal.dispose()
        }
    }, [mobile])

    return (
        <PageShell title="Terminal" description="Local Slackzilla terminal" shellClassName="terminal-shell">
            <section className={`panel terminal-panel${mobile ? " terminal-panel--mobile-disabled" : ""}`}>
                <div className="panel-header">
                    <h1>Terminal</h1>
                </div>
                {mobile
                    ? <div className="terminal-mobile-disabled">
                        <strong>Terminal unavailable on mobile</strong>
                        <p>Open Slackzilla on a larger screen to use the interactive terminal.</p>
                    </div>
                    : <div className="terminal-container" ref={containerRef} />
                }
            </section>
        </PageShell>
    )
}

export default Terminal
