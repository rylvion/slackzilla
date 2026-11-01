const test = require("node:test")
const assert = require("node:assert/strict")
const { groupServerErrors, groupServerEvents } = require("../../server/database/store")

test("groups identical errors while retaining occurrence metadata and one stack", () => {
    const errors = groupServerErrors([
        { id: "a", name: "TypeError", message: "failed", stack: "TypeError: failed\n at handler", source: "api", time: "2026-10-01T00:00:00.000Z" },
        { id: "b", name: "TypeError", message: "failed", stack: "TypeError: failed\n at handler", source: "worker", time: "2026-10-02T00:00:00.000Z" },
        { id: "c", name: "TypeError", message: "failed", stack: "TypeError: failed\n at otherHandler", source: "api", time: "2026-10-03T00:00:00.000Z" }
    ])

    assert.equal(errors.length, 2)
    const duplicate = errors.find(group => group.count === 2)
    assert.equal(duplicate.stack, "TypeError: failed\n at handler")
    assert.deepEqual(duplicate.occurrences.map(item => item.id).sort(), ["a", "b"])
    assert.equal(duplicate.firstSeen, "2026-10-01T00:00:00.000Z")
    assert.equal(duplicate.lastSeen, "2026-10-02T00:00:00.000Z")
})

test("keeps event groups separate when query values differ", () => {
    const events = groupServerEvents(100, [
        { id: "a", method: "GET", path: "/api/items?value=one", type: "api", statusCode: 200, source: "server", time: "2026-10-01T00:00:00.000Z" },
        { id: "b", method: "GET", path: "/api/items?value=two", type: "api", statusCode: 200, source: "server", time: "2026-10-02T00:00:00.000Z" },
        { id: "c", method: "GET", path: "/api/items?value=one", type: "api", statusCode: 200, source: "server", time: "2026-10-03T00:00:00.000Z" }
    ])

    assert.equal(events.length, 2)
    assert.equal(events.find(group => group.path.endsWith("value=one")).count, 2)
    assert.equal(events.find(group => group.path.endsWith("value=two")).count, 1)
})