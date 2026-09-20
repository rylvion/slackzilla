const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const {
    parseJavaScript,
    createChunks,
    getFileType
} = require("./code-parser")
const { listCommands, getCommand, runCommand } = require("../command-runner")

const projectRoot = path.join(__dirname, "..", "..")
const ragDirectory = path.join(projectRoot, ".rag")
const indexPath = path.join(ragDirectory, "index.json")

const ignoredDirectories = new Set([".git", ".rag", "node_modules", "dist", "logs", ".vscode", "priv"])
const ignoredFiles = new Set(["package-lock.json", "feedback.json"])
const allowedExtensions = new Set([".js", ".jsx", ".mjs", ".json", ".md", ".css", ".html", ".yml", ".service", ".conf", ".example" ])

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp" ])

const model = process.env.AI_MODEL || "openrouter/free"

const MAX_SOURCE_LENGTH = 3500
const MAX_CONTEXT_TOKENS = 4000
const MAX_CODE_CONTEXTS = 20
const MAX_RELATIONSHIP_ROOTS = 8

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "SYSTEM_PROMPT.txt"), "utf8")
SYSTEM_PROMPT.trim()

function emitActivity(onActivity, event) {
    if (typeof onActivity === "function") {
        onActivity({ timestamp: Date.now(), ...event })
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
            .replace(/([a-z])([A-Z])/g, "$1 $2")
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
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
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

    const pathDependencies = file.code.pathReferences || []

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
        version: 5,
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
                try {
                    code = parseJavaScript(content, {
                        filePath: metadata.path,
                        projectRoot
                    })
                }
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
    if (index.version !== 5) return false

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
            const symbolName = symbol.name.toLowerCase()
            const questionText = String(question).toLowerCase()
            const exactMatch = questionText.includes(symbolName) ? 100 : 0
            const score = exactMatch + [...queryTokens].reduce((total, token) => total + (symbolTokens.has(token) ? 20 : 0), 0)

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

            const exactMatch = String(question).toLowerCase().includes(route.path.toLowerCase()) ? 100 : 0
            const score = exactMatch + [...queryTokens].reduce(
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

    const rankedDocuments = documents
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score
            }

            return left.relativePath.localeCompare(right.relativePath)
        })

    const minimumScore = rankedDocuments.length
        ? Math.max(1, Math.ceil(rankedDocuments[0].score * 0.85))
        : 0
    const selectedPaths = new Set()

    return rankedDocuments
        .filter(document => {
            if (document.score < minimumScore || selectedPaths.has(document.relativePath)) return false
            selectedPaths.add(document.relativePath)
            return true
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


function buildCodebaseContext(question, index, retrievedSources = []) {
    const environmentVariables = extractEnvironmentVariables(question)

    const context = {
        symbols: [],
        routes: [],
        files: new Set(),
        dependencies: new Set(),
        dependants: new Set(),
        environmentVariables: [],
        code: [],
        codeEntries: [],
        directFiles: new Set(),
        relatedFiles: new Set(),
        fileScores: new Map()
    }

    const addFileScore = (filePath, score, group = "direct") => {
        if (!filePath) return
        context.fileScores.set(filePath, Math.max(context.fileScores.get(filePath) || 0, score))
        context.files.add(filePath)
        if (group === "related") context.relatedFiles.add(filePath)
        else context.directFiles.add(filePath)
    }

    for (const source of retrievedSources) {
        addFileScore(source.relativePath, 1000 + source.score, "direct")
    }

    const queryTokens = tokens(question)
    const questionText = String(question).toLowerCase()
    const contextCandidates = index.files
        .filter(file => file.type === "javascript")
        .map(file => ({
            file,
            score: [...queryTokens].reduce((score, token) => {
                if (tokens(file.path).has(token)) return score + 30
                if (file.tokens?.includes(token)) return score + 2
                return score
            }, 0) + (questionText.includes(file.path.toLowerCase()) ? 150 : 0)
        }))
        .filter(candidate => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 12)

    for (const candidate of contextCandidates) {
        addFileScore(candidate.file.path, candidate.score, "direct")
    }

    context.symbols = findSymbols(question, index)
    context.routes = findRoutes(question, index)

    for (const symbol of context.symbols) {
        addFileScore(symbol.file, 500 + symbol.score, "direct")
    }

    for (const route of context.routes) {
        addFileScore(route.file, 500 + route.score, "direct")
    }

    const relationshipRoots = [...context.directFiles]
        .sort((left, right) => (context.fileScores.get(right) || 0) - (context.fileScores.get(left) || 0))
        .slice(0, MAX_RELATIONSHIP_ROOTS)

    for (const filePath of relationshipRoots) {
        const dependencies = getDependencies(filePath, index)
        const dependants = getDependants(filePath, index)

        for (const dependency of dependencies) {
            context.dependencies.add(dependency)
            addFileScore(dependency, Math.max(100, (context.fileScores.get(filePath) || 0) - 120), "related")
        }
        for (const dependant of dependants) {
            context.dependants.add(dependant)
            addFileScore(dependant, Math.max(90, (context.fileScores.get(filePath) || 0) - 150), "related")
        }
    }

    for (const variable of environmentVariables) { context.environmentVariables.push( ...findEnvironmentVariable(variable, index) ) }

    const contextEnvironmentVariables = new Set(
        context.environmentVariables.map(variable => `${variable.name}:${variable.file}:${variable.line}`)
    )

    for (const filePath of context.files) {
        const file = index.files.find(item => item.path === filePath)

        for (const variable of file?.code?.environmentVariables || []) {
            const key = `${variable.name}:${filePath}:${variable.line}`
            if (contextEnvironmentVariables.has(key)) continue

            contextEnvironmentVariables.add(key)
            context.environmentVariables.push({
                name: variable.name,
                file: filePath,
                line: variable.line
            })
        }
    }

    const orderedFiles = [...context.files]
        .sort((left, right) => (context.fileScores.get(right) || 0) - (context.fileScores.get(left) || 0))

    for (const filePath of orderedFiles) {
        const file = index.files.find(item => item.path === filePath)
        if (!file) continue
        const symbols = context.symbols.filter(symbol => symbol.file === filePath)

        if (symbols.length) {
            for (const symbol of symbols) {
                const codeContext = getCodeContext(file, symbol)
                if (codeContext) {
                    context.codeEntries.push({
                        file: filePath,
                        text: codeContext,
                        score: (context.fileScores.get(filePath) || 0) + symbol.score + 150,
                        category: context.relatedFiles.has(filePath) ? "related" : "direct"
                    })
                }
            }
        } else {
            const codeContext = getCodeContext(file)
            if (codeContext) {
                context.codeEntries.push({
                    file: filePath,
                    text: codeContext,
                    score: context.fileScores.get(filePath) || 0,
                    category: context.relatedFiles.has(filePath) ? "related" : "direct"
                })
            }
        }
    }

    context.codeEntries.sort((left, right) => right.score - left.score)
    context.codeContextCount = context.codeEntries.length
    context.codeEntries = context.codeEntries.slice(0, MAX_CODE_CONTEXTS)
    context.code = context.codeEntries.map(entry => entry.text)

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
            `RELEVANT ROUTES:\n${context.routes.slice(0, 20)
                .map(route =>`- ${route.method} ${route.path} in ${route.file}:${route.line}`)
                .join("\n")}`
        )
    }

    if (context.dependencies.size) {
        sections.push( `DEPENDENCIES:\n${[...context.dependencies].map(file => `- ${file}`).join("\n")}` )
    }

    if (context.dependants.size) {
        sections.push(`DEPENDANTS:\n${[...context.dependants].map(file => `- ${file}`).join("\n")}`)
    }

    if (context.code.length) {
        sections.push(`CODE STRUCTURE:\n${context.code.join("\n\n")}`)
    }

    return sections.join("\n\n")
}

