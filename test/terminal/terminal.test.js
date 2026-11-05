const assert = require("node:assert/strict")
const test = require("node:test")

const { handleTerminalApi } = require("../../server/api/terminal")
const { listRoutes } = require("../../server/api/routes")
const { executeCommand, executeLogs, parseLogOptions, redactLogLine } = require("../../server/lib/terminal/commands")
const { parseCommand, parseCommandRequest, tokenize } = require("../../server/lib/terminal/parser")
const { canExecuteCommand, PERMISSIONS } = require("../../server/lib/terminal/permissions")

function response() {
    return {
        headers: {},
        setHeader(name, value) { this.headers[name] = value },
        end(body) {
            this.body = body
            this.payload = JSON.parse(body)
        }
    }
}

function contextFor(body, overrides = {}) {
    const session = { sessionId: `test-${Math.random()}`, csrfToken: "valid-token" }
    const ip = session.sessionId

    return {
        auth: {
            requireSession: () => session,
            getSessionFromRequest: () => null,
            getRequestIp: () => ip,
            verifyCsrf: () => true,
            ...overrides.auth
        },
        parseBody: async () => body,
        sendOk: (res, data) => {
            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, data }))
        },
        sendError: (res, statusCode, code, error, details) => {
            res.statusCode = statusCode
            res.end(JSON.stringify({ ok: false, code, error, ...details }))
        },
        renderStatusSummary: () => ({
            botOnline: true,
            uptimeText: "1 minute",
            nodeVersion: "v22",
            platform: "linux",
            commit: "abc123",
            branch: "main",
            deploymentStatus: "ready"
        })
    }
}

test("parses and validates terminal command requests", () => {
    assert.deepEqual(parseCommand("status one"), { name: "status", args: ["one"] })
    assert.deepEqual(tokenize('docs search "rate limiting"'), ["docs", "search", "rate limiting"])
    assert.deepEqual(tokenize('json {"name":"test","count":3}'), ["json", '{"name":"test","count":3}'])
    assert.deepEqual(parseCommandRequest({ command: "UPTIME", args: [] }), { name: "uptime", args: [] })
    assert.throws(() => parseCommand(""), /command is required/)
    assert.throws(() => parseCommand("bad_name"), /command name is invalid/)
    assert.throws(() => parseCommandRequest({ command: "status", args: "not-an-array" }), /arguments must be an array/)
})

test("filters documentation search results without changing retrieval", async () => {
    const result = await executeCommand("docs", ["search", "rate", "--sources", "1", "--no-verbose"], contextFor({}))
    assert.equal(result.results.length, 1)
    assert.equal(Object.hasOwn(result.results[0], "excerpt"), false)
    await assert.rejects(() => executeCommand("docs", ["search", "rate", "--sources", "zero"], contextFor({})), /positive integer/)
})

test("returns current and historical release notes from version", async () => {
    const current = await executeCommand("version", [], contextFor({}))
    assert.ok(current.currentVersion)
    assert.ok(Array.isArray(current.changes))

    const historical = await executeCommand("version", ["v0.9.6-beta"], contextFor({}))
    assert.equal(historical.version, "v0.9.6-beta")
    assert.ok(Array.isArray(historical.changes))
    assert.ok(historical.changes.length <= 15)
    const verbose = await executeCommand("version", ["v0.9.6-beta", "--verbose"], contextFor({}))
    assert.equal(verbose.truncated, false)
    assert.equal(verbose.changes.length, verbose.changesTotal)
    const leadingFlag = await executeCommand("version", ["--verbose", "v0.9.6-beta"], contextFor({}))
    assert.equal(leadingFlag.version, "v0.9.6-beta")
    assert.equal(leadingFlag.truncated, false)
    const help = await executeCommand("version", ["--help"], contextFor({}))
    assert.ok(help.versions.includes("v0.9.6-beta"))
    await assert.rejects(() => executeCommand("version", ["v0.0.0-not-real"], contextFor({})), /was not found/)
})

