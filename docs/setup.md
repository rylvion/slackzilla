# Slackzilla Setup Guide

This guide covers local development and production. Slackzilla contains a Slack bot, a dashboard/webhook server, and a React client built with Vite.

## Prerequisites

- Node.js and npm.
- A Slack app installed in a workspace.
- Git for deployment features.
- Linux, sudo, and systemd for production service files.
- An AI provider key only if the AI assistant is required.

## Create the Slack App

1. Open [Slack API Your Apps](https://api.slack.com/apps) and create a blank app in the target workspace.
2. Add a bot user and install the app.
3. Copy the Bot User OAuth Token (`xoxb-...`) as `SLACK_BOT_TOKEN`.
4. Create an app-level token with `connections:write` and set it as `SLACK_APP_TOKEN`.
5. Copy the app Signing Secret as `SLACK_SIGNING_SECRET`.
6. Add the scopes and slash commands required by `manifest.json`.

The bot uses Socket Mode, so it does not require a public inbound Slack HTTP endpoint.

## Environment Files

Copy `bot/.env.example` to `bot/.env` and set:

```text
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
AI_API_KEY=...                 # optional
AI_MODEL=openai/gpt-oss-20b:free
AI_URL=https://ai.hackclub.com/proxy/v1/chat/completions
```

Copy `server/.env.example` to `server/.env` and set:

```text
WEBHOOK_SECRET=...
PORT=9000
PROJECT_DIR=/absolute/path/to/slackzilla
BRANCH=main
REPO_URL=https://github.com/your-user/slackzilla.git
ADMIN_PASSWORD_HASH=pbkdf2$sha512$600000$salt$derived-key
ADMIN_SESSION_SECRET=...
COOKIE_SECURE=false
SLACK_BOT_TOKEN=xoxb-...       # needed for dashboard feedback replies
```

The dashboard loads `server/.env` first and can fall back to `bot/.env` for the bot token during local development. Keep secrets out of version control. `PROJECT_DIR` must exist; it is used for Git and disk telemetry and deployment scripts.

## Generate an Admin Hash

Use the bot command after the bot is running:

```text
/sz-hash pbkdf2 sha512 600000 your-password
```

Copy the returned `pbkdf2$...` value into `ADMIN_PASSWORD_HASH`. PBKDF2 is explained in [security.md](security.md).

## Local Development

Install dependencies:

```bash
npm ci
```

For React hot reload:

```bash
npm run dev
```

This serves the client at `http://localhost:5173`, but does not start the API, telemetry, logs, or bot.

For the complete local runtime:

```bash
npm start
```

This builds and lints the client, then starts the bot and dashboard server. The dashboard is available at `http://localhost:9000`. On Windows, Linux-only actions such as `systemctl` and Bash deployment are expected not to work.

For a dashboard-only iteration:

```bash
npm run build
npm run server
```

## Dashboard Features

- `/` public dashboard.
- `/status` host, process, disk, network, and bot telemetry.
- `/commands` command reference and trusted command runner.
- `/ai` repository-aware question answering and related visual assets.
- `/api` HTTP endpoint reference.
- `/docs` in-app developer documentation.
- `/logs` bounded log viewer.
- `/admin/login` admin session flow.
- `/admin` authenticated controls and feedback management.

## AI Assistant

Set `AI_API_KEY` and restart the server to enable model answers. The assistant retrieves text outside `priv/`, ignores environment files and dependencies, and can return relevant images from `assets/attachments/`. It does not parse binary image contents.

The public API accepts:

```json
{
  "question": "How does the feedback API work?"
}
```

Command execution is explicit and should be treated as trusted functionality because commands may generate secrets, call external services, or mutate data.

## Production Services

On Linux:

1. Run `npm ci` and configure both environment files.
2. Build with `npm run build`.
3. Copy `server/slackzilla.service` and `server/slackzilla-webhook.service` to `/etc/systemd/system/`.
4. Ensure service users, working directories, paths, and environment loading match the host.
5. Run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now slackzilla.service slackzilla-webhook.service
```

Restart after code or environment changes:

```bash
sudo systemctl restart slackzilla.service
sudo systemctl restart slackzilla-webhook.service
```

Use a reverse proxy for HTTPS and set `COOKIE_SECURE=true` when HTTPS is active.

## Validation Checklist

```bash
npm run build
npm run lint
npm run validate-manifest
npm run validate-commands
```

Then test:

```bash
curl -i http://localhost:9000/api/status
curl -i http://localhost:9000/api/commands
curl -i http://localhost:9000/api/ask
```

Use an API client for JSON POST requests, authenticated APIs, CSRF headers, and webhook signatures.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Bot will not connect | Slack tokens, signing secret, app scopes, and Socket Mode. |
| AI returns configuration text | `AI_API_KEY`, `AI_URL`, and `AI_MODEL`; restart after changes. |
| Admin login loops | Password hash, session secret, cookie settings, and HTTPS/`COOKIE_SECURE`. |
| Feedback reply fails | Bot token must be available to the dashboard process and the user ID must be valid. |
| Disk is unavailable | Confirm `PROJECT_DIR` exists and is readable. |
| Webhook returns 401 | Compare `WEBHOOK_SECRET` and raw-body signature; see [webhook.md](webhook.md). |
| Service action fails locally | Control actions target Linux systemd hosts. |
| Dashboard changes are missing | Rebuild and restart the dashboard service. |

For implementation details read [api.md](api.md), [architecture.md](architecture.md), and [security.md](security.md).
