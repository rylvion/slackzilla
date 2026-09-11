import { useEffect, useMemo, useRef, useState } from "react"
import PageShell from "../components/PageShell"
import { useLogStream } from "../components/utils/api"
import "../css/logs.css"
import ansiLine from "../components/logs/ansi-handler"
import {isAtBottom, scrollToBottom, jumpToLine, jumpBy} from "../components/logs/logs-utils"

function Logs() {
    const { lines, connected } = useLogStream()
    const [query, setQuery] = useState("")
    const [highlightLine, setHighlightLine] = useState(null)
    const [newLines, setNewLines] = useState(new Set())

    const containerRef = useRef(null)
    const previousLinesRef = useRef(null)
    const initialScrollRef = useRef(true)
    const wasAtBottomRef = useRef(true)
    const urlLineRef = useRef(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)

        const q = params.get("q")
        if (q) {
            queueMicrotask(() => setQuery(q))
        }
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)

        if (!query) {
            params.delete("q")
        } else {
            params.set("q", query)
        }

        const newUrl = `${window.location.pathname}?${params.toString()}`
        window.history.replaceState({}, "", newUrl)
    }, [query])

    useEffect(() => {
        if (!lines.length) return
        if (previousLinesRef.current === null) {
            previousLinesRef.current = lines

            requestAnimationFrame(() => {
                const urlParams = new URLSearchParams(window.location.search)
                const lineParam = urlParams.get("line")
                const line = Number(lineParam)

                if (Number.isInteger(line) && line > 0) {
                    urlLineRef.current = true
                    jumpToLine(containerRef.current, lines, line, setHighlightLine)
                } else {
                    scrollToBottom(containerRef.current, false)
                }

                initialScrollRef.current = false
            })

            return
        }

        const previousNumbers = new Set(
            previousLinesRef.current.map((line) => line.number),
        )

        const addedLines = lines
            .filter((line) => !previousNumbers.has(line.number))
            .map((line) => line.number)

        if (addedLines.length) {
            setNewLines((current) => {
                const next = new Set(current)

                for (const number of addedLines) {
                    next.add(number)
                }

                return next
            })

            setTimeout(() => {
                setNewLines((current) => {
                    const next = new Set(current)

                    for (const number of addedLines) {
                        next.delete(number)
                    }

                    return next
                })
            }, 3000)
        }

        previousLinesRef.current = lines

        if (wasAtBottomRef.current) {
            requestAnimationFrame(() => {
                scrollToBottom(containerRef.current, false)
            })
        }
    }, [lines])

    function handleScroll() {
        wasAtBottomRef.current = isAtBottom(containerRef.current)
    }

    const filteredLines = useMemo(() => {
        if (!query) return lines

        const q = query.trim().toLowerCase()

        const rangeMatch = q.match(/^(\d+)\s*-\s*(\d+)$/)

        if (rangeMatch) {
            const start = Number(rangeMatch[1])
            const end = Number(rangeMatch[2])

            return lines.filter(
                (line) => line.number >= start && line.number <= end,
            )
        }

        if (/^\d+$/.test(q)) {
            const num = Number(q)

            return lines.filter((line) => line.number === num)
        }

        return lines.filter(
            (line) =>
                String(line.number).includes(q) ||
                line.text.toLowerCase().includes(q),
        )
    }, [lines, query])

    return (
        <PageShell title="Logs" description="Live Slackzilla server and bot logs" >
            <section className="panel">
                <div className="panel-header">
                    <h1>Live Logs</h1>

                    <span className="panel-subtitle">
                        {connected
                            ? "stream connected / 1s"
                            : "stream reconnecting"}
                    </span>
                </div>

                <div className="log-toolbar">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="filter output..."
                        aria-label="Filter logs"
                        onKeyDown={(event) => {
                            if (event.key !== "Enter") return

                            const q = query.trim()

                            if (/^\d+$/.test(q)) {
                                const num = Number(q)

                                setQuery("")

                                setTimeout(() => {jumpToLine(containerRef.current, lines, num, setHighlightLine)}, 10)
                            }
                        }}
                    />

                    <a className="button" href="/api/logs/download">
                        download snapshot
                    </a>
                </div>

                <div
                    className="terminal"
                    aria-live="polite"
                    ref={containerRef}
                    onScroll={handleScroll}
                >
                    <div className="log-lines">
                        {filteredLines.length ? (
                            filteredLines.map((line, i) =>
                                ansiLine(
                                    {
                                        ...line,
                                        highlightLine,
                                        highlighted: newLines.has(line.number),
                                    },
                                    i,
                                ),
                            )
                        ) : (
                            <div className="muted">
                                $ waiting for log output...
                            </div>
                        )}
                    </div>
                </div>

                <div className="log-navigation">
                    <button className="button" onClick={() => jumpToLine(containerRef.current, lines, lines[0]?.number, setHighlightLine)} disabled={!lines.length}>first</button>
                    <button className="button" onClick={() => jumpBy(containerRef.current, lines, -100, (num) => jumpToLine(containerRef.current, lines, num, setHighlightLine))} disabled={!lines.length}>prev 100</button>
                    <button className="button"onClick={() => jumpBy(containerRef.current, lines, 100, (num) => jumpToLine(containerRef.current, lines, num, setHighlightLine))} disabled={!lines.length}>next 100</button>
                    <button className="button" onClick={() => scrollToBottom(containerRef.current)} disabled={!lines.length}>latest</button>
                </div>
            </section>
        </PageShell>
    )
}

export default Logs
