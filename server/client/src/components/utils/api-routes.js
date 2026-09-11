// Some of these routes may not be implemented this is utilised as a frontend
// This file documents and describes API routes available in the backend.
const API_ROUTES = [
    {
        version: "1.0.0",
        routes: [
            /*
            {
                id: "api-some-unique-id", // (DO NOT make it the same as any other route's id)
                operationId: "someUniqueOperationId", // so if in the future i want an mcp or expand RAG to use api then this is the unique identifier for this operation
                uuid: "some-unique-uuid", // (DO NOT make it the same as any other route's uuid)
                tags: ["tag1", "tag2"], // for grouping and filtering in the API reference
                method: "GET", // or POST, PUT, DELETE, PATCH, etc. (if there are 2 different methods then make another route object with the same path but different method)
                path: "/api/some-path", // the path of the route, relative to the server root
                description: "A brief description of what this route does.",
                categories: ["public", "private", "admin", "core", "monitoring", "commands", "logs", "streaming", "feedback", "control"], // for grouping and filtering in the API reference
                livesAt: "/server/api/some-path/index.js", // the file where this route is implemented
                schema: "/server/api/some-path/some-path.schema.json", // the JSON schema file for this route's request 
            }
            */
            {
                id: "api-commands",
                operationId: "listCommands",
                uuid: "d3ad1f1a-2d2a-4e1a-9b82-57ca62fdb1b9",
                tags: ["commands"],
                method: "GET",
                path: "/api/commands",
                description: "List command IDs, descriptions, categories and usage hints.",
                categories: ["public", "commands"],
                livesAt: "/server/api/commands/index.js",
                schema: null,
                parameters: [],
                responses: { "200": { description: "Command metadata", schema: null }},
            },
            {
                id: "api-command",
                operationId: "executeCommand",
                uuid: "72f8229a-05d0-41a4-ae8d-a14e8e8e6b11",
                tags: ["commands"],
                method: "POST",
                path: "/api/commands/:id",
                description: "Execute an existing Slack command through the API adapter.",
                categories: ["public", "commands"],
                livesAt: "/server/api/commands/index.js",
                schema: null,
                parameters: [
                    { name: "id", in: "path", required: true, type: "string" },
                    { name: "text", in: "body", required: false, type: "string" }
                ],
                responses: { "200": { description: "Captured command responses", schema: null }, "404": { description: "Command not found", schema: null } }
            },
            {
                id: "api-command-help",
                operationId: "getCommandHelp",
                uuid: "0f2fa13a-1d9d-4a0a-9349-2c4a07c2f348",
                tags: ["commands", "help"],
                method: "GET",
                path: "/api/commands/:id",
                description: "Return metadata and a usage hint for one command.",
                categories: ["public", "commands", "help"],
                livesAt: "/server/api/commands/index.js",
                schema: null,
                parameters: [{ name: "id", in: "path", required: true, type: "string" }],
                responses: { "200": { description: "Command help", schema: null } }
            },
            {
                id: "api-ask",
                operationId: "answerCodebaseQuestion",
                uuid: "b6a4c3f4-7622-4ec6-9a9c-0cbf5a9b11a8",
                tags: ["rag", "assistant"],
                method: "POST",
                path: "/api/ask",
                description: "Retrieve relevant Slackzilla source files and answer a codebase question; optionally execute an explicitly selected command.",
                categories: ["public", "assistant", "codebase"],
                livesAt: "/server/api/ask/index.js",
                schema: null,
                parameters: [
                    { name: "question", in: "body", required: true, type: "string" },
                    { name: "commandId", in: "body", required: false, type: "string" },
                    { name: "commandText", in: "body", required: false, type: "string" }
                ],
                responses: { "200": { description: "Answer, sources, and optional command result", schema: null } }
            },
            {
                id: "api-status",
                operationId: "getApiStatus",
                uuid: "aef3c1e0-4b2a-4d5e-9f8b-1c2d3e4f5a6b",
                tags: ["system", "monitoring"],
                method: "GET",
                path: "/api/status",
                description: "Public host, process and bot telemetry.",
                categories: ["core", "monitoring", "public"],
                livesAt: "/server/api/status/index.js",
                schema: "/server/api/status/status.schema.json",
                parameters: [],
                responses: { "200": { description: "Status payload", schema: "/server/api/status/status.schema.json" } }
            },
            {
                id: "api-status-stream",
                operationId: "streamApiStatus",
                uuid: "c8e91a1b-55d1-4a85-9f7f-0d87b40c5d72",
                tags: ["system", "monitoring", "events"],
                method: "GET",
                path: "/api/status/stream",
                description: "Server-sent status updates for the dashboard.",
                categories: ["monitoring", "public", "streaming"],
                livesAt: "/server/api/status/index.js",
                schema: "/server/api/status/status.schema.json",
                parameters: [],
                responses: { "200": { description: "text/event-stream status events", schema: "/server/api/status/status.schema.json" } }
            },
            {
                id: "api-logs",
                operationId: "getApiLogs",
                uuid: "3c8eebc0-1bb8-4b0d-92c4-8b7a9b8e1fd0",
                tags: ["logs"],
                method: "GET",
                path: "/api/logs",
                description: "Return the current dashboard log snapshot.",
                categories: ["public", "logs"],
                livesAt: "/server/api/logs/index.js",
                schema: "/server/api/logs/logs.schema.json",
                parameters: [],
                responses: { "200": { description: "Log lines and byte size", schema: "/server/api/logs/logs.schema.json" } }
            },
            {
                id: "api-logs-stream",
                operationId: "streamApiLogs",
                uuid: "9a4f5ed8-c4f3-4f20-8c2d-1d521d5d31a4",
                tags: ["logs", "events"],
                method: "GET",
                path: "/api/logs/stream",
                description: "Stream log snapshots and new log lines.",
                categories: ["public", "logs", "streaming"],
                livesAt: "/server/api/logs/index.js",
                schema: "/server/api/logs/logs.schema.json",
                parameters: [],
                responses: { "200": { description: "text/event-stream log events", schema: "/server/api/logs/logs.schema.json" } }
            },
            {
                id: "api-logs-download",
                operationId: "downloadApiLogs",
                uuid: "5bf2ad8f-12d5-4b9e-9dc4-cc6a548a2b8f",
                tags: ["logs"],
                method: "GET",
                path: "/api/logs/download",
                description: "Download the current log snapshot as plain text.",
                categories: ["public", "logs"],
                livesAt: "/server/api/logs/index.js",
                schema: null,
                parameters: [],
                responses: { "200": { description: "text/plain log content", schema: null } }
            },
            {
                id: "api-metrics",
                operationId: "getApiMetrics",
                uuid: "2d9cebf1-5d39-4e4d-b0f3-17a5d25cc144",
                tags: ["metrics", "monitoring"],
                method: "GET",
                path: "/api/metrics",
                description: "Return bot command and usage metrics.",
                categories: ["public", "monitoring"],
                livesAt: "/server/api/metrics/index.js",
                schema: "/server/api/metrics/metrics.schema.json",
                parameters: [],
                responses: { "200": { description: "Bot metrics", schema: "/server/api/metrics/metrics.schema.json" } }
            },
            {
                id: "api-admin-summary",
                operationId: "getAdminSummary",
                uuid: "0e5b17e4-f6b9-4a4b-a8b6-9f10e246d09c",
                tags: ["admin"],
                method: "GET",
                path: "/api/admin/summary",
                description: "Return the authenticated admin dashboard summary.",
                categories: ["admin", "private"],
                livesAt: "/server/api/admin/index.js",
                schema: "/server/api/admin/admin.schema.json",
                parameters: [],
                authentication: "admin session cookie",
                responses: { 
                    "200": { description: "Admin summary", schema: "/server/api/admin/admin.schema.json" }, 
                    "401": { description: "Admin session required", schema: null } 
                }
            },
            {
                id: "api-admin-events",
                operationId: "streamAdminEvents",
                uuid: "f3b8b5d8-20de-4e20-87c8-0c594ba2a8f1",
                tags: ["admin", "events"],
                method: "GET",
                path: "/api/admin/events",
                description: "Stream authenticated admin dashboard updates.",
                categories: ["admin", "private", "streaming"],
                livesAt: "/server/api/admin/index.js",
                schema: "/server/api/admin/admin.schema.json",
                parameters: [],
                authentication: "admin session cookie",
                responses: { 
                    "200": { description: "text/event-stream admin events", schema: "/server/api/admin/admin.schema.json" }, 
                    "401": { description: "Admin session required", schema: null }
                }
            },
            {
                id: "api-admin-control",
                operationId: "postAdminControl",
                uuid: "4b95a8e6-8ed3-4d4a-9a8a-cc2c1c1d6e40",
                tags: ["admin", "control"],
                method: "POST",
                path: "/api/admin/control", // accepts 
                description: "Run an authenticated service or refresh action.",
                categories: ["admin", "private", "control"],
                livesAt: "/server/api/control/index.js",
                schema: "/server/api/control/control.schema.json",
                parameters: [
                    { name: "action", in: "body", required: true, type: "string" },
                    { name: "csrf", in: "body", required: true, type: "string" }
                ],
                authentication: "admin session cookie and CSRF token",
                responses: { 
                    "200": { description: "Action result", schema: "/server/api/control/control.schema.json" },
                    "403": { description: "Invalid CSRF token", schema: null } 
                }
            },
            {
                id: "api-admin-feedback",
                operationId: "getAdminFeedback",
                uuid: "f20e5e8a-7d9c-4dd0-9d7a-6c0e7b2dbf3a",
                tags: ["admin", "feedback"],
                method: "GET",
                path: "/api/admin/feedback",
                description: "List authenticated feedback, optionally filtered by query and status.",
                categories: ["admin", "private", "feedback"],
                livesAt: "/server/api/feedback/index.js",
                schema: "/server/api/feedback/feedback.schema.json",
                parameters: [{ name: "q", in: "query", required: false, type: "string" }, { name: "status", in: "query", required: false, type: "string" }],
                authentication: "admin session cookie",
                responses: { 
                    "200": { description: "Feedback list", schema: "/server/api/feedback/feedback.schema.json" },
                    "401": { description: "Admin session required", schema: null }
                }
            },
            {
                id: "api-admin-feedback-item",
                operationId: "getAdminFeedbackItem",
                uuid: "8cf2cf40-e2eb-4a87-bd3f-4df7981dbb71",
                tags: ["admin", "feedback"],
                method: "GET",
                path: "/api/admin/feedback/:id",
                description: "Retrieve one authenticated feedback item.",
                categories: ["admin", "private", "feedback"],
                livesAt: "/server/api/feedback/index.js",
                schema: "/server/api/feedback/feedback.schema.json",
                parameters: [{ name: "id", in: "path", required: true, type: "string" }],
                authentication: "admin session cookie",
                responses: { 
                    "200": { description: "Feedback item", schema: "/server/api/feedback/feedback.schema.json" },
                    "404": { description: "Feedback not found", schema: null } 
                }
            },
            {
                id: "api-admin-feedback-action",
                operationId: "postAdminFeedbackAction",
                uuid: "a5d9d5c7-7b76-403d-9ef8-343da9d1d7ac",
                tags: ["admin", "feedback"],
                method: "POST",
                path: "/api/admin/feedback/:id",
                description: "Read, delete, or respond to an authenticated feedback item.",
                categories: ["admin", "private", "feedback"],
                livesAt: "/server/api/feedback/index.js",
                schema: "/server/api/feedback/feedback.schema.json",
                parameters: [
                    { name: "id", in: "path", required: true, type: "string" },
                    { name: "action", in: "body", required: true, type: "string" },
                    { name: "csrf", in: "body", required: true, type: "string" }
                ],
                authentication: "admin session cookie and CSRF token",
                responses: { "200": { description: "Updated feedback item", schema: "/server/api/feedback/feedback.schema.json" }, "403": { description: "Invalid CSRF token", schema: null } }
            },
            {
                id: "api-webhook",
                operationId: "handleGitHubWebhook",
                uuid: "c0c2b1a4-9f3d-4e8b-9c77-2a1f0d9e7abc",
                tags: ["webhook", "deployment", "github"],
                method: "POST",
                path: "/webhook",
                description: "Handle GitHub push events, verify HMAC signature, filter branch, and trigger deployment.",
                categories: ["public", "webhook", "deployment"],
                livesAt: "/server/server.js",
                schema: null,
                parameters: [
                    { name: "X-GitHub-Event", in: "header", required: true, type: "string" },
                    { name: "X-Hub-Signature-256", in: "header", required: true, type: "string" },
                    { name: "Content-Type", in: "header", required: true, type: "string" },
                    { name: "rawBody", in: "body", required: true, type: "string" }
                ],
                responses: {
                    "202": { description: "Accepted deploy or ignored event", schema: null },
                    "400": { description: "Invalid JSON payload", schema: null },
                    "401": { description: "Invalid signature", schema: null }
                }
            }

        ]
    }
]

export default API_ROUTES