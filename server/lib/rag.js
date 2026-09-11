const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { parseJavaScript } = require("./code-parser")
const { listCommands, getCommand, runCommand } = require("./command-runner")

const projectRoot = path.join(__dirname, "..", "..")
const ragDirectory = path.join(projectRoot, ".rag")
const indexPath = path.join(ragDirectory, "index.json")

const ignoredDirectories = new Set([".git", ".rag", "node_modules", "dist", "logs", ".vscode", "priv"])
const ignoredFiles = new Set(["package-lock.json"])
const allowedExtensions = new Set([".js", ".jsx", ".mjs", ".json", ".md", ".css", ".html", ".yml", ".service", ".conf", ".example" ])

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp" ])

const model = process.env.AI_MODEL || "openrouter/free"

const CHUNK_SIZE = 60
const CHUNK_STEP = 40
const MAX_SOURCE_LENGTH = 3500

function emitActivity(onActivity, event) {
    if (typeof onActivity === "function") {
        onActivity({
            timestamp: Date.now(),
            ...event
        })
    }
}

function collectFiles(directory, files = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
        if (entry.isFile() && ignoredFiles.has(entry.name)) continue

        const fullPath = path.join(directory, entry.name)
        
        if (entry.isDirectory()) {
            collectFiles(fullPath, files)
            continue
        }
        const extension = path.extname(entry.name).toLowerCase()

        if (allowedExtensions.has(extension) && !entry.name.endsWith(".env")) { files.push(fullPath) }
    }

    return files
}


function collectImages(directory, images = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
         if (entry.isFile() && ignoredFiles.has(entry.name)) continue

        const fullPath = path.join(directory, entry.name)

        if (entry.isDirectory()) {
            collectImages(fullPath, images)
            continue
        }

        if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
            images.push(fullPath)
        }
    }

    return images
}

function relativePath(filePath) {
    return path.relative(projectRoot, filePath).replaceAll(path.sep, "/")
}

function tokens(value) {
    return new Set(
        String(value)
            .toLowerCase()
            .replace(/[\/\\._-]+/g, " ")
            .match(/[a-z0-9]{2,}/g) || []
    )
}

