const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { listCommands, getCommand, runCommand } = require("../command-runner")
const { MAX_CONTEXT_TOKENS, buildCodebaseContext, estimateTokenCount, loadIndex, packRepositoryContext, retrieve, retrieveImages } = require("./rag")

const model = process.env.AI_MODEL || "openai/gpt-6-luna"
const MAX_TOOL_ROUNDS = 3
const PROMPTS_DIR = path.join(__dirname, "prompts")
const SYSTEM_PROMPT = fs.readFileSync(path.join(PROMPTS_DIR, "SYSTEM_PROMPT.md"), "utf8").trim()
const TOOL_CALL_LIMIT = fs.readFileSync(path.join(PROMPTS_DIR, "TOOL-CALL-LIMIT_PROMPT.md"), "utf8").trim()
const estimateOptionalTokenCount = value => String(value || "").length ? estimateTokenCount(value) : 0

function formatResponses(responses) {
    return responses
        .map(response => {
            if (typeof response === "string") return response
            if (response?.text) return response.text
            if (response?.blocks) return response.blocks.map(block => block.text?.text || block.alt_text || "").filter(Boolean).join("\n")
            return JSON.stringify(response)
        })
        .join("\n")
}

function inferCommandInvocation(question) {
    const match = String(question).match(/(\/sz-[a-z0-9-]+)/i)
    if (!match) return null

    const command = listCommands().find(item => item.cmd.toLowerCase() === match[1].toLowerCase())
    if (!command) return null

    const hashRequest = String(question).match(/(?:password|passphrase)\s+["']?([^,"'\s]+)["']?.*?(\d{2,})\s+iterations/i)
    if (command.id === "hash" && hashRequest) {
        const algorithm = /pbkdf2/i.test(question) ? "pbkdf2" : "sha256"
        const digest = question.match(/\b(sha(?:1|224|256|384|512)|md5)\b/i)?.[1] || "sha512"
        return { id: command.id, text: `${algorithm} ${digest} ${hashRequest[2]} ${hashRequest[1]}` }
    }

    const remainder = String(question).slice(match.index + match[1].length).replace(/^\s*command\b/i, "").trim()
    return { id: command.id, text: remainder }
}

function buildAiFallback(responseState = {}, toolResults = []) {
    const reasoning = (responseState.rounds || []).map(round => String(round.text || "").trim()).filter(Boolean)
    const resultText = toolResults.map(item => `### ${item.toolName}\nArguments:\n\`\`\`json\n${JSON.stringify(item.arguments || {}, null, 2)}\n\`\`\`\nResponse:\n\`\`\`json\n${JSON.stringify(item.result, null, 2)}\n\`\`\``)

    if (!reasoning.length && !resultText.length) return "The AI did not return a final response."

    return [
        "The AI did not return a final response, but the available execution results are:",
        reasoning.length ? `\n${reasoning.join("\n\n")}` : "",
        resultText.length ? `\n${resultText.join("\n\n")}` : ""
    ].join("").trim()
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

async function readAiResponse(response, responseState = { rounds: [], accumulatedText: "" }, signal, onToken) {
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
            const data = rawEvent.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n")
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
        if (answer && typeof onToken === "function") onToken(answer)
        for (const toolCall of message.tool_calls || []) toolCalls[toolCall.id] = toolCall
    }

    const markupToolCalls = [...answer.matchAll(/<tool_call>\s*([A-Za-z][A-Za-z0-9_]*)\s*<\/tool_call>/gi)]
    for (const [index, match] of markupToolCalls.entries()) {
        const name = match[1]
        const id = `markup-tool-${index}`
        if (!Object.values(toolCalls).some(toolCall => toolCall.function?.name === name)) {
            toolCalls[id] = { id, type: "function", function: { name, arguments: "{}" } }
        }
    }

    answer = answer.replace(/<tool_call>\s*[A-Za-z][A-Za-z0-9_]*\s*<\/tool_call>/gi, "").trim()
    responseState.accumulatedText += answer
    responseState.rounds.push({ text: answer, toolCalls: Object.values(toolCalls) })

    return { answer, toolCalls: Object.values(toolCalls), usage }
}

function scaleTokenBreakdown(breakdown, total) {
    const entries = Object.entries(breakdown)
    const estimatedTotal = entries.reduce((sum, [, value]) => sum + value, 0)
    if (!estimatedTotal || !Number.isFinite(total) || total <= 0) return breakdown

    const scale = total / estimatedTotal
    const scaled = {}
    let assigned = 0
    entries.forEach(([key, value], index) => {
        if (index === entries.length - 1) {
            scaled[key] = Math.max(0, total - assigned)
            return
        }
        scaled[key] = Math.round(value * scale)
        assigned += scaled[key]
    })
    return scaled
}


