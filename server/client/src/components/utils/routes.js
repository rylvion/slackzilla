import { lazy } from "react"

// this file is used by MainSidebar, Sitemap and App.jsx to define the routes and links in the application
const routes = [
    // PUBLIC PAGES
    { id: "dashboard", label: "Home", to: "/", description: "Live overview and bot activity", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Home")), children: [] },
    { id: "status", label: "Uptime", to: "/status", description: "Host and process telemetry", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Status")), children: [] },
    { id: "commands", label: "Commands", to: "/commands", description: "view available Slack commands", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Commands")), children: [] },
    { id: "logs", label: "Logs", to: "/logs", description: "ANSI-aware live output viewer", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Logs")), children: []},
    { id: "api", label: "API", to: "/api", description: "Endpoint reference", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Api")), children: []},
    { id: "ai", label: "AI Assistant", to: "/ai", description: "Ask questions about Slackzilla", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Ai")), children: [] }  ,
    { id: "docs", label: "Docs", to: "/docs", description: "Operations and extension guide", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Docs")), children: [
        // {id: "installation", label: "Setup slackzilla", to: "/docs/installation", description: "Installation instructions", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/Installation")), children: []},
        // {id: "adding-a-command", label: "Adding a command", to: "/docs/adding-commands", description: "How to add a new command to slackzilla", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/AddingCommands")), children: []},
        // {id: "adding-an-api", label: "Adding an API", to: "/docs/adding-apis", description: "How to add a new API endpoint to slackzilla", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/AddingAnApi")), children: []},
        // {id: "adding-a-page", label: "Adding a page", to: "/docs/adding-a-page", description: "How to add a new page to slackzilla", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/AddingAPage")), children: []},
        // {id: "api-documentation", label: "API documentation", to: "/docs/api", description: "A detailed documentation of the API", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/docs/ApiDocumentation")), children: [
        //     {id: "api-documentation-commands", label: "Commands API", to: "/docs/api/commands", description: "A detailed documentation of the Commands API", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/api/Commands")), children: []},
        //     {id: "api-documentation-webhook", label: "Webhook API", to: "/docs/api/webhook", description: "A detailed documentation of the Webhook API", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/api/Webhook")), children: []},
        //     {id: "api-documentation-rest", label: "REST API", to: "/docs/api/rest", description: "A detailed documentation of the REST API", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/docs/api/Rest")), children: []},
        // ]},
    ]},
    { id: "sitemap", label: "Sitemap", to: "/sitemap", description: "Routes and machine surfaces", danger: false, api: false, hidden: false, component: lazy(() => import("../../pages/Sitemap")), children: [] },
    { id: "admin", label: "Admin Dashboard", to: "/admin", description: "Manage, view, control administrative controls", danger: true, api: false, hidden: true, component: lazy(() => import("../../pages/Admin")), children: [] },
    { id: "admin-login", label: "Admin", to: "/admin/login", description: "Login to the admin panel", danger: true, api: false, hidden: false, component: lazy(() => import("../../pages/admin/Login")), children: [] }, // this isnt listed as a child of admin because it should be accessible without being logged in (bcs its very important)
    // API 
    {id: "api-status", label: "Public status JSON", to: "/api/status", description: "Use this for integrations and monitoring.", danger: false, api: true, hidden: true, component: null, children: []},
    {id: "webhook", label: "GitHub webhook", to: "/webhook", description: "POST only, HMAC signature required.", danger: true, api: true, hidden: true, component: null, children: []},
    {id: "api-commands", label: "Commands API", to: "/api/commands", description: "POST only, HMAC signature required.", danger: false, api: true, hidden: true, component: null, children: []},
    {id: "api-ask", label: "AI assistant API", to: "/api/ask", description: "Repository-aware question answering.", danger: false, api: true, hidden: true, component: null, children: []},

    {id: "not-found", label: "Not Found", to: "*", description: "404 page not found", danger: false, api: false, hidden: true, component: lazy(() => import("../../pages/NotFound")), children: []}, // this is the catch-all route for 404 pages, it should always be last in the array

]

// hidden: true means the link will not be shown in the main sidebar but can still be accessed directly via URL or programmatically (sitemap will still show it)
// danger: true means the link is for admin or sensitive operatixons, and may require authentication or special permissions
// api: true means the link is for API endpoints, and may be used for integrations or programmatic access
// component: the React component that will be rendered when the link is accessed (if api then leave as null or undefined)
// children: an array of sub-routes or sub-pages, each following the same structure as the parent route

export default routes