function normalisePath(value) {
    return String(value)
        .trim()
        .replace(/^["'`(]+|["'`),.]+$/g, "")
        .replaceAll("\\", "/")
        .replace(/^\.\/+/, "")
        .toLowerCase()
}

function extractFileReferences(question) {
    const matches = String(question).match(
        /(?:[\w.-]+\/)*[\w.-]+\.(?:js|jsx|mjs|json|md|css|html|yml|service|conf|example)/gi
    ) || []

    return [...new Set(matches.map(normalisePath))]
}

function resolveFileReference(fromFile, reference) {
    if (!reference) { return null }

    const fromDirectory = path.dirname( path.join(projectRoot, fromFile) )
    const candidate = path.resolve(fromDirectory, reference)

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return relativePath(candidate)
    }

    return null
}

function extractPathReferences(filePath, code) {
    const references = []

    const pathJoinRegex = /path\.join\s*\(\s*(?:__dirname|__filename)\s*,\s*["'`]([^"'`]+)["'`]\s*\)/g
    const pathResolveRegex = /path\.resolve\s*\(\s*(?:__dirname|__filename)\s*,\s*["'`]([^"'`]+)["'`]\s*\)/g

    for (const regex of [pathJoinRegex, pathResolveRegex]) {
        let match

        while ((match = regex.exec(code)) !== null) {
            const resolved = resolveFileReference(
                filePath,
                match[1]
            )

            if (resolved) {
                references.push(resolved)
            }
        }
    }


    return references
}

function getFileType(filePath) {
    const extension = path.extname(filePath).toLowerCase()

    if ([".js", ".jsx", ".mjs"].includes(extension)) return "javascript"
    if (extension === ".md") return "markdown"
    if (extension === ".json") return "json"
    if ([".yml"].includes(extension)) return "yaml"
    if ([".css"].includes(extension)) return "css"
    if ([".html"].includes(extension)) return "html"
    if ([".service", ".conf", ".example"].includes(extension)) return "config"

    return "text"
}

function getHeading(lines, start) {
    for (let index = start; index >= 0; index--) {
        const match = lines[index]?.match(/^\s{0,3}#{1,6}\s+(.+)$/)
        if (match) { return match[1].trim() }
    }

    return null
}

function createChunks(content, filePath) {
    const lines = content.split(/\r?\n/)
    const type = getFileType(filePath)
    const chunks = []

    for (let start = 0; start < lines.length; start += CHUNK_STEP) {
        const chunkLines = lines.slice(start, start + CHUNK_SIZE)

        if (!chunkLines.length) continue

        const text = chunkLines.join("\n")
        const heading = type === "markdown"? getHeading(lines, start) : null

        chunks.push({
            start: start + 1,
            end: Math.min(start + CHUNK_SIZE, lines.length),
            type,
            heading,
            text
        })
    }

    return chunks 
}

function getFileMetadata(filePath) {
    const stats = fs.statSync(filePath)

    return {
        path: relativePath(filePath),
        size: stats.size,
        modified: stats.mtimeMs
    }
}


function resolveImport(fromFile, importPath) {
    if (!importPath.startsWith(".")) {
        return null
    }

    const fromDirectory = path.dirname(
        path.join(projectRoot, fromFile)
    )

    const candidates = [
        path.resolve(fromDirectory, importPath),
        path.resolve(fromDirectory, `${importPath}.js`),
        path.resolve(fromDirectory, `${importPath}.jsx`),
        path.resolve(fromDirectory, `${importPath}.mjs`),
        path.resolve(fromDirectory, importPath, "index.js")
    ]

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return relativePath(candidate)
        }
    }

    return null
}

function getDependencies(filePath, index = loadIndex()) {
    const file = index.files.find(
        item => item.path === filePath
    )

    if (!file?.code) {
        return []
    }

    const importDependencies = (file.code.imports || [])
        .map(item => resolveImport(file.path, item.source))
        .filter(Boolean)

    const pathDependencies = extractPathReferences(
        file.path,
        file.code.content || ""
    )

    return [
        ...new Set([
            ...importDependencies,
            ...pathDependencies
        ])
    ]
}

function buildIndex() {
    const files = collectFiles(projectRoot)

    const index = {
        version: 1,
        generatedAt: new Date().toISOString(),
        files: []
    }

    for (const filePath of files) {
        try {
            const metadata = getFileMetadata(filePath)
            const content = fs.readFileSync(filePath, "utf8")
            const chunks = createChunks(content, filePath)
            const type = getFileType(filePath)

            let code = null

            if (type === "javascript") {
                try { code = parseJavaScript(content)}
                catch { code = null}
            }

            index.files.push({
                ...metadata,
                type,
                tokens: [...tokens(`${metadata.path} ${content}`)],
                chunks,
                code
            })

        } catch {
            continue
        }
    }

    fs.mkdirSync(ragDirectory, { recursive: true })
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))

    return index
}



function isIndexCurrent(index) {
    if (!index?.files || !Array.isArray(index.files)) return false

    const currentFiles = collectFiles(projectRoot)
    if (currentFiles.length !== index.files.length) { return false }

    const indexedFiles = new Map(
        index.files.map(file => [file.path, file])
    )

    for (const filePath of currentFiles) {
        try {
            const metadata = getFileMetadata(filePath)
            const indexed = indexedFiles.get(metadata.path)

            if (!indexed) return false

            if (
                indexed.size !== metadata.size ||
                indexed.modified !== metadata.modified
            ) {
                return false
            }
        } catch {
            return false
        }
    }

    return true
}

function loadIndex() {
    try {
        if (!fs.existsSync(indexPath)) { return buildIndex() }
        const index = JSON.parse( fs.readFileSync(indexPath, "utf8") )
        if (!isIndexCurrent(index)) { return buildIndex() }
        return index
    } catch {
        return buildIndex()
    }
}

function findSymbols(question, index = loadIndex()) {
    const queryTokens = tokens(question)
    const results = []

    for (const file of index.files) {
        if (!file.code) continue

        for (const symbol of file.code.functions || []) {
            const symbolTokens = tokens(symbol.name)
            const score = [...queryTokens].reduce((total, token) => total + (symbolTokens.has(token) ? 20 : 0), 0)

            if (score > 0) {
                results.push({
                    file: file.path,
                    ...symbol,
                    score
                })
            }
        }
    }

    return results.sort( (left, right) => right.score - left.score )
}

function getDependants(filePath, index = loadIndex()) {
    const dependants = []

    for (const file of index.files) {
        if (!file.code) continue

        const dependencies = (file.code.imports || [])
            .map(item =>
                resolveImport(file.path, item.source)
            )
            .filter(Boolean)

        if (dependencies.includes(filePath)) {
            dependants.push(file.path)
        }
    }

    return dependants
}

function findEnvironmentVariable(name, index = loadIndex()) {
    const results = []

    for (const file of index.files) {
        if (!file.code) continue

        for (const variable of file.code.environmentVariables || []) {
            if (
                variable.name.toLowerCase() ===
                name.toLowerCase()
            ) {
                results.push({
                    file: file.path,
                    line: variable.line,
                    name: variable.name
                })
            }
        }
    }

    return results
}

function extractEnvironmentVariables(question) {
    return String(question).match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []
}

function findRoutes(question, index = loadIndex()) {
    const queryTokens = tokens(question)
    const results = []

    for (const file of index.files) {
        if (!file.code) continue

        for (const route of file.code.routes || []) {
            const routeTokens = tokens(
                `${route.method} ${route.path}`
            )

            const score = [...queryTokens].reduce(
                (total, token) =>
                    total +
                    (routeTokens.has(token) ? 20 : 0),
                0
            )

            if (score > 0) {
                results.push({
                    file: file.path,
                    ...route,
                    score
                })
            }
        }
    }

    return results.sort(
        (left, right) => right.score - left.score
    )
}

function getCodeContext(file, symbol = null) {
    if (!file.code) return ""

    const sections = []

    if (file.code.imports?.length) {
        sections.push(`IMPORTS:\n${file.code.imports.map(item => `- ${item.source}`).join("\n")}`)
    }

    if (file.code.functions?.length) {
        sections.push(`FUNCTIONS:\n${file.code.functions.map(item =>`- ${item.name} (${item.line}-${item.endLine})`).join("\n")}`)
    }

    if (file.code.environmentVariables?.length) {
        sections.push(`ENVIRONMENT VARIABLES:\n${file.code.environmentVariables.map(item => `- ${item.name} (${item.line})`).join("\n")}`)
    }

    if (file.code.routes?.length) {
        sections.push(`ROUTES:\n${file.code.routes.map(item => `- ${item.method} ${item.path} (${item.line})`).join("\n")}`)
    }

    if (symbol && file.chunks?.length) {
        const startLine = symbol.line
        const endLine = symbol.endLine || symbol.line

        const relevantChunks = file.chunks.filter(chunk =>  chunk.start <= endLine && chunk.end >= startLine )

        if (relevantChunks.length) {
            sections.push(`SOURCE (${startLine}-${endLine}):\n${relevantChunks.map(chunk => chunk.text).join("\n")}` )
        }
    }

    return sections.join("\n\n")
}

function calculateScore({
    question,
    queryTokens,
    document,
    chunk,
    requestedFiles
}) {
    const filePath = document.path.toLowerCase()
    const chunkText = chunk.text.toLowerCase()
    const fileTokens = tokens(document.path)
    const headingTokens = tokens(chunk.heading || "")

    let score = 0

    const exactFileMatch = requestedFiles.some(
        requested => requested === filePath
    )

    if (exactFileMatch) {
        score += 1000
    }

    for (const token of queryTokens) {
        if (fileTokens.has(token)) {
            score += 20
        }

        if (headingTokens.has(token)) {
            score += 15
        }

        if (chunkText.includes(token)) {
            score += 5
        }
    }

    const questionLower = question.toLowerCase()

    if (
        questionLower.includes("how does") ||
        questionLower.includes("how do") ||
        questionLower.includes("how is")
    ) {
        if (document.type === "markdown") {
            score += 8
        }
    }

    if (
        questionLower.includes("where") ||
        questionLower.includes("which file") ||
        questionLower.includes("implemented")
    ) {
        if (
            document.type === "javascript" ||
            document.type === "json"
        ) {
            score += 8
        }
    }

    if (
        questionLower.includes("architecture") ||
        questionLower.includes("design") ||
        questionLower.includes("flow")
    ) {
        if (
            filePath.includes("architecture") ||
            filePath.includes("arch") ||
            filePath.includes("diagram")
        ) {
            score += 30
        }
    }

    if (
        questionLower.includes("security") ||
        questionLower.includes("csrf") ||
        questionLower.includes("authentication") ||
        questionLower.includes("auth")
    ) {
        if (filePath.includes("security") || filePath.includes("auth")) {
            score += 30
        }
    }

    if (
        questionLower.includes("webhook") ||
        questionLower.includes("github") ||
        questionLower.includes("deploy")
    ) {
        if (
            filePath.includes("webhook") ||
            filePath.includes("deploy")
        ) {
            score += 30
        }
    }

    return score
}

function retrieve(question, limit = 8) {
    const cleanQuestion = String(question || "").trim()
    const queryTokens = tokens(cleanQuestion)
    const requestedFiles = extractFileReferences(cleanQuestion)
    const index = loadIndex()
    const documents = []

    for (const document of index.files) {
        for (const chunk of document.chunks) {
            const score = calculateScore({
                question: cleanQuestion,
                queryTokens,
                document,
                chunk,
                requestedFiles
            })

            if (score <= 0) continue

            documents.push({
                relativePath: document.path,
                start: chunk.start,
                end: chunk.end,
                type: chunk.type,
                heading: chunk.heading,
                text: chunk.text,
                score
            })
        }
    }

    return documents
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score
            }

            return left.relativePath.localeCompare(right.relativePath)
        })
        .slice(0, limit)
        .map(document => ({
            ...document,
            text: document.text.slice(0, MAX_SOURCE_LENGTH)
        }))
}

