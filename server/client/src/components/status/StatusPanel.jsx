import { stat } from "./stats"

function StatusPanel({ status: suppliedStatus } = {}) {
    const state = suppliedStatus || window.__SLACKZILLA__ || {}
    const online = state.botOnline ?? state.summary?.botOnline ?? false
    const uptime = state.uptimeText ?? state.uptime ?? state.summary?.uptime ?? "Unknown"
    const deployment = state.deploymentStatus ?? state.deployment ?? state.summary?.deployment ?? "Unknown"
    const lastDeployedAt = state.lastDeploymentText ?? state.lastDeployedAt ?? state.summary?.lastDeployedAt ?? "Unknown"

    return (
        <section id="status" className="panel">
            <div className="panel-header">
                <h2>System Status</h2>
            </div>
            <div className="stats">
                {stat("BOT STATUS", online ? "ONLINE" : "OFFLINE", online ? "status-online" : "status-offline")}
                {stat("UPTIME", uptime)}
                {stat("DEPLOYMENT", deployment)}
                {stat("LAST DEPLOYED AT ", lastDeployedAt)}
            </div>
        </section>
    ) 
}

export default StatusPanel