async function answerQuestion({ question, commandId, commandText, identity, tools, onActivity, onToken, signal, includeCodebaseContext = true } = {}, withAi = true) {
    const cleanQuestion = String(question || "").trim()
    if (!cleanQuestion) throw new Error("question is required")

    const throwIfAborted = () => {if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError")}

    const activities = []

    const emit = (event) => {
        const activity = { id: crypto.randomUUID(), timestamp: Date.now(), ...event }
        activities.push(activity)
        if (typeof onActivity === "function") onActivity(activity)
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
        message: includeCodebaseContext ? "Building codebase context..." : "Codebase context disabled"
    })

    const index = loadIndex()
    const isCommandRequest = /\b(run|execute|use|call|invoke)\b[\s\S]{0,100}\b(command|\/sz-[a-z0-9-]+)\b/i.test(cleanQuestion)
    const codebaseContext = !includeCodebaseContext || isCommandRequest
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
    const contextPack = includeCodebaseContext
        ? packRepositoryContext(sources, codebaseContext)
        : {
            text: "",
            contextTokens: 0,
            contextBudget: MAX_CONTEXT_TOKENS,
            selectedFiles: [],
            selectedCodeContexts: 0
        }

    emit({
        type: "context",
        activityId: "codebase",
        status: "completed",
        message: includeCodebaseContext ? "Built codebase context" : "Skipped codebase context",
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

    ////////////////////////////////////////////////////////////////////////////////////////

    const imageText = images.map(image => `IMAGE ASSET: ${image.path} (available at ${image.url})`).join("\n")
    const commandTextResult = commandResult ? `\nCOMMAND RESULT (${commandResult.command}):\n${formatResponses(commandResult.responses)}` : ""

    if (!process.env.AI_API_KEY && withAi) {
        emit({ type: "ai", activityId: "request", status: "failed", message: "AI_API_KEY is not configured" })

        return {
            question: cleanQuestion,
            answer: commandResult
                ? formatResponses(commandResult.responses)
                : "AI_API_KEY is not configured. Retrieved relevant code sources are available for inspection.",
            sources: sources.map(({ relativePath, start, end, type, heading, score }) => ({ path: relativePath, start, end, type, heading, score })),
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
            sources: sources.map(({ relativePath, start, end, type, heading, score }) => ({ path: relativePath, start, end, type, heading, score })),
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

    const requestAi = includeTools => {
        throwIfAborted()
        currentRequestInputBreakdown = recordInputBreakdown(includeTools)

        return fetch(endpoint, {
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
            }),
            signal
        })
    }

    const tokenUsage = { input: 0, output: 0, total: 0 }
    const responseState = { rounds: [], accumulatedText: "" }
    const toolResults = []
    const requests = []
    const addUsage = usage => {
        tokenUsage.input += Number(usage?.input || 0)
        tokenUsage.output += Number(usage?.output || 0)
        tokenUsage.total += Number(usage?.total || 0)
    }
    const recordInputBreakdown = includeTools => ({
        systemPrompt: estimateTokenCount(SYSTEM_PROMPT),
        codebaseContext: estimateTokenCount(contextPack.text),
        toolDefinitions: includeTools
            ? estimateTokenCount(JSON.stringify(tools?.definitions || []))
            : 0,
        userInput: estimateTokenCount(`Question:\n${cleanQuestion}\n\nVisual assets:\n${imageText || "No matching visual assets."}${commandTextResult}`),
        dependencies: estimateTokenCount(JSON.stringify(messages.filter(message => message.role === "assistant" || message.role === "tool"))
        ),
        activities: estimateTokenCount(JSON.stringify(activities))
    })
    let currentRequestInputBreakdown = null

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

    let result = await readAiResponse(response, responseState, signal, onToken)

    addUsage(result.usage)
    requests.push({
        input: result.usage.input,
        output: result.usage.output,
        total: result.usage.total,
        inputBreakdown: scaleTokenBreakdown(currentRequestInputBreakdown, result.usage.input),
        outputBreakdown: scaleTokenBreakdown({
            toolCalls: result.toolCalls.length ? estimateTokenCount(JSON.stringify(result.toolCalls)) : 0,
            reasoning: result.toolCalls.length ? estimateOptionalTokenCount(result.answer) : 0,
            response: result.toolCalls.length ? 0 : estimateOptionalTokenCount(result.answer)
        }, result.usage.output)
    })

    let toolRound = 0

    while (result.toolCalls.length && tools?.execute && toolRound < MAX_TOOL_ROUNDS) {
        toolRound += 1
        if (result.answer) {
            emit({
                type: "reasoning",
                activityId: `response-round-${toolRound}`,
                status: "completed",
                message: result.answer,
                metadata: { round: toolRound, kind: "intermediate-reasoning" }
            })
        }
        messages.push({
            role: "assistant",
            content: result.answer || null,
            tool_calls: result.toolCalls
        })

        for (const toolCall of result.toolCalls) {
            let args = {}

            try { args = JSON.parse(toolCall.function?.arguments || "{}") }
            catch { args = {} }

            const toolStartedAt = process.hrtime.bigint()
            const toolResult = await tools.execute(toolCall.function?.name, args, emit, signal)
            const toolDurationMs = Number(process.hrtime.bigint() - toolStartedAt) / 1e6
            const responseCapturedAt = process.hrtime.bigint()
            toolResults.push({
                toolName: toolCall.function?.name,
                arguments: args,
                result: toolResult,
                durationMs: toolDurationMs,
                responseDurationMs: Number(process.hrtime.bigint() - responseCapturedAt) / 1e6
            })

            emit({
                type: "tool",
                activityId: `tool-${toolCall.id}`,
                status: "completed",
                message: `Executed tool ${toolCall.function?.name}`,
                metadata: {
                    toolName: toolCall.function?.name,
                    arguments: args,
                    result: toolResult,
                    durationMs: toolDurationMs,
                    responseDurationMs: Number(process.hrtime.bigint() - responseCapturedAt) / 1e6
                }
            })

            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function?.name,
                content: `LIVE API DATA (current runtime evidence):\n${JSON.stringify(toolResult)}`
            })
        }

        emit({type: "ai", activityId: "request", status: "started", message: "Analysing tool results and generating answer"})

        response = await requestAi(true)

        if (!response.ok) { throw new Error(`AI request failed with ${response.status}`) }

        result = await readAiResponse(response, responseState, signal, onToken)
        addUsage(result.usage)
        requests.push({
            input: result.usage.input,
            output: result.usage.output,
            total: result.usage.total,
            inputBreakdown: scaleTokenBreakdown(currentRequestInputBreakdown, result.usage.input),
            outputBreakdown: scaleTokenBreakdown({
                toolCalls: result.toolCalls.length ? estimateTokenCount(JSON.stringify(result.toolCalls)) : 0,
                reasoning: result.toolCalls.length ? estimateOptionalTokenCount(result.answer) : 0,
                response: result.toolCalls.length ? 0 : estimateOptionalTokenCount(result.answer)
            }, result.usage.output)
        })
    }

    if (result.toolCalls.length) {
        emit({type: "ai", activityId: "request", status: "started", message: "Tool limit reached, generating final answer" })

        messages.push({ role: "system", content: TOOL_CALL_LIMIT })

        response = await requestAi(false)

        if (!response.ok) { throw new Error(`AI final response failed with ${response.status}`) }

        result = await readAiResponse(response, responseState, signal, onToken)
        addUsage(result.usage)
        requests.push({
            input: result.usage.input,
            output: result.usage.output,
            total: result.usage.total,
            inputBreakdown: scaleTokenBreakdown(currentRequestInputBreakdown, result.usage.input),
            outputBreakdown: scaleTokenBreakdown({
                toolCalls: result.toolCalls.length ? estimateTokenCount(JSON.stringify(result.toolCalls)) : 0,
                reasoning: 0,
                response: estimateOptionalTokenCount(result.answer)
            }, result.usage.output)
        })
    }

    const answer = String(result.answer || "").trim() || buildAiFallback(responseState, toolResults)

    requests.forEach(request => {
        if (!request.input) request.input = Object.values(request.inputBreakdown || {}).reduce((sum, value) => sum + value, 0)
        if (!request.output) request.output = Object.values(request.outputBreakdown || {}).reduce((sum, value) => sum + value, 0)
        if (!request.total) request.total = request.input + request.output
    })
    if (!tokenUsage.input) tokenUsage.input = estimateTokenCount(JSON.stringify(messages))
    if (!tokenUsage.output) tokenUsage.output = estimateTokenCount(answer)
    if (!tokenUsage.total) tokenUsage.total = tokenUsage.input + tokenUsage.output
    const inputBreakdown = requests.reduce((breakdown, request) => {
        Object.entries(request.inputBreakdown || {}).forEach(([key, value]) => {
            breakdown[key] = (breakdown[key] || 0) + value
        })
        return breakdown
    }, { systemPrompt: 0, codebaseContext: 0, toolDefinitions: 0, userInput: 0, dependencies: 0, activities: 0 })

    emit({
        type: "ai",
        activityId: "request",
        status: "completed",
        message: `Processed response from AI model ${model}`,
        metadata: {
            inputTokens: tokenUsage.input,
            outputTokens: tokenUsage.output,
            totalTokens: tokenUsage.total,
            inputBreakdown,
            requests
        }
    })

    return {
        answer,
        responseRounds: responseState.rounds.map(round => ({
            text: round.text,
            toolCalls: round.toolCalls.map(toolCall => ({
                id: toolCall.id,
                type: toolCall.type,
                function: { ...toolCall.function }
            }))
        })),
        sources: sources.map(({ relativePath, start, end, type, heading, score }) => ({ path: relativePath, start, end, type, heading, score })),
        images,
        command: commandResult,
        activities,
        trace: activities.map(activity => ({ ...activity })),
        usage: {
            ...tokenUsage,
            inputBreakdown,
            requests
        }
    }
}


module.exports = {
    answerQuestion,
    buildAiFallback,
    readAiResponse,
    normaliseUsage,
    scaleTokenBreakdown
}
