import { useEffect, useState } from "react"

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