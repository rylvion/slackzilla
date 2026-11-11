    import { lazy } from "react"

    // this file is used by MainSidebar, Sitemap and App.jsx to define the routes and links in the application
    const routes = [
        // PUBLIC PAGES
        { id: "home", label: "Dashboard", to: "/", description: "live telemetry and metrics", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Status"))},
        { id: "commands", label: "Commands", to: "/commands", description: "view and execute slack commands", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Commands"))},
        { id: "logs", label: "Logs", to: "/logs", description: "live log stream", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Logs"))},
        { id: "terminal", label: "Terminal", to: "/terminal", description: "embedded terminal", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Terminal"))},
        { id: "api", label: "API", to: "/api", description: "lists all api endpoints", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Api"))},
        { id: "ai", label: "AI Assistant", to: "/ai", description: "ask question to ai with codebase context", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Ai"))},
        { id: "docs-search", label: "Docs Search", to: "/docs/search", description: "search docs", danger: false, api: false, hidden: true, admin: false, component: lazy(() => import("../../pages/DocsSearch"))},
        { id: "docs", label: "Docs", to: "/docs", path: "/docs/*", description: "docs", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Docs"))},
        { id: "sitemap", label: "Sitemap", to: "/sitemap", description: "shows all pages", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Sitemap"))},
    
        // admin pages
        { id: "admin-login", label: "Admin", to: "/admin/login", description: "login to the admin panel", danger: true, api: false, hidden: false, admin: true, component: lazy(() => import("../../pages/admin/Login"))},
        { id: "admin", label: "Admin Dashboard", to: "/admin", description: "manage, view and control admin actions", danger: true, api: false, hidden: true, admin: true, component: lazy(() => import("../../pages/Admin"))},
        { id: "admin-events", label: "Server Events", to: "/admin/events", description: "view and manage inbound requests", danger: true, api: false, hidden: true, admin: true, adminOnly: true, component: lazy(() => import("../../pages/admin/ServerEvents"))},
        { id: "admin-errors", label: "Server Errors", to: "/admin/errors", description: "view and manage server errors", danger: true, api: false, hidden: true, admin: true, adminOnly: true, component: lazy(() => import("../../pages/admin/AdminErrors"))},
        { id: "admin-logs", label: "Admin Logs", to: "/admin/logs", description: "manipulate logs at your own discretion", danger: true, api: false, hidden: true, admin: true, component: lazy(() => import("../../pages/admin/AdminLogs"))},

        // special pages
        {id: "not-found", label: "Not Found", to: "*", description: "404 page not found", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/NotFound"))}, // this is the catch-all route for 404 pages, it should always be last in the array
    ]

    // hidden: true means the link will not be shown in the main sidebar but can still be accessed directly via URL or programmatically (sitemap will still show it)
    // danger: true means the link is for admin or sensitive operations, and may require authentication or special permissions
    // api: true means the link is for API endpoints, and may be used for integrations or programmatic access
    // component: the React component that will be rendered when the link is accessed (if api then leave as null or undefined)
    // admin: true means the link will be shown in the main sidebar if the cookie or session indicates the user is an admin, otherwise it will be hidden
    // adminOnly: true means a hidden link is shown in the main sidebar only while an admin session is authenticated
    export default routes
