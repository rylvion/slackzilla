import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "../components/PageShell"
import { getCsrfToken, getJson, useSession, useStatusStream } from "../components/utils/api"
import ansiLine from "../components/logs/ansi-handler"
import "../css/admin/base.css"
import "../css/admin/main.css"
import "../css/shared/logs/log-terminal.css"

function formatFeedbackTime(timestamp) {
    if (!timestamp) return "time unavailable"

    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return "time unavailable"

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium"
    })
}

function formatBackupBytes(bytes) {
    const value = Number(bytes) || 0
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function Admin() {

    const [summary, setSummary] = useState(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState("")
    const [feedbackStatus, setFeedbackStatus] = useState("all")
    const [selectedFeedback, setSelectedFeedback] = useState(null)
    const [responseText, setResponseText] = useState("")
    const [feedback, setFeedback] = useState([])
    const [serverErrors, setServerErrors] = useState([])
    const [archives, setArchives] = useState([])
    const [logMessage, setLogMessage] = useState("")
    const [restoreTarget, setRestoreTarget] = useState(null)
    const { status } = useStatusStream({})
    const { csrfToken } = useSession()

    useEffect(() => {
        getJson("/api/admin/summary").then(setSummary).catch(error => setError(error.message))
    }, [])

    useEffect(() => {
        if (!csrfToken) return
        getJson("/api/admin/errors").then(result => setServerErrors(result.errors || [])).catch(error => setError(error.message))
        getJson("/api/admin/log-archives").then(result => setArchives(result.archives || [])).catch(error => setError(error.message))
    }, [csrfToken])

    useEffect(() => {
        if (!csrfToken) return
        getJson(`/api/admin/feedback?status=${feedbackStatus}`).then(result => setFeedback(result.feedback || [])).catch(error => setError(error.message))
    }, [csrfToken, feedbackStatus])

    async function feedbackAction(id, action, extra = {}) {
        const token = await getCsrfToken().catch(() => null)
        if (!token) return
        setBusy(`feedback-${id}`)
        try {
            const result = await getJson(`/api/admin/feedback/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
                body: JSON.stringify({ action, csrf: token, ...extra })
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
        const token = await getCsrfToken().catch(() => null)
        if (!token) return
        const dangerous = ["start", "stop", "restart", "redeploy"].includes(action)
        if (dangerous && !confirmAction(`Confirm ${action} service action?`)) return
        setBusy(action)
        try {
            const result = await getJson("/api/admin/control", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
                body: JSON.stringify({ action, csrf: token, confirmed: dangerous })
            })
            setSummary(current => ({ ...current, status: result.status || current.status }))
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy("")
        }
    }

    async function logControl(action, payload = {}, confirmation = "") {
        const token = await getCsrfToken().catch(() => null)
        if (!token) return
        if (confirmation && !window.confirm(confirmation)) return
        setBusy(action)
        setLogMessage("")
        try {
            const result = await getJson("/api/admin/control", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
                body: JSON.stringify({ action, csrf: token, confirmed: true, ...payload })
            })
            setLogMessage(`[SUCCESS] ${action} completed`)
            const archivesResult = await getJson("/api/admin/log-archives")
            setArchives(archivesResult.archives || [])
            return result
        } catch (requestError) {
            setLogMessage(`[ERROR] ${action}: ${requestError.message}`)
        } finally {
            setBusy("")
        }
    }

    const errorOverview = useMemo(() => {
        const groups = new Map()
        for (const capturedError of serverErrors) {
            const group = groups.get(capturedError.message) || { message: capturedError.message, count: 0, latest: capturedError }
            group.count += 1
            if (new Date(capturedError.time) > new Date(group.latest.time)) group.latest = capturedError
            groups.set(capturedError.message, group)
        }
        return [...groups.values()].sort((a, b) => new Date(b.latest.time) - new Date(a.latest.time))
    }, [serverErrors])

    if (error && !summary) {
        return (
            <PageShell title="Admin" description="Slackzilla admin controls" active="admin-login">
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

    return (
        <PageShell title="Admin" description="Authenticated Slackzilla admin controls" active="admin-login">
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
                        <button className="button action-stop" disabled={Boolean(busy)} onClick={() => logControl("reset-telemetry", {}, "Reset telemetry history?")}>reset telemetry</button>

                    </div>
                    <div className="admin-meta">
                        <span>service: {summary?.runtimeConfig?.botServiceName || "unknown"}</span>
                        <span>branch: {summary?.runtimeConfig?.deployBranch || "unknown"}</span>
                        <span>deployment: {adminStatus.deploymentStatus || "unknown"}</span>
                    </div>
                </div>
            </section>

            <section className="panel admin-controls-panel">
                <div className="panel-header"><h2>Log controls</h2><span className="panel-subtitle">dangerous actions require confirmation · <Link to="/admin/logs">view logs</Link></span></div>
                <div className="panel-body admin-log-controls">
                    {logMessage && <p className={logMessage.startsWith("[SUCCESS]") ? "success-banner" : "error-banner"}>{logMessage}</p>}
                    <div className="admin-log-actions">
                        <button className="button" disabled={Boolean(busy)} onClick={() => logControl("rotate-logs", {}, "Archive current logs and start fresh?")}>rotate logs</button>
                    </div>
                    <div className="admin-backups">
                        <div className="admin-backups__header"><h3>Log backups</h3><span>{archives.length} available</span></div>
                        {archives.map(archive => <article className={`admin-backup-card ${archive.name.startsWith("slackzilla-before-restore-") ? "admin-backup-card--restore" : ""}`} key={archive.name}>
                            <div className="admin-backup-card__identity"><strong>{archive.name}</strong>{archive.name.startsWith("slackzilla-before-restore-") && (
                                <span className="backup-type backup-type-restore">before restore</span>
                            )}<span>created {formatFeedbackTime(archive.createdAt)}</span></div>
                            <div className="admin-backup-card__metadata"><span>{formatBackupBytes(archive.bytes)}</span><span>{archive.lines} lines</span><span>updated {formatFeedbackTime(archive.updatedAt)}</span></div>
                            <div className="admin-backup-card__actions">
                                <button className="button" disabled={Boolean(busy)} onClick={() => setRestoreTarget(archive)}>restore / switch</button>
                                <button className="button button-danger" disabled={Boolean(busy)} onClick={() => logControl("delete-log-archive", { archive: archive.name }, "Delete this log backup permanently?")}>delete</button>
                            </div>
                            
                        </article>)}
                        {!archives.length && <p className="muted">No log backups yet. Rotate the current log to create one.</p>}
                    </div>
                </div>
            </section>

            {restoreTarget && (
                <div className="admin-modal-backdrop">
                    <div className="admin-modal">
                        <h3>Restore log backup?</h3>
                        <p>What should happen to the current log?</p>
                        <div className="admin-modal__actions">
                            <button className="button" onClick={() => {
                                const archive = restoreTarget.name
                                setRestoreTarget(null)
                                logControl("restore-log", { archive, saveCurrent: false })
                            }}>restore only</button>
                            <button className="button" onClick={() => {
                                const archive = restoreTarget.name
                                setRestoreTarget(null)
                                logControl("restore-log", { archive, saveCurrent: true })
                            }}>save current & restore</button>
                            <button className="button" onClick={() => setRestoreTarget(null)}>cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <section className="admin-columns">
                <div className="panel admin-overview-panel">
                    <div className="panel-header"><h2>Error overview</h2><span className="panel-subtitle">{serverErrors.length} captured · <Link to="/admin/errors">open debugger</Link></span></div>
                    <div className="panel-body"><div className="admin-error-overview">
                        {errorOverview.slice(0, 8).map(group => <Link className="admin-error-overview__item" to={`/admin/errors?error=${encodeURIComponent(group.message)}`} key={group.message}><strong>{group.count > 1 ? `(${group.count}) ` : ""}{group.message}</strong><span>{group.latest.source} · {formatFeedbackTime(group.latest.time)}</span></Link>)}
                        {!errorOverview.length && <p className="muted">No captured server errors.</p>}
                    </div></div>
                </div>
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
                                <time className="feedback-time" dateTime={selectedFeedback.timestamp} title={selectedFeedback.timestamp}>logged {formatFeedbackTime(selectedFeedback.timestamp)}</time>
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
                                    <time className="feedback-time" dateTime={item.timestamp} title={item.timestamp}>logged {formatFeedbackTime(item.timestamp)}</time>
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
                        <h2>Recent Commands</h2>
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

                <div className="dashboard-activity-grid">
                    <div className="panel">
                        <div className="panel-header">
                            <h2>Server activity</h2>
                                <span className="panel-subtitle">{(summary?.criticalEvents || []).length} events · <Link to="/admin/events">open full event view</Link></span>                        </div>
                        <div className="panel-body">
                            <div className="mini-list server-events-list">
                                {(summary?.criticalEvents || []).slice(0, 20).map((event, index) => (
                                    <div className="server-event server-event--critical" key={`${event.statusCode}-${event.path}-${index}`}>
                                        <span><code>{event.methods?.join(", ")} {event.path}</code></span>
                                        <strong>({event.count}) {event.statusCode}</strong>
                                    </div>
                                ))}

                                {!(summary?.criticalEvents || []).length && (
                                    <p className="muted">No critical server events recorded.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <h2>Log snapshot</h2>
                            <span className="panel-subtitle">{summary?.logs?.length || 0} lines · <Link to="/admin/logs">open full log view</Link></span>
                        </div>
                        <div className="panel-body">
                            <div className="terminal terminal--snapshot">
                                <div className="log-lines">
                                    {summary?.logs?.length
                                        ? summary.logs.map((text, index) => ansiLine({number: index + 1, text, highlightLine: null, highlighted: false }, index))
                                        : <div className="muted">$ waiting for log output...</div>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default Admin
