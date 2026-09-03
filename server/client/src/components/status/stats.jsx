export function stat(name, value, className = "") {
    return (
        <div className="stat">
            <span className="stat-label">{name.toUpperCase()}</span>
            <span className={`stat-value ${className}`}>{value}</span>
        </div>
    )
}