function getChunkPriority(chunk) {
    const kindBonus = {
        code: 250,
        structure: 100,
        source: 0
    }

    const tokens = estimateTokenCount(chunk.text)
    const sizePenalty = Math.min(tokens / 20, 100)

    return chunk.score + (kindBonus[chunk.kind] || 0) - sizePenalty
}

function packContextChunks(chunks, budget = MAX_CONTEXT_TOKENS) {
    const selected = []
    const selectedKeys = new Set()
    let usedTokens = 0

    const ranked = [...chunks].sort(
    (left, right) =>
        getChunkPriority(right) - getChunkPriority(left)
)

    for (const chunk of ranked) {
        if (selectedKeys.has(chunk.key)) continue

        const chunkTokens = estimateTokenCount(chunk.text)
        if (usedTokens + chunkTokens > budget) continue

        selected.push(chunk)
        selectedKeys.add(chunk.key)
        usedTokens += chunkTokens
    }

    return { selected, usedTokens }
}

function packRepositoryContext(sources, context, budget = MAX_CONTEXT_TOKENS) {
    const chunks = []

    for (const source of sources) {
        chunks.push({
            key: `source:${source.relativePath}:${source.start}-${source.end}`,
            file: source.relativePath,
            kind: "source",
            score: 1000 + source.score,
            text: `SOURCE FILE: ${source.relativePath}\nLINES: ${source.start}-${source.end}\nTYPE: ${source.type}\n${source.text}`
        })
    }

    const structuralContext = formatCodebaseContext({ ...context, code: [] })
    if (structuralContext) {
        chunks.push({
            key: "codebase:structure",
            kind: "structure",
            score: 180,
            text: structuralContext
        })
    }

    for (const entry of (context.codeEntries || []).slice(0, MAX_CODE_CONTEXTS)) {
        chunks.push({
            key: `code:${entry.file}:${entry.text.slice(0, 80)}`,
            file: entry.file,
            kind: "code",
            score: entry.score,
            text: `CODE FILE: ${entry.file}\n${entry.text}`
        })
    }

    const packed = packContextChunks(chunks, budget)
    const selectedFiles = [...new Set(packed.selected.map(chunk => chunk.file).filter(Boolean))]
    const selectedCodeContexts = packed.selected.filter(chunk => chunk.kind === "code").length

    return {
        text: packed.selected.map(chunk => chunk.text).join("\n\n"),
        contextTokens: packed.usedTokens,
        contextBudget: budget,
        selectedFiles,
        selectedCodeContexts
    }
}

