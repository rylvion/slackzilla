import PageShell from "../components/PageShell"
import "../css/api.css"

const endpoints = [
    ["GET", "/api/status", "Current host, deployment, bot, memory, disk and network telemetry."],
    ["GET", "/api/status/stream", "Server-sent status updates, broadcast every second."],
    ["GET", "/api/metrics", "Command totals plus unique users and channels."],
    ["GET", "/api/logs", "Bounded log snapshot as JSON."],
    ["GET", "/api/logs/stream", "Live log snapshot and appended lines."],
    ["GET", "/api/logs/download", "Bounded log snapshot as plain text."],
    ["GET", "/api/admin/summary", "Authenticated admin dashboard data."],
    ["GET", "/api/admin/events", "Authenticated admin event stream."],
    ["POST", "/api/admin/control", "Authenticated control actions with CSRF protection."],
    ["GET/POST", "/api/admin/feedback", "Authenticated feedback search and actions."]
]

function Api() {
    return (
        <PageShell title="API" description="Slackzilla API reference">
            <section className="panel">
                <div className="panel-header"><h1>API Surface</h1><span className="panel-subtitle">modular / same-origin / JSON envelopes</span></div>
                <div className="panel-body"><p>Public telemetry endpoints do not require authentication. Admin endpoints require the secure admin session cookie and state-changing requests also require the CSRF token returned by the admin summary.</p></div>
            </section>
            
            <section className="panel">
                <div className="endpoint-list">
                    {endpoints.map(([method, path, description]) => (
                        <div className="endpoint" key={`${method}-${path}`}>
                            <span className="method">{method}</span>
                            <code className="endpoint-path">{path}</code>
                            <span className="endpoint-description">{description}</span>
                        </div>
                    ))}
                </div>
            </section>
        </PageShell>
    )
}

export default Api