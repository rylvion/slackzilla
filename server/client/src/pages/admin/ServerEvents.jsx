import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "../../components/PageShell"
import { getCsrfToken, getJson } from "../../components/utils/api"
import "../../css/admin/base.css"
import "../../css/admin/events.css"

function formatEventTime(timestamp) {
    if (!timestamp) return "time unavailable"
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? "time unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
}

function eventPriority(event) {
    const status = Number(event.statusCode)
    if (status >= 500) return 3
    if (status >= 400) return 2
    return 1
}

function ServerEvents() {
    const [events, setEvents] = useState([])
    const [selected, setSelected] = useState(() => new Set())
    const [error, setError] = useState("")
    const [query, setQuery] = useState("")
    const [level, setLevel] = useState("all")
    const [busy, setBusy] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState(() => new Set())

    const refresh = () => getJson("/api/admin/events?limit=1000").then(result => setEvents(result.events || []))
    useEffect(() => { refresh().catch(requestError => setError(requestError.message))}, [])

    const filteredEvents = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        return [...events].sort((a, b) => eventPriority(b) - eventPriority(a) || new Date(b.occurrences?.[0]?.time || 0) - new Date(a.occurrences?.[0]?.time || 0)).filter(event => {
            const status = Number(event.statusCode)
            if (level === "critical" && status < 400) return false
            if (level === "ok" && status >= 400) return false
            if (!normalizedQuery) return true
            return [event.method, event.path, event.type, event.statusCode, ...event.occurrences.map(occurrence => `${occurrence.source} ${occurrence.time}`)].join(" ").toLowerCase().includes(normalizedQuery)
        })
    }, [events, level, query])

    const filteredIds = useMemo(() => filteredEvents.flatMap(event => event.occurrences.map(occurrence => occurrence.id)), [filteredEvents])
    const selectedCount = selected.size

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
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy(false)
        }
    }

    function toggleGroup(id) {
        setExpandedGroups(current => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function toggleSelected(id) {
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

    return (
        <PageShell title="Server Events" description="Full authenticated server event history">
            <section className="panel server-events-page">
                <div className="panel-header">
                    <div><h1>Server Events</h1><p className="panel-description">Critical responses are pinned above normal traffic. Similar events are bundled together.</p></div>
                    <span className="panel-subtitle">{events.reduce((total, group) => total + group.count, 0)} recorded</span>
                </div>
                <div className="panel-body">
                    <div className="server-events-filters">
                        <label htmlFor="server-event-search">Search events</label>
                        <input id="server-event-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="path, method, status, type..." />
                        <label htmlFor="server-event-level">Show</label>
                        <select id="server-event-level" value={level} onChange={event => setLevel(event.target.value)}>
                            <option value="all">All events</option><option value="critical">Critical only</option><option value="ok">Successful only</option>
                        </select>
                        <span className="server-events-filter-count">{filteredIds.length} occurrences shown</span>
                    </div>
                    <div className="history-bulk-toolbar">
                        <span>{selectedCount} selected</span>
                        <button className="button" disabled={busy || !selectedCount} onClick={() => control("delete-events", { ids: [...selected] }, `Delete ${selectedCount} selected event${selectedCount === 1 ? "" : "s"}?`)}>Delete selected</button>
                        <button className="button action-stop" disabled={busy || !filteredIds.length} onClick={() => control("delete-events", { ids: filteredIds }, `Clear all ${filteredIds.length} filtered event${filteredIds.length === 1 ? "" : "s"}?`)}>Clear filtered ({filteredIds.length})</button>
                    </div>
                    {error && <div className="error-banner">{error} <Link to="/admin/login">sign in</Link></div>}
                    {!error && !filteredEvents.length && <p className="muted">No matching server events.</p>}
                    <div className="server-events-table">
                        {filteredEvents.map(group => {
                            const critical = Number(group.statusCode) >= 400
                            const expanded = expandedGroups.has(group.id)
                            const groupSelected = group.occurrences.every(occurrence => selected.has(occurrence.id))
                            return (
                                <div className="server-event-group" key={group.id} onClick={event => {
                                    if (event.target.closest("button, input, label, .history-occurrence-row")) return
                                    toggleGroup(group.id)
                                }}>
                                    <article className={`server-event-row ${critical ? "server-event-row--critical" : ""} ${group.count > 1 ? "server-event-row--grouped" : ""}`}>
                                        <button className="server-event-row__toggle" onClick={() => toggleGroup(group.id)} aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} event group`}>{expanded ? "−" : "+"}</button>
                                        <div className="server-event-row__status"><strong>{group.statusCode || "--"}</strong><span>{critical ? "CRITICAL" : "OK"}</span></div>
                                        <button className="server-event-row__main" onClick={() => toggleGroup(group.id)}><code>{group.method || "?"} {group.path || "unknown path"}</code><time>{formatEventTime(group.occurrences[0]?.time)}</time></button>
                                        <span className="server-event-row__type">{group.type || "request"} · {group.count}</span>
                                        <label className="history-select"><input type="checkbox" checked={groupSelected} onChange={() => toggleGroupSelection(group)} /> select</label>
                                        <button className="button" disabled={busy} onClick={event => { event.stopPropagation(); control("delete-event-group", { groupId: group.id }, `Delete all ${group.count} occurrences in this event group?`) }}>Delete group</button>
                                    </article>
                                    {expanded && <div className="server-event-group__details" onClick={event => event.stopPropagation()}>{group.occurrences.map(occurrence => <div className="history-occurrence-row" key={occurrence.id} onClick={() => toggleSelected(occurrence.id)}><input type="checkbox" checked={selected.has(occurrence.id)} onClick={event => event.stopPropagation()} onChange={() => toggleSelected(occurrence.id)} /><time>{formatEventTime(occurrence.time)}</time><code>{occurrence.source || group.source} · {occurrence.path || group.path}</code><button className="button" disabled={busy} onClick={event => { event.stopPropagation(); control("delete-event", { id: occurrence.id }, "Delete this event occurrence?") }}>Delete</button></div>)}</div>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default ServerEvents
