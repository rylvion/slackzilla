const acorn = require("acorn")
const walk = require("acorn-walk")
const fs = require("fs")
const path = require("path")

function parseJavaScript(content, options = {}) {
    let ast

    try {
        ast = acorn.parse(content, {
            ecmaVersion: "latest",
            sourceType: "module",
            locations: true
        })
    } catch (moduleError) {
        ast = acorn.parse(content, {
            ecmaVersion: "latest",
            sourceType: "script",
            locations: true
        })
    }

    const result = {
        imports: [],
        exports: [],
        functions: [],
        calls: [],
        environmentVariables: [],
        routes: []
    }

    const functionStack = []

    walk.ancestor(ast, {
        ImportDeclaration(node) {
            result.imports.push({
                source: node.source.value,
                line: node.loc.start.line
            })
        },

        CallExpression(node, ancestors) {
            const functionName = getCallName(node)

            if (!functionName) return

            const currentFunction =
                [...ancestors]
                    .reverse()
                    .find(item =>
                        item.type === "FunctionDeclaration" ||
                        item.type === "FunctionExpression" ||
                        item.type === "ArrowFunctionExpression"
                    )

            result.calls.push({
                name: functionName,
                line: node.loc.start.line,
                from: currentFunction
                    ? getFunctionName(currentFunction)
                    : null
            })

            const environmentVariable = getEnvironmentVariable(node)

            if (environmentVariable) {
                result.environmentVariables.push({
                    name: environmentVariable,
                    line: node.loc.start.line
                })
            }

            const route = getRoute(node)

            if (route) {
                result.routes.push(route)
            }
        },

        MemberExpression(node) {
            const environmentVariable = getEnvironmentVariable({ callee: node })

            if (environmentVariable) {
                result.environmentVariables.push({
                    name: environmentVariable,
                    line: node.loc.start.line
                })
            }
        },

        VariableDeclaration(node) {
            for (const declaration of node.declarations) {
                if (
                    declaration.init?.type === "CallExpression" &&
                    declaration.init.callee.type === "Identifier" &&
                    declaration.init.callee.name === "require"
                ) {
                    const source = declaration.init.arguments[0]

                    if (source?.type === "Literal") {
                        result.imports.push({
                            source: source.value,
                            importedAs: declaration.id.name,
                            line: node.loc.start.line
                        })
                    }
                }
            }
        },

        FunctionDeclaration(node) {
            result.functions.push({
                name: node.id?.name || "anonymous",
                type: "function",
                line: node.loc.start.line,
                endLine: node.loc.end.line,
                async: node.async
            })
        },

        ClassDeclaration(node) {
            result.functions.push({
                name: node.id?.name || "anonymous",
                type: "class",
                line: node.loc.start.line,
                endLine: node.loc.end.line
            })
        },

        AssignmentExpression(node) {
            const exportedName = getExportName(node)

            if (exportedName) {
                result.exports.push({
                    name: exportedName,
                    line: node.loc.start.line
                })
            }
        },

        IfStatement(node) {
            result.routes.push(...getPathRoutes(node.test, node.consequent))
        }
    })

    if (options.filePath && options.projectRoot) {
        result.pathReferences = extractPathReferences(
            options.filePath,
            content,
            options.projectRoot
        )
    }
    
    inferRouteMethods(ast, result)
    return deduplicate(result)
}

function getCallName(node) {
    if (node.callee.type === "Identifier") {
        return node.callee.name
    }

    if (node.callee.type === "MemberExpression") {
        const object =
            node.callee.object?.name ||
            node.callee.object?.property?.name

        const property =
            node.callee.property?.name ||
            node.callee.property?.value

        if (object && property) {
            return `${object}.${property}`
        }

        if (property) {
            return property
        }
    }

    return null
}

function getFunctionName(node) {
    if (node.id?.name) { return node.id.name }
    return null
}

function getEnvironmentVariable(node) {
    const { callee } = node

    if (
        callee?.type === "MemberExpression" &&
        callee.object?.type === "MemberExpression" &&
        callee.object.object?.type === "Identifier" &&
        callee.object.object.name === "process" &&
        callee.object.property?.name === "env"
    ) {
        return callee.property?.name || null
    }

    return null
}

function getRoute(node) {
    if (
        node.callee?.type !== "MemberExpression" ||
        node.callee.object?.name !== "app"
    ) {
        return null
    }

    const method = node.callee.property?.name
    const firstArgument = node.arguments?.[0]

    if (
        !method ||
        firstArgument?.type !== "Literal" ||
        typeof firstArgument.value !== "string"
    ) {
        return null
    }

    if (!["get", "post", "put", "patch", "delete", "use"].includes(method)) {
        return null
    }

    return {
        method: method.toUpperCase(),
        path: firstArgument.value,
        line: node.loc.start.line
    }
}

function getExportName(node) {
    const left = node.left

    if (!left || left.type !== "MemberExpression") {
        return null
    }

    if (
        left.object?.name === "module" &&
        left.property?.name === "exports"
    ) {
        return "default"
    }

    if ( left.object?.name === "exports") {
        return left.property?.name || null
    }

    if (
        left.object?.type === "MemberExpression" &&
        left.object.object?.name === "module" &&
        left.object.property?.name === "exports"
    ) {
        return left.property?.name || null
    }

    return null
}

