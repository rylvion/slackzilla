import PageShell from "../components/PageShell"
import "../css/api.css"

const endpoints = [
    ["GET", "/api/commands", "List of all available commands."],
    ["GET", "/api/commands/:command", "Command details and usage."],
    ["POST", "/api/commands/:command", "Execute a command with JSON payload."],
    ["GET", "/api/status", "Current host, deployment, bot and runtime summary."],
    ["GET", "/api/status/stream", "Server-sent status updates, broadcast every second."],
    ["GET", "/api/telemetry", "Current runtime telemetry and the last 120 samples."],
    ["GET", "/api/telemetry/stream", "Live telemetry snapshots with the last 120 samples."],
    ["GET", "/api/metrics", "Command totals plus unique users and channels."],
    ["GET", "/api/logs", "Bounded log snapshot as JSON."],
    ["GET", "/api/logs/stream", "Live log snapshot and appended lines."],
    ["GET", "/api/logs/download", "Bounded log snapshot as plain text."],
    ["GET", "/api/admin/summary", "Authenticated admin dashboard data."],
    ["GET", "/api/admin/server-events", "Authenticated full server event history."],
    ["GET", "/api/admin/events", "Authenticated admin event stream."],
    ["POST", "/api/admin/control", "Authenticated control actions with CSRF protection."],
    ["GET/POST", "/api/admin/feedback", "Authenticated feedback search and actions."],
    ["GET/POST", "/api/ask", "Ask the AI assistant a question and receive a response."],
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