function retrieveImages(question, limit = 6) {
    const queryTokens = tokens(question)

    return collectImages(projectRoot)
        .map(filePath => {
            const relative = relativePath(filePath)
            const imageTokens = tokens(relative)

            const aliases = [
                ["calculator", "calc"],
                ["calculation", "calc"],
                ["architecture", "arch"],
                ["diagram", "arch"],
                ["webhook", "hook"],
                ["dashboard", "dash"],
                ["github", "git"]
            ]

            const score = [...queryTokens].reduce((total, token) => {
                if (imageTokens.has(token)) {
                    return total + 10
                }

                if (
                    aliases.some(
                        ([query, image]) =>
                            token === query && imageTokens.has(image)
                    )
                ) {
                    return total + 6
                }

                return total
            }, 0)

            return {
                relativePath: relative,
                score
            }
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
    return responses
        .map(response => {
            if (typeof response === "string") return response

            if (response?.text) {
                return response.text
            }

            if (response?.blocks) {
                return response.blocks
                    .map(
                        block =>
                            block.text?.text ||
                            block.alt_text ||
                            ""
                    )
                    .filter(Boolean)
                    .join("\n")
            }

            return JSON.stringify(response)
        })
        .join("\n")
}

function inferCommandInvocation(question) {
    const match = String(question).match(/(\/sz-[a-z0-9-]+)/i)

    if (!match) return null

    const command = listCommands().find(
        item =>
            item.cmd.toLowerCase() === match[1].toLowerCase()
    )

    if (!command) return null

    const hashRequest = String(question).match(
        /(?:password|passphrase)\s+["']?([^,"'\s]+)["']?.*?(\d{2,})\s+iterations/i
    )

    if (command.id === "hash" && hashRequest) {
        const algorithm = /pbkdf2/i.test(question)? "pbkdf2" : "sha256"

        const digest = question.match(/\b(sha(?:1|224|256|384|512)|md5)\b/i)?.[1] || "sha512"

        return {
            id: command.id,
            text: `${algorithm} ${digest} ${hashRequest[2]} ${hashRequest[1]}`
        }
    }

    const remainder = String(question)
        .slice(match.index + match[1].length)
        .replace(/^\s*command\b/i, "")
        .trim()

    return {
        id: command.id,
        text: remainder
    }
}


function buildCodebaseContext(question, index) {
    const environmentVariables = extractEnvironmentVariables(question)

    const context = {
        symbols: [],
        routes: [],
        files: new Set(),
        dependencies: new Set(),
        dependants: new Set(),
        environmentVariables: [],
        code: []
    }

    context.symbols = findSymbols(question, index)
    context.routes = findRoutes(question, index)

    for (const symbol of context.symbols) {
        if (symbol.file) { context.files.add(symbol.file) }
    }

    for (const route of context.routes) {
        if (route.file) { context.files.add(route.file) }
    }

    for (const filePath of context.files) {
        const dependencies = getDependencies(filePath, index)
        const dependants = getDependants(filePath, index)

        for (const dependency of dependencies) { context.dependencies.add(dependency) }
        for (const dependant of dependants) { context.dependants.add(dependant) }
    }

    for (const filePath of context.dependencies) { context.files.add(filePath) }
    for (const filePath of context.dependants) { context.files.add(filePath) }
    for (const variable of environmentVariables) { context.environmentVariables.push( ...findEnvironmentVariable(variable, index) ) }

    for (const filePath of context.files) {
        const file = index.files.find(item => item.path === filePath )

        if (!file) continue

        const symbols = context.symbols.filter( symbol => symbol.file === filePath )

        if (symbols.length) {
            for (const symbol of symbols) {
                const codeContext = getCodeContext(file, symbol )
                if (codeContext) { context.code.push(codeContext) }
            }
        } else {
            const codeContext = getCodeContext(file)

            if (codeContext) { context.code.push(codeContext) }
        }
    }

    return context
}

function formatCodebaseContext(context) {
    const sections = []

    if (context.symbols.length) {
        sections.push(
            `RELEVANT SYMBOLS:\n${context.symbols
                .slice(0, 20)
                .map(symbol => `- ${symbol.name} in ${symbol.file}:${symbol.line}-${symbol.endLine}`)
                .join("\n")}`
        )
    }

    if (context.routes.length) {
        sections.push(
            `RELEVANT ROUTES:\n${context.routes
                .slice(0, 20)
                .map(route =>`- ${route.method} ${route.path} in ${route.file}:${route.line}`)
                .join("\n")}`
        )
    }

    if (context.dependencies.size) {
        sections.push(
            `DEPENDENCIES:\n${[...context.dependencies]
                .map(file => `- ${file}`)
                .join("\n")}`
        )
    }

    if (context.dependants.size) {
        sections.push(
            `DEPENDANTS:\n${[...context.dependants]
                .map(file => `- ${file}`)
                .join("\n")}`
        )
    }

    if (context.environmentVariables.length) {
        sections.push(
            `ENVIRONMENT VARIABLES:\n${context.environmentVariables
                .map(variable => `- ${variable.name} in ${variable.file}:${variable.line}`)
                .join("\n")}`
        )
    }

    if (context.code.length) {
        sections.push(
            `CODE STRUCTURE:\n${context.code.join("\n\n")}`
        )
    }

    return sections.join("\n\n")
}

/**
 * e.g. parameter: 
 * {
 *   question: "How does the authentication flow work?",
 *   commandId: "sz-hash",
 *   commandText: "pbkdf2 sha256 10000 mypassword",
 *   identity: { userId: "user123", userName: "Alice" },
 *   onActivity: (activity) => console.log(activity)
 * }
 */
async function answerQuestion({
    question,
    commandId,
    commandText,
    identity,
    onActivity
} = {}, withAi = true) {
    const cleanQuestion = String(question || "").trim()

    if (!cleanQuestion) {
        throw new Error("question is required")
    }

    const activities = []

    const emit = (event) => {
        const activity = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...event
        }

        activities.push(activity)

        if (typeof onActivity === "function") {
            onActivity(activity)
        }
    }

    const inferredCommand = !commandId ? inferCommandInvocation(cleanQuestion) : null
    commandId = commandId || inferredCommand?.id
    commandText = commandText || inferredCommand?.text
    let commandResult = null

    if (commandId) {
        if (!getCommand(commandId)) {
            throw new Error(`unknown command: ${commandId}`)
        }

        emit({
            type: "command",
            activityId: commandId,
            status: "started",
            message: `Executing command ${commandId} with arguments: ${commandText || "(none)"}`
        })

        commandResult = await runCommand(commandId, commandText, identity)

        emit({
            type: "command",
            activityId: commandId,
            status: "completed",
            message: `Command ${commandId} executed successfully`
        })
    }

    ///////////////////////////////////////////////////////////////////////////////////////

    emit({
        type: "retrieval",
        activityId: "sources",
        status: "started",
        message: "Searching repository..."
    })

    const sources = retrieve(cleanQuestion)

    emit({
        type: "retrieval",
        activityId: "sources",
        status: "completed",
        message: `Retrieved ${sources.length} source${sources.length === 1 ? "" : "s"}`
    })

    //////////////////////////////////////////////////////////////////////////////////////

    emit({
        type: "retrieval",
        activityId: "images",
        status: "started",
        message: "Searching for visual assets..."
    })

    const images = retrieveImages(cleanQuestion)

    emit({
        type: "retrieval",
        activityId: "images",
        status: "completed",
        message: `Retrieved ${images.length} image${images.length === 1 ? "" : "s"}`
    })

    ///////////////////////////////////////////////////////////////////////////////////////

    emit({
        type: "context",
        activityId: "codebase",
        status: "started",
        message: "Building codebase context..."
    })

    const index = loadIndex()
    const codebaseContext = buildCodebaseContext(cleanQuestion, index)
    const codebaseText = formatCodebaseContext(codebaseContext)

    emit({
        type: "context",
        activityId: "codebase",
        status: "completed",
        message: "Built codebase context",
        metadata: {
            symbols: codebaseContext.symbols.map(symbol => ({
                name: symbol.name,
                file: symbol.file,
                line: symbol.line,
                length: symbol.length,
                endLine: symbol.endLine,
                score: symbol.score,
                "available at": `${symbol.file}:${symbol.line}-${symbol.endLine || symbol.line}`
            })),
            routes: codebaseContext.routes.length,
            files: codebaseContext.files.size,
            dependencies: codebaseContext.dependencies.size,
            dependants: codebaseContext.dependants.size,
            environmentVariables: codebaseContext.environmentVariables.length,
            codeContexts: codebaseContext.code.length
        }
    })

    const sourceText = sources
        .map(source => {
            const metadata = [
                `FILE: ${source.relativePath}`,
                `LINES: ${source.start}-${source.end}`,
                `TYPE: ${source.type}`
            ]

            if (source.heading) {
                metadata.push(`SECTION: ${source.heading}`)
            }

            return `${metadata.join("\n")}\n${source.text}`
        })
        .join("\n\n")

    const imageText = images
        .map(image => `IMAGE ASSET: ${image.path} (available at ${image.url})`)
        .join("\n")

    const commandTextResult = commandResult
        ? `\nCOMMAND RESULT (${commandResult.command}):\n${formatResponses(commandResult.responses)}`
        : ""

    if (!process.env.AI_API_KEY && withAi) {
        emit({
            type: "ai",
            activityId: "request",
            status: "failed",
            message: "AI_API_KEY is not configured"
        })

        return {
            question: cleanQuestion,
            answer: commandResult
                ? formatResponses(commandResult.responses)
                : "AI_API_KEY is not configured. Retrieved relevant code sources are available for inspection.",
            sources: sources.map(
                ({ relativePath, start, end, type, heading, score }) =>
                    ({ path: relativePath, start, end, type, heading, score })
            ),
            images,
            command: commandResult,
            activities
        }
    }

    const configuredUrl = (
        process.env.AI_URL ||
        "https://ai.hackclub.com/proxy/v1"
    ).replace(/\/$/, "")

    const endpoint = configuredUrl.endsWith("/chat/completions")
        ? configuredUrl
        : `${configuredUrl}/chat/completions`

    if (!withAi) {
        emit({
            type: "ai",
            activityId: "request",
            status: "skipped",
            message: "AI generation skipped"
        })

        return {
            question: cleanQuestion,
            answer: "AI response is disabled. Retrieved relevant code sources are available for inspection.",
            activities,
            sources: sources.map(
                ({ relativePath, start, end, type, heading, score }) =>
                    ({ path: relativePath, start, end, type, heading, score })
            ),
            images,
            command: commandResult,
            context: codebaseText || codebaseContext || "No matching codebase context."
        }
    }

    emit({
        type: "ai",
        activityId: "request",
        status: "started",
        message: `Sending request to AI model ${model} at ${endpoint}`
    })

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
                    content:
                        "You are Slackzilla's codebase assistant. Answer only from the supplied repository context and command result. Treat file paths, line ranges, source types, sections, and retrieved code as repository facts. Do not invent files, functions, routes, behaviour, dependencies, or architecture. Say when the context is insufficient. Be concise and include relevant file paths. Do not claim to have executed a command unless a command result is supplied."
                },
                {
                    role: "user",
                    content:
                        `Question:\n${cleanQuestion}\n\nRepository context:\n${sourceText || "No matching repository context."}\n\nCodebase context:\n${codebaseText || "No matching codebase context."}\n\nVisual assets:\n${imageText || "No matching visual assets."}${commandTextResult}`
                }
            ]
        })
    })

    const responseBody = await response.json().catch(() => ({}))

    emit({
        type: "ai",
        activityId: "request",
        status: "received",
        message: `Received response from AI model ${model}`,
    })

    if (!response.ok) {
        emit({
            type: "ai",
            activityId: "request",
            status: "failed",
            message:
                responseBody.error?.message ||
                responseBody.error ||
                `AI request failed with ${response.status}`
        })

        throw new Error(
            responseBody.error?.message ||
            responseBody.error ||
            `AI request failed with ${response.status}`
        )
    }

    const answer = responseBody.choices?.[0]?.message?.content

    if (!answer) {
        emit({
            type: "ai",
            activityId: "request",
            status: "failed",
            message: "AI returned an empty response"
        })

        throw new Error("AI returned an empty response")
    }

    emit({
        type: "ai",
        activityId: "request",
        status: "completed",
        message: `Processed response from AI model ${model}`
    })

    return {
        answer,
        sources: sources.map(
            ({ relativePath, start, end, type, heading, score }) =>
                ({ path: relativePath, start, end, type, heading, score })
        ),
        images,
        command: commandResult,
        activities
    }
}

module.exports = {
    emitActivity,
    answerQuestion,
    retrieve,
    retrieveImages,
    listCommands,
    buildIndex,
    loadIndex,
    findSymbols,
    getDependencies,
    getDependants,
    findEnvironmentVariable,
    findRoutes,
    getCodeContext
}