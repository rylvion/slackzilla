const acorn = require("acorn")
const walk = require("acorn-walk")

function parseJavaScript(content) {
    const ast = acorn.parse(content, {
        ecmaVersion: "latest",
        sourceType: "unambiguous",
        locations: true
    })

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
        }
    })

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
        callee.object.object?.type === "MemberExpression" &&
        callee.object.object.object?.name === "process" &&
        callee.object.object.property?.name === "env"
    ) {
        return callee.object.property?.name || null
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

        result[key] = values.filter(
            (value, index, array) => index === array.findIndex( other => JSON.stringify(other) === JSON.stringify(value) )
        )
    }

    return result
}

module.exports = {
    parseJavaScript
}