function deduplicate(result) {
    for (const key of Object.keys(result)) {
        const values = result[key]

        if (key !== "routes") {
            result[key] = values.filter((value, index, array) => index === array.findIndex(other => JSON.stringify(other) === JSON.stringify(value)) )
            continue
        }

        const routes = new Map()

        for (const route of values) {
            const key = `${route.path}:${route.matchType}`
            const existing = routes.get(key)

            if (!existing) {
                routes.set(key, {
                    ...route,
                    methods: [...new Set(route.methods || [])]
                })

                continue
            }

            existing.methods = [
                ...new Set([
                    ...existing.methods,
                    ...(route.methods || [])
                ])
            ]

            existing.line = Math.min(existing.line, route.line)
        }

        result.routes = [...routes.values()]
    }

    return result
}

function inferRouteMethods(ast, result) {
    function getStatements(node) {
        if (node?.type === "BlockStatement") return node.body
        if (node) return [node]
        return []
    }

    function getAcceptedMethods(node) {
        const methods = []

        function visit(statement) {
            if (!statement) return

            if (statement.type === "IfStatement") {
                const test = statement.test

                if (
                    test.type === "BinaryExpression" &&
                    ["===", "==", "!==", "!="].includes(test.operator) &&
                    test.left.type === "MemberExpression" &&
                    test.left.property?.name === "method" &&
                    test.right.type === "Literal" &&
                    typeof test.right.value === "string"
                ) {
                    const method = test.right.value.toUpperCase()
                    const statements = getStatements(statement.consequent)

                    const returnsTrue = statements.some(item =>
                        item.type === "ReturnStatement" &&
                        item.argument?.type === "Literal" &&
                        item.argument.value === true
                    )

                    if (
                        ["===", "=="].includes(test.operator)
                    ) {
                        methods.push(method)
                    } else if (returnsTrue) {
                        methods.push(method)
                    }
                }

                visit(statement.consequent)
                visit(statement.alternate)
                return
            }

            if (statement.type === "BlockStatement") {
                statement.body.forEach(visit)
                return
            }

            if (statement.type === "SwitchStatement") {
                statement.cases.forEach(item =>
                    item.consequent.forEach(visit)
                )
            }
        }

        visit(node)

        return [...new Set(methods)]
    }

    function analyseFunction(node) {
        if (node.body?.type !== "BlockStatement") return

        const statements = node.body.body

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]

            if (statement.type !== "IfStatement") continue

            const routes = getPathRoutes(
                statement.test,
                statement.consequent
            )

            if (!routes.length) continue

            const methods = new Set(
                routes.flatMap(route => route.methods || [])
            )

            for (let j = i + 1; j < statements.length; j++) {
                const nextStatement = statements[j]

                if (
                    nextStatement.type === "IfStatement" &&
                    getPathRoutes(
                        nextStatement.test,
                        nextStatement.consequent
                    ).length
                ) {
                    break
                }

                for (const method of getAcceptedMethods(nextStatement)) {
                    methods.add(method)
                }
            }

            if (!methods.size) continue

            for (const route of routes) {
                const existing = result.routes.find(item =>
                    item.path === route.path &&
                    item.matchType === route.matchType &&
                    item.line === route.line
                )

                if (existing) {
                    existing.methods = [
                        ...new Set([
                            ...(existing.methods || []),
                            ...methods
                        ])
                    ]
                }
            }
        }
    }

    walk.simple(ast, {
        FunctionDeclaration: analyseFunction,
        FunctionExpression: analyseFunction,
        ArrowFunctionExpression: analyseFunction
    })
}

function getPathMethods(test) {
    const methods = []

    function visit(node) {
        if (!node) return

        if (node.type === "LogicalExpression") {
            visit(node.left)
            visit(node.right)
            return
        }

        if (node.type !== "BinaryExpression") return

        const left = node.left
        const right = node.right

        const isMethodReference =
            left.type === "MemberExpression" &&
            left.property.type === "Identifier" &&
            left.property.name === "method"

        const isMethodLiteral =
            right.type === "Literal" &&
            typeof right.value === "string"

        if (!isMethodReference || !isMethodLiteral) return

        if (node.operator === "===" || node.operator === "==") {
            methods.push(right.value.toUpperCase())
        }
    }

    visit(test)

    return [...new Set(methods)]
}


