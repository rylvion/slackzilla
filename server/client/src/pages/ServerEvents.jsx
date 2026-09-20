import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "../components/PageShell"
import { getJson } from "../components/utils/api"
import "../css/admin.css"

function formatEventTime(timestamp) {
    if (!timestamp) return "time unavailable"
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? "time unavailable" : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium"
    })
}

function eventPriority(event) {
    const status = Number(event.statusCode)
    if (status >= 500) return 3
    if (status >= 400) return 2
    return 1
}

function ServerEvents() {
    const [events, setEvents] = useState([])
    const [error, setError] = useState("")
    const [query, setQuery] = useState("")
    const [level, setLevel] = useState("all")

    useEffect(() => {
        getJson("/api/admin/server-events?limit=1000")
            .then(result => setEvents(result.events || []))
            .catch(requestError => setError(requestError.message))
    }, [])

    const orderedEvents = useMemo(() => [...events].sort((a, b) => {
        const priority = eventPriority(b) - eventPriority(a)
        if (priority) return priority
        return new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime()
    }), [events])

    const filteredEvents = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()

        return orderedEvents.filter(event => {
            const status = Number(event.statusCode)
            const isCritical = status >= 400
            if (level === "critical" && !isCritical) return false
            if (level === "ok" && isCritical) return false
            if (!normalizedQuery) return true

            return [event.method, event.path, event.type, event.statusCode, event.time]
                .filter(value => value !== null && value !== undefined)
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery)
        })
    }, [level, orderedEvents, query])

    return (
        <PageShell title="Server Events" description="Full authenticated server event history" active="admin-login">
            <section className="panel server-events-page">
                <div className="panel-header">
                    <div>
                        <h1>Server Events</h1>
                        <p className="panel-description">Critical responses are pinned above normal traffic.</p>
                    </div>
                    <span className="panel-subtitle">{events.length} recorded</span>
                </div>
                <div className="panel-body">
                    <div className="server-events-filters">
                        <label htmlFor="server-event-search">Search events</label>
                        <input id="server-event-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="path, method, status, type..." />
                        <label htmlFor="server-event-level">Show</label>
                        <select id="server-event-level" value={level} onChange={event => setLevel(event.target.value)}>
                            <option value="all">All events</option>
                            <option value="critical">Critical only</option>
                            <option value="ok">Successful only</option>
                        </select>
                        <span className="server-events-filter-count">{filteredEvents.length} shown</span>
                    </div>
                    {error && <div className="error-banner">{error} <Link to="/admin/login">sign in</Link></div>}
                    {!error && !filteredEvents.length && <p className="muted">No matching server events.</p>}
                    <div className="server-events-table">
                        {filteredEvents.map((event, index) => {
                            const status = Number(event.statusCode)
                            const critical = status >= 400
                            return (
                                <article className={`server-event-row ${critical ? "server-event-row--critical" : ""}`} key={`${event.time}-${event.method}-${event.path}-${index}`}>
                                    <div className="server-event-row__status">
                                        <strong>{event.statusCode || "—"}</strong>
                                        <span>{critical ? "CRITICAL" : "OK"}</span>
                                    </div>
                                    <div className="server-event-row__main">
                                        <code>{event.method || "?"} {event.path || "unknown path"}</code>
                                        <time dateTime={event.time}>{formatEventTime(event.time)}</time>
                                    </div>
                                    <span className="server-event-row__type">{event.type || "request"}</span>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default ServerEvents