async function answerQuestion({
    question,
    commandId,
    commandText,
    identity,
    tools,
    onActivity,
    onToken
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
        if (!getCommand(commandId)) { throw new Error(`unknown command: ${commandId}`) }
        emit({type: "command", activityId: commandId, status: "started", message: `Executing command ${commandId} with arguments: ${commandText || "(none)"}` })
        commandResult = await runCommand(commandId, commandText, identity)
        emit({ type: "command", activityId: commandId, status: "completed", message: `Command ${commandId} executed successfully` })
    }

    ///////////////////////////////////////////////////////////////////////////////////////

    emit({ type: "retrieval", activityId: "sources", status: "started", message: "Searching repository..." })

    const sources = retrieve(cleanQuestion)

    emit({
        type: "retrieval",
        activityId: "sources",
        status: "completed",
        message: `Retrieved ${sources.length} source${sources.length === 1 ? "" : "s"}`,
        metadata: {
            sources: sources.map(source => ({
                path: source.relativePath,
                lines: `${source.start}-${source.end}`,
                type: source.type,
                score: source.score
            }))
        }
    })

    //////////////////////////////////////////////////////////////////////////////////////

    emit({ type: "retrieval", activityId: "images", status: "started", message: "Searching for visual assets..." })

    const images = retrieveImages(cleanQuestion)

    emit({
        type: "retrieval",
        activityId: "images",
        status: "completed",
        message: `Retrieved ${images.length} image${images.length === 1 ? "" : "s"}`,
        metadata: {
            images: images.map(image => ({
                path: image.path,
                score: image.score
            }))
        }
    })

    ///////////////////////////////////////////////////////////////////////////////////////

    emit({
        type: "context",
        activityId: "codebase",
        status: "started",
        message: "Building codebase context..."
    })

    const index = loadIndex()
    const isCommandRequest = /\b(run|execute|use|call|invoke)\b[\s\S]{0,100}\b(command|\/sz-[a-z0-9-]+)\b/i.test(cleanQuestion)
    const codebaseContext = isCommandRequest
        ? {
            symbols: [],
            routes: [],
            files: new Set(),
            dependencies: new Set(),
            dependants: new Set(),
            environmentVariables: [],
            code: []
        }
        : buildCodebaseContext(cleanQuestion, index, sources)
    const contextPack = packRepositoryContext(sources, codebaseContext)

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
            codeContexts: codebaseContext.codeContextCount ?? codebaseContext.codeEntries?.length ?? codebaseContext.code?.length ?? 0,
            contextTokens: contextPack.contextTokens,
            contextBudget: contextPack.contextBudget,
            selectedFiles: contextPack.selectedFiles,
            selectedCodeContexts: contextPack.selectedCodeContexts
        }
    })

    const imageText = images.map(image => `IMAGE ASSET: ${image.path} (available at ${image.url})`).join("\n")
    const commandTextResult = commandResult ? `\nCOMMAND RESULT (${commandResult.command}):\n${formatResponses(commandResult.responses)}` : ""

    if (!process.env.AI_API_KEY && withAi) {
        emit({ type: "ai", activityId: "request", status: "failed", message: "AI_API_KEY is not configured" })

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

    const configuredUrl = (process.env.AI_URL ||"https://ai.hackclub.com/proxy/v1").replace(/\/$/, "")

    const endpoint = configuredUrl.endsWith("/chat/completions")? configuredUrl : `${configuredUrl}/chat/completions`

    if (!withAi) {
        emit({ type: "ai", activityId: "request", status: "skipped", message: "AI generation skipped" })

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
            context: contextPack.text || "No matching repository context."
        }
    }

    emit({ type: "ai", activityId: "request", status: "started", message: `Sending request to AI model ${model} at ${endpoint}` })

    const messages = [
        {
            role: "system",
            content: SYSTEM_PROMPT
        },
        {
            role: "user",
            content: `Question:\n${cleanQuestion}\n\nRepository knowledge:\n${contextPack.text || "No matching repository context."}\n\nVisual assets:\n${imageText || "No matching visual assets."}${commandTextResult}`
        }
    ]

    const requestAi = includeTools => fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.AI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            stream: true,
            stream_options: { include_usage: true },
            messages,
            ...(includeTools && tools?.definitions?.length
                ? { tools: tools.definitions, tool_choice: "auto" }
                : {})
        })
    })

    let response = await requestAi(true)

    emit({ type: "ai", activityId: "request", status: "received", message: `Received response from AI model ${model}` })

    if (!response.ok) {
        const responseBody = await response.json().catch(() => ({}))

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
            responseBody.error?.message || responseBody.error || `AI request failed with ${response.status}`
        )
    }

    const tokenUsage = { input: 0, output: 0, total: 0 }
    const addUsage = usage => {
        tokenUsage.input += Number(usage?.input || 0)
        tokenUsage.output += Number(usage?.output || 0)
        tokenUsage.total += Number(usage?.total || 0)
    }

    let result = await readAiResponse(response, onToken)
    addUsage(result.usage)

    let toolRound = 0

    while (result.toolCalls.length && tools?.execute && toolRound < 1) {
        toolRound += 1
        messages.push({
            role: "assistant",
            content: result.answer || null,
            tool_calls: result.toolCalls
        })

        for (const toolCall of result.toolCalls) {
            let args = {}

            try { args = JSON.parse(toolCall.function?.arguments || "{}") }
            catch { args = {} }

            const toolResult = await tools.execute(toolCall.function?.name, args, emit)
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function?.name,
                content: `LIVE API DATA (current runtime evidence):\n${JSON.stringify(toolResult)}`
            })
        }

        emit({ type: "ai", activityId: "request", status: "started", message: "Generating answer from repository and live API evidence" })

        response = await requestAi(true)

        if (!response.ok) { throw new Error(`AI request failed with ${response.status}`) }

        result = await readAiResponse(response, onToken)
        addUsage(result.usage)
    }

    const answer = result.answer

    if (!answer) {
        emit({ type: "ai", activityId: "request", status: "failed", message: "AI returned an empty response" })
        throw new Error("AI returned an empty response")
    }

    if (!tokenUsage.input) tokenUsage.input = estimateTokenCount(JSON.stringify(messages))
    if (!tokenUsage.output) tokenUsage.output = estimateTokenCount(answer)
    if (!tokenUsage.total) tokenUsage.total = tokenUsage.input + tokenUsage.output

    emit({
        type: "ai",
        activityId: "request",
        status: "completed",
        message: `Processed response from AI model ${model}`,
        metadata: {
            inputTokens: tokenUsage.input,
            outputTokens: tokenUsage.output,
            totalTokens: tokenUsage.total
        }
    })

    return {
        answer,
        sources: sources.map(
            ({ relativePath, start, end, type, heading, score }) =>
                ({ path: relativePath, start, end, type, heading, score })
        ),
        images,
        command: commandResult,
        activities,
        usage: tokenUsage
    }
}

