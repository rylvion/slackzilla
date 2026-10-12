# Slackzilla

[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-v24.15.0-green?logo=nodedotjs&logoColor=white)
[![Slackzilla Version](https://img.shields.io/badge/Slackzilla-v0.9.6--beta-blueviolet)](https://github.com/rylvion/slackzilla/blob/main/)
[![Top Language](https://img.shields.io/github/languages/top/rylvion/slackzilla)](https://github.com/search?q=repo%3Arylvion%2Fslackzilla++language%3AJavaScript&type=code)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white)

Slackzilla is a full-stack Slack bot with a React-based web dashboard, HTTP API, server telemetry, administrative controls, and a repository-aware AI assistant. It also supports automated GitHub deployments, feedback management, and modular slash commands.

## Features

[![Slash commands](https://img.shields.io/badge/Slash%20Commands-25-blueviolet)](https://rylvion.hackclub.app/commands)
[![AI/RAG Tools](https://img.shields.io/badge/AI%20Tools-7-orange)](https://rylvion.hackclub.app/ai)
[![API Endpoints](https://img.shields.io/badge/API%20Endpoints-16-green)](https://rylvion.hackclub.app/api)
[![Admin Endpoints](https://img.shields.io/badge/Admin%20Endpoints-11-red)](https://rylvion.hackclub.app/api)
[![Admin Controls](https://img.shields.io/badge/Admin%20Controls-15-yellow)](https://rylvion.hackclub.app/admin)

![Real-time Updates](https://img.shields.io/badge/Real--time-SSE-blue)
![Security](https://img.shields.io/badge/Security-CSRF%20%2B%20Sessions-green)
[![RAG](https://img.shields.io/badge/RAG-Repository--Aware-purple)](docs/rag.md)
[![Deployment](https://img.shields.io/badge/Deployment-Automated-orange)](docs/webhook.md)

- 25 modular slash commands defined in `bot/data/commands.json`.
- 7 tools for the AI assistant: `getStatus`, `getCommands`, `getReleaseInfo`, `getTelemetry`, `getLogs`, `getMetrics`, and `runCommand`
- 16 public API endpoints, 11 admin endpoints, and 15 admin controls
- Generated Slack app manifest support.
- Public status, metrics, logs, commands, and AI APIs.
- Admin sessions with signed cookies, PBKDF2 password verification, CSRF protection, secure API access, and rate limiting.
- Feedback filtering, read/unread status, replies, and deletion.
- CPU, memory, disk, network, bot, command, and server request telemetry.
- React pages for the dashboard, status, commands, API reference, AI assistant, documentation, logs, sitemap, and admin workflows.
- GitHub push webhook validation with `HMAC-SHA256` and branch filtering.
- Repository-aware (RAG) AI assistant with lexical & deterministic retrieval, model generation, image asset discovery, and tools execution lists.

## Architecture

The backend uses Node's built-in `http` module rather than Express. API modules are explicit handlers imported and registered in `server/server.js`. Persistent runtime data is currently stored through the JSON-backed adapter in `server/database/store.js`; an external database is not required.

Check [docs](docs/docs.md) to see full navigation and overview of slackzilla

* [Setup](docs/setup.md) 
* [Architecture](docs/architecture.md)
* [API](docs/api.md)
* [RAG Assistant](docs/rag.md)
* [Security](docs/security.md)
* [Webhook](docs/webhook.md)
* [Server Setup](docs/server-setup.md)
* [POST command docs](docs/post/README.md)
* [Extension Guides](docs/extension/README.md)

## Requirements

- Node.js with `npm` (make sure all dependencies are installed with `npm ci` before running)
- A Slack app with Socket Mode enabled.
- Git for deployment features.
- Linux and systemd for the production service files. (Admin controls relies on bot service file being active too stop & start the bot, but you can still run the bot `npm start` on windows)
- (optional) An AI provider key for model-backed AI answers. (optional, but recommended for the `/ai` page, `/api/ask` endpoint and `/sz-ask` command)

## Setup

To run the project locally, clone the repository, install dependencies, and configure environment variables and then run the bot and dashboard by executing the following command. For more information, see the [Setup Guide](docs/setup.md).

```bash
npm start
```

## Dashboard Pages

[![Dashboard Pages](https://img.shields.io/badge/Dashboard%20Pages-12-blueviolet)](https://rylvion.hackclub.app/sitemap)
[![Public Pages](https://img.shields.io/badge/Public%20Pages-7-green)](https://rylvion.hackclub.app/sitemap)
[![Admin Pages](https://img.shields.io/badge/Admin%20Pages-5-red)](https://rylvion.hackclub.app/sitemap)

| Path            | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `/`             | Public bot and server dashboard.                                   |
| `/status`       | Runtime, CPU, memory, disk, and network telemetry with charts.     |
| `/commands`     | Command reference and trusted command runner.                      |
| `/logs`         | ANSI-aware live log viewer.                                        |
| `/ai`           | Repository-aware AI questions, sources, and related visual assets. |
| `/api`          | API endpoint reference.                                            |
| `/docs`         | In-app developer documentation.                                    |
| `/admin/login`  | Admin login and session creation.                                  |
| `/admin`        | Authenticated controls, feedback management, and server activity.  |
| `/admin/logs`   | Authenticated log viewer, deletion, rotation, and restoration.     |
| `/admin/errors` | Authenticated error log viewer and stream.                         |
| `/admin/events` | Authenticated server event stream.                                 |

Unknown browser routes return the React NotFound page with HTTP status `404`.

## API Quick Reference

![API Endpoints](https://img.shields.io/badge/API%20Endpoints-16-green)
![GET](https://img.shields.io/badge/GET-14-blue)
![POST](https://img.shields.io/badge/POST-3-orange)
![SSE](https://img.shields.io/badge/SSE-3-purple)

Public endpoints:

```bash
GET  /api/status
GET  /api/status/stream
GET  /api/telemetry
GET  /api/telemetry/stream
GET  /api/metrics
GET  /api/logs
GET  /api/logs/stream
GET  /api/logs/download
GET  /api/commands
GET  /api/commands/:id
POST /api/commands/:id
GET /api/ask
POST /api/ask
GET  /api/routes
GET  /api/release
GET  /api/session
POST  /webhook
```

Admin endpoints require a valid session cookie and CSRF protection for state-changing requests:

![Admin Endpoints](https://img.shields.io/badge/Admin%20Endpoints-11-red)
![GET](https://img.shields.io/badge/GET-8-blue)
![POST](https://img.shields.io/badge/POST-2-orange)
![SSE](https://img.shields.io/badge/SSE-2-purple)

```bash
GET  /api/admin/summary
GET  /api/admin/events
GET  /api/admin/feedback
GET  /api/admin/feedback/:id
POST /api/admin/feedback/:id
POST /api/admin/control
GET  /api/admin/errors
GET  /api/admin/errors/stream
GET  /api/admin/server-events
GET  /api/admin/log-archives
```

See the [API documentation](docs/api.md) for details on request and response formats, query parameters, and error codes.

## RAG Assistant

The `/ai` page and `/api/ask` endpoint retrieve relevant repository text before asking the configured AI model to answer. Retrieval excludes `priv/`, `.env` files, logs, dependencies, build output, and Git metadata. Related image assets are identified by filename and can be displayed without reading their binary contents. The assistant can execute a command only when a recognised slash command is explicitly requested. Command execution reuses the existing Slack command module and may have side effects, so command APIs should be restricted before production exposure.

See the [RAG documentation](docs/rag.md) for details on retrieval scoring, model generation, image assets, and command execution.

## Slack Commands

Commands are defined in `bot/data/commands.json` and implemented in `bot/cmds/`. To add a command:

1. Add its metadata to `bot/data/commands.json`.
2. Add the implementation to `bot/cmds/`.
3. Register it using the existing command module pattern.
4. Run `npm run validate-commands`.
5. Run `npm run generate-manifest` if the Slack manifest changed.
6. Restart the bot.

Utility commands support a `<command> help` form with usage examples. It also has a dedicated api endpoint.

See [Command Endpoints](docs/architecture.md#command-architecture) for details on command metadata, request and response formats, and error codes.

## GitHub Deployment Webhook

The dashboard accepts signed push events at `POST /webhook`. It verifies `X-Hub-Signature-256` with `WEBHOOK_SECRET`, requires a `push` event, checks `payload.ref` against `BRANCH`, records deployment state, and runs `server/deploy.sh`.

Read the [webhook guide](docs/webhook.md) before exposing the endpoint publicly.

## Production

For Linux deployment:

```bash
npm ci
npm run build
sudo cp server/slackzilla.service /etc/systemd/system/
sudo cp server/slackzilla-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now slackzilla.service slackzilla-webhook.service
```

Use a reverse proxy for HTTPS and set `COOKIE_SECURE=true`. Restart the appropriate service after code or environment changes.

## Scripts

| Command                     | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `npm start`                 | Build, lint, and start bot plus dashboard.           |
| `npm run bot`               | Start only the Slack bot.                            |
| `npm run server`            | Start only the dashboard server.                     |
| `npm run dev`               | Start Vite client development mode.                  |
| `npm run build`             | Build the React client.                              |
| `npm run lint`              | Lint the React client.                               |
| `npm run generate-manifest` | Generate `manifest.json`.                            |
| `npm run validate-manifest` | Validate the Slack manifest.                         |
| `npm run validate-commands` | Validate command metadata.                           |
| `npm run cmd-stats`         | Print command usage statistics.                      |
| `npm run build:pages`       | Build the static preview when that workflow is used. |

See [Testing](docs/testing.md#scripts) for more details

## License

[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)

no need for credits, but if your using this code in a project, i'd love to see what you do with it so if you make something cool with it, please share it with me!

if theres any issues, bugs or feature requests, please open an issue on the repository or reach out to me on the [Slackzilla Server](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) and ill try to help you out.
