import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "../../components/PageShell"
import { getCsrfToken, getJson } from "../../components/utils/api"
import "../../css/admin/base.css"
import "../../css/admin/events.css"
import "../../css/admin/errors.css"

function formatTime(value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "time unavailable" : date.toLocaleString()
}

function AdminErrors() {
    const [errors, setErrors] = useState([])
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState(() => new Set())
    const [expanded, setExpanded] = useState(() => {
        const selectedGroup = new URLSearchParams(window.location.search).get("error")
        return selectedGroup ? new Set([selectedGroup]) : new Set()
    })
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)

    const refresh = () => getJson("/api/admin/errors").then(result => setErrors(result.errors || []))

    useEffect(() => {
        refresh().catch(error => setMessage(error.message))
        const stream = new EventSource("/api/admin/errors/stream")
        stream.addEventListener("snapshot", event => setErrors(JSON.parse(event.data).errors || []))
        stream.addEventListener("server_error", () => refresh().catch(() => {}))
        stream.onerror = () => setMessage("error stream reconnecting")
        return () => stream.close()
    }, [])

    const groups = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        return errors.filter(group => !normalized || [group.name, group.message, group.firstSeen, group.lastSeen, ...group.occurrences.map(occurrence => `${occurrence.source} ${occurrence.time}`)].join(" ").toLowerCase().includes(normalized))
    }, [errors, query])

    const filteredIds = useMemo(() => groups.flatMap(group => group.occurrences.map(occurrence => occurrence.id)), [groups])

    async function control(action, payload, confirmation) {
        if (confirmation && !window.confirm(confirmation)) return
        setBusy(true)
        try {
            const csrf = await getCsrfToken()
            await getJson("/api/admin/control", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
                body: JSON.stringify({ action, csrf, confirmed: true, ...payload })
            })
            setSelected(new Set())
            await refresh()
        } catch (requestError) {  setMessage(requestError.message)}
        finally {setBusy(false)}
    }

    function toggleGroup(id) {
        setExpanded(current => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleOccurrence(id) {
        setSelected(current => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleGroupSelection(group) {
        const groupSelected = group.occurrences.every(occurrence => selected.has(occurrence.id))
        setSelected(current => {
            const next = new Set(current)
            group.occurrences.forEach(occurrence => groupSelected ? next.delete(occurrence.id) : next.add(occurrence.id))
            return next
        })
    }

    async function copyStack(stack) {
        try {
            await navigator.clipboard.writeText(stack || "")
            setMessage("Stack trace copied.")
        } catch {
            setMessage("Could not copy the stack trace.")
        }
    }

    return (
        <PageShell title="Server Errors" description="Authenticated server error debugger">
            <section className="panel admin-error-page">
                <div className="panel-header">
                    <div><h1>Server Error Debugger</h1><p className="panel-description">Expand a group to inspect its shared stack trace and occurrence history. <Link to="/admin/logs">Open log controls.</Link></p></div>
                    <Link className="button" to="/admin">back to admin</Link>
                </div>
                <div className="panel-body">
                    <div className="admin-error-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="search error message, source..." aria-label="Search server errors" /><span>{filteredIds.length} occurrences · {groups.length} groups</span></div>
                    <div className="history-bulk-toolbar history-bulk-toolbar--errors">
                        <span>{selected.size} selected</span>
                        <button className="button" disabled={busy || !selected.size} onClick={() => control("delete-errors", { ids: [...selected] }, `Delete ${selected.size} selected error${selected.size === 1 ? "" : "s"}?`)}>Delete selected</button>
                        <button className="button action-stop" disabled={busy || !filteredIds.length} onClick={() => control("delete-errors", { ids: filteredIds }, `Delete all ${filteredIds.length} matching error${filteredIds.length === 1 ? "" : "s"}?`)}>Delete all matching ({filteredIds.length})</button>
                    </div>
                    {message && <p className="error-banner">{message}</p>}
                    <div className="admin-error-list">
                        {groups.length ? groups.map(group => {
                            const open = expanded.has(group.id)
                            const groupSelected = group.occurrences.every(occurrence => selected.has(occurrence.id))
                            return (
                                <article className="admin-error-card" key={group.id}>
                                    <div className="admin-error-card__header">
                                        <button className="admin-error-card__summary" onClick={() => toggleGroup(group.id)} aria-expanded={open}><strong>{group.message || "Unknown server error"}</strong><span>{group.name} · {group.count} occurrence{group.count === 1 ? "" : "s"} · last seen {formatTime(group.lastSeen)}</span></button>
                                        <label className="history-select"><input type="checkbox" checked={groupSelected} onChange={() => toggleGroupSelection(group)} /> select</label>
                                        <button className="button" disabled={busy} onClick={event => { event.stopPropagation(); control("delete-error-group", { groupId: group.id }, `Delete all ${group.count} occurrences in this error group?`) }}>Delete group</button>
                                    </div>
                                    {open && <div className="admin-error-card__details"><div className="stack-header"><span>shared stack trace</span><button className="button" onClick={event => { event.stopPropagation(); copyStack(group.stack) }}>Copy stack</button></div><pre>{group.stack}</pre><div className="history-occurrence-list">{group.occurrences.map(occurrence => <div className="history-occurrence-row" key={occurrence.id} onClick={() => toggleOccurrence(occurrence.id)}><input type="checkbox" checked={selected.has(occurrence.id)} onClick={event => event.stopPropagation()} onChange={() => toggleOccurrence(occurrence.id)} /><time>{formatTime(occurrence.time)}</time><code>{occurrence.source || "unknown source"}</code><button className="button" disabled={busy} onClick={event => { event.stopPropagation(); control("delete-error", { id: occurrence.id }, "Delete this error occurrence?") }}>Delete</button></div>)}</div></div>}
                                </article>
                            )
                        }) : <p className="muted">No matching server errors.</p>}
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default AdminErrors
