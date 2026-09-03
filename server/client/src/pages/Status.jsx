import StatusPanel from "../components/status/StatusPanel"
import { useState } from "react"
import PageShell from "../components/PageShell"
import { formatBytes, formatRate, useStatusStream } from "../components/utils/api"
import { metric } from "../components/status/metrics"
import "../css/status.css"

function TelemetryChart({ title, samples, series, unit = "%", maximum: fixedMaximum = null }) {
    const [hovered, setHovered] = useState(null)
    const width = 640
    const height = 150
    const padding = 18
    const horizontalPadding = 2
    const values = samples.flatMap(sample => series.map(item => Number(sample[item.key])).filter(Number.isFinite))
    const maximum = fixedMaximum || Math.max(1, ...values)
    const pointsFor = key => samples.map((sample, index) => {
        const value = Number(sample[key])
        if (!Number.isFinite(value)) return null
        const x = horizontalPadding + (index / Math.max(1, samples.length - 1)) * (width - horizontalPadding * 2)
        const y = height - padding - (Math.min(value, maximum) / maximum) * (height - padding * 2)
        return `${x},${y}`
    }).filter(Boolean).join(" ")
    const formatValue = value => unit === "%" ? `${value.toFixed(2)}%` : formatRate(value)

    return (
        <div className="telemetry-chart">
            <div className="telemetry-chart-header">
                <strong>{title}</strong>
                <div className="telemetry-legend">
                    {series.map(item => <span key={item.key}><i style={{ backgroundColor: item.colour }} />{item.label}</span>)}
                </div>
            </div>
            <div className="telemetry-chart-plot">
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} over the last 120 samples`} onMouseLeave={() => setHovered(null)}>
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
                {series.map(item => <g key={item.key}>
                    <polyline points={pointsFor(item.key)} fill="none" stroke={item.colour} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {samples.map((sample, index) => {
                        const value = Number(sample[item.key])
                        if (!Number.isFinite(value)) return null
                        const x = horizontalPadding + (index / Math.max(1, samples.length - 1)) * (width - horizontalPadding * 2)
                        const y = height - padding - (Math.min(value, maximum) / maximum) * (height - padding * 2)
                        return <circle key={`${item.key}-${sample.time}-${index}`} cx={x} cy={y} r="7" fill={item.colour} className="chart-point" onMouseEnter={() => setHovered({ sample, index, x, y })} />
                    })}
                </g>)}
            </svg>
            {hovered && <div className="chart-tooltip" style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%` }}>
                <strong>{new Date(hovered.sample.time).toLocaleTimeString()}</strong>
                {series.map(item => {
                    const value = Number(hovered.sample[item.key])
                    return Number.isFinite(value) && <span key={item.key} style={{ color: item.colour }}>{item.label}: {formatValue(value)}</span>
                })}
            </div>}
            </div>
            <span className="chart-scale">0 - {maximum.toFixed(maximum < 10 ? 1 : 0)} {unit}</span>
        </div>
    )
}

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
            <PageShell title="Uptime" description="Slackzilla system and bot telemetry" active="status" state={status} links={internalLinks}>
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
                        {metric("DISK", status.diskTotal ? `${formatBytes(status.diskUsed)} / ${formatBytes(status.diskTotal)}` : "unavailable", status.diskUsedPercent)}
                    </div>
                    <div className="telemetry-history">
                        <div className="history-label">LAST 120 SAMPLES</div>
                        <TelemetryChart title="CPU and memory usage" samples={status.telemetryHistory || []} series={[
                            { key: "cpuPercent", label: "CPU", colour: "#00ff78" },
                            { key: "memoryUsedPercent", label: "MEMORY", colour: "#58d8ff" }
                        ]} maximum={100} />
                        <TelemetryChart title="Network throughput" samples={status.telemetryHistory || []} series={[
                            { key: "networkRxRate", label: "INBOUND", colour: "#58d8ff" },
                            { key: "networkTxRate", label: "OUTBOUND", colour: "#ffba5c" }
                        ]} unit="bytes/s" />
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
                            <span className="stat-value" aria-label={`Outbound data rate: ${formatRate(status.networkTxRate)}`}>{formatRate(status.networkTxRate)}</span>
                        </div>
                    </div>
                </section>
            </PageShell>
        </>
    )
}

export default Status