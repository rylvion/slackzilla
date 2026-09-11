import { Fragment } from "react"
import { Link, useLocation } from "react-router-dom"
import routes from "./utils/routes"

function RouteLinks({ active, pathname }) {
    return routes.map(route => (
        <Fragment key={route.id}>
            {!route.api && !route.hidden && (
                <Link
                    className={
                        active
                            ? active === route.id ? "active" : ""
                            : (
                                pathname === route.to ||
                                (route.to !== "/" && pathname.startsWith(`${route.to}/`))
                            ) ? "active" : ""
                    }
                    to={route.to}
                >
                    {route.label}
                </Link>
            )}

            {route.children?.length > 0 && (
                <RouteLinks
                    routes={route.children}
                    active={active}
                    pathname={pathname}
                />
            )}
        </Fragment>
    ))
}

function MainSidebar({ active, state }) {
    const location = useLocation()
    const pathname = location.pathname

    const sidebarStatus =
        state?.botOnline ||
        state?.summary?.botOnline ||
        "offline"

    const isOnline = ["active", "online"].includes(
        String(sidebarStatus).toLowerCase()
    )

    return (
        <aside className="sidebar">
            <div className="sidebar-title">NAVIGATION</div>

            <nav>
                <RouteLinks
                    routes={routes}
                    active={active}
                    pathname={pathname}
                />
            </nav>

            <div className="sidebar-footer">
                <div className="footer-title">STATUS</div>

                <div className="status">
                    <span className={isOnline ? "dot" : "dot dot--red"}></span>
                    {sidebarStatus}
                </div>
            </div>
        </aside>
    )
}

export default MainSidebar