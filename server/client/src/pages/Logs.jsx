import { useMemo, useState, useRef } from "react"
import PageShell from "../components/PageShell"
import { useLogStream } from "../components/utils/api"
import "../css/logs.css"

function ansiLine({ number, text, highlightLine}, index) {
    // eslint-disable-next-line no-control-regex
    const tokens = String(text).split(/(\u001b\[[0-9;]*m)/g)
    let className = ""
    const parts = []

    const colours = {
        31: "ansi-red",
        32: "ansi-green",
        33: "ansi-yellow",
        36: "ansi-cyan",
        90: "ansi-muted"
    }

    tokens.forEach((token, tokenIndex) => {
        //eslint-disable-next-line no-control-regex
        const code = token.match(/\u001b\[([0-9;]*)m/)
        if (code) {
            const value = code[1]
            className = value === "0" ? "" : colours[value] || className
        } else if (token) {
            parts.push(
                <span className={className} key={`${index}-${tokenIndex}`}>
                    {token}
                </span>
            )
        }
    })

    return (
        <div
            className={`log-line ${highlightLine === number ? "highlight" : ""}`}
            id={`log-line-${number}`}
            key={index}
        >
            <span className="log-line-number">{number}</span>
            <span className="log-line-text">{parts}</span>
        </div>
    )
}


function Logs() {
    
    const { lines, connected } = useLogStream()
    const [query, setQuery] = useState("")
    const containerRef = useRef(null)
    
    const [highlightLine, setHighlightLine] = useState(null)

    function jumpToLine(num) {
        const el = document.getElementById(`log-line-${num}`)
        if (!el || !containerRef.current) return

        containerRef.current.scrollTo({
            top: el.offsetTop - 20,
            behavior: "smooth"
        })

        setHighlightLine(num)
        setTimeout(() => setHighlightLine(null), 2500)
    }


    const filteredLines = useMemo(() => {
        if (!query) return lines

        const q = query.trim().toLowerCase()

        const rangeMatch = q.match(/^(\d+)\s*-\s*(\d+)$/)
        if (rangeMatch) {
            const start = Number(rangeMatch[1])
            const end = Number(rangeMatch[2])
            return lines.filter(l => l.number >= start && l.number <= end)
        }

        if (/^\d+$/.test(q)) {
            const num = Number(q)
            return lines.filter(l => l.number === num)
        }

        return lines.filter(l =>
            String(l.number).includes(q) ||
            l.text.toLowerCase().includes(q)
        )
    }, [lines, query])

    return (
        <PageShell title="Logs" description="Live Slackzilla server and bot logs">
            <section className="panel">
                <div className="panel-header">
                    <h1>Live Logs</h1>
                    <span className="panel-subtitle">
                        {connected ? "stream connected / 1s" : "stream reconnecting"}
                    </span>
                </div>

                <div className="log-toolbar">
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="filter output..."
                        aria-label="Filter logs"
                        onKeyDown={e => {
                            if (e.key === "Enter") {
                                const q = query.trim()
                                if (/^\d+$/.test(q)) {
                                    const num = Number(q)
                                    setQuery("")
                                    setTimeout(() => jumpToLine(num), 10)
                                }
                            }
                        }}
                    />
                    <a className="button" href="/api/logs/download">download snapshot</a>
                </div>

                <div className="terminal" aria-live="polite" ref={containerRef}>
                    <div className="log-lines">
                        {filteredLines.length
                            ? filteredLines.map((line, i) => ansiLine({ ...line, highlightLine }, i))
                            : <div className="muted">$ waiting for log output...</div>}
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default Logs