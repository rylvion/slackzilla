    import { lazy } from "react"

    // this file is used by MainSidebar, Sitemap and App.jsx to define the routes and links in the application
    const routes = [
        // PUBLIC PAGES
        { id: "dashboard", label: "Home", to: "/", description: "Live overview and bot activity", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Home"))},
        { id: "status", label: "Uptime", to: "/status", description: "Host and process telemetry", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Status"))},
        { id: "commands", label: "Commands", to: "/commands", description: "view available Slack commands", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Commands"))},
        { id: "logs", label: "Logs", to: "/logs", description: "ANSI-aware live output viewer", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Logs"))},
        { id: "api", label: "API", to: "/api", description: "Endpoint reference", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Api"))},
        { id: "ai", label: "AI Assistant", to: "/ai", description: "Ask questions about Slackzilla", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Ai"))},
        { id: "docs", label: "Docs", to: "/docs", description: "Operations and extension guide", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Docs"))},
        { id: "sitemap", label: "Sitemap", to: "/sitemap", description: "Routes and machine surfaces", danger: false, api: false, hidden: false, admin: false, component: lazy(() => import("../../pages/Sitemap"))},
    
        // admin pages
        { id: "admin", label: "Admin Dashboard", to: "/admin", description: "Manage, view, control administrative controls", danger: true, api: false, hidden: true, admin: true, component: lazy(() => import("../../pages/Admin"))},
        { id: "admin-events", label: "Server Events", to: "/admin/events", description: "Full authenticated server event history", danger: true, api: false, hidden: true, admin: true, component: lazy(() => import("../../pages/admin/ServerEvents"))},
        { id: "admin-errors", label: "Server Errors", to: "/admin/errors", description: "Full authenticated server error debugger", danger: true, api: false, hidden: true, admin: true, component: lazy(() => import("../../pages/admin/AdminErrors"))},
        { id: "admin-logs", label: "Admin Logs", to: "/admin/logs", description: "Authenticated log controls and viewer", danger: true, api: false, hidden: true, admin: true, component: lazy(() => import("../../pages/admin/AdminLogs"))},
        { id: "admin-login", label: "Admin", to: "/admin/login", description: "Login to the admin panel", danger: true, api: false, hidden: false, admin: true, component: lazy(() => import("../../pages/admin/Login"))},
    
        // API 
        {id: "api-status", label: "Public status JSON", to: "/api/status", description: "Use this for integrations and monitoring.", danger: false, api: true, hidden: true, admin: false, component: null},
        {id: "webhook", label: "GitHub webhook", to: "/webhook", description: "POST only, HMAC signature required.", danger: true, api: true, hidden: true, admin: false, component: null},
        {id: "api-commands", label: "Commands API", to: "/api/commands", description: "POST only, HMAC signature required.", danger: false, api: true, hidden: true, admin: false, component: null},
        {id: "api-ask", label: "AI assistant API", to: "/api/ask", description: "Repository-aware question answering.", danger: false, api: true, hidden: true, admin: false, component: null},

        // special pages
        {id: "not-found", label: "Not Found", to: "*", description: "404 page not found", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/NotFound"))}, // this is the catch-all route for 404 pages, it should always be last in the array
    ]

    // hidden: true means the link will not be shown in the main sidebar but can still be accessed directly via URL or programmatically (sitemap will still show it)
    // danger: true means the link is for admin or sensitive operations, and may require authentication or special permissions
    // api: true means the link is for API endpoints, and may be used for integrations or programmatic access
    // component: the React component that will be rendered when the link is accessed (if api then leave as null or undefined)
    // admin: true means the link will be shown in the main sidebar if the cookie or session indicates the user is an admin, otherwise it will be hidden
    export default routes
