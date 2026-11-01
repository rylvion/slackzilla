const assert = require("node:assert/strict")
const test = require("node:test")

const { createRagTools } = require("../../server/lib/rag/rag-tools")

test("runs a registered public terminal command through the RAG tool", async () => {
    const calls = []
    const tools = createRagTools({
        runTerminalCommand: async (command, args) => {
            calls.push({ command, args })
            return { uptimeText: "1 minute" }
        }
    })

    const result = await tools.execute("runTerminalCommand", { command: "uptime", args: [] })

    assert.equal(result.success, true)
    assert.deepEqual(calls, [{ command: "uptime", args: [] }])
    assert.deepEqual(result.data, { uptimeText: "1 minute" })
})

test("returns terminal command failures without exposing an execution bypass", async () => {
    const tools = createRagTools({
        runTerminalCommand: async () => {
            const error = new Error("terminal command is not available to the RAG")
            error.statusCode = 403
            throw error
        }
    })

    const result = await tools.execute("runTerminalCommand", { command: "sudo", args: ["status"] })

    assert.equal(result.success, false)
    assert.equal(result.status, 403)
    assert.match(result.error, /not available/)
})

test("runs internal API commands without accepting credential headers", async () => {
    const calls = []
    const tools = createRagTools({
        runApiCommand: async request => {
            calls.push(request)
            return { status: 200, ok: true, body: { ready: true } }
        }
    })

    const result = await tools.execute("runApiCommand", {
        method: "GET",
        path: "/api/status"
    })

    assert.equal(result.success, true)
    assert.deepEqual(calls, [{ method: "GET", path: "/api/status", body: undefined, headers: {} }])

    const blocked = await tools.execute("runApiCommand", {
        method: "POST",
        path: "/api/example",
        headers: { Authorization: "secret" }
    })
    assert.equal(blocked.success, false)
})
