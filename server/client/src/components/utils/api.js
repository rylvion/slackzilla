import { createContext, createElement, useContext, useEffect, useState } from "react"

let sessionRequest = null
let sessionState = { session: null, loading: true, error: null }
let sessionStateAvailable = false
const sessionListeners = new Set()
const SessionContext = createContext(null)

function publishSessionState(nextState) {
    sessionState = nextState
    sessionStateAvailable = true
    sessionListeners.forEach(listener => listener(sessionState))
}

function subscribeToSession(listener) {
    sessionListeners.add(listener)
    if (sessionStateAvailable) listener(sessionState)
    return () => sessionListeners.delete(listener)
}

function fetchSession() {
    const request = getJson("/api/session")
    sessionRequest = request

    request.then(result => {
        if (sessionRequest !== request) return
        publishSessionState({ session: result, loading: false, error: null })
    }).catch(error => {
        if (sessionRequest !== request) return
        sessionRequest = null
        publishSessionState({
            session: { authenticated: false, csrfToken: null, session: null },
            loading: false,
            error
        })
    })

    return request
}

export function getSession() {
    if (sessionRequest) return sessionRequest
    if (sessionStateAvailable) return Promise.resolve(sessionState.session)

    publishSessionState({ session: null, loading: true, error: null })
    return fetchSession()
}

export function refreshSession() {
    sessionRequest = null
    publishSessionState({ session: null, loading: true, error: null })
    return fetchSession()
}

export function invalidateSession() {
    sessionRequest = null
    publishSessionState({
        session: { authenticated: false, csrfToken: null, session: null },
        loading: false,
        error: null
    })
}

export async function getCsrfToken() {
    const result = await getSession()
    return result?.authenticated ? result.csrfToken : null
}

export function SessionProvider({ children }) {
    const [state, setState] = useState({ session: null, loading: true, error: null })

    useEffect(() => {
        const unsubscribe = subscribeToSession(setState)

        getSession().catch(() => {})

        return unsubscribe
    }, [])

    return createElement(SessionContext.Provider, {
        value: {
            session: state.session,
            loading: state.loading,
            authenticated: Boolean(state.session?.authenticated),
            csrfToken: state.session?.csrfToken || null
        }
    }, children)
}

export function useSession() {
    const context = useContext(SessionContext)

    if (!context) throw new Error("useSession must be used within SessionProvider")

    return context
}

export async function getJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        },
        ...options
    })

    const text = await response.text()

    let body = null

    if (text.trim()) {
        try {
            body = JSON.parse(text)
        } catch {
            throw new Error(
                `Expected JSON response but received invalid JSON (${response.status})`
            )
        }
    }

    if (!response.ok || body?.ok === false) {
        throw new Error(
            body?.error || `Request failed with ${response.status}`
        )
    }

    return body?.data ?? body
}

export async function streamJson(url, options = {}, onEvent = () => {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "text/event-stream",
            ...(options.headers || {})
        }
    })

    if (!response.ok) {
        const text = await response.text()
        let body = null

        try { body = JSON.parse(text) }
        catch { /* The server may return plain text for transport errors. */ }

        throw new Error(body?.error || `Request failed with ${response.status}`)
    }

    if (!response.body) throw new Error("Streaming response is not supported by this browser")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const processEvent = rawEvent => {
        const lines = rawEvent.split(/\r?\n/)
        const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim() || "message"
        const data = lines
            .filter(line => line.startsWith("data:"))
            .map(line => line.slice(5).trim())
            .join("\n")

        if (!data) return

        try { onEvent(event, JSON.parse(data)) }
        catch { onEvent(event, data) }
    }

    while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() || ""
        events.forEach(processEvent)

        if (done) break
    }

    if (buffer.trim()) processEvent(buffer)
}

export function useStatusStream(initial = {}) {
    const [status, setStatus] = useState(initial || {})
    const [connected, setConnected] = useState(false)

    useEffect(() => {
        let alive = true
        const stream = new EventSource("/api/status/stream")

        stream.addEventListener("status", event => {
            if (!alive) return
            setStatus(JSON.parse(event.data))
            setConnected(true)
        })
        stream.addEventListener("summary", event => {
            if (!alive) return
            setStatus(current => ({ ...current, ...JSON.parse(event.data) }))
        })
        stream.onerror = () => {
            if (alive) setConnected(false)
        }

        return () => {
            alive = false
            stream.close()
        }
    }, [])

    return { status, connected }
}

export function useLogStream() {
    const [lines, setLines] = useState([])
    const [connected, setConnected] = useState(false)
    const [lineNumber, setLineNumber] = useState(0)

    useEffect(() => {
        let alive = true
        const stream = new EventSource("/api/logs/stream")

        stream.addEventListener("snapshot", event => {
            if (!alive) return

            const rawLines = JSON.parse(event.data).lines || []

            const numbered = rawLines.map((text, i) => ({
                number: i + 1,
                text
            }))

            setLines(numbered)
            setLineNumber(rawLines.length)
            setConnected(true)
        })

        stream.addEventListener("log", event => {
            if (!alive) return

            const text = JSON.parse(event.data).line

            setLineNumber(n => n + 1)

            setLines(current => [
                ...current,
                { number: lineNumber + 1, text }
            ].slice(-500))
        })

        stream.onerror = async () => {
            if (!alive) return
            setConnected(false)

            try {
                const res = await fetch("/slackzilla.log")
                if (res.ok) {
                    const text = await res.text()
                    const rawLines = text.split("\n")

                    const numbered = rawLines.map((line, i) => ({
                        number: i + 1,
                        text: line
                    }))

                    setLines(numbered.slice(-500))
                    setLineNumber(rawLines.length)
                }
            } catch (err) {
                console.error("fallback log load failed", err)
            }
        }

        return () => {
            alive = false
            stream.close()
        }
    }, [lineNumber])

    return { lines, connected }
}

export function formatBytes(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "unavailable"
    const units = ["B", "KB", "MB", "GB", "TB"]
    let amount = Number(value)
    let index = 0

    while (amount >= 1024 && index < units.length - 1) {
        amount /= 1024
        index += 1
    }

    return `${amount.toFixed(index ? 1 : 0)} ${units[index]}`
}

export function formatRate(value) {
    return value === null || value === undefined ? "unavailable" : `${formatBytes(value)}/s`
}

export function useTelemetryStream(initial = {}) {
    const [telemetry, setTelemetry] = useState(initial || {})
    const [connected, setConnected] = useState(false)

    useEffect(() => {
        let alive = true
        const stream = new EventSource("/api/telemetry/stream")

        stream.addEventListener("telemetry", event => {
            if (!alive) return
            setTelemetry(JSON.parse(event.data))
            setConnected(true)
        })
        stream.onerror = () => {
            if (alive) setConnected(false)
        }

        return () => {
            alive = false
            stream.close()
        }
    }, [])

    return { telemetry, connected }
}
