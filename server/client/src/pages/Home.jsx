import PageShell from "../components/PageShell"
import StatusPanel from "../components/status/StatusPanel"
import { stat } from "../components/status/stats"
import { useStatusStream } from "../components/utils/api"

function Home() {
    const state = window.__SLACKZILLA__ || {}
    const { status, connected } = useStatusStream(state)

    const internalLinks = [
        { id: "overview", label: "Overview" },
        { id: "status",   label: "Status" },
        { id: "activity", label: "Activity" },
        { id: "feedback", label: "Feedback" },
    ]

    return (
        <PageShell title="Dashboard" description="Slackzilla server overview" active="dashboard" state={state} links={internalLinks} >
            <section id="overview" className="panel">
                <div className="panel-header">
                    <h1>Dashboard</h1>
                    <span className="panel-subtitle">Slackzilla server overview</span>
                </div>

                <div className="panel-body">
                    <p className="hero-copy">
                        Welcome to the Slackzilla control surface. Monitor the bot, inspect activity,
                        and keep an eye on the host from one terminal-inspired dashboard.
                    </p>
                    <div className="live-indicator">
                        <span className={connected ? "dot" : "dot dot--red"} />
                        {connected ? "CONNECTED" : "OFFLINE / RETRYING"}
                    </div>
                </div>
            </section>

            <StatusPanel status={status} />

            <section className="panel">
                <div className="panel-header">
                    <h2>Bot Telemetry</h2>
                    <span className="panel-subtitle">persisted command activity</span>
                </div>

                <div className="stats stats--three">
                    {stat("COMMANDS EXECUTED", status.commandsExecuted ?? "—")}
                    {stat("UNIQUE USERS", status.uniqueUsers ?? "—")}
                    {stat("CHANNELS SEEN", status.uniqueChannels ?? "—")}
                </div>
            </section>

            <section id="activity" className="panel">
                <div className="panel-header">
                    <h2>Recent Activity</h2>
                </div>

                <div className="panel-body">
                    {state.recentActivity?.length ? (
                        <div className="activity-list">
                            {state.recentActivity.map((activity, index) => (
                                <div className="activity-item" key={activity.id ?? index}>
                                    <span className="activity-time">{activity.time ?? "Unknown"}</span>
                                    <span className="activity-message">{activity.message ?? "Activity recorded"}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="muted">No recent activity available.</p>
                    )}
                </div>
            </section>

            <section id="feedback" className="panel">
                <div className="panel-header">
                    <h2>Feedback</h2>
                </div>

                <div className="panel-body">
                    {state.feedback?.length ? (
                        <div className="feedback-list">
                            {state.feedback.map((item, index) => (
                                <div className="feedback-item" key={item.id ?? index}>
                                    <div className="feedback-meta">
                                        <span>{item.user ?? "Unknown user"}</span>
                                        <span>{item.time ?? ""}</span>
                                    </div>
                                    <p>{item.message ?? "No message"}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="muted">No feedback available.</p>
                    )}
                </div>
            </section>
        </PageShell>
    )
}

export default Home
