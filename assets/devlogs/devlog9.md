![React Dashboard](../attachments/d9/dashboard.png)

# Devlog 9: React Dashboard
time logged: still progressing
date: 25/08/2026

The React dashboard is finally here! I completely replaced/mitigrated the old EJS dashboard with a new React app. THIS will be the biggest devlog yet, as it covers a lot of changes and new features. Main features added is mitigration, codebase assistance, graphs, telemetary and a new api.

Heres a summary of what i changed
- renamed `src/` to `bot/` - this is because its related to the bot and not the server and its not where all the main files are
- mitigrated the EJS dashboard into a React app
- overhauled the UI
- deleted the pages system and the workflow to build it
- added a new RAG modal that answers questions about the repo and shows related visual assets (also includes a new `rag.js` file that handles the retrieval and generation of answers)

The react dashboard has the following features:
- 10 pages (Home, Api, Commands, Docs, Home, Logs, NotFound, Sitemap, Status)
- 7 components
- 5 utilities js exports in the `utils/` folder
- 404 page (with routing) and Error Boundary modal page
- public AI assistant page with repository-aware retrieval and related visual assets
- command API with stable IDs, command help, and captured command responses (basically allows programmatically execution of commands outside of slack)
- command runner moved to the Commands page, keeping AI questions separate from command execution
- public status, logs, metrics, command, and AI API endpoints
- admin feedback controls for filtering, viewing, replying, marking read/unread, and deleting
- confirmation gates for dangerous service actions and feedback deletion
- CPU, memory, disk, and network telemetry with responsive graphs and hover data tooltips (so satisfying)

## Current React Architecture

The active client source lives in `server/client/src/`. Vite builds it into `server/client/dist/`, which is served by `server/server.js`. React Router renders the page routes declared in `server/client/src/components/utils/routes.js`. The server still owns the HTTP status code: known browser routes receive the React shell with `200`, while unknown browser routes receive the same shell with `404` so the client can render the NotFound page without hiding the correct HTTP semantics.

The old EJS dashboard and static page-generation flow are no longer the active dashboard path. The bot remains in `bot/`, separate from the dashboard server, and the server uses explicit Node `http` handlers under `server/api/`.

## RAG and Command APIs

The new `/ai` page sends questions to `POST /api/ask`. `server/lib/rag.js` retrieves relevant repository text while excluding `priv/`, `.env` files, dependencies, logs, and build output. It can identify related image assets such as the calculator flowchart without parsing binary image contents. If configured, the retrieved context is sent to the AI provider; otherwise the endpoint returns a local configuration message and source metadata.

Commands are exposed through `GET /api/commands`, `GET /api/commands/:id`, and `POST /api/commands/:id`. The API adapter reuses the same command modules as Slack and captures their responses. The Commands page provides the interactive runner, while the AI page remains focused on repository questions. Explicit natural-language requests can still ask the RAG service to execute a recognised slash command and return its actual result.

## Lessons and Limitations

The migration exposed several boundaries that are now documented in `docs/`: authentication and CSRF, the webhook protocol, API registration, setup, and RAG behaviour. Runtime persistence is still file-backed through `server/database/store.js`; an external database remains a future adapter project rather than a required dependency.

Linux systemd controls and deployment scripts are intended for the hosted environment. On Windows local development, the dashboard, APIs, telemetry, and React pages work, but system service actions and Bash deployment are not expected to succeed. The dashboard must be rebuilt and restarted after production client or server changes.