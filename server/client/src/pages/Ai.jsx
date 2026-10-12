import { useEffect, useRef, useState } from "react"
import PageShell from "../components/PageShell"
import { streamJson } from "../components/utils/api"
import { activityToMarkdown, markdownToHtml } from "../components/utils/markdown"
import "../css/ai.css"
import "../css/markdown.css"

const AI_SESSION_STORAGE_KEY = "slackzilla.ai.session"
const AI_ACTIVITY_OPEN_STORAGE_KEY = "slackzilla.ai.activity-open"

function getUsage(result, activities) {
    if (result?.usage) return result.usage

    const completedActivity = [...activities].reverse().find(activity =>
        activity.type === "ai" && activity.status === "completed" && activity.metadata
    )

    return {
        input: completedActivity?.metadata?.inputTokens,
        output: completedActivity?.metadata?.outputTokens,
        total: completedActivity?.metadata?.totalTokens
    }
}

function displayTokenCount(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—"
}

function formatDuration(value) {
    const milliseconds = Number(value)
    if (!Number.isFinite(milliseconds)) return ""
    if (milliseconds < 1000) return `${Math.max(0.1, milliseconds).toFixed(1)}ms`
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1).replace(/\.0$/, "")}s`

    const minutes = Math.floor(milliseconds / 60000)
    const seconds = Math.round((milliseconds % 60000) / 1000)
    return `${minutes}m ${seconds}s`
}

async function copyMarkdown(value) {
    const text = String(value || "")
    if (!text) return false

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
    }

    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    textarea.remove()
    return copied
}

function readSavedSession() {
    try {
        return JSON.parse(localStorage.getItem(AI_SESSION_STORAGE_KEY) || "null")
    } catch {
        return null
    }
}

function readActivityOpen() {
    try {
        return localStorage.getItem(AI_ACTIVITY_OPEN_STORAGE_KEY) === "true"
    } catch {
        return false
    }
}

function stringifyTraceValue(value, spacing = 2) {
    try {
        return JSON.stringify(value, null, spacing)
    } catch {
        return String(value)
    }
}

function tracePreview(value, emptyLabel = "(no arguments)") {
    if (value === undefined || value === null || (typeof value === "object" && !Object.keys(value).length)) { return emptyLabel }

    const compact = stringifyTraceValue(value, 0)
    return compact.length > 64 ? `${compact.slice(0, 63)}…` : compact
}

function getThinkingEntries(entries) {
    const completedToolNames = new Set(
        entries
            .filter(entry => entry.type === "tool")
            .map(entry => entry.metadata?.toolName)
            .filter(Boolean)
    )

    return entries.filter(entry => {
        if (entry.type === "reasoning" || entry.type === "commentary") return Boolean(entry.message)
        if (entry.type === "tool") return Boolean(entry.metadata?.toolName)
        if (entry.type === "api_request" && entry.status === "started") { return !completedToolNames.has(entry.activityId) }
        return entry.status === "failed" && (entry.type === "api_request" || entry.type === "command_tool")
    })
}

function Ai() {
    const [savedSession] = useState(readSavedSession)
    const [question, setQuestion] = useState(() => savedSession?.question || "")
    const [result, setResult] = useState(() => savedSession?.result || null)
    const [answer, setAnswer] = useState(() => savedSession?.answer || savedSession?.result?.answer || "")
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const [activities, setActivities] = useState(() => savedSession?.activities || [])
    const [trace, setTrace] = useState(() => savedSession?.trace || savedSession?.result?.trace || [])
    const [thinkingDurationMs, setThinkingDurationMs] = useState(() => savedSession?.thinkingDurationMs || savedSession?.result?.thinkingDurationMs || null)
    const [thinkingOpen, setThinkingOpen] = useState(false)
    const [latestProgress, setLatestProgress] = useState("")
    const [copiedTarget, setCopiedTarget] = useState("")
    const [activityLogOpen, setActivityLogOpen] = useState(readActivityOpen)
    const activityLogRef = useRef(null)
    const requestStartedAtRef = useRef(null)
    const activitiesRef = useRef(savedSession?.activities || [])
    const answerRef = useRef(savedSession?.answer || savedSession?.result?.answer || "")

    useEffect(() => {
        if (activityLogRef.current) activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight
    }, [activities])

    async function ask(event) {
        event.preventDefault()
        if (!question.trim()) return

        setBusy(true)
        setError("")
        setResult(null)
        setAnswer("")
        setActivities([])
        setTrace([])
        setThinkingDurationMs(null)
        setThinkingOpen(true)
        setLatestProgress("Starting request")
        requestStartedAtRef.current = performance.now()
        activitiesRef.current = []
        answerRef.current = ""

        const submittedQuestion = question.trim()

        try {
            await streamJson(
                "/api/ask",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: submittedQuestion })
                },
                (eventName, payload) => {
                    if (eventName === "activity") {
                        activitiesRef.current = [...activitiesRef.current, payload]
                        setActivities(activitiesRef.current)
                        setTrace(currentTrace => [...currentTrace, { ...payload }])
                        setLatestProgress(payload.message || "Working")
                    }
                    if (eventName === "token") {
                        answerRef.current += payload.token || ""
                        setAnswer(answerRef.current)
                    }
                    if (eventName === "complete") {
                        const completedAnswer = payload.answer || answerRef.current
                        const completedActivities = activitiesRef.current
                        const completedThinkingDurationMs = requestStartedAtRef.current === null
                            ? payload.thinkingDurationMs
                            : performance.now() - requestStartedAtRef.current
                        const completedSession = {
                            question: submittedQuestion,
                            answer: completedAnswer,
                            result: payload,
                            activities: completedActivities,
                            trace: payload.trace || activitiesRef.current,
                            thinkingDurationMs: completedThinkingDurationMs,
                            sources: payload.sources || [],
                            images: payload.images || []
                        }

                        setResult(payload)
                        setTrace(payload.trace || activitiesRef.current)
                        setThinkingDurationMs(completedThinkingDurationMs)
                        setAnswer(completedAnswer)
                        answerRef.current = completedAnswer
                        setThinkingOpen(false)
                        try {
                            localStorage.setItem(AI_SESSION_STORAGE_KEY, JSON.stringify(completedSession))
                        } catch {
                            // A storage quota or privacy restriction should not fail a completed answer.
                        }
                    }
                    if (eventName === "error") {
                        setError(payload.error || "The AI request failed")
                        setLatestProgress(payload.error || "The AI request failed")
                        setThinkingOpen(false)
                    }
                }
            )
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy(false)
            setThinkingOpen(false)
        }
    }

    const tokenUsage = getUsage(result, activities)
    const activityMarkdown = activities.map(activityToMarkdown).join("\n\n")
    const thinkingEntries = getThinkingEntries(trace.length ? trace : activities)
    const thinkingToolCount = thinkingEntries.filter(entry => entry.type === "tool").length

    async function handleCopy(value, target) {
        try {
            if (await copyMarkdown(value)) setCopiedTarget(target)
        } catch {
            setCopiedTarget("")
        }
    }

    return (
        <PageShell title="AI Assistant" description="Ask questions about Slackzilla">
            <section className="panel ai-panel">
                <div className="panel-header ai-page-header">
                    <div>
                        <span className="ai-prompt">slackzilla@repo:~$ rag</span>
                        <h1>AI Assistant</h1>
                        <span className="panel-subtitle">repository-aware terminal</span>
                    </div>
                    <span className={`ai-connection${busy ? " is-live" : ""}`}>
                        <span className="ai-connection-dot" /> {busy ? "running" : "ready"}
                    </span>
                </div>

                <div className="panel-body ai-body">
                    <form className="ai-command-form" onSubmit={ask}>
                        <label htmlFor="ai-question"><span>&gt;</span> query</label>
                        <textarea
                            id="ai-question"
                            value={question}
                            onChange={event => setQuestion(event.target.value)}
                            placeholder="How does the /api/ask request flow work?"
                            rows="3"
                            onKeyDown={event => {
                                if (event.ctrlKey && event.key === "Enter") {
                                    event.preventDefault()
                                    event.currentTarget.form.requestSubmit()
                                }
                            }}
                            required
                        />
                        <div className="ai-command-footer">
                            <span>ctrl + enter to run</span>
                            <button className="button ai-submit" type="submit" disabled={busy || !question.trim()}>
                                {busy ? "running..." : "run query"}
                            </button>
                        </div>
                    </form>

                    {error && <p className="error-banner">{error}</p>}

                    <div className="ai-terminal-grid">
                        <details open={activityLogOpen} onToggle={event => {
                            const isOpen = event.currentTarget.open
                            setActivityLogOpen(isOpen)
                            try {
                                localStorage.setItem(AI_ACTIVITY_OPEN_STORAGE_KEY, String(isOpen))
                            } catch {
                                // Activity visibility should still work when storage is unavailable.
                            }
                        }} className="ai-activity-sidebar" aria-live="polite" aria-busy={busy}>
                            <summary>
                                <span>activity.log</span>
                                <span className="ai-activity-summary-actions">
                                    <span>{activities.length} events</span>
                                    <button className="ai-copy-button" type="button" disabled={!activityMarkdown} onClick={event => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        handleCopy(activityMarkdown, "activity")
                                    }}>
                                        {copiedTarget === "activity" ? "copied" : "copy markdown"}
                                    </button>
                                </span>
                            </summary>
                            <div className="ai-activity-log" ref={activityLogRef}>
                                {activities.length === 0 && <p className="ai-activity-empty">Waiting for query execution...</p>}
                                {activities.map(activity => <article className="ai-activity-entry" key={activity.id || `${activity.timestamp}-${activity.message}`}>
                                    <div className="markdown-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(activityToMarkdown(activity)) }} />
                                </article>)}
                            </div>
                        </details>

                        <section className="ai-terminal-pane ai-output-pane">
                            <div className="ai-pane-header">
                                <h2>response.md</h2>
                                <div className="ai-pane-actions">
                                    <span>{result?.sources?.length || 0} sources</span>
                                    <button className="ai-copy-button" type="button" disabled={!answer} onClick={() => handleCopy(answer, "response")}>
                                        {copiedTarget === "response" ? "copied" : "copy markdown"}
                                    </button>
                                </div>
                            </div>
                            <div className="ai-answer">
                                {(thinkingEntries.length > 0 || busy) && <>
                                    <details className="ai-thinking" open={thinkingOpen} onToggle={event => setThinkingOpen(event.currentTarget.open)} aria-live="polite" aria-busy={busy}>
                                        <summary>
                                            <span>{busy ? "Thinking" : "Thought"} {thinkingToolCount} {thinkingToolCount === 1 ? "tool" : "tools"}{!busy && formatDuration(thinkingDurationMs) ? ` (${formatDuration(thinkingDurationMs)})` : ""}</span>
                                        </summary>
                                        <div className="ai-thinking-trace">
                                            {busy && <p className="ai-thinking-progress">{latestProgress || "Working"}</p>}
                                            {thinkingEntries.map((entry, index) => {
                                                if (entry.type === "reasoning" || entry.type === "commentary") {
                                                    return <p className="ai-trace-reasoning" key={entry.id || `${entry.timestamp}-${index}`}>{entry.message}</p>
                                                }

                                                if (entry.type !== "tool") {
                                                    return <p className="ai-trace-failure" key={entry.id || `${entry.timestamp}-${index}`}>{entry.message}</p>
                                                }

                                                const toolName = entry.metadata.toolName
                                                const argumentsValue = entry.metadata.arguments || {}
                                                const responseValue = entry.metadata.result
                                                const failed = entry.status === "failed" || responseValue?.success === false || Boolean(responseValue?.error)
                                                const key = entry.id || `${entry.timestamp}-${index}`

                                                return <article className={`ai-trace-tool${failed ? " is-failed" : ""}`} key={key}>
                                                    <details className="ai-trace-disclosure">
                                                        <summary>Ran tool <code>{toolName}</code> with args <span className="ai-trace-preview">{tracePreview(argumentsValue)}</span>{formatDuration(entry.metadata.durationMs) && <span className="ai-trace-time">({formatDuration(entry.metadata.durationMs)})</span>}</summary>
                                                        <pre><code className="language-json">{stringifyTraceValue(argumentsValue)}</code></pre>
                                                    </details>
                                                    <details className="ai-trace-disclosure">
                                                        <summary>Captured response from <code>{toolName}</code> <span className="ai-trace-preview">{tracePreview(responseValue, "(waiting for response…)")}</span> <span className="ai-trace-status">{failed ? "Error" : "Success"}</span>{formatDuration(entry.metadata.responseDurationMs) && <span className="ai-trace-time">({formatDuration(entry.metadata.responseDurationMs)})</span>}</summary>
                                                        <pre><code className="language-json">{stringifyTraceValue(responseValue ?? { status: "running" })}</code></pre>
                                                    </details>
                                                </article>
                                            })}
                                        </div>
                                    </details>
                                </>}
                                {answer
                                    ? <div className="markdown-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(answer) }} />
                                    : (busy ? "Generating response..." : "No response yet.")}
                                {busy && <span className="ai-cursor" />}
                            </div>
                            <div className="ai-token-stats" aria-label="Token usage">
                                <div><span>input tokens</span><strong>{displayTokenCount(tokenUsage.input)}</strong></div>
                                <div><span>output tokens</span><strong>{displayTokenCount(tokenUsage.output)}</strong></div>
                                <div><span>total tokens</span><strong>{displayTokenCount(tokenUsage.total)}</strong></div>
                            </div>
                            {result?.sources?.length > 0 && <div className="ai-sources">
                                <h3>sources</h3>
                                {result.sources.map(source => <div className="ai-source" key={`${source.path}-${source.start}`}><code>{source.path}:{source.start}</code><span>{source.score}</span></div>)}
                            </div>}
                            {result?.images?.length > 0 && <div className="ai-images">
                                <h3>visual assets</h3>
                                <div className="ai-image-grid">
                                    {result.images.map(image => <figure key={image.path} className="ai-image-card">
                                        <img src={image.url} alt={`Repository asset ${image.path}`} />
                                        <figcaption><code>{image.path}</code></figcaption>
                                    </figure>)}
                                </div>
                            </div>}
                        </section>

                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default Ai
