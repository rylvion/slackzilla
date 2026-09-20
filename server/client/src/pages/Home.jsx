import PageShell from "../components/PageShell"
import StatusPanel from "../components/status/StatusPanel"
import { stat } from "../components/status/stats"
import { useStatusStream } from "../components/utils/api"

import { useEffect, useState } from "react"

function Home() {
    const [activityTimedOut, setActivityTimedOut] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setActivityTimedOut(true)
        }, 3000)

        return () => clearTimeout(timer)
    }, [])

    const state = window.__SLACKZILLA__ || {}
    const { status, connected } = useStatusStream(state)

    const internalLinks = [
        { id: "overview", label: "Overview" },
        { id: "status",   label: "Status" },
        { id: "activity", label: "Activity" },
    ]

    return (
        <PageShell title="Dashboard" description="Slackzilla server overview" links={internalLinks} >
            <section id="overview" className="panel">
                <div className="panel-header">
                    <h1>Dashboard</h1>
                    <span className="panel-subtitle">Slackzilla server overview</span>
                </div>

                <div className="panel-body">
                    <p className="hero-copy">
                        Welcome to the Slackzilla control surface. Monitor the bot, inspect activity,
                        ask questions to the ai assistant, and provide feedback to me.
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
                    {stat("TOTAL COMMANDS EXECUTED", status.commandStats?.length ?? "—")}
                </div>
            </section>

            <section id="activity" className="panel">
                <div className="panel-header">
                    <h2>Recent Activity</h2>
                </div>

                <div className="panel-body">
                    {status.recentActivity?.length ? (
                        <div className="activity-list">
                            {Object.entries(
                                status.recentActivity.reduce((groups, activity) => {
                                    const date = new Date(activity.time)
                                    const dateKey = date.toLocaleDateString("en-GB")

                                    if (!groups[dateKey]) {
                                        groups[dateKey] = []
                                    }

                                    groups[dateKey].push(activity)
                                    return groups
                                }, {})
                            ).map(([date, activities]) => (
                                <div className="activity-group" key={date}>
                                    <div className="activity-date">
                                        {new Date(activities[0].time).toLocaleDateString("en-GB", {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long"
                                        })}
                                    </div>

                                    {activities.map((activity, index) => (
                                        <div className="activity-item" key={activity.id ?? `${activity.time}-${index}`}>
                                            <span className="activity-time">
                                                {new Date(activity.time).toLocaleTimeString("en-GB", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit"
                                                })}
                                            </span>

                                            <span className="activity-message">
                                                {activity.user && (
                                                    <span className="activity-user">{activity.user}</span>
                                                )}
                                                <span className="activity-action"> ran </span>
                                                <span className="activity-command">
                                                    /{activity.command ?? "unknown"}
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : (
                            <p className="muted">
                                {activityTimedOut
                                    ? "No recent activity available."
                                    : "Loading Activities...."
                                }
                            </p>
                    )}
                </div>
            </section>

            
        </PageShell>
    )
}

export default Home
