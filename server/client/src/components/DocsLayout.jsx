import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import PageShell from "./PageShell"
import DocsSearchBar from "./DocsSearchBar"
import { documents } from "./utils/docs"
import { DOCS_SIDEBAR_STORAGE_KEY, docsLayoutClassName, getDocsSidebarCollapsed, toggleDocsSidebar } from "./utils/docs-layout-state.mjs"
import { groupDocuments } from "./utils/docs-navigation.mjs"
import "../css/markdown.css"
import "../css/docs.css"

function readStorage() {
    try {
        return window.localStorage
    } catch {
        return null
    }
}

function DocsLayout({ title, subtitle, searchQuery = "", activeRoute, children, overlay = null }) {
    const [collapsed, setCollapsed] = useState(() => {
        const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth
        return getDocsSidebarCollapsed(readStorage(), viewportWidth)
    })

    const navigationGroups = useMemo(() => {
        return groupDocuments(documents)
    }, [])

    const [collapsedGroups, setCollapsedGroups] = useState({})

    useEffect(() => {
        readStorage()?.setItem(DOCS_SIDEBAR_STORAGE_KEY, String(collapsed))
    }, [collapsed])

    function toggleSidebar() {
        setCollapsed(current => toggleDocsSidebar(current))
    }

    return (
        <>
            <PageShell title={title} description="Slackzilla operations and extension guide" shellClassName="docs-page">
                <section className="panel docs-viewer">
                    <div className="panel-header docs-search-header">
                        <div className="docs-header-title">
                            <h1>{title}</h1>
                            <span className="panel-subtitle">{subtitle}</span>
                        </div>
                        <div className="docs-header-actions">
                            <DocsSearchBar key={searchQuery} initialQuery={searchQuery} />
                            <button className="docs-sidebar-toggle" type="button" aria-expanded={!collapsed} aria-controls="docs-navigation" aria-label={collapsed ? "Show documentation navigation" : "Hide documentation navigation"} onClick={toggleSidebar}>
                                <span aria-hidden="true">{collapsed ? "[+]" : "[-]"}</span>
                            </button>
                        </div>
                    </div>
                    <div className={docsLayoutClassName(collapsed)}>
                        <nav id="docs-navigation" className="docs-index" aria-label="Documentation index" aria-hidden={collapsed}>
                            {navigationGroups.map(([group, items]) => {
                                const groupCollapsed = collapsedGroups[group]

                                return (
                                    <section className="docs-group" key={group}>
                                        <button className="docs-group-toggle" type="button" tabIndex={collapsed ? -1 : 0} onClick={() => setCollapsedGroups(current => ({ ...current, [group]: !current[group] }))} aria-expanded={!groupCollapsed}>
                                            <span>{group}</span>
                                            <span aria-hidden="true">{groupCollapsed ? "+" : "-"}</span>
                                        </button>
                                        {!groupCollapsed && (
                                            <div className="docs-group-items">
                                                {items.map(item => (
                                                    <Link className={item.route === activeRoute ? "active" : ""} key={item.id} to={item.route} tabIndex={collapsed ? -1 : 0}>
                                                        {item.title}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )
                            })}
                        </nav>
                        {children}
                    </div>
                </section>
            </PageShell>
            {overlay}
        </>
    )
}

export default DocsLayout
