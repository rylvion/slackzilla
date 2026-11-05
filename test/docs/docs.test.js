const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const { groupDocuments, documentGroup, groupOrder } = require("../../server/client/src/components/utils/docs-navigation.mjs")
const docsPath = path.resolve(__dirname, "../../server/client/src/components/utils/docs.js")

const markdownSources = {
    "docs/docs.md": "# Documentation\n\nBrowse the guides.",
    "docs/guides/setup.md": "# Setup Guide\n\nConfigure the project and install dependencies.",
    "docs/api.md": "# API Reference\n\nThe `/api/status` endpoint returns server status.",
    "docs/extension/plugins.md": "# Plugin Guide\n\nCreate custom extensions.",
    "docs/testing.md": "# Testing\n\nRun the automated test suite.",
    "assets/devlogs/v1.md": "# Version One\n\nIntroduced the documentation system.",
    "README.md": "# Slackzilla\n\nA Slack bot with documentation."
}

function loadDocs() {
    let source = fs.readFileSync(docsPath, "utf8")

    source = source.replace(
        'import markdownSources from "virtual:slackzilla-docs"',
        "const markdownSources = globalThis.__markdownSources"
    )

    source = source
        .replace(/^export const (documents|documentByRoute|searchDocuments|rewriteMarkdownLinks)\b/gm, "const $1")
        .replace(/^export function (searchDocuments|rewriteMarkdownLinks)\b/gm, "function $1")

    source += `
        module.exports = {
            documents,
            documentByRoute,
            searchDocuments,
            rewriteMarkdownLinks
        }
    `

    const module = { exports: {} }
    vm.runInNewContext(source, {module, globalThis: { __markdownSources: markdownSources }, Map, String, Object, Array, Math, RegExp}, { filename: docsPath })
    return module.exports
}

const { documents, documentByRoute, searchDocuments, rewriteMarkdownLinks } = loadDocs()

const normalise = value => JSON.parse(JSON.stringify(value))

test("loads Markdown documents from supported sources", () => {
    assert.equal(documents.length, 7)
    assert.ok(documents.some(document => document.source === "README.md"))
    assert.ok(documents.some(document => document.source === "docs/guides/setup.md"))
    assert.ok(documents.some(document => document.source === "assets/devlogs/v1.md"))
})

test("sorts documents by route", () => {
    const routes = normalise(documents.map(document => document.route))
    assert.deepStrictEqual(routes, [...routes].sort((a, b) => a.localeCompare(b)))
})

test("maps the documentation index to /docs", () => assert.equal(documentByRoute.get("/docs")?.title, "Documentation"))

test("maps the README to /docs/readme", () => {
    const document = documentByRoute.get("/docs/readme")

    assert.equal(document?.source, "README.md")
    assert.equal(document?.title, "Slackzilla")
})

test("maps nested documentation files to their routes", () => {
    assert.equal(documentByRoute.get("/docs/guides/setup")?.title, "Setup Guide")
    assert.equal(documentByRoute.get("/docs/extension/plugins")?.title, "Plugin Guide")
})

test("does not create a document for an unknown route", () => {
    assert.equal(documentByRoute.get("/docs/missing"), undefined)
})

test("assigns the expected document categories", () => {
    const categories = new Map(documents.map(document => [document.source, document.category ]))

    assert.equal(categories.get("docs/docs.md"), "Index")
    assert.equal(categories.get("docs/guides/setup.md"), "guides")
    assert.equal(categories.get("docs/extension/plugins.md"), "extension")
    assert.equal(categories.get("assets/devlogs/v1.md"), "Devlogs")
    assert.equal(categories.get("README.md"), "Project")
})

test("extracts titles from Markdown headings", () => {
    assert.equal(documentByRoute.get("/docs/guides/setup")?.title, "Setup Guide")
})

test("searches documents by title", () => {
    const results = searchDocuments("Setup Guide")

    assert.ok(results.length > 0)
    assert.equal(results[0].document.route, "/docs/guides/setup")
})

test("searches document content case-insensitively", () => {
    const results = searchDocuments("AUTOMATED TEST SUITE")
    assert.ok(results.some(result => result.document.source === "docs/testing.md"))
})

test("searches document headings", () => {
    const results = searchDocuments("API Reference")
    assert.ok(results.some(result => result.document.source === "docs/api.md"))
})

test("returns no results for empty or whitespace-only queries", () => {
    assert.deepStrictEqual(normalise(searchDocuments("")), [])
    assert.deepStrictEqual(normalise(searchDocuments("   ")), [])
})

test("returns no results for unmatched queries", () => assert.deepStrictEqual(normalise(searchDocuments("nonexistent-phrase-xyz")), []))

test("respects the search result limit", () => {
    assert.equal(searchDocuments("documentation", 1).length, 1)
    assert.equal(searchDocuments("documentation", 0).length, 0)
})

test("includes a relevant excerpt in search results", () => {
    const result = searchDocuments("dependencies").find(item => item.document.source === "docs/guides/setup.md")

    assert.ok(result)
    assert.match(result.text, /dependencies/i)
})

test("preserves external Markdown links", () => {
    const markdown = "[Website](https://example.com/page)"
    assert.equal(rewriteMarkdownLinks(markdown, "docs/guides/setup.md"), markdown)
})

test("rewrites relative Markdown links to documentation routes", () => {
    const result = rewriteMarkdownLinks("[API](../api.md)", "docs/guides/setup.md")
    assert.equal(result, "[API](/docs/api)")
})

test("preserves query strings and heading fragments in links", () => {
    const result = rewriteMarkdownLinks("[API](../api.md?view=full#status)", "docs/guides/setup.md") // representary, no query/fragment in docs.jsx
    assert.equal(result, "[API](/docs/api?view=full#status)")
})

test("preserves fragment-only links", () => {
    const markdown = "[Section](#installation)"
    assert.equal(rewriteMarkdownLinks(markdown, "docs/guides/setup.md"), markdown)
})

test("rewrites HTML href attributes", () => {
    const result = rewriteMarkdownLinks( '<a href="../api.md">API</a>', "docs/guides/setup.md")

    assert.equal(result, '<a href="/docs/api">API</a>')
})

test("rewrites HTML src attributes", () => {
    const result = rewriteMarkdownLinks('<img src="../images/example.png">', "docs/guides/setup.md")
    assert.equal(result, '<img src="/docs/images/example.png">')
})

test("rewrites devlog HTML image paths to public asset paths", () => {
    const markdown = '<img src="../attachments/d1/slack.jpg"><picture><source srcset="../attachments/d1/slack.jpg 1x, ../attachments/d1/slack@2x.jpg 2x"></picture>'
    const result = rewriteMarkdownLinks(markdown, "assets/devlogs/devlog1.md")

    assert.equal(result, '<img src="/assets/attachments/d1/slack.jpg"><picture><source srcset="/assets/attachments/d1/slack.jpg 1x, /assets/attachments/d1/slack@2x.jpg 2x"></picture>')
})

test("groups documents in the expected navigation sections", () => {
    const groups = groupDocuments(documents)
    const names = groups.map(([name]) => name)

    assert.deepEqual(names, [...groupOrder.filter(name => names.includes(name))])

    assert.ok(groups.some(([name]) => name === "Guides"))
    assert.ok(groups.some(([name]) => name === "API Reference"))
    assert.ok(groups.some(([name]) => name === "Extension Guides"))
    assert.ok(groups.some(([name]) => name === "Development & Testing"))
    assert.ok(groups.some(([name]) => name === "Devlogs"))
    assert.ok(groups.some(([name]) => name === "Project Resources"))
})

test("assigns README and devlog documents to their correct groups", () => {
    assert.equal(documentGroup({ source: "README.md" }), "Project Resources" )
    assert.equal( documentGroup({ source: "assets/devlogs/v1.md" }), "Devlogs" )
})

test("does not mutate the original document list when grouping", () => {
    const original = structuredClone(documents)

    groupDocuments(documents)
    assert.deepStrictEqual(normalise(documents), original)
})
