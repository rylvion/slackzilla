import Head from "./Head"
import Header from "./Header"
import MainSidebar from "./MainSidebar"
import InternalSidebar from "./InternalSidebar"
import PanelInteractions from "./PanelInteractions"

import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

function PageShell({ title, description, links = [], active='', showSidebar = true, shellClassName = "", children }) {
    const { pathname } = useLocation()
    const [state, setState] = useState({})
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("slackzilla-sidebar-collapsed") === "true")
    const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem("slackzilla-sidebar-width")) || 220)

    useEffect(() => {
        if (!showSidebar) return undefined

        let cancelled = false

        async function fetchState() {
            try {
                const response = await fetch("/api/status")
                if (!response.ok) { throw new Error(`HTTP ${response.status}`)}

                const result = await response.json()
                if (!cancelled) { setState(result.data ?? result) }
            } catch (error) {
                console.error("Failed to fetch bot state:", error)
            }
        }

        fetchState()

        return () => {cancelled = true}
    }, [showSidebar])
    
    return (
        <>
            <Head title={title} description={description} state={state} />
            <Header />
            {showSidebar && (
                <MainSidebar
                    active={active}
                    state={state}
                    collapsed={sidebarCollapsed}
                    width={sidebarWidth}
                    onToggle={() => {
                        const next = !sidebarCollapsed
                        setSidebarCollapsed(next)
                        localStorage.setItem("slackzilla-sidebar-collapsed", String(next))
                    }}
                    onWidthChange={width => {
                        setSidebarWidth(width)
                        localStorage.setItem("slackzilla-sidebar-width", String(width))
                    }}
                />
            )}
            <main
                className={`main-content ${shellClassName}`.trim()}
                style={showSidebar ? { "--sidebar-width": `${sidebarCollapsed ? 52 : sidebarWidth}px` } : undefined}
            >
                {links.length > 0 && <InternalSidebar links={links} />}
                <div className={`content ${shellClassName ? `${shellClassName}-content` : ""}`.trim()}>{children}</div>
            </main>
            <PanelInteractions pathname={pathname} />
        </>
    )
}

export default PageShell
