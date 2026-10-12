const test = require("node:test")
const assert = require("node:assert/strict")
const { parseJavaScript } = require("../../server/lib/rag/code-parser")

test("detects routes inside combined pathname and method conditions", () => {
    const source = `
        async function handler(req, res, url) {
            if (url.pathname === "/api/status" && req.method === "GET") {
                return true
            }
        }
    `

    const { routes } = parseJavaScript(source)

    assert.ok(
        routes.some(route => route.path === "/api/status"),
        "Expected parser to detect /api/status"
    )
})

test("ignores negative pathname comparisons without a false return", () => {
    const source = `
        async function handler(req, res, url) {
            if (url.pathname !== "/api/status") {
                return true
            }
        }
    `

    const { routes } = parseJavaScript(source)

    assert.equal(
        routes.some(route => route.path === "/api/status"),
        false,
        "Negative pathname comparisons without a false return should not be detected as routes"
    )
})

test("detects routes matched using includes()", () => {
    const source = `
        async function handler(req, res, url) {
            if (["/api/logs", "/api/logs/stream"].includes(url.pathname)) {
                return true
            }
        }
    `

    const { routes } = parseJavaScript(source)

    assert.ok(routes.some(route => route.path === "/api/logs"))
    assert.ok(routes.some(route => route.path === "/api/logs/stream"))
})

test("detects routes matched using startsWith()", () => {
    const source = `
        async function handler(req, res, url) {
            if (url.pathname.startsWith("/api/commands/")) {
                return true
            }
        }
    `

    const { routes } = parseJavaScript(source)

    assert.ok(
        routes.some(route => route.path === "/api/commands/")
    )
})

test("detects negated prefix guards that return false", () => {
    const source = `
        function handler(req, res, url) {
            if (!url.pathname.startsWith("/api/commands/")) {
                return false
            }

            return true
        }
    `

    const { routes } = parseJavaScript(source)

    assert.ok(
        routes.some(route =>
            route.path === "/api/commands/" &&
            route.matchType === "prefix"
        )
    )
})

test("detects single-line negated prefix guards", () => {
    const source = `
        function handler(req, res, url) {
            if (!url.pathname.startsWith("/api/commands/")) return false
            return true
        }
    `

    const { routes } = parseJavaScript(source)

    assert.ok(
        routes.some(route =>
            route.path === "/api/commands/" &&
            route.matchType === "prefix"
        )
    )
})

test("extracts HTTP methods from combined route conditions", () => {
    const source = `
        function handler(req, res, url) {
            if (url.pathname === "/api/commands" && req.method === "GET") {
                return true
            }
        }
    `

    const { routes } = parseJavaScript(source)

    assert.ok(
        routes.some(route =>
            route.path === "/api/commands" &&
            route.matchType === "exact" &&
            route.methods?.includes("GET")
        )
    )
})

test("infers methods from checks following a prefix route guard", () => {
    const source = `
        async function handler(req, res, url) {
            if (!url.pathname.startsWith("/api/commands/")) {
                return false
            }

            if (req.method === "GET") {
                return true
            }

            if (req.method !== "POST") {
                return true
            }

            return true
        }
    `

    const { routes } = parseJavaScript(source)

    const route = routes.find(item =>
        item.path === "/api/commands/" &&
        item.matchType === "prefix"
    )

    assert.ok(route, "Expected prefix route to be detected")
    assert.deepEqual(route.methods, ["GET", "POST"])
})

test("does not apply methods from one route to a separate route", () => {
    const source = `
        async function handler(req, res, url) {
            if (url.pathname === "/api/commands" && req.method === "GET") {
                return true
            }

            if (!url.pathname.startsWith("/api/commands/")) {
                return false
            }

            if (req.method === "POST") {
                return true
            }
        }
    `

    const { routes } = parseJavaScript(source)

    const exactRoute = routes.find(item =>
        item.path === "/api/commands" &&
        item.matchType === "exact"
    )

    const prefixRoute = routes.find(item =>
        item.path === "/api/commands/" &&
        item.matchType === "prefix"
    )

    assert.ok(exactRoute)
    assert.ok(prefixRoute)

    assert.ok(exactRoute.methods.includes("GET"))
    assert.ok(!exactRoute.methods.includes("POST"))

    assert.ok(prefixRoute.methods.includes("POST"))
    assert.ok(!prefixRoute.methods.includes("GET"))
})