export const metric = (label, value, percent) => (
    <div className="metric-card">
        <div className="metric-top"><span>{label}</span><strong>{value}</strong></div>
        {percent !== undefined && <div className="meter"><span style={{ width: `${Math.min(100, Math.max(0, percent || 0))}%` }} /></div>}
    </div>
)