test("supports bounded, numbered and redacted log queries", () => {
    assert.deepEqual(parseLogOptions([]), { mode: "tail", limit: 10, start: null, end: null })
    assert.deepEqual(parseLogOptions(["--head", "2"]), { mode: "head", limit: 2, start: null, end: null })
    assert.deepEqual(parseLogOptions(["--start", "2", "--end", "3"]).start, 2)
    assert.throws(() => parseLogOptions(["--tail", "51"]), /between 1 and 50/)
    assert.equal(redactLogLine("password=secret slackzilla_admin_session=abc csrf: xyz"), "password: [REDACTED] slackzilla_admin_session=[REDACTED] csrf: [REDACTED]")
})

test("logs use the existing store and handle empty collections", () => {
    const context = contextFor({})
    context.store = { getLogSnapshot: () => ({ content: "one\npassword=secret\nthree\n" }) }
    context.splitLogLines = content => String(content).split(/\r?\n/).filter(Boolean)
    const result = executeLogs(["--head", "2"], context)
    assert.deepEqual(result.entries.map(entry => entry.number), [1, 2])
    assert.match(result.entries[1].text, /REDACTED/)
    const empty = executeLogs([], { ...context, store: { getLogSnapshot: () => ({ content: "" }) } })
    assert.deepEqual(empty.entries, [])
})

test("filters RAG sources by file type and limit", async () => {
    const result = await executeCommand("rag", ["sources", "--type", "jsx", "--limit", "20"], contextFor({}))
    assert.ok(result.sources.length <= 20)
    assert.ok(result.sources.every(source => source.toLowerCase().endsWith(".jsx")))
    assert.equal(result.limit, 20)
})

test("filters RAG sources by path search", async () => {
    const result = await executeCommand("rag", ["sources", "--search", "terminal", "--limit", "20"], contextFor({}))
    assert.ok(result.sources.length <= 20)
    assert.ok(result.sources.every(source => source.toLowerCase().includes("terminal")))
    assert.equal(result.search, "terminal")
})

test("lists and inspects the registered RAG tools", async () => {
    const listed = await executeCommand("rag", ["tools"], contextFor({}))
    assert.ok(listed.tools.some(tool => tool.name === "runApiCommand"))
    assert.ok(listed.tools.some(tool => tool.name === "runTerminalCommand"))
    assert.ok(listed.tools.every(tool => tool.parameters))

    const inspected = await executeCommand("rag", ["inspect", "runApiCommand"], contextFor({}))
    assert.equal(inspected.tool.name, "runApiCommand")
    assert.deepEqual(inspected.tool.parameters.required, ["method", "path"])
})

test("executes a registered RAG tool through the terminal", async () => {
    const result = await executeCommand("rag", ["execute", "getReleaseInfo", "{}"], contextFor({}))
    assert.equal(result.tool, "getReleaseInfo")
    assert.equal(result.result.success, true)
    assert.ok(result.result.data.currentVersion)

    const flagged = await executeCommand("rag", ["execute", "getCommand", "--command", "/sz-", "--description", "algorithm", "--fuzzy", "haash"], contextFor({}))
    assert.equal(flagged.tool, "getCommands")
    assert.equal(flagged.result.success, true)
    assert.ok(Array.isArray(flagged.result.data))
    await assert.rejects(() => executeCommand("rag", ["inspect", "not-a-tool"], contextFor({})), /unknown RAG tool/)
})

test("lists Slack command metadata and derives virtual directory entries", async () => {
    const list = await executeCommand("command", ["list"], contextFor({}))
    assert.ok(list.commands.length > 0)
    assert.ok(list.commands.every(command => command.name && command.description && command.usage))

    const directory = await executeCommand("command", ["dir"], contextFor({}))
    assert.ok(directory.commands.some(command => command.entry === "<DIR>" || command.entry === "<CMD>"))
    assert.equal(directory.directory.count, directory.directory.items.length)
    assert.equal(directory.directory.items.find(command => command.id === "hash")?.entry, "<DIR>")
    assert.equal(directory.directory.items.find(command => command.id === "ping")?.entry, "<CMD>")
})

