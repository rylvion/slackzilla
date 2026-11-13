
import { useMemo, useState, useRef, useEffect } from "react"

function formatResponse(response) {
    if (!response) return ""
    if (!Array.isArray(response.responses)) return JSON.stringify(response, null, 2)

    return response.responses.map(item => typeof item === "string" ? item : JSON.stringify(item, null, 2)).join("\n")
}

function Panel({commands, expandedId, argumentsById, busyIds, results, onCommandClick, onArgumentsChange, onArgumentsSubmit}) {
    const [search, setSearch] = useState("")
    const [category, setCategory] = useState("all")

    const argumentInputRef = useRef(null)

    useEffect(() => {if (expandedId) argumentInputRef.current?.focus()}, [expandedId])

    const categories = useMemo(() =>
        [...new Set(commands.map(command => command.category || "uncategorised"))]
            .sort((a, b) => a.localeCompare(b)),
        [commands]
    )

    const filteredCommands = commands.filter(command => {
        const matchesCategory = category === "all" || (command.category || "uncategorised") === category
        const query = search.trim().toLowerCase()
        const matchesSearch = !query || [
            command.command,
            command.description,
            command.category,
            command.usageHint
        ].some(value => value?.toLowerCase().includes(query))

        return matchesCategory && matchesSearch
    })

    return (
        <div className="command-explorer">
            <header className="command-explorer-header">
                <div>
                    <div className="command-eyebrow">visit <a href="https://app.slack.com/client/E09V59WQY1E/C0CFLJA4YUB" target="_blank">the help server</a>, to execute slack commands too!</div>
                    <h2>Command explorer<span className="command-title-dot">.</span></h2>
                    <p>Browse, inspect and execute available slash commands.</p>
                </div>
                <div className="command-total">
                    <span className="command-total-value">{commands.length.toString().padStart(2, "0")}</span>
                    <span className="command-total-label">COMMANDS</span>
                </div>
            </header>

            <div className="command-toolbar">
                <label className="command-search" htmlFor="command-search">
                    <span className="command-field-label">SEARCH</span>
                    <span className="command-search-field">
                        <span className="command-search-prefix">$</span>
                        <input id="command-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a command..." autoComplete="off"/>
                        {search && <button className="command-clear-search" type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
                    </span>
                </label>

                <label className="command-category-filter" htmlFor="command-category">
                    <span className="command-field-label">CATEGORY</span>
                    <select id="command-category" value={category} onChange={event => setCategory(event.target.value)}>
                        <option value="all">All categories</option>
                        {categories.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                </label>
            </div>

            <div className="command-list-heading">
                <span>AVAILABLE COMMANDS</span>
                <span>{filteredCommands.length} MATCH{filteredCommands.length === 1 ? "" : "ES"}</span>
            </div>

            {filteredCommands.length > 0 ? (
                <div className="command-list">
                    {filteredCommands.map((command, index) => {
                        const expanded = expandedId === command.id
                        const busy = busyIds.includes(command.id)
                        const result = results[command.id]
                        const usageHint = command.usageHint?.trim()
                        const commandName = command.command || "Unknown command"
                        const commandCategory = command.category || "uncategorised"

                        return (
                            <article className={`command-item${expanded ? " is-expanded" : ""}`} key={command.id}>
                                <div className="command-item-main">
                                    <button className="command-item-info" type="button" onClick={() => onCommandClick(command)} disabled={busy} aria-expanded={Boolean(usageHint && expanded)}>
                                        <span className="command-index">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="command-info-content">
                                            <span className="command-name">{commandName.slice(1)}</span>
                                            <span className="command-description">{command.description || "No description available."}</span>
                                            <span className="command-metadata">
                                                <span className="command-category">{commandCategory}</span>
                                                {usageHint? <span className="command-usage"><span>USAGE</span> {usageHint}</span> : <span className="command-usage command-no-args">NO ARGUMENTS</span>}
                                            </span>
                                        </span>
                                    </button>

                                    <div className="command-item-action">
                                        {usageHint ? (
                                            <button className={`command-action-button${expanded ? " is-active" : ""}`} type="button" onClick={() => onCommandClick(command)} disabled={busy}>
                                                <span>{expanded ? "Close" : "Configure"}</span>
                                                <span className="command-action-icon">{expanded ? "−" : "+"}</span>
                                            </button>
                                        ) : (
                                            <button className="command-action-button command-action-run" type="button" onClick={() => onCommandClick(command)} disabled={busy}>
                                                <span>{busy ? "Running" : "Run"}</span>
                                                <span className="command-action-icon">{busy ? "…" : "↗"}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {expanded && usageHint && (
                                    <form className="command-inline-runner" onSubmit={event => {
                                        event.preventDefault()
                                        onArgumentsSubmit(event, command)
                                        requestAnimationFrame(() => argumentInputRef.current?.focus())
                                    }}>
                                        <div className="command-runner-heading">
                                            <span className="command-runner-prompt">$ execute {commandName}</span>
                                            <span className="command-runner-status">ARGUMENTS REQUIRED</span>
                                        </div>
                                        <label htmlFor={`command-args-${command.id}`}>Command arguments</label>
                                        <div className="command-argument-row">
                                            <input ref={argumentInputRef} id={`command-args-${command.id}`} value={argumentsById[command.id] || ""} onChange={event => onArgumentsChange(command.id, event.target.value)} placeholder={usageHint} autoComplete="off" disabled={busy}/>
                                            <button className="command-run-button" type="submit" disabled={busy}>{busy ? "Executing..." : "Run command"} <span>↗</span></button>
                                        </div>
                                        <p className="command-input-hint">Separate arguments with spaces.</p>
                                    </form>
                                )}

                                {result && (
                                    <div className="command-result" aria-live="polite">
                                        <div className="command-result-heading">
                                            <span>{result.loading ? "EXECUTING" : result.error ? "EXECUTION ERROR" : "COMMAND OUTPUT"}</span>
                                            <span className={result.loading ? "command-result-indicator is-running" : result.error ? "command-result-indicator is-error" : "command-result-indicator"}>
                                                {result.loading ? "RUNNING" : result.error ? "FAILED" : "RESPONSE"}
                                            </span>
                                        </div>
                                        {result.loading && <p className="command-running">Executing {commandName}...</p>}
                                        {result.error && <p className="command-error">{result.error}</p>}
                                        {result.response && <pre className="command-response">{formatResponse(result.response) || "Command completed with no output."}</pre>}
                                    </div>
                                )}
                            </article>
                        )
                    })}
                </div>
            ) : (
                <div className="command-empty">
                    <span className="command-empty-icon">⌕</span>
                    <strong>No matching commands</strong>
                    <p>Try another search term or change the category filter.</p>
                    <button type="button" onClick={() => { setSearch(""); setCategory("all") }}>Clear filters</button>
                </div>
            )}

            <footer className="command-explorer-footer">
                <span><span className="command-footer-dot" /> COMMAND EXECUTION ENABLED</span>
                <span>SLASH COMMANDS / API</span>
            </footer>
        </div>
    )
}

export default Panel
