const fs = require("fs")
const path = require("path")
const {parseJavaScript, createChunks, getFileType} = require("./code-parser")

const projectRoot = path.join(__dirname, "..", "..", "..")
const ragDirectory = path.join(projectRoot, ".rag")
const indexPath = path.join(ragDirectory, "index.json")

const ignoredDirectories = new Set([".git", ".rag", "node_modules", "dist", "logs", "archive", ".vscode", "priv", "prompts", "test"])
const ignoredFiles = new Set(["package-lock.json", "feedback.json", "metrics.json"])
const allowedExtensions = new Set([".js", ".jsx", ".mjs", ".json", ".md", ".html", ".yml", ".service", ".conf", ".example" ])
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp" ])

const VERSION = 5

const MAX_SOURCE_LENGTH = 3500
const MAX_CONTEXT_TOKENS = 4000
const MAX_CODE_CONTEXTS = 20
const MAX_RELATIONSHIP_ROOTS = 8
const DOCS_PATH_SCORE_BOOST = 25


const keywordBoosts = [
    {
        keywords: ["how does", "how do", "how is", "how does the", "how does this"],
        condition: document => document.type === "markdown",
        score: 8
    },
    {
        keywords: ["where is", "where are", "which file", "what file", "implemented in", "defined in", "located in"],
        condition: document => ["javascript", "json"].includes(document.type),
        score: 12
    },
    {
        keywords: ["architecture", "system design", "component structure", "how components connect"],
        condition: (_, filePath) => ["architecture", "arch", "diagram"].some(keyword => filePath.includes(keyword)),
        score: 35
    },
    {
        keywords: ["flowchart", "execution flow", "request flow", "data flow", "control flow"],
        condition: (_, filePath) => ["flow", "diagram", "sequence", "architecture"].some(keyword => filePath.includes(keyword)),
        score: 30
    },
    {
        keywords: ["security", "csrf", "authentication", "authorisation", "authorization", "login security", "session security"],
        condition: (_, filePath) => ["security", "auth", "csrf", "session", "login"].some(keyword => filePath.includes(keyword)),
        score: 35
    },
    {
        keywords: ["webhook", "github webhook", "slack webhook"],
        condition: (_, filePath) => filePath.includes("webhook"),
        score: 35
    },
    {
        keywords: ["github actions", "github workflow", "deployment pipeline", "ci cd", "continuous integration", "continuous deployment"],
        condition: (_, filePath) => ["workflow", "action", "deploy", "ci-cd", "pipeline"].some(keyword => filePath.includes(keyword)),
        score: 35
    },
    {
        keywords: ["deployment", "deploy", "hosting", "production server"],
        condition: (_, filePath) => ["deploy", "deployment", "hosting", "production"].some(keyword => filePath.includes(keyword)),
        score: 25
    },
    {
        keywords: ["database", "sql", "schema", "database query", "data storage"],
        condition: (_, filePath) => ["database", "db", "sql", "schema", "storage"].some(keyword => filePath.includes(keyword)),
        score: 30
    },
    {
        keywords: ["api endpoint", "http route", "api route", "endpoint implementation", "request handler"],
        condition: (_, filePath) => ["route", "api", "endpoint", "handler"].some(keyword => filePath.includes(keyword)),
        score: 25
    },
    {
        keywords: ["rate limiting", "rate limiter", "request limits", "request throttling"],
        condition: (_, filePath) => ["rate-limit", "rate_limit", "limiter", "throttle"].some(keyword => filePath.includes(keyword)),
        score: 35
    },
    {
        keywords: ["error handling", "error logging", "server errors", "debugging"],
        condition: (_, filePath) => ["error", "log", "debug"].some(keyword => filePath.includes(keyword)),
        score: 25
    },
    {
        keywords: ["terminal", "command line", "cli command", "terminal command"],
        condition: (_, filePath) => ["terminal", "cli", "command"].some(keyword => filePath.includes(keyword)),
        score: 30
    },
    {
        keywords: ["rag", "retrieval augmented generation", "document retrieval", "semantic search", "chunking"],
        condition: (_, filePath) => ["rag", "retriev", "embedding", "chunk", "index", "search"].some(keyword => filePath.includes(keyword)),
        score: 35
    },
    {
        keywords: ["ai inference", "ai chat", "llm", "language model", "ai integration"],
        condition: (_, filePath) => ["ai", "llm", "inference", "model", "prompt"].some(keyword => filePath.includes(keyword)),
        score: 30
    },
    {
        keywords: ["configuration", "config file", "environment variables", "environment configuration"],
        condition: (_, filePath) => ["config", ".env", "environment"].some(keyword => filePath.includes(keyword)),
        score: 20
    },
    {
        keywords: ["tests", "unit tests", "integration tests", "test coverage"],
        condition: (_, filePath) => ["test", "spec", "coverage"].some(keyword => filePath.includes(keyword)),
        score: 30
    }
]

