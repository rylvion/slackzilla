# Slackzilla

Slackzilla is a modular Slack bot with a hosted React dashboard, HTTP API, GitHub deployment webhook, telemetry, feedback management, and a repository-aware AI assistant.

## Links

- [Hosted dashboard](https://rylvion.hackclub.app/)
- [Static preview](https://rylvion.github.io/slackzilla/)
- [Documentation](https://rylvion.github.io/slackzilla/docs/)
- [Wiki](https://github.com/rylvion/slackzilla/wiki)
- [Repository](https://github.com/rylvion/slackzilla)
- [GitHub devlogs](https://github.com/rylvion/slackzilla/blob/main/assets/devlogs/devlogs.md)
- [Stardance devlogs](https://stardance.hackclub.com/projects/4967)

## What It Does

Slackzilla has two main runtime processes:

1. A Slack bot in `bot/` that uses Slack Bolt Socket Mode and responds to data-driven slash commands.
2. A dashboard and webhook server in `server/` that serves the React interface, APIs, telemetry, logs, admin controls, feedback management, and GitHub deployment flow.

Other project capabilities include:

- 23 modular slash commands defined in `bot/data/commands.json`.
- Generated Slack app manifest support.
- Public status, metrics, logs, commands, and AI APIs.
- Admin sessions with signed cookies, PBKDF2 password verification, CSRF protection, and rate limiting.
- Feedback filtering, read/unread status, replies, and deletion.
- CPU, memory, disk, network, bot, command, and server request telemetry.
- React pages for the dashboard, status, commands, API reference, AI assistant, documentation, logs, sitemap, and admin workflows.
- GitHub push webhook validation with HMAC-SHA256 and branch filtering.
- Related repository image assets in AI responses, such as calculator flowcharts.

## Architecture

```text
Slack Socket Mode -> bot/bot.js -> bot/cmds/*
                              -> server/database and server/logs

Browser/GitHub -> server/server.js
               -> React dashboard
               -> server/api/*
               -> authentication and telemetry
               -> deployment webhook
```

The backend uses Node's built-in `http` module rather than Express. API modules are explicit handlers imported and registered in `server/server.js`. Persistent runtime data is currently stored through the JSON-backed adapter in `server/database/store.js`; an external database is not required.

Read the detailed guides in [`docs/`](docs/docs.md):

- [Setup](docs/setup.md)
- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [RAG assistant](docs/rag.md)
- [Security](docs/security.md)
- [Webhook](docs/webhook.md)
- [Server setup](docs/server-setup.md)

## Requirements

- Node.js with npm.
- A Slack app with Socket Mode enabled.
- Git for deployment features.
- Linux and systemd for the production service files.
- An AI provider key for model-backed AI answers.

## Setup

Install dependencies:

```bash
npm ci
```

Copy the environment templates:

```bash
cp bot/.env.example bot/.env
cp server/.env.example server/.env
```

On Windows, copy the files using Explorer or PowerShell instead. Fill in the Slack credentials in `bot/.env`:

```text
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
```

Optional AI settings belong in `bot/.env`:

```text
AI_API_KEY=...
AI_MODEL=openai/gpt-oss-20b:free
AI_URL=https://ai.hackclub.com/proxy/v1/chat/completions
```

Configure `server/.env` with at least:

```text
WEBHOOK_SECRET=...
PORT=9000
PROJECT_DIR=/absolute/path/to/slackzilla
BRANCH=main
REPO_URL=https://github.com/your-user/slackzilla.git
ADMIN_PASSWORD_HASH=pbkdf2$sha512$600000$salt$derived-key
ADMIN_SESSION_SECRET=...
COOKIE_SECURE=false
```

Set `SLACK_BOT_TOKEN` in `server/.env` as well when dashboard feedback replies need to send Slack DMs. The dashboard can fall back to `bot/.env` during local development.

Generate an admin password hash with the bot command:

```text
/sz-hash pbkdf2 sha512 600000 your-password
```

Copy the returned `pbkdf2$...` value into `ADMIN_PASSWORD_HASH`, then log in using the original password. See [Security](docs/security.md) for the technical details.

## Running Locally

Run the complete local runtime:

```bash
npm start
```

This builds and lints the React client, then starts the bot and dashboard server. Open:

```text
http://localhost:9000
```

For dashboard-only development:

```bash
npm run build
npm run server
```

For React hot reload:

```bash
npm run dev
```

Vite serves the client at `http://localhost:5173`, but the Vite-only workflow does not provide the real backend APIs, logs, telemetry, or bot connection.

Windows supports the dashboard, APIs, telemetry, React pages, and command runner. Linux-specific service operations such as `systemctl` and Bash deployment are expected to fail locally on Windows.

## Dashboard Pages

| Path | Purpose |
| --- | --- |
| `/` | Public bot and server dashboard. |
| `/status` | Runtime, CPU, memory, disk, and network telemetry with charts. |
| `/commands` | Command reference and trusted command runner. |
| `/ai` | Repository-aware AI questions, sources, and related visual assets. |
| `/api` | API endpoint reference. |
| `/docs` | In-app developer documentation. |
| `/logs` | ANSI-aware live log viewer. |
| `/admin/login` | Admin login and session creation. |
| `/admin` | Authenticated controls, feedback management, and server activity. |

Unknown browser routes return the React NotFound page with HTTP status `404`.

## API Quick Reference

Public endpoints:

```text
GET  /api/status
GET  /api/status/stream
GET  /api/metrics
GET  /api/logs
GET  /api/logs/stream
GET  /api/logs/download
GET  /api/commands
GET  /api/commands/:id
POST /api/commands/:id
GET  /api/ask
POST /api/ask
```

Admin endpoints require a valid session cookie and CSRF protection for state-changing requests:

```text
GET  /api/admin/summary
GET  /api/admin/events
GET  /api/admin/feedback
GET  /api/admin/feedback/:id
POST /api/admin/feedback/:id
POST /api/admin/control
```

Example command API request:

```bash
curl -X POST http://localhost:9000/api/commands/calculator \
  -H "Content-Type: application/json" \
  -d '{"text":"2 + 3"}'
```

Example AI request:

```bash
curl -X POST http://localhost:9000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does feedback authentication work?"}'
```

## RAG Assistant

The `/ai` page and `/api/ask` endpoint retrieve relevant repository text before asking the configured AI model to answer. Retrieval excludes `priv/`, `.env` files, logs, dependencies, build output, and Git metadata. Related image assets are identified by filename and can be displayed without reading their binary contents.

The assistant can execute a command only when a recognised slash command is explicitly requested. Command execution reuses the existing Slack command module and may have side effects, so command APIs should be restricted before production exposure.

## Slack Commands

Commands are defined in `bot/data/commands.json` and implemented in `bot/cmds/`. To add a command:

1. Add its metadata to `bot/data/commands.json`.
2. Add the implementation to `bot/cmds/`.
3. Register it using the existing command module pattern.
4. Run `npm run validate-commands`.
5. Run `npm run generate-manifest` if the Slack manifest changed.
6. Restart the bot.

Utility commands generally support a `<command> help` form with usage examples.

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

| Command | Purpose |
| --- | --- |
| `npm start` | Build, lint, and start bot plus dashboard. |
| `npm run bot` | Start only the Slack bot. |
| `npm run server` | Start only the dashboard server. |
| `npm run dev` | Start Vite client development mode. |
| `npm run build` | Build the React client. |
| `npm run lint` | Lint the React client. |
| `npm run generate-manifest` | Generate `manifest.json`. |
| `npm run validate-manifest` | Validate the Slack manifest. |
| `npm run validate-commands` | Validate command metadata. |
| `npm run cmd-stats` | Print command usage statistics. |
| `npm run build:pages` | Build the static preview when that workflow is used. |

## Validation

```bash
npm run build
npm run lint
npm run validate-manifest
npm run validate-commands
```

## License

MIT. See [LICENSE](LICENSE).
