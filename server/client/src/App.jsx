// DO NOT touch this file unless you know what your doing, this loads and renders the routes, WITHOUT this no routes will work and maybe cause a REACT_RENDER_ERROR
// to add a new page edit routes.js on ./components/utils/routes.js and follow the same structure as the other routes, then add a new page in ./pages and import it in routes.js, then add a new link in the sidebar by editing MainSidebar.jsx and adding a new <SidebarLink> component with the correct props, then add a new route in App.jsx by importing the new page and adding a new <Route> component with the correct path and element props, then add a new sitemap entry in Sitemap.jsx by adding a new object to the pages array with the correct path, label, description, api, 
import {
    BrowserRouter,
    Navigate,
    Routes,
    Route
} from "react-router-dom"

import { Suspense } from "react"
import routes from "./components/utils/routes"
import { SessionProvider, useSession } from "./components/utils/api"
import './css/init.css'
import isDebugMode from "./components/utils/debug"

function Loading() {
    return (
        <div className="loading">
            <span className="spinner"></span>
            <span className="loading-text">Loading</span>
        </div>
    )
}

function ProtectedRoute({ children }) {
    const { loading, authenticated } = useSession()

    if (loading) return <Loading />
    if (!authenticated) return <Navigate to="/admin/login" replace />

    return children
}

function renderRoutes(routes) {
    return routes
        .filter(route => !route.api)
        .map(route => {
            const Component = route.component
            const element = Component ? <Component /> : null
            const protectedElement = route.admin && route.to !== "/admin/login"
                ? <ProtectedRoute>{element}</ProtectedRoute>
                : element

            return <Route key={route.id} path={route.to} element={protectedElement} />
        })
}

function App() {
    if (isDebugMode) console.log("DEBUG MODE ENABLED!!!")

    // if (isDebugMode) { throw new Error("Test error boundary") } // uncomment to test error boundary

    return (
        <SessionProvider>
            <BrowserRouter>
                <Suspense fallback={<Loading />}>
                    <Routes>
                        {renderRoutes(routes)}
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </SessionProvider>
    )
}

export default App
