import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "../../components/PageShell"
import { getJson } from "../../components/utils/api"
import "../../css/admin/base.css"
import "../../css/admin/errors.css"

function formatTime(value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "time unavailable" : date.toLocaleString()
}

function AdminErrors() {
    const [errors, setErrors] = useState([])
    const [query, setQuery] = useState("")
    const [expanded, setExpanded] = useState(() => {
        const selected = new URLSearchParams(window.location.search).get("error")
        return selected ? new Set([selected]) : new Set()
    })
    const [message, setMessage] = useState("")

    useEffect(() => {
        getJson("/api/admin/errors").then(result => setErrors(result.errors || [])).catch(error => setMessage(error.message))
        const stream = new EventSource("/api/admin/errors/stream")
        stream.addEventListener("snapshot", event => setErrors(JSON.parse(event.data).errors || []))
        stream.addEventListener("server_error", event => setErrors(current => [JSON.parse(event.data), ...current].slice(0, 200)))
        stream.onerror = () => setMessage("error stream reconnecting")
        return () => stream.close()
    }, [])

    const groups = useMemo(() => {
        const normalised = query.trim().toLowerCase()
        const map = new Map()
        for (const error of errors) {
            const haystack = [error.name, error.source, error.message, error.time].join(" ").toLowerCase()
            if (normalised && !haystack.includes(normalised)) continue
            const key = error.message || "Unknown server error"
            const group = map.get(key) || { key, errors: [] }
            group.errors.push(error)
            map.set(key, group)
        }
        return [...map.values()]
    }, [errors, query])

    function toggle(key) {
        setExpanded(current => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    return (
        <PageShell title="Server Errors" description="Authenticated server error debugger" active="admin-login">
            <section className="panel admin-error-page">
                <div className="panel-header">
                        <div><h1>Server Error Debugger</h1><p className="panel-description">Full stack traces are available by expanding an error group. <Link to="/admin/logs">Open log controls.</Link></p></div>
                    <Link className="button" to="/admin">back to admin</Link>
                </div>
                <div className="panel-body">
                    <div className="admin-error-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="search error message, source..." aria-label="Search server errors" /><span>{groups.length} matching errors</span></div>
                    {message && <p className="error-banner">{message}</p>}
                    <div className="admin-error-list">
                        {groups.length 
                            ? groups.map(group => {
                            const open = expanded.has(group.key)
                            const first = group.errors[0]
                            return (
                                <article className="admin-error-card" key={group.key}>
                                    <button className="admin-error-card__summary" onClick={() => toggle(group.key)} aria-expanded={open}>
                                        <strong>{group.errors.length > 1 ? `(${group.errors.length}) ` : ""}{group.key}</strong>
                                        <span>{first.source} · {formatTime(first.time)}</span>
                                    </button>
                                    {open && <div className="admin-error-card__details">{group.errors.map((error, index) => <div className="admin-error-instance" key={`${error.id || error.time}-${index}`}><div><b>{error.name}</b><span>{error.source} · {formatTime(error.time)}</span></div><pre>{error.stack}</pre></div>)}</div>}
                                </article>
                            )}) 
                            : <p className="muted">No matching server errors.</p>
                        }
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default AdminErrors
