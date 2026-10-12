const test = require("node:test")
const assert = require("node:assert/strict")
const { answerQuestion, buildAiFallback, readAiResponse, calculateScore } = require("../../server/lib/rag/rag")

function streamResponse(payloads) {
    const body = payloads.map(payload => `data: ${JSON.stringify(payload)}\n\n`).join("") + "data: [DONE]\n\n"
    return new Response(body, { headers: { "content-type": "text/event-stream" } })
}

test("falls back to available tool results when the final response is empty", () => {
    const answer = buildAiFallback(
        { rounds: [{ text: "I checked the current status." }] },
        [{ toolName: "getStatus", arguments: {}, result: { success: true, data: { status: "ready" } } }]
    )

    assert.match(answer, /current status/)
    assert.match(answer, /getStatus/)
    assert.match(answer, /ready/)
})

test("gives docs files a higher retrieval score", () => {
    const base = {
        question: "How does authentication work?",
        queryTokens: new Set(["how", "does", "authentication", "work"]),
        chunk: { text: "Authentication flow", heading: "Authentication" },
        requestedFiles: []
    }

    const docsScore = calculateScore({
        ...base,
        document: { path: "docs/guide.md", type: "markdown" }
    })
    const otherScore = calculateScore({
        ...base,
        document: { path: "README.md", type: "markdown" }
    })

    assert.equal(docsScore - otherScore, 25)
})

test("keeps response text and tool calls across streamed rounds", async () => {
    const state = { rounds: [], accumulatedText: "" }
    const first = await readAiResponse(streamResponse([
        { choices: [{ delta: { content: "Checking status", tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "getStatus", arguments: "{}" } }] } }] }
    ]), state)
    const second = await readAiResponse(streamResponse([
        { choices: [{ delta: { content: "Status is ready." } }] }
    ]), state)

    assert.equal(first.toolCalls[0].function.name, "getStatus")
    assert.equal(second.answer, "Status is ready.")
    assert.equal(state.rounds.length, 2)
    assert.equal(state.accumulatedText, "Checking statusStatus is ready.")
})

test("answerQuestion returns tool evidence when a later model round is empty", async () => {
    const originalFetch = global.fetch
    const originalKey = process.env.AI_API_KEY
    const originalUrl = process.env.AI_URL
    const requests = []

    process.env.AI_API_KEY = "test-key"
    process.env.AI_URL = "https://example.test/v1"
    global.fetch = async (url, options) => {
        requests.push({ url, options: JSON.parse(options.body) })

        if (requests.length === 1) {
            return streamResponse([
                { choices: [{ delta: { tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "getStatus", arguments: "{}" } }] } }] }
            ])
        }

        return streamResponse([])
    }

    try {
        const result = await answerQuestion({
            question: "What is the current status?",
            tools: {
                definitions: [{ type: "function", function: { name: "getStatus" } }],
                execute: async () => ({ success: true, data: { status: "ready" } })
            }
        })

        assert.equal(requests.length, 2)
        assert.match(result.answer, /getStatus/)
        assert.match(result.answer, /ready/)
    } finally {
        global.fetch = originalFetch
        if (originalKey === undefined) delete process.env.AI_API_KEY
        else process.env.AI_API_KEY = originalKey
        if (originalUrl === undefined) delete process.env.AI_URL
        else process.env.AI_URL = originalUrl
    }
})