const IMAGE_CATALOG = [
    {
        path: "assets/attachments/d10/ai-chat-activity.png",
        tags: ["ai", "chat", "activity", "ai chat", "assistant", "conversation"],
        description: "AI chat activity",
        category: "ai"
    },
    {
        path: "assets/attachments/d11/admin-activity.png",
        tags: ["admin", "activity", "administration", "admin events"],
        description: "Administrative activity",
        category: "admin"
    },
    {
        path: "assets/attachments/d11/ai-activity-view.png",
        tags: ["ai", "activity", "ai activity", "inference", "ai requests"],
        description: "AI activity view",
        category: "ai"
    },
    {
        path: "assets/attachments/d2/htop-output.png",
        tags: ["htop", "processes", "cpu", "memory", "system resources", "performance"],
        description: "System process and resource usage",
        category: "system"
    },
    {
        path: "assets/attachments/d2/logs.png",
        tags: ["logs", "logging", "server logs", "debugging", "errors"],
        description: "Application logs",
        category: "logs"
    },
    {
        path: "assets/attachments/d3/g-act-arch.png",
        tags: ["github actions", "architecture", "workflow architecture", "automation", "ci cd", "deployment pipeline"],
        description: "GitHub Actions architecture",
        category: "architecture"
    },
    {
        path: "assets/attachments/d4/calc-behind-the-scenes.png",
        tags: ["calculator", "calculation", "math", "calculator implementation"],
        description: "Calculator implementation",
        category: "calculator"
    },
    {
        path: "assets/attachments/d5/manifest-workflow-flowchart.png",
        tags: ["manifest", "workflow", "flowchart", "github actions", "automation", "configuration"],
        description: "Manifest workflow flowchart",
        category: "workflow"
    },
    {
        path: "assets/attachments/d5/workflows.png",
        tags: ["workflows", "workflow", "github actions", "automation", "ci cd"],
        description: "Workflow configuration",
        category: "workflow"
    },
    {
        path: "assets/attachments/d6/terminal-output.png",
        tags: ["terminal", "console", "command line", "cli", "output", "commands"],
        description: "Terminal command output",
        category: "terminal"
    },
    {
        path: "assets/attachments/d7/logs.png",
        tags: ["logs", "logging", "server logs", "debugging", "errors"],
        description: "Application logs",
        category: "logs"
    },
    {
        path: "assets/attachments/d8/dashboard.png",
        tags: ["dashboard", "ui", "interface", "admin panel", "web interface"],
        description: "Dashboard interface",
        category: "dashboard"
    },
    {
        path: "assets/attachments/d9/dashboard-status.png",
        tags: ["dashboard", "status", "health", "server status", "bot status", "monitoring"],
        description: "Dashboard status monitoring",
        category: "dashboard"
    },
    {
        path: "assets/docs/nest-domain.config.png",
        tags: ["domain", "dns", "configuration", "nest", "domain config"],
        description: "Domain configuration",
        category: "configuration"
    }
]

const IMAGE_INTENTS = [
    {
        keywords: ["architecture", "system design", "component structure", "how components connect", "deep dive"],
        categories: ["architecture"],
        score: 25
    },
    {
        keywords: ["workflow", "workflows", "flowchart", "pipeline", "github actions", "ci cd"],
        categories: ["workflow", "architecture"],
        score: 25
    },
    {
        keywords: ["calculator", "calculation", "math"],
        categories: ["calculator"],
        score: 30
    },
    {
        keywords: ["dashboard", "interface", "ui", "admin panel", "page", "web interface"],
        categories: ["dashboard"],
        score: 25
    },
    {
        keywords: ["terminal", "console", "command line", "cli"],
        categories: ["terminal"],
        score: 25
    },
    {
        keywords: ["logs", "logging", "errors", "debugging"],
        categories: ["logs"],
        score: 25
    },
    {
        keywords: ["ai", "assistant", "inference", "ai chat", "capabilities"],
        categories: ["ai"],
        score: 25
    },
    {
        keywords: ["admin activity", "admin events", "administration"],
        categories: ["admin"],
        score: 25
    },
    {
        keywords: ["cpu", "memory usage", "processes", "htop", "system resources"],
        categories: ["system"],
        score: 25
    },
    {
        keywords: ["slack", "slack bot", "slack integration"],
        categories: ["slack"],
        score: 25
    },
    {
        keywords: ["domain", "dns", "domain configuration"],
        categories: ["configuration"],
        score: 25
    }
]


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
    const matches = String(question).match(/(?:[\w.-]+\/)*[\w.-]+\.(?:js|jsx|mjs|json|md|css|html|yml|service|conf|example)/gi) || []
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
    if (typeof importPath !== "string" || !importPath.startsWith(".")) {
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

    return [...new Set([...importDependencies, ...pathDependencies])]
}

function buildIndex() {
    const files = collectFiles(projectRoot)

    const index = {
        version: VERSION,
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
                try { code = parseJavaScript(content, { filePath: metadata.path, projectRoot })}
                catch { code = null}
            }

            index.files.push({...metadata, type, tokens: [...tokens(`${metadata.path} ${content}`)], chunks, code})
        } catch {
            continue
        }
    }

    for (const file of index.files) {
        if (!file.code) continue

        const imports = file.code.imports || []
        const calls = file.code.calls || []
        const routes = file.code.routes || []

        for (const imported of imports) {
            if (!imported.importedAs) continue

            const dependencyPath = resolveImport(file.path, imported.source)

            if (!dependencyPath) continue
            const dependency = index.files.find( item => item.path === dependencyPath )
            if (!dependency?.code) continue

            const importedName = imported.importedName || imported.importedAs
            const handler = dependency.code.functions.find(fn => fn.name === importedName)

            if (!handler?.methods?.length) continue
            const matchingCalls = calls.filter(call => call.name === imported.importedAs && call.line != null)

            for (const call of matchingCalls) {
                const route = routes.find(item => item.line === call.line)

                if (!route) continue
                route.methods = [...new Set( [...(route.methods || []), ...handler.methods])]
            }
        }
    }

    fs.mkdirSync(ragDirectory, { recursive: true })
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))

    return index
}



function isIndexCurrent(index) {
    if (!index?.files || !Array.isArray(index.files)) return false
    if (index.version !== VERSION) return false

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
            if ( indexed.size !== metadata.size || indexed.modified !== metadata.modified) return false
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

            if (score > 0) results.push({file: file.path,...symbol,score})
        }
    }

    return results.sort( (left, right) => right.score - left.score )
}

function getDependants(filePath, index = loadIndex()) {
    const dependants = []

    for (const file of index.files) {
        if (!file.code) continue
        const dependencies = (file.code.imports || []).map(item => resolveImport(file.path, item.source)).filter(Boolean)
        if (dependencies.includes(filePath)) dependants.push(file.path)
    }

    return dependants
}

function findEnvironmentVariable(name, index = loadIndex()) {
    const results = []

    for (const file of index.files) {
        if (!file.code) continue

        for (const variable of file.code.environmentVariables || []) {
            if (variable.name.toLowerCase() === name.toLowerCase()) results.push({file: file.path, line: variable.line, name: variable.name})
        }
    }
    return results
}

const extractEnvironmentVariables = question => String(question).match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || []

function findRoutes(question, index = loadIndex()) {
    const queryTokens = tokens(question)
    const results = []

    for (const file of index.files) {
        if (!file.code) continue

        for (const route of file.code.routes || []) {
            const routeTokens = tokens(`${route.method} ${route.path}`)

            const exactMatch = String(question).toLowerCase().includes(route.path.toLowerCase()) ? 100 : 0
            const score = exactMatch + [...queryTokens].reduce((total, token) => total + (routeTokens.has(token) ? 20 : 0), 0)

            if (score > 0) results.push({file: file.path, ...route, score })
        }
    }


    return results.sort((left, right) => right.score - left.score )
}

function getCodeContext(file, symbol = null) {
    if (!file.code) return ""

    const sections = []

    if (file.code.imports?.length) sections.push(`IMPORTS:\n${file.code.imports.map(item => `- ${item.source}`).join("\n")}`)
    if (file.code.functions?.length) sections.push(`FUNCTIONS:\n${file.code.functions.map(item =>`- ${item.name} (${item.line}-${item.endLine})`).join("\n")}`)
    if (file.code.routes?.length) sections.push(`ROUTES:\n${file.code.routes.map(item => `- ${item.method} ${item.path} (${item.line})`).join("\n")}`)

    if (symbol && file.chunks?.length) {
        const startLine = symbol.line
        const endLine = symbol.endLine || symbol.line

        const relevantChunks = file.chunks.filter(chunk =>  chunk.start <= endLine && chunk.end >= startLine )

        if (relevantChunks.length) sections.push(`SOURCE (${startLine}-${endLine}):\n${relevantChunks.map(chunk => chunk.text).join("\n")}` )
    }

    return sections.join("\n\n")
}


function calculateScore({ question, queryTokens, document, chunk, requestedFiles }) {
    const filePath = document.path.toLowerCase()
    const chunkText = chunk.text.toLowerCase()
    const fileTokens = tokens(document.path)
    const headingTokens = tokens(chunk.heading || "")

    let score = 0

    const exactFileMatch = requestedFiles.some(requested => requested === filePath)

    if (exactFileMatch) score += 1000
    if (filePath.startsWith("docs/")) score += DOCS_PATH_SCORE_BOOST

    for (const token of queryTokens) {
        if (fileTokens.has(token)) score += 20
        if (headingTokens.has(token)) score += 15
        if (chunkText.includes(token)) score += 5
    }

    const questionLower = question.toLowerCase()

    for (const rule of keywordBoosts) {
        if (rule.keywords.some(keyword => questionLower.includes(keyword))) {
            if (rule.condition(document, filePath)) score += rule.score
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
            const score = calculateScore({question: cleanQuestion, queryTokens, document, chunk, requestedFiles})

            if (score <= 0) continue

            documents.push({relativePath: document.path, start: chunk.start, end: chunk.end, type: chunk.type, heading: chunk.heading, text: chunk.text, score})
        }
    }

    const rankedDocuments = documents.sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return left.relativePath.localeCompare(right.relativePath)
    })

    const minimumScore = rankedDocuments.length? Math.max(15, Math.ceil(rankedDocuments[0].score * 0.85)) : 0
    const selectedPaths = new Set()

    return rankedDocuments
        .filter(document => {
            if (document.score < minimumScore || selectedPaths.has(document.relativePath)) return false
            selectedPaths.add(document.relativePath)
            return true
        })
        .slice(0, limit).map(document => ({...document, text: document.text.slice(0, MAX_SOURCE_LENGTH)}))
}

function retrieveImages(question, limit = 6) {
    const query = String(question || "").toLowerCase().trim()

    if (!query) return []

    const queryTokens = tokens(query)
    const intents = IMAGE_INTENTS.filter(intent =>
        intent.keywords.some(keyword => query.includes(keyword))
    )

    return IMAGE_CATALOG
        .map(image => {
            const imageTokens = tokens(`${image.path} ${image.description} ${image.tags.join(" ")}`)
            let score = 0

            for (const token of queryTokens) {if (imageTokens.has(token)) score += 3}
            for (const tag of image.tags) { if (query.includes(tag)) score += tag.includes(" ") ? 12 : 6 }

            for (const intent of intents) {
                if (intent.categories.includes(image.category)) score += intent.score
                else score -= 15
            }

            return { relativePath: image.path, score }
        }).filter(image => image.score >= 12)
        .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
        .slice(0, limit)
        .map(image => ({ path: image.relativePath, url: `/${image.relativePath}`, score: image.score}))
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
        .map(file => ({ file,score: [...queryTokens].reduce((score, token) => {
            if (tokens(file.path).has(token)) return score + 30
            if (file.tokens?.includes(token)) return score + 2
            return score
        }, 0) + (questionText.includes(file.path.toLowerCase()) ? 150 : 0)
        }))
        .filter(candidate => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 12)

    for (const candidate of contextCandidates) addFileScore(candidate.file.path, candidate.score, "direct")

    context.symbols = findSymbols(question, index)
    context.routes = findRoutes(question, index)

    for (const symbol of context.symbols) addFileScore(symbol.file, 500 + symbol.score, "direct")
    for (const route of context.routes) addFileScore(route.file, 500 + route.score, "direct")

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

    for (const variable of environmentVariables) { context.environmentVariables.push( ...findEnvironmentVariable(variable, index))}
    const contextEnvironmentVariables = new Set(context.environmentVariables.map(variable => `${variable.name}:${variable.file}:${variable.line}`))

    for (const filePath of context.files) {
        const file = index.files.find(item => item.path === filePath)

        for (const variable of file?.code?.environmentVariables || []) {
            const key = `${variable.name}:${filePath}:${variable.line}`
            if (contextEnvironmentVariables.has(key)) continue

            contextEnvironmentVariables.add(key)
            context.environmentVariables.push({name: variable.name, file: filePath, line: variable.line})
        }
    }

    const orderedFiles = [...context.files].sort((left, right) => (context.fileScores.get(right) || 0) - (context.fileScores.get(left) || 0))

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
            if (codeContext) context.codeEntries.push({file: filePath, text: codeContext, score: context.fileScores.get(filePath) || 0, category: context.relatedFiles.has(filePath) ? "related" : "direct"})
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

    if (context.symbols.length)     sections.push(`RELEVANT SYMBOLS:\n${context.symbols.slice(0, 20).map(symbol => `- ${symbol.name} in ${symbol.file}:${symbol.line}-${symbol.endLine}`).join("\n")}`)
    if (context.routes.length)      sections.push(`RELEVANT ROUTES:\n${context.routes.slice(0, 20).map(route =>`- ${route.method} ${route.path} in ${route.file}:${route.line}`).join("\n")}`)
    if (context.dependencies.size)  sections.push( `DEPENDENCIES:\n${[...context.dependencies].map(file => `- ${file}`).join("\n")}` )
    if (context.dependants.size)    sections.push(`DEPENDANTS:\n${[...context.dependants].map(file => `- ${file}`).join("\n")}`)
    if (context.code.length)        sections.push(`CODE STRUCTURE:\n${context.code.join("\n\n")}`)
    return sections.join("\n\n")
}

function getChunkPriority(chunk) {
    const kindBonus = {code: 250, structure: 100, source: 0}

    const tokens = estimateTokenCount(chunk.text)
    const sizePenalty = Math.min(tokens / 20, 100)

    return chunk.score + (kindBonus[chunk.kind] || 0) - sizePenalty
}

function packContextChunks(chunks, budget = MAX_CONTEXT_TOKENS) {
    const selected = []
    const selectedKeys = new Set()
    let usedTokens = 0

    const ranked = [...chunks].sort((left, right) => getChunkPriority(right) - getChunkPriority(left))

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

const estimateTokenCount = value => Math.max(1, Math.ceil(String(value || "").length / 4))
module.exports = {
    emitActivity,
    MAX_CONTEXT_TOKENS,
    buildCodebaseContext,
    packRepositoryContext,
    retrieve,
    retrieveImages,
    buildIndex,
    loadIndex,
    findSymbols,
    getDependencies,
    getDependants,
    findEnvironmentVariable,
    findRoutes,
    getCodeContext,
    calculateScore,
    estimateTokenCount
}
