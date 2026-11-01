
import { useEffect, useMemo, useState } from "react"
import PageShell from "../components/PageShell"
import "../css/api.css"

const filters = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"]

function Api() {
    const [routes, setRoutes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")
    const [methodFilter, setMethodFilter] = useState("ALL")

    useEffect(() => {
        const controller = new AbortController()

        async function loadRoutes() {
            try {
                const response = await fetch("/api/routes", { signal: controller.signal })
                if (!response.ok) throw new Error(`Request failed (${response.status})`)
                const result = await response.json()
                if (!result.ok || !Array.isArray(result.data?.routes)) throw new Error("Invalid API routes response")

                setRoutes(result.data.routes)
                setError("")
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message || "Failed to load API routes")
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        loadRoutes()

        return () => controller.abort()
    }, [])

    const counts = useMemo(() => ({
        total: routes.length,
        get: routes.filter(route => route.methods?.includes("GET")).length,
        post: routes.filter(route => route.methods?.includes("POST")).length,
        admin: routes.filter(route => route.path.startsWith("/api/admin/")).length
    }), [routes])

    const filteredRoutes = useMemo(() => {
        const query = search.trim().toLowerCase()

        return routes
            .filter(route => {
                const routeMethods = route.methods || []
                const matchesMethod = methodFilter === "ALL" || routeMethods.includes(methodFilter)
                const matchesSearch = !query || [route.path, route.file || "", ...routeMethods].some(value => value.toLowerCase().includes(query))

                return matchesMethod && matchesSearch
            })
            .sort((a, b) => a.path.localeCompare(b.path))
    }, [routes, search, methodFilter])

    return (
        <PageShell title="API" description="Slackzilla API reference">
            <div className="api-page">
                <section className="api-hero">
                    <div className="api-hero-content">
                        <div className="api-terminal-prompt">
                            <span>slackzilla@repo</span>:<span>~</span>$ routes
                        </div>

                        <p>
                            Registered HTTP routes across the Slackzilla codebase. See{" "}
                            <a href="/docs/api">API documentation</a> for more details about each endpoint.
                        </p>
                    </div>
                </section>

                <section className="api-panel">
                    <div className="api-section-header">
                        <div>
                            <span className="api-section-kicker">ROUTE REGISTRY</span>
                            <h2>HTTP endpoints</h2>
                        </div>

                        <span className="api-result-count">
                            {loading ? "LOADING" : error ? "UNAVAILABLE" : `${filteredRoutes.length} RESULTS`}
                        </span>
                    </div>

                    <div className="api-toolbar">
                        <label className="api-search">
                            <span aria-hidden="true" className="api-search-icon">/</span>
                            <input
                                type="search"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search routes, methods or source files..."
                                aria-label="Search API endpoints"
                            />
                        </label>

                        <div className="api-filters" role="group" aria-label="Filter endpoints by HTTP method">
                            {filters.map(filter => (
                                <button
                                    key={filter}
                                    type="button"
                                    className={`api-filter ${methodFilter === filter ? "active" : ""}`}
                                    aria-pressed={methodFilter === filter}
                                    onClick={() => setMethodFilter(filter)}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="api-table-heading">
                        <span>METHOD</span>
                        <span>ENDPOINT</span>
                        <span>SOURCE</span>
                    </div>

                    {loading ? (
                        <div className="api-message">
                            <span className="api-loading-indicator" />
                            Loading registered routes...
                        </div>
                    ) : error ? (
                        <div className="api-message api-error" role="alert">
                            <strong>Could not load API routes</strong>
                            <span>{error}</span>
                            <button type="button" onClick={() => window.location.reload()}>
                                Reload page
                            </button>
                        </div>
                    ) : filteredRoutes.length === 0 ? (
                        <div className="api-message">
                            <strong>No matching endpoints</strong>
                            <span>Try a different search or HTTP method.</span>
                            <button type="button" onClick={() => {
                                setSearch("")
                                setMethodFilter("ALL")
                            }}>
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="api-endpoints">
                            {filteredRoutes.map(route => {
                                const routeMethods = route.methods || []
                                const isAdmin = route.path.startsWith("/api/admin/")
                                const isStream = route.path.endsWith("/stream")

                                return (
                                    <article className="api-endpoint" key={`${route.path}-${routeMethods.join(",")}`}>
                                        <div className="api-methods">
                                            {routeMethods.map(method => (
                                                <span className="api-method" data-method={method} key={method}>
                                                    {method}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="api-endpoint-info">
                                            <code className="api-path">{route.path}</code>

                                            <div className="api-source">
                                                <span className="api-source-file">{route.file || "Unknown source"}</span>
                                                {Number.isFinite(route.line) && (
                                                    <span className="api-source-line">L{route.line}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="api-endpoint-tags">
                                            {isAdmin && <span className="api-tag admin">ADMIN</span>}
                                            {isStream && <span className="api-tag stream">STREAM</span>}
                                            {!isAdmin && !isStream && <span className="api-tag">HTTP</span>}
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}

                    <div className="api-panel-footer">
                        <span>
                            <span className="api-status-dot" />
                            {loading ? "Loading registry" : error ? "Registry unavailable" : "Registry loaded"}
                        </span>

                        <span>SLACKZILLA / API</span>
                    </div>
                </section>

                <section className="api-stats" aria-label="API statistics">
                    <div className="api-stat">
                        <span className="api-stat-label">TOTAL ROUTES</span>
                        <strong>{loading ? "..." : counts.total}</strong>
                    </div>

                    <div className="api-stat">
                        <span className="api-stat-label">GET</span>
                        <strong>{loading ? "..." : counts.get}</strong>
                    </div>

                    <div className="api-stat">
                        <span className="api-stat-label">POST</span>
                        <strong>{loading ? "..." : counts.post}</strong>
                    </div>

                    <div className="api-stat">
                        <span className="api-stat-label">ADMIN</span>
                        <strong>{loading ? "..." : counts.admin}</strong>
                    </div>
                </section>
            </div>
        </PageShell>
    )
}

export default Api
