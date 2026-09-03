import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "../components/PageShell"
import { getJson, useStatusStream } from "../components/utils/api"
import "../css/admin.css"

function Admin() {

    const [summary, setSummary] = useState(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState("")
    const [feedbackStatus, setFeedbackStatus] = useState("all")
    const [selectedFeedback, setSelectedFeedback] = useState(null)
    const [responseText, setResponseText] = useState("")
    const [feedback, setFeedback] = useState([])
    const { status } = useStatusStream({})

    useEffect(() => {
        getJson("/api/admin/summary").then(setSummary).catch(error => setError(error.message))
    }, [])

    useEffect(() => {
        if (!summary?.csrfToken) return
        getJson(`/api/admin/feedback?status=${feedbackStatus}`).then(result => setFeedback(result.feedback || [])).catch(error => setError(error.message))
    }, [summary?.csrfToken, feedbackStatus])

    async function feedbackAction(id, action, extra = {}) {
        if (!summary?.csrfToken) return
        setBusy(`feedback-${id}`)
        try {
            const result = await getJson(`/api/admin/feedback/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": summary.csrfToken },
                body: JSON.stringify({ action, csrf: summary.csrfToken, ...extra })
            })
            if (action === "delete") {
                setSelectedFeedback(null)
            } else if (result.feedback) {
                setSelectedFeedback(result.feedback)
                setResponseText(result.feedback.response || "")
            }
            const refreshed = await getJson(`/api/admin/feedback?status=${feedbackStatus}`)
            setFeedback(refreshed.feedback || [])
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy("")
        }
    }

    function confirmAction(message) {
        return window.confirm(message)
    }

    async function control(action) {
        if (!summary?.csrfToken) return
        const dangerous = ["start", "stop", "restart", "redeploy"].includes(action)
        if (dangerous && !confirmAction(`Confirm ${action} service action?`)) return
        setBusy(action)
        try {
            const result = await getJson("/api/admin/control", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": summary.csrfToken },
                body: JSON.stringify({ action, csrf: summary.csrfToken, confirmed: dangerous })
            })
            setSummary(current => ({ ...current, status: result.status || current.status }))
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy("")
        }
    }

    if (error && !summary) {
        return (
            <PageShell title="Admin" description="Slackzilla admin controls" active="admin">
                <section className="panel">
                    <div className="panel-body">
                        <p>{error}</p>
                        <Link className="button" to="/admin/login">open admin login</Link>
                    </div>
                </section>
            </PageShell>
        )
    }
    const adminStatus = summary?.status || status || {}
    const stats = summary?.commandStats || []
    const serverEvents = summary?.serverEvents || []

    return (
        <PageShell title="Admin" description="Authenticated Slackzilla admin controls" active="admin" state={adminStatus}>
            <section className="panel">
                <div className="panel-header">
                    <h1>Control Room</h1>
                    <span className="panel-subtitle">authenticated operator surface</span>
                </div>

                <div className="panel-body">
                    {error && <p className="error-banner">{error}</p>}
                    <div className="control-row">
                        {["refresh", "restart", "stop", "start", "redeploy"].map(action => (
                            <button 
                                className={`button action-${action}`}
                                title={action === "refresh" ? "Refresh dashboard data" : `${action} the Slackzilla service. Confirmation required.`}
                                aria-label={`${action} service${action === "refresh" ? " data" : ". Confirmation required"}`}
                                disabled={Boolean(busy)}
                                onClick={() => control(action)}
                                key={action}>
                                {busy === action ? "working..." : action}
                            </button>
                        ))}
                    </div>
                    <div className="admin-meta">
                        <span>service: {summary?.runtimeConfig?.botServiceName || "unknown"}</span>
                        <span>branch: {summary?.runtimeConfig?.deployBranch || "unknown"}</span>
                        <span>deployment: {adminStatus.deploymentStatus || "unknown"}</span>
                    </div>
                </div>
            </section>

            <section className="admin-columns">
                <div className="panel">
                    <div className="panel-header">
                        <h2>Feedback queue</h2>
                        <select className="feedback-filter" value={feedbackStatus} onChange={event => setFeedbackStatus(event.target.value)}>
                            <option value="all">All</option>
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                            <option value="responded">Responded</option>
                        </select>
                    </div>
                    <div className="panel-body">
                        {selectedFeedback && <div className="feedback-detail">
                            <div className="feedback-meta">
                                <span>{selectedFeedback.username || selectedFeedback.userId || "anonymous"}</span>
                                <span className={`feedback-status feedback-status--${selectedFeedback.status}`}>{selectedFeedback.status}</span>
                            </div>
                            <code className="feedback-id" title={selectedFeedback.id}>{selectedFeedback.id}</code>
                            <p>{selectedFeedback.message}</p>
                            <textarea value={responseText} onChange={event => setResponseText(event.target.value)} maxLength="4000" placeholder="Write a response to the Slack user" />
                            <div className="feedback-actions">
                                <button className="button" disabled={Boolean(busy)} onClick={() => feedbackAction(selectedFeedback.id, "respond", { response: responseText })}>Reply</button>
                                <button className="button" disabled={Boolean(busy)} onClick={() => feedbackAction(selectedFeedback.id, selectedFeedback.status === "unread" ? "read" : "unread")}>{selectedFeedback.status === "unread" ? "Mark read" : "Mark unread"}</button>
                                <button className="button action-stop" title="Permanently delete this feedback" aria-label="Permanently delete this feedback" disabled={Boolean(busy)} onClick={() => confirmAction("Delete this feedback permanently?") && feedbackAction(selectedFeedback.id, "delete", { confirmed: true })}>Delete</button>
                            </div>
                        </div>}
                        {feedback.length ? feedback.map(item =>
                            <div className="feedback-item" key={item.id}>
                                <div className="feedback-meta">
                                    <button className="feedback-select" onClick={() => { setSelectedFeedback(item); setResponseText(item.response || "") }}>{item.username || item.userId || "anonymous"}</button>
                                    <span className={`feedback-status feedback-status--${item.status}`}>{item.status}</span>
                                </div>
                                <code className="feedback-id" title={item.id}>{item.id}</code>
                                <p>{item.message}</p>
                                <div className="feedback-actions">
                                    <button className="button" disabled={Boolean(busy)} onClick={() => { setSelectedFeedback(item); setResponseText(item.response || "") }}>Respond</button>
                                    <button className="button" disabled={Boolean(busy)} onClick={() => feedbackAction(item.id, item.status === "unread" ? "read" : "unread")}>{item.status === "unread" ? "Mark read" : "Mark unread"}</button>
                                    <button className="button action-stop" title="Permanently delete this feedback" aria-label="Permanently delete this feedback" disabled={Boolean(busy)} onClick={() => confirmAction("Delete this feedback permanently?") && feedbackAction(item.id, "delete", { confirmed: true })}>Delete</button>
                                </div>
                            </div>) : <p className="muted">No feedback recorded.</p>}
                    </div>
                    </div>

                <div className="panel">
                    <div className="panel-header">
                        <h2>Command pulse</h2>
                    </div>
                    <div className="panel-body">
                        <div className="mini-list">
                            {stats.map(item => (
                                <div key={item.name}>
                                    <code>/{item.name}</code>
                                    <strong>{item.count}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <h2>Server activity</h2>
                        <span className="panel-subtitle">{serverEvents.length} recent events</span>
                    </div>
                    <div className="panel-body">
                        <div className="mini-list">
                            {serverEvents.slice(0, 10).map((event, index) => (
                                <div key={`${event.time}-${index}`}>
                                    <code>{event.method} {event.path}</code>
                                    <strong>{event.statusCode || "received"}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default Admin