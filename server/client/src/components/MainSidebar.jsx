import { Fragment } from "react"
import { Link, useLocation } from "react-router-dom"
import { useEffect, useRef } from "react"
import routes from "./utils/routes"
import { useSession } from "./utils/api"

function RouteLinks({ active, pathname, authenticated }) {
    return routes.map(route => (
        <Fragment key={route.id}>
            {!route.api && (!route.hidden || (route.adminOnly && authenticated)) && (
                <Link className={active
                        ? active === route.id 
                            ? "active" : ""
                            : (pathname === route.to ||(route.to !== "/" && pathname.startsWith(`${route.to}/`)))
                            ? "active" 
                        : ""
                    }
                    to={route.id === "docs"? sessionStorage.getItem('slackzilla_docs_page') || route.to : route.to}
                >
                    {route.label}
                </Link>
            )}

        </Fragment>
    ))
}

function MainSidebar({ active, state, collapsed = false, width = 220, onToggle, onWidthChange }) {
    const location = useLocation()
    const { authenticated } = useSession()
    const pathname = location.pathname
    const resizingRef = useRef(false)

    useEffect(() => {
        function handlePointerMove(event) {
            if (!resizingRef.current || collapsed) return
            onWidthChange?.(Math.min(360, Math.max(180, event.clientX)))
        }

        function handlePointerUp() {
            resizingRef.current = false
            document.body.classList.remove("sidebar-is-resizing")
        }

        window.addEventListener("pointermove", handlePointerMove)
        window.addEventListener("pointerup", handlePointerUp)

        return () => {
            window.removeEventListener("pointermove", handlePointerMove)
            window.removeEventListener("pointerup", handlePointerUp)
        }
    }, [collapsed, onWidthChange])

    function beginResize(event) {
        if (collapsed) return
        resizingRef.current = true
        document.body.classList.add("sidebar-is-resizing")
        event.preventDefault()
    }

    const isOnline = (state?.botOnline ?? state?.summary?.botOnline) === true

    return (
        <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`} style={{ "--sidebar-width": `${collapsed ? 52 : width}px` }}>
            <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? ">" : "<"}</button>
            <div className="sidebar-title">NAVIGATION</div>

            <nav><RouteLinks active={active} pathname={pathname} authenticated={authenticated} /></nav>

            <div className="sidebar-footer">
                <div className="footer-title">STATUS</div>
                <div className="status"><span className={isOnline ? "dot" : "dot dot--red"}></span>{isOnline ? "Online" : "Offline"}</div>
            </div>
            {!collapsed && <span className="sidebar-resize-handle" onPointerDown={beginResize} role="separator" aria-label="Resize navigation sidebar" tabIndex="0" />}
        </aside>
    )
}

export default MainSidebar