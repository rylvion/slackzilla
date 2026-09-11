import StatusPanel from "../components/status/StatusPanel"
import TelemetryChart from "../components/status/TelemetryChart"
import PageShell from "../components/PageShell"
import { formatBytes, formatRate, useStatusStream } from "../components/utils/api"
import { metric } from "../components/status/metrics"
import "../css/status.css"

function Status() {
    const state = window.__SLACKZILLA__ || {}
    const { status, connected } = useStatusStream(state)

    const internalLinks = [
        { id: "overview", label: "Overview" },
        { id: "resources", label: "Resources" },
        { id: "network", label: "Network" },
    ]

    return (
        <>
            <PageShell title="Uptime" description="Slackzilla system and bot telemetry" links={internalLinks}>
                <section id="overview" className="panel">
                    <div className="panel-header">
                        <h1>Runtime Telemetry</h1>
                        <span className={`panel-subtitle connection-status ${connected ? "is-live" : "is-reconnecting"}`}>
                            <span className="connection-dot" />
                            {connected ? "LIVE" : "RECONNECTING"}
                        </span>
                    </div>

                    <StatusPanel status={status} />
                </section>

                <section id="resources" className="panel">
                    <div className="panel-header">
                        <h2>Resource usage</h2>
                        <span className="panel-subtitle">host-level snapshot</span>
                    </div>

                    <div className="metric-grid">
                        {metric("CPU LOAD", status.cpuText || "unavailable", Number.parseFloat(status.cpuText))}
                        {metric("MEMORY", status.memoryText || "unavailable", status.memoryUsedPercent)}
                        {metric("DISK", status.diskTotal? `${formatBytes(status.diskUsed)} / ${formatBytes(status.diskTotal)}` : "unavailable", status.diskUsedPercent)}
                    </div>

                    <div className="telemetry-history">
                        <div className="history-label">LAST 120 SAMPLES</div>

                        <TelemetryChart title="CPU and memory usage" samples={status.telemetryHistory || []} series={[
                                { key: "cpuPercent", label: "CPU", colour: "#00ff78"},
                                { key: "memoryUsedPercent", label: "MEMORY", colour: "#58d8ff" },
                            ]}
                            maximum={100} 
                        />
                    </div>
                </section>

                <section id="network" className="panel">
                    <div className="panel-header">
                        <h2>Network throughput</h2>
                        <span className="panel-subtitle">interface aggregate</span>
                    </div>

                    <div className="stats stats--two">
                        <div className="stat network-stat network-stat--inbound" title="Inbound: data received by this server">
                            <span className="stat-label">INBOUND</span>
                            <span className="stat-value" aria-label={`Inbound data rate: ${formatRate(status.networkRxRate)}`}>{formatRate(status.networkRxRate)}</span>
                        </div>

                        <div className="stat network-stat network-stat--outbound" title="Outbound: data sent by this server">
                            <span className="stat-label">OUTBOUND</span>
                            <span className="stat-value" aria-label={`Outbound data rate: ${formatRate(status.networkTxRate)}`}>
                                {formatRate(status.networkTxRate)}
                            </span>
                        </div>
                    </div>

                    <div className="telemetry-history">
                        <div className="history-label">LAST 120 SAMPLES</div>

                        <TelemetryChart title="Network throughput" samples={status.telemetryHistory || []} series={[
                                { key: "networkRxRate", label: "INBOUND", colour: "#58d8ff" },
                                { key: "networkTxRate", label: "OUTBOUND", colour: "#ffba5c" },
                            ]}
                            unit="bytes/s"
                        />
                    </div>
                </section>
            </PageShell>
        </>
    )
}

export default Status