async function readAiResponse(response, onToken) {
    let answer = ""
    const toolCalls = {}
    let usage = { input: 0, output: 0, total: 0 }
    const isStreamingResponse = response.headers.get("content-type")?.includes("text/event-stream")

    if (isStreamingResponse && response.body?.getReader) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let finished = false

        const processEvent = rawEvent => {
            const data = rawEvent
                .split(/\r?\n/)
                .filter(line => line.startsWith("data:"))
                .map(line => line.slice(5).trim())
                .join("\n")

            if (!data || data === "[DONE]") {
                if (data === "[DONE]") finished = true
                return
            }

            let payload
            try { payload = JSON.parse(data) }
            catch { return }

            usage = normaliseUsage(payload.usage, usage)

            const choice = payload.choices?.[0]
            const token = choice?.delta?.content

            if (token) {
                answer += token
                if (typeof onToken === "function") onToken(token)
            }

            for (const toolCall of choice?.delta?.tool_calls || []) {
                const current = toolCalls[toolCall.index] || {
                    id: toolCall.id,
                    type: "function",
                    function: { name: "", arguments: "" }
                }

                current.id ||= toolCall.id
                current.function.name += toolCall.function?.name || ""
                current.function.arguments += toolCall.function?.arguments || ""
                toolCalls[toolCall.index] = current
            }
        }

        while (!finished) {
            const { done, value } = await reader.read()
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

            const events = buffer.split(/\r?\n\r?\n/)
            buffer = events.pop() || ""
            events.forEach(processEvent)

            if (done) break
        }

        if (buffer.trim()) processEvent(buffer)
    } else {
        const responseBody = await response.json().catch(() => ({}))
        usage = normaliseUsage(responseBody.usage, usage)
        const message = responseBody.choices?.[0]?.message || {}
        answer = message.content || ""

        for (const toolCall of message.tool_calls || []) {
            toolCalls[toolCall.id] = toolCall
        }

        if (answer && typeof onToken === "function") onToken(answer)
    }

    const markupToolCalls = [...answer.matchAll(/<tool_call>\s*([A-Za-z][A-Za-z0-9_]*)\s*<\/tool_call>/gi)]

    for (const [index, match] of markupToolCalls.entries()) {
        const name = match[1]
        const id = `markup-tool-${index}`

        if (!Object.values(toolCalls).some(toolCall => toolCall.function?.name === name)) {
            toolCalls[id] = {
                id,
                type: "function",
                function: { name, arguments: "{}" }
            }
        }
    }

    answer = answer.replace(/<tool_call>\s*[A-Za-z][A-Za-z0-9_]*\s*<\/tool_call>/gi, "").trim()

    return {
        answer,
        toolCalls: Object.values(toolCalls),
        usage
    }
}

function normaliseUsage(rawUsage, previous = { input: 0, output: 0, total: 0 }) {
    if (!rawUsage) return previous

    const input = Number(rawUsage.prompt_tokens ?? rawUsage.input_tokens ?? rawUsage.promptTokens ?? 0)
    const output = Number(rawUsage.completion_tokens ?? rawUsage.output_tokens ?? rawUsage.completionTokens ?? 0)
    const total = Number(rawUsage.total_tokens ?? rawUsage.totalTokens ?? (input + output))

    return {
        input: input || previous.input,
        output: output || previous.output,
        total: total || previous.total
    }
}

function estimateTokenCount(value) {
    return Math.max(1, Math.ceil(String(value || "").length / 4))
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
