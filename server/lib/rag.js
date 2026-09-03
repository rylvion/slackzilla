const fs = require("fs")
const path = require("path")
const { listCommands, getCommand, runCommand } = require("./command-runner")

const projectRoot = path.join(__dirname, "..", "..")
const ignoredDirectories = new Set([".git", "node_modules", "dist", "logs", ".vscode", "priv"])
const allowedExtensions = new Set([".js", ".jsx", ".mjs", ".json", ".md", ".css", ".html", ".yml", ".service", ".conf", ".example"])
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"])
const model = process.env.AI_MODEL || "openai/gpt-oss-20b:free"

function collectFiles(directory, files = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue

        const fullPath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            collectFiles(fullPath, files)
        } else if (allowedExtensions.has(path.extname(entry.name).toLowerCase()) && !entry.name.endsWith(".env")) {
            files.push(fullPath)
        }
    }

    return files
}

function collectImages(directory, images = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue

        const fullPath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            collectImages(fullPath, images)
        } else if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
            images.push(fullPath)
        }
    }

    return images
}

function tokens(value) {
    return new Set(String(value).toLowerCase().replace(/[\/_-]+/g, " ").match(/[a-z0-9]{2,}/g) || [])
}

function retrieve(question, limit = 8) {
    const queryTokens = tokens(question)
    const documents = []

    for (const filePath of collectFiles(projectRoot)) {
        const relativePath = path.relative(projectRoot, filePath).replaceAll(path.sep, "/")
        const content = fs.readFileSync(filePath, "utf8")
        const lines = content.split(/\r?\n/)

        for (let start = 0; start < lines.length; start += 40) {
            const text = lines.slice(start, start + 60).join("\n")
            const documentTokens = tokens(`${relativePath} ${text}`)
            const score = [...queryTokens].reduce((total, token) => total + (documentTokens.has(token) ? 1 : 0), 0)
            if (score > 0) documents.push({ relativePath, start: start + 1, text, score })
        }
    }

    return documents
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(document => ({ ...document, text: document.text.slice(0, 3500) }))
}

function retrieveImages(question, limit = 6) {
    const queryTokens = tokens(question)

    return collectImages(projectRoot)
        .map(filePath => {
            const relativePath = path.relative(projectRoot, filePath).replaceAll(path.sep, "/")
            const imageTokens = tokens(relativePath)
            const aliases = [
                ["calculator", "calc"],
                ["calculation", "calc"],
                ["architecture", "arch"],
                ["diagram", "arch"]
            ]
            const score = [...queryTokens].reduce((total, token) => {
                if (imageTokens.has(token)) return total + 1
                return total + (aliases.some(([query, image]) => token === query && imageTokens.has(image)) ? 1 : 0)
            }, 0)
            return { relativePath, score }
        })
        .filter(image => image.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(image => ({
            path: image.relativePath,
            url: `/${image.relativePath}`,
            score: image.score
        }))
}

function formatResponses(responses) {
    return responses.map(response => {
        if (typeof response === "string") return response
        if (response?.text) return response.text
        if (response?.blocks) return response.blocks.map(block => block.text?.text || block.alt_text || "").filter(Boolean).join("\n")
        return JSON.stringify(response)
    }).join("\n")
}

function inferCommandInvocation(question) {
    const match = String(question).match(/(\/sz-[a-z0-9-]+)/i)
    if (!match) return null

    const command = listCommands().find(item => item.cmd.toLowerCase() === match[1].toLowerCase())
    if (!command) return null

    const hashRequest = String(question).match(/(?:password|passphrase)\s+["']?([^,"'\s]+)["']?.*?(\d{2,})\s+iterations/i)
    if (command.id === "hash" && hashRequest) {
        const algorithm = /pbkdf2/i.test(question) ? "pbkdf2" : "sha256"
        const digest = question.match(/\b(sha(?:1|224|256|384|512)|md5)\b/i)?.[1] || "sha512"
        return { id: command.id, text: `${algorithm} ${digest} ${hashRequest[2]} ${hashRequest[1]}` }
    }

    const remainder = String(question).slice(match.index + match[1].length).replace(/^\s*command\b/i, "").trim()
    return { id: command.id, text: remainder }
}

async function answerQuestion({ question, commandId, commandText, identity } = {}) {
    const cleanQuestion = String(question || "").trim()
    if (!cleanQuestion) throw new Error("question is required")

    const inferredCommand = !commandId ? inferCommandInvocation(cleanQuestion) : null
    commandId = commandId || inferredCommand?.id
    commandText = commandText || inferredCommand?.text

    let commandResult = null
    if (commandId) {
        if (!getCommand(commandId)) throw new Error(`unknown command: ${commandId}`)
        commandResult = await runCommand(commandId, commandText, identity)
    }

    const sources = retrieve(cleanQuestion)
    const images = retrieveImages(cleanQuestion)
    const sourceText = sources.map(source => `FILE: ${source.relativePath}:${source.start}\n${source.text}`).join("\n\n")
    const imageText = images.map(image => `IMAGE ASSET: ${image.path} (available at ${image.url})`).join("\n")
    const commandTextResult = commandResult ? `\nCOMMAND RESULT (${commandResult.command}):\n${formatResponses(commandResult.responses)}` : ""

    if (!process.env.AI_API_KEY) {
        return {
            answer: commandResult ? formatResponses(commandResult.responses) : "AI_API_KEY is not configured. Retrieved relevant code sources are available for inspection.",
            sources: sources.map(({ relativePath, start, score }) => ({ path: relativePath, start, score })),
            images,
            command: commandResult
        }
    }

    const configuredUrl = (process.env.AI_URL || "https://ai.hackclub.com/proxy/v1").replace(/\/$/, "")
    const endpoint = configuredUrl.endsWith("/chat/completions")
        ? configuredUrl
        : `${configuredUrl}/chat/completions`
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.AI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: "You are Slackzilla's codebase assistant. Answer only from the supplied repository context and command result. Say when the context is insufficient. Be concise and include relevant file paths. Do not claim to have executed a command unless a command result is supplied."
                },
                {
                    role: "user",
                    content: `Question:\n${cleanQuestion}\n\nRepository context:\n${sourceText || "No matching repository context."}\n\nVisual assets:\n${imageText || "No matching visual assets."}${commandTextResult}`
                }
            ]
        })
    })
    const responseBody = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw new Error(responseBody.error?.message || responseBody.error || `AI request failed with ${response.status}`)
    }

    const answer = responseBody.choices?.[0]?.message?.content
    if (!answer) throw new Error("AI returned an empty response")

    return {
        answer,
        sources: sources.map(({ relativePath, start, score }) => ({ path: relativePath, start, score })),
        images,
        command: commandResult
    }
}

module.exports = {
    answerQuestion,
    retrieve,
    retrieveImages,
    listCommands
}