function getPathRoutes(test, consequent = null) {
    if (!test) return []
    if (
        test.type === "UnaryExpression" &&
        test.operator === "!"
    ) {
        const statements = consequent?.type === "BlockStatement"
            ? consequent.body
            : consequent
                ? [consequent]
                : []

        const returnsFalse = statements.some(statement =>
            statement.type === "ReturnStatement" &&
            statement.argument?.type === "Literal" &&
            statement.argument.value === false
        )

        if (returnsFalse) {
            return getPathRoutes(test.argument)
        }
    }

    if (test.type === "LogicalExpression" && test.operator === "&&") {
        const routes = [
            ...getPathRoutes(test.left),
            ...getPathRoutes(test.right)
        ]

        const methods = [...new Set(getPathMethods(test))]

        return routes.map(route => ({
            ...route,
            methods
        }))
    }

    if (
        test.type === "BinaryExpression" &&
        ["===", "==", "!==", "!="].includes(test.operator)
    ) {
        const pathname = test.left
        const path = test.right

        const isPathComparison =
            pathname?.type === "MemberExpression" &&
            pathname.object?.name === "url" &&
            pathname.property?.name === "pathname" &&
            path?.type === "Literal" &&
            typeof path.value === "string" &&
            path.value.startsWith("/")

        if (!isPathComparison) return []

        const isNegative = ["!==", "!="].includes(test.operator)

        if (isNegative) {
            const statements = consequent?.type === "BlockStatement"
                ? consequent.body
                : consequent
                    ? [consequent]
                    : []

            const returnsFalse = statements.some(statement =>
                statement.type === "ReturnStatement" &&
                statement.argument?.type === "Literal" &&
                statement.argument.value === false
            )

            if (!returnsFalse) return []
        }

        return [{
            method: "HTTP",
            path: path.value,
            matchType: "exact",
            line: test.loc.start.line
        }]
    }

    if (test.type === "CallExpression") {
        const callee = test.callee
        const method = callee?.property?.name

        if (method === "startsWith") {
            const pathname = callee.object
            const path = test.arguments[0]

            if (
                pathname?.type === "MemberExpression" &&
                pathname.object?.name === "url" &&
                pathname.property?.name === "pathname" &&
                path?.type === "Literal" &&
                typeof path.value === "string" &&
                path.value.startsWith("/")
            ) {
                return [{
                    method: "HTTP",
                    path: path.value,
                    matchType: "prefix",
                    line: test.loc.start.line
                }]
            }
        }

        if (method === "includes") {
            const paths = callee.object
            const pathname = test.arguments[0]

            if (
                paths?.type === "ArrayExpression" &&
                pathname?.type === "MemberExpression" &&
                pathname.object?.name === "url" &&
                pathname.property?.name === "pathname"
            ) {
                return paths.elements
                    .filter(element =>
                        element?.type === "Literal" &&
                        typeof element.value === "string" &&
                        element.value.startsWith("/")
                    )
                    .map(element => ({
                        method: "HTTP",
                        path: element.value,
                        matchType: "exact",
                        line: test.loc.start.line
                    }))
            }
        }
    }

    return []
}


function resolveFileReference(projectRoot, fromFile, reference, baseName = "") {
    if (!reference) return null

    const fromDirectory = path.dirname(path.join(projectRoot, fromFile))
    const baseDirectory = ["__dirname", "__filename"].includes(baseName)
        ? fromDirectory
        : projectRoot
    const candidate = path.resolve(baseDirectory, reference)

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(projectRoot, candidate).replaceAll(path.sep, "/")
    }

    return null
}

function extractPathReferences(filePath, code, projectRoot) {
    const references = []
    const regex = /path\.(?:join|resolve)\s*\(\s*(__dirname|__filename|[A-Za-z_$][\w$]*)\s*,\s*([^\)]+)\)/g
    let match

    while ((match = regex.exec(code)) !== null) {
        const parts = [...match[2].matchAll(/["'`]([^"'`]+)["'`]/g)].map(item => item[1])
        if (!parts.length) continue

        const reference = parts.join(path.sep)
        const resolved = resolveFileReference(projectRoot, filePath, reference, match[1])

        if (resolved) references.push(resolved)
    }

    return [...new Set(references)]
}

function getFileType(filePath) {
    const extension = path.extname(filePath).toLowerCase()

    if ([".js", ".jsx", ".mjs"].includes(extension)) return "javascript"
    if (extension === ".md") return "markdown"
    if (extension === ".json") return "json"
    if (extension === ".yml") return "yaml"
    if (extension === ".css") return "css"
    if (extension === ".html") return "html"
    if ([".service", ".conf", ".example"].includes(extension)) return "config"

    return "text"
}

function getHeading(lines, start) {
    for (let index = start; index >= 0; index--) {
        const match = lines[index]?.match(/^\s{0,3}#{1,6}\s+(.+)$/)
        if (match) return match[1].trim()
    }

    return null
}

function createChunks(content, filePath, chunkSize = 60, chunkStep = 40) {
    const lines = content.split(/\r?\n/)
    const type = getFileType(filePath)
    const chunks = []

    for (let start = 0; start < lines.length; start += chunkStep) {
        const chunkLines = lines.slice(start, start + chunkSize)
        if (!chunkLines.length) continue

        chunks.push({
            start: start + 1,
            end: Math.min(start + chunkSize, lines.length),
            type,
            heading: type === "markdown" ? getHeading(lines, start) : null,
            text: chunkLines.join("\n")
        })
    }

    return chunks
}

module.exports = {
    parseJavaScript,
    createChunks,
    extractPathReferences,
    getFileType
}
