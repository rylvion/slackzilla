import { Fragment } from "react"
import { Link } from "react-router-dom"
import routes from "./utils/routes"

function RouteLinks({ routes, active }) {
    return routes.map(route => (
        <Fragment key={route.id}>
            {!route.api && !route.hidden && (
                <Link
                    className={active === route.id ? "active" : ""}
                    to={route.to}
                >
                    {route.label}
                </Link>
            )}

            {route.children?.length > 0 && (
                <RouteLinks
                    routes={route.children}
                    active={active}
                />
            )}
        </Fragment>
    ))
}

function MainSidebar({ active, state }) {
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