test("routes sudo execute logout through admin control, clears the session and forwards cookies", async () => {
    let loggedOut = false
    const result = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: { "x-csrf-token": "valid-token" } },
        res: result,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "sudo", args: ["execute", "logout"], reauthToken: "logout-token", confirmed: true }, {
            auth: {
                getSessionFromRequest: () => ({ sessionId: "logout-session", csrfToken: "valid-token" }),
                verifyCsrf: () => true,
                consumeReauthenticationToken: () => true,
                logout: (req, res) => { loggedOut = true; res.setHeader("Set-Cookie", ["cleared"]) }
            }
        })
    })
    assert.equal(result.statusCode, 200)
    assert.equal(loggedOut, true)
    assert.deepEqual(result.headers["Set-Cookie"], ["cleared"])
    assert.equal(result.payload.data.authenticated, false)
})

test("does not execute logout when re-authentication or confirmation fails", async () => {
    let executions = 0
    const run = async (body, consume = false) => {
        const result = response()
        const sessionId = `logout-failure-${Math.random()}`
        await handleTerminalApi({
            req: { method: "POST", url: "/api/terminal", headers: { "x-csrf-token": "valid-token" } },
            res: result,
            url: new URL("http://localhost/api/terminal"),
            context: contextFor(body, {
                auth: {
                    getSessionFromRequest: () => ({ sessionId, csrfToken: "valid-token" }),
                    verifyCsrf: () => true,
                    consumeReauthenticationToken: () => consume,
                    logout: () => { executions += 1 }
                }
            })
        })
        return result
    }

    const rejectedAuth = await run({ command: "sudo", args: ["execute", "logout"], reauthToken: "bad", confirmed: true })
    assert.equal(rejectedAuth.statusCode, 403)
    assert.equal(executions, 0)

    const rejectedConfirmation = await run({ command: "sudo", args: ["execute", "logout"], reauthToken: "valid", confirmed: false }, true)
    assert.equal(rejectedConfirmation.statusCode, 403)
    assert.equal(executions, 0)
})

test("supports the direct sudo logout spelling through the same control path", async () => {
    let executions = 0
    const result = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: { "x-csrf-token": "valid-token" } },
        res: result,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "sudo", args: ["logout"], reauthToken: "logout-token", confirmed: true }, {
            auth: {
                getSessionFromRequest: () => ({ sessionId: "direct-logout-session", csrfToken: "valid-token" }),
                verifyCsrf: () => true,
                consumeReauthenticationToken: () => true,
                logout: () => { executions += 1 }
            }
        })
    })
    assert.equal(result.statusCode, 200)
    assert.equal(executions, 1)
})

test("discovers the admin control route through the indexed route mechanism", () => {
    const matches = listRoutes().filter(route => route.path === "/api/admin/control")
    assert.equal(matches.length, 1)
    assert.equal(matches[0].method, "HTTP")
    assert.deepEqual(matches[0].methods, ["POST"])
    assert.equal(matches[0].file.replaceAll("\\", "/"), "server/api/control/index.js")
})

test("requires explicit permissions", () => {
    assert.equal(canExecuteCommand({ permission: PERMISSIONS.ADMIN }, { sessionId: "admin" }), true)
    assert.equal(canExecuteCommand({ permission: "unknown" }, { sessionId: "admin" }), false)
    assert.equal(canExecuteCommand({ permission: PERMISSIONS.ADMIN }, null), false)
})

test("executes a registered backend command", async () => {
    const res = response()
    const handled = await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "uptime", args: [] })
    })

    test("supports public route, documentation, and command inspection", async () => {
        const context = contextFor({ command: "api", args: ["inspect", "/api/admin/control"] })
        const apiResponse = response()
        await handleTerminalApi({
            req: { method: "POST", url: "/api/terminal", headers: {} },
            res: apiResponse,
            url: new URL("http://localhost/api/terminal"),
            context
        })
        assert.equal(apiResponse.statusCode, 200)
        assert.equal(apiResponse.payload.data.data.routes[0].path, "/api/admin/control")

        const docsResponse = response()
        await handleTerminalApi({
            req: { method: "POST", url: "/api/terminal", headers: {} },
            res: docsResponse,
            url: new URL("http://localhost/api/terminal"),
            context: contextFor({ command: "docs", args: ["search", "rate limiting"] })
        })
        assert.equal(docsResponse.statusCode, 200)
        assert.ok(docsResponse.payload.data.data.results.length > 0)
    })

    assert.equal(handled, true)
    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.data.data.uptimeText, "1 minute")
})

test("rejects unknown commands and invalid csrf", async () => {
    const unknownResponse = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res: unknownResponse,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "shell", args: [] })
    })

    test("allows authenticated admin terminal requests with valid csrf", async () => {
        const result = response()
        await handleTerminalApi({
            req: { method: "POST", url: "/api/terminal", headers: { "x-csrf-token": "valid-token" } },
            res: result,
            url: new URL("http://localhost/api/terminal"),
            context: contextFor({ command: "sudo", args: ["controls"] }, {
                auth: {
                    getSessionFromRequest: () => ({ sessionId: "admin-session", csrfToken: "valid-token" }),
                    verifyCsrf: req => req.headers["x-csrf-token"] === "valid-token"
                }
            })
        })
        assert.equal(result.statusCode, 200)
        assert.equal(result.payload.data.data.controls[0].id, "refresh")
    })

    test("allows authenticated sudo status with the existing admin summary", async () => {
        const result = response()
        const context = contextFor({ command: "sudo", args: ["status"] }, {
            auth: {
                getSessionFromRequest: () => ({ sessionId: "admin-status", csrfToken: "valid-token" }),
                verifyCsrf: () => true
            }
        })
        context.buildAdminSummary = () => ({ authenticated: true, controls: "available" })
        await handleTerminalApi({
            req: { method: "POST", url: "/api/terminal", headers: { "x-csrf-token": "valid-token" } },
            res: result,
            url: new URL("http://localhost/api/terminal"),
            context
        })
        assert.equal(result.statusCode, 200)
        assert.equal(result.payload.data.data.status.authenticated, true)
    })

    test("executes a registered Slack command through the shared runner", async () => {
        const result = await executeCommand("command", ["execute", "ping"], contextFor({}))
        assert.equal(result.command, "/sz-ping")
        assert.match(result.responses[0], /pong/)
    })
    assert.equal(unknownResponse.statusCode, 404)
    assert.equal(unknownResponse.payload.code, "COMMAND_NOT_FOUND")

    const csrfResponse = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res: csrfResponse,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "sudo", args: ["list"] }, {
            auth: {
                getSessionFromRequest: () => ({ sessionId: "csrf-test" }),
                verifyCsrf: () => false
            }
        })
    })
    assert.equal(csrfResponse.statusCode, 403)
    assert.equal(csrfResponse.payload.code, "CSRF_INVALID")
})

test("rejects malformed requests, missing sessions, and rapid repeats", async () => {
    const malformedResponse = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res: malformedResponse,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "status", args: "invalid" })
    })

    test("requires authentication and CSRF for sudo commands", async () => {
        const responseValue = response()
        await handleTerminalApi({
            req: { method: "POST", url: "/api/terminal", headers: {} },
            res: responseValue,
            url: new URL("http://localhost/api/terminal"),
            context: contextFor({ command: "sudo", args: ["controls"] }, {
                auth: { getSessionFromRequest: () => null }
            })
        })
        assert.equal(responseValue.statusCode, 401)
    })
    assert.equal(malformedResponse.statusCode, 400)

    const missingResponse = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res: missingResponse,
        url: new URL("http://localhost/api/terminal"),
        context: contextFor({ command: "sudo", args: ["list"] }, {
            auth: {
                getSessionFromRequest: () => null
            }
        })
    })
    assert.equal(missingResponse.statusCode, 401)

    const context = contextFor({ command: "uptime", args: [] })
    const firstResponse = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res: firstResponse,
        url: new URL("http://localhost/api/terminal"),
        context
    })
    const repeatedResponse = response()
    await handleTerminalApi({
        req: { method: "POST", url: "/api/terminal", headers: {} },
        res: repeatedResponse,
        url: new URL("http://localhost/api/terminal"),
        context
    })
    assert.equal(repeatedResponse.statusCode, 429)
    assert.equal(repeatedResponse.payload.code, "RATE_LIMITED")
})
