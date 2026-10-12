# Slackzilla Documentation

## Guides

* [Setup](setup.md) - Configure Slack, local development, AI, and production services.
* [Architecture](architecture.md) - Processes, request dispatch, storage, telemetry, and deployment.
* [API](api.md) - Endpoint reference and API implementation guide.
* [RAG Assistant](rag.md) - Retrieval, model generation, image assets, and command execution.
* [Security](security.md) - Authentication, authorisation, cookies, sessions, PBKDF2, and CSRF.
* [Webhook](webhook.md) - GitHub signature verification and deployment flow.
* [Server Setup](server-setup.md) - Linux host, systemd, dashboard, and webhook checklist.
* [Testing](testing.md) - Automated tests, validation checks, RAG tools, and npm scripts.
* [Extension Docs](extension/README.md) - List of extension guides 
* [POST commands](post/README.md) - List of POST commands for Slackzilla bot and dashboard.

## Extension Guides

* [Command Extensions](command-extension-guide.md) - Add new commands to the bot and dashboard.
* [RAG Extensions](react-extension-guide.md) - Add new RAG tools and AI
* [Dashboard Extensions](api-extension-guide.md) - Add new public/private API endpoints.

## POST Commands

* [`POST /api/admin/control`](post/admin-control.md)
* [`POST /api/admin/feedback`](post/admin-feedback.md)
* [`POST /api/ask`](post/ask.md)
* [`POST /api/command`](post/command.md)

## Project Referencess

* [Devlogs](../assets/devlogs/devlogs.md) - Development history and implementation notes.
* [Stardance Devlogs](https://stardance.hackclub.com/projects/4967) - Hack Club devlogs
* [Repository](https://github.com/rylvion/slackzilla) - Source code
* [Hosted dashboard](https://rylvion.hackclub.app/) - live React dashboard and bot interface.
* [Slackzilla Server](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) - help channel for Slackzilla bot and dashboard.

## about slackzilla

Slackzilla is a full-stack Slack application built with Node.js, Slack Bolt, React and Vite. It combines a Slack bot with a web dashboard for managing commands, monitoring application activity, viewing logs and handling administrative operations.

The project is split into two main processes:

* **Bot:** Maintains the Slack connection through Socket Mode and handles Slack events and commands.
* **Dashboard server:** Serves the web interface and provides HTTP APIs for authentication, session management, monitoring and administrative operations.

The dashboard uses React and Vite, while the backend uses Node.js and a built-in HTTP server. Both processes share file-backed storage for application data. Slackzilla is designed with a modular architecture, separating bot functionality, server-side operations and frontend components to make the codebase easier to maintain, test and extend.

For implementation details, see [Architecture](architecture.md), [API Reference](api.md) and [Security](security.md).

this is a solo project by rylvion (me :D) and is open source under the MIT license