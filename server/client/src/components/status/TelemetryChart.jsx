import { Line } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js"
import { formatRate } from "../utils/api"

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
)

function TelemetryChart({
    title,
    samples,
    series,
    unit = "%",
    maximum: fixedMaximum = null,
}) {
    const values = samples.flatMap((sample) =>
        series
            .map((item) => Number(sample[item.key]))
            .filter(Number.isFinite),
    )

    const maximum = fixedMaximum || Math.max(1, ...values)

    const formatValue = (value) =>
        unit === "%" ? `${value.toFixed(2)}%` : formatRate(value)

    const data = {
        labels: samples.map((sample) => sample.time),

        datasets: series.map((item) => ({
            label: item.label,
            data: samples.map((sample) => {
                const value = Number(sample[item.key])
                return Number.isFinite(value) ? value : null
            }),
            borderColor: item.colour,
            backgroundColor: item.colour,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.2,
            spanGaps: true,
        })),
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,

        animation: false,

        interaction: {
            mode: "index",
            intersect: false,
        },

        plugins: {
            legend: {
                display: false,
            },

            tooltip: {
                mode: "index",
                intersect: false,
                
                itemSort: (a, b) => b.parsed.y - a.parsed.y,

                callbacks: {
                    title: (items) => {
                        if (!items.length) return ""

                        const time = samples[items[0].dataIndex]?.time
                        if (!time) return ""

                        return new Date(time).toLocaleTimeString()
                    },

                    label: (context) => {
                        const value = context.parsed.y
                        return `${context.dataset.label}: ${formatValue(value)}`
                    },
                },
            },
        },

        scales: {
            x: {
                display: false,
                grid: {
                    display: false,
                },
            },

            y: {
                min: 0,
                max: fixedMaximum ? Math.max(fixedMaximum, ...values) : Math.max(1, ...values),

                grid: {
                    colour: "rgba(255, 255, 255, 0.08)",
                },

                ticks: {
                    display: false,
                },
            },
        },

        elements: {
            line: {
                capBezierPoints: true,
            },
        },
    }

    return (
        <div className="telemetry-chart">
            <div className="telemetry-chart-header">
                <strong>{title}</strong>

                <div className="telemetry-legend">
                    {series.map((item) => (
                        <span key={item.key}>
                            <i style={{ backgroundColor: item.colour }} />
                            {item.label}
                        </span>
                    ))}
                </div>
            </div>

            <div className="telemetry-chart-plot">
                <Line data={data} options={options} />
            </div>

            <span className="chart-scale">
                0 - {maximum.toFixed(maximum < 10 ? 1 : 0)} {unit}
            </span>
        </div>
    )
}

export default TelemetryChart