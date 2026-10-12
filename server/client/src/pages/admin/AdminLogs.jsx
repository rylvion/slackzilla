import { useEffect, useMemo, useRef, useState } from "react"
import PageShell from "../../components/PageShell"
import { getCsrfToken, getJson, useLogStream } from "../../components/utils/api"
import ansiLine from "../../components/logs/ansi-handler"
import { isAtBottom, scrollToBottom, jumpToLine, jumpBy } from "../../components/logs/logs-utils"

import "../../css/shared/logs/log-terminal.css"
import "../../css/logs.css"
import "../../css/admin/base.css"

function AdminLogs() {
    const { lines, connected } = useLogStream()
    const [query, setQuery] = useState("")
    const [highlightLine, setHighlightLine] = useState(null)
    const [start, setStart] = useState("")
    const [end, setEnd] = useState("")
    const [line, setLine] = useState("")
    const [count, setCount] = useState("100")
    const [busy, setBusy] = useState("")
    const [message, setMessage] = useState("")
    const containerRef = useRef(null)
    const wasAtBottomRef = useRef(true)
    async function control(action, payload, confirmation) {
        const token = await getCsrfToken().catch(() => null)
        if (!token || (confirmation && !window.confirm(confirmation))) return
        setBusy(action)
        try {
            await getJson("/api/admin/control", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ action, csrf: token, confirmed: true, ...payload }) })
            setMessage(`[SUCCESS] ${action} completed`)
        } catch (error) {
            setMessage(`[ERROR] ${action}: ${error.message}`)
        } finally { setBusy("") }
    }

    useEffect(() => {
        if (lines.length && wasAtBottomRef.current) requestAnimationFrame(() => scrollToBottom(containerRef.current, false))
    }, [lines])

    const filteredLines = useMemo(() => {
        if (!query) return lines
        const value = query.toLowerCase()
        return lines.filter(item => String(item.number).includes(value) || item.text.toLowerCase().includes(value))
    }, [lines, query])

    return <PageShell title="Admin Logs" description="Authenticated log viewer" active="admin-login">
        <section className="panel">
            <div className="panel-header"><div><h1>Logs</h1><p className="panel-description">Public log viewer. Administrative controls are on the Admin page.</p></div><span className="panel-subtitle">{connected ? "stream connected / 1s" : "stream reconnecting"}</span></div>
            <div className="log-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="filter output..." aria-label="Filter logs" /><a className="button" href="/api/logs/download">download snapshot</a></div>
            <div className="terminal" ref={containerRef} onScroll={() => { wasAtBottomRef.current = isAtBottom(containerRef.current) }}><div className="log-lines">{filteredLines.length ? filteredLines.map((item, index) => ansiLine({ ...item, highlightLine }, index)) : <div className="muted">$ waiting for log output...</div>}</div></div>
            <div className="log-navigation"><button className="button" onClick={() => jumpToLine(containerRef.current, lines, lines[0]?.number, setHighlightLine)} disabled={!lines.length}>first</button><button className="button" onClick={() => jumpBy(containerRef.current, lines, -100, number => jumpToLine(containerRef.current, lines, number, setHighlightLine))} disabled={!lines.length}>prev 100</button><button className="button" onClick={() => jumpBy(containerRef.current, lines, 100, number => jumpToLine(containerRef.current, lines, number, setHighlightLine))} disabled={!lines.length}>next 100</button><button className="button" onClick={() => scrollToBottom(containerRef.current)} disabled={!lines.length}>latest</button></div>
        </section>
        <section className="panel admin-controls-panel"><div className="panel-header"><h2>Line controls</h2><span className="panel-subtitle">backup and rotation controls are on Admin</span></div><div className="panel-body admin-log-controls">
            {message && <p className={message.startsWith("[SUCCESS]") ? "success-banner" : "error-banner"}>{message}</p>}
            <button className="button action-stop" disabled={Boolean(busy)} onClick={() => control("delete-log", {}, "Delete the entire log file? This cannot be undone.")}>delete entire log</button>
            <div><label>Delete lines</label><input type="number" min="1" value={start} onChange={event => setStart(event.target.value)} placeholder="from" /><input type="number" min="1" value={end} onChange={event => setEnd(event.target.value)} placeholder="to" /><button className="button action-stop" disabled={Boolean(busy || !start || !end)} onClick={() => control("delete-lines", { start, end }, "Delete this exact range of log lines?")}>delete range</button></div>
            <div><label>Delete last</label><input type="number" min="1" value={count} onChange={event => setCount(event.target.value)} /><button className="button action-stop" disabled={Boolean(busy || !count)} onClick={() => control("delete-last", { count }, "Delete the latest log lines?")}>delete latest</button></div>
            <div><label>Delete line</label><input type="number" min="1" value={line} onChange={event => setLine(event.target.value)} placeholder="line number" /><button className="button action-stop" disabled={Boolean(busy || !line)} onClick={() => control("delete-line", { line }, "Delete this exact log line?")}>delete line</button></div>
        </div></section>
    </PageShell>
}

export default AdminLogs
