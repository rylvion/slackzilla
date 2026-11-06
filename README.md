# Slackzilla

[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-v24.15.0-green?logo=nodedotjs&logoColor=white)
[![Slackzilla Version](https://img.shields.io/badge/Slackzilla-v1.0.0--release-blueviolet)](https://github.com/rylvion/slackzilla/blob/main/)
[![Top Language](https://img.shields.io/github/languages/top/rylvion/slackzilla)](https://github.com/search?q=repo%3Arylvion%2Fslackzilla++language%3AJavaScript&type=code)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white)

Slackzilla is a full-stack Slack bot with a React-based web dashboard, HTTP API, server telemetry, administrative controls, and a repository-aware AI assistant. It also supports automated GitHub deployments, feedback management, and modular slash commands.

## Features

[![Slash commands](https://img.shields.io/badge/Slash%20Commands-25-blueviolet)](https://rylvion.hackclub.app/commands)
[![AI/RAG Tools](https://img.shields.io/badge/AI%20Tools-9-orange)](https://rylvion.hackclub.app/ai)
[![API Endpoints](https://img.shields.io/badge/API%20Endpoints-17-green)](https://rylvion.hackclub.app/api)
[![Admin Endpoints](https://img.shields.io/badge/Admin%20Endpoints-11-red)](https://rylvion.hackclub.app/api)
[![Admin Controls](https://img.shields.io/badge/Admin%20Controls-21-yellow)](https://rylvion.hackclub.app/admin)

![Real-time Updates](https://img.shields.io/badge/Real--time-SSE-blue)
![Security](https://img.shields.io/badge/Security-CSRF%20%2B%20Sessions-green)
[![RAG](https://img.shields.io/badge/RAG-Repository--Aware-purple)](docs/rag.md)
[![Deployment](https://img.shields.io/badge/Deployment-Automated-orange)](docs/webhook.md)

- 25 modular slash commands defined in `bot/data/commands.json`.
- 9 tools for the AI assistant: `getStatus`, `runApiCommand`, `runTerminalCommand`, `getCommands`, `getReleaseInfo`, `runCommand`, `getLogs`, `getErrors`, and `getRoutes`.
- 17 public API endpoints, 11 admin endpoints, and 21 admin controls
- Generated Slack app manifest support.
- Public status, metrics, logs, commands, and AI APIs.
- Admin sessions with signed cookies, PBKDF2 password verification, CSRF protection, secure API access, and rate limiting.
- Feedback filtering, read/unread status, replies, and deletion.
- CPU, memory, disk, network, bot, command, and server request telemetry.
- React pages for the dashboard, status, commands, API reference, AI assistant, documentation, logs, sitemap, and admin workflows.
- GitHub push webhook validation with `HMAC-SHA256` and branch filtering.
- Repository-aware (RAG) AI assistant with lexical & deterministic retrieval, model generation, image asset discovery, and tools execution lists.
- Embedded xterm.js terminal with registered local/backend commands, virtual directory navigation, logs, API requests, version history, RAG diagnostics, and browser storage inspection.

## Architecture

The backend uses Node's built-in `http` module rather than Express. API modules are explicit handlers imported and registered in `server/server.js`. Persistent runtime data is currently stored through the JSON-backed adapter in `server/database/store.js`; an external database is not required. See [Architecture](docs/architecture.md) for details on the backend architecture, API endpoints, and command architecture.

Check [docs](docs/docs.md) to see full navigation and overview of slackzilla

- [Setup](docs/setup.md)
- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Terminal](docs/terminal.md)
- [RAG Assistant](docs/rag.md)
- [Security](docs/security.md)
- [Webhook](docs/webhook.md)
- [Server Setup](docs/server-setup.md)
- [POST command docs](docs/post/README.md)
- [Extension Guides](docs/extension/README.md)

## Requirements

- Node.js with `npm` (make sure all dependencies are installed with `npm ci` before running)
- A Slack app with Socket Mode enabled.
- Git for deployment features.
- Linux and systemd for the production service files. (Admin controls relies on bot service file being active too stop & start the bot, but you can still run the bot `npm start` on windows)
- An AI provider key for model-backed AI answers. (optional, bcs these are needed for the `/ai` page, `/api/ask` endpoint and `/sz-ask` command)

## Setup

To run the project locally, clone the repository, install dependencies, and configure environment variables and then run the bot and dashboard by executing the following command. For more information, see the [Setup Guide](docs/setup.md).

```bash
npm start
```

### Slack Commands

![Slack Commands](https://img.shields.io/badge/Slack%20Commands-25-blueviolet)
![Core](https://img.shields.io/badge/Core-4-blue)
![Entertainment](https://img.shields.io/badge/Entertainment-7-orange)
![Utility](https://img.shields.io/badge/Utility-14-green)

| Command        | Usage                                             | Description                                                                                                                                                                                            | Category      |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `/sz-ping`     | (none)                                            | Checks if the bot is responsive                                                                                                                                                                        | Core          |
| `/sz-help`     | (none)                                            | Displays all commands and their descriptions                                                                                                                                                           | Core          |
| `/sz-info`     | (none)                                            | Displays info about the bot (version, author, etc.)                                                                                                                                                    | Core          |
| `/sz-quote`    | (none)                                            | Displays a random quote                                                                                                                                                                                | Entertainment |
| `/sz-joke`     | (none)                                            | Sends a random joke                                                                                                                                                                                    | Entertainment |
| `/sz-fact`     | (none)                                            | Displays a fun fact                                                                                                                                                                                    | Entertainment |
| `/sz-hug`      | (none)                                            | Sends a hug                                                                                                                                                                                            | Entertainment |
| `/sz-meme`     | (none)                                            | Shows a random meme                                                                                                                                                                                    | Entertainment |
| `/sz-echo`     | `<message>`                                       | Echoes the message you sent                                                                                                                                                                            | Core          |
| `/sz-calc`     | `<expression>`                                    | Calculates a mathematical expression                                                                                                                                                                   | Utility       |
| `/sz-roll`     | `<side><n><rolls>+<modifier>`                     | Rolls a dice                                                                                                                                                                                           | Utility       |
| `/sz-base64`   | `<string>`                                        | Generates a Base64-encoded string                                                                                                                                                                      | Utility       |
| `/sz-8ball`    | `<question>`                                      | Asks the magic 8-ball a question                                                                                                                                                                       | Entertainment |
| `/sz-rps`      | `<rock\|1 /paper\|2 /scissors\|3>`                | Plays rock paper scissors with the bot                                                                                                                                                                 | Entertainment |
| `/sz-uuid`     | (none)                                            | Generates a random UUID v4                                                                                                                                                                             | Utility       |
| `/sz-token`    | `<length>` (default: `32`)                        | Generates a secure random token                                                                                                                                                                        | Utility       |
| `/sz-random`   | `<min> <max>`                                     | Generates a random number between two numbers                                                                                                                                                          | Utility       |
| `/sz-case`     | `<camel\|pascal\|snake\|kebab> <text>`            | Converts between text cases                                                                                                                                                                            | Utility       |
| `/sz-unix`     | `<timestamp\|date>`                               | Converts between Unix timestamps and human-readable dates                                                                                                                                              | Utility       |
| `/sz-count`    | `<text>`                                          | Counts characters, words and lines                                                                                                                                                                     | Utility       |
| `/sz-hash`     | `<algorithm> <encrypt?> <iter?> <salt?> <string>` | Generates a hash (Default: `SHA-256`, Algorithms: `RSA-MD5`, `RSA-RIPEMD160`, `RSA-SHA1`, `RSA-SHA1-2`, `RSA-SHA224`, `RSA-SHA256`, `RSA-SHA3-224`, `RSA-SHA3-256`, `rand`, `pbkdf2`, `base64`, `hex`) | Utility       |
| `/sz-decode`   | `<algorithm> <string>`                            | Decodes the following algorithms: `base64`, `hex`, `rand`                                                                                                                                              | Utility       |
| `/sz-feedback` | `<message>`                                       | Sends feedback to the bot author                                                                                                                                                                       | Utility       |
| `/sz-ask`      | `<question>`                                      | Asks a question to the bot                                                                                                                                                                             | Utility       |
| `/sz-release`  | `<version>`                                       | Displays the latest release notes                                                                                                                                                                      | Utility       |

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
| `/terminal`     | Restricted xterm.js terminal for diagnostics and registered tools. |
| `/ai`           | Repository-aware AI questions, sources, and related visual assets. |
| `/api`          | API endpoint reference.                                            |
| `/docs`         | Dynamically generated documentation.                               |
| `/admin/login`  | Admin login and session creation.                                  |
| `/admin`        | Authenticated controls, feedback management, and server activity.  |
| `/admin/logs`   | Authenticated log viewer, deletion, rotation, and restoration.     |
| `/admin/errors` | Authenticated error log viewer and stream.                         |
| `/admin/events` | Authenticated server event stream.                                 |

Unknown browser routes return the React NotFound page with HTTP status `404`.

## ALL API Routes

![API Endpoints](https://img.shields.io/badge/API%20Endpoints-17-green)
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
GET  /api/ask
POST /api/ask
GET  /api/routes
GET  /api/release
GET  /api/session
POST /api/terminal
POST /webhook
```

Admin endpoints require a valid session cookie and CSRF protection for state-changing requests:

![Admin Endpoints](https://img.shields.io/badge/Admin%20Endpoints-11-red)
![GET](https://img.shields.io/badge/GET-8-blue)
![POST](https://img.shields.io/badge/POST-2-orange)
![SSE](https://img.shields.io/badge/SSE-2-purple)

```bash
GET  /api/admin/summary
GET  /api/admin/summary/stream
GET  /api/admin/events
GET  /api/admin/feedback
GET  /api/admin/feedback/:id
POST /api/admin/feedback/:id
POST /api/admin/control
GET  /api/admin/errors
GET  /api/admin/errors/stream
GET  /api/admin/log-archives
```

See the [API documentation](docs/api.md) for details on request and response formats, query parameters, and error codes.

## Embedded Terminal

The dashboard Terminal page is a restricted browser terminal, not an operating-system shell. It never executes arbitrary host commands, reads the server filesystem, or forwards unrestricted network requests. Local commands run in the browser; registered backend commands use the bounded `POST /api/terminal` endpoint.

The terminal includes:

- Local utilities: `help`, `ver`, `history`, `time`, `terminal`, `refresh`, and `cls`/`clear`.
- Public backend commands: `status`, `uptime`, `version`, `logs`, `api`, `docs`, `rag`, and `command`.
- Administrative commands: `sudo status`, `sudo controls`, `sudo inspect`, `sudo execute`, and `sudo logout`, protected by the existing administrator session, CSRF, re-authentication, confirmation, and rate limits.
- Virtual contexts: `command`, `api`, `logs`, and `storage`; `api` exposes `get` and `post` contexts, while storage exposes browser `session` and `local` contexts.

Examples:

```text
version --help
version v0.9.6-beta --verbose
logs --tail 50
api get /api/status
api post /api/example --body '{"example":true}'
rag sources --type jsx,json --search terminal --limit 20
cd storage/session
```

`dir` lists the current virtual context without changing it. `cd`, `cd ..`, relative paths such as `cd ../local`, `exit`, and idle `Ctrl+C` use the shared context stack. Storage values are shown only after administrator authentication; session cookies and CSRF secrets are not printed, and the protected terminal-state key cannot be deleted. See the [Terminal Guide](docs/terminal.md) and [Terminal Extension Guide](docs/extension/terminal-extension-guide.md).

## RAG Assistant

The `/ai` page and `/api/ask` endpoint retrieve relevant repository text before asking the configured AI model to answer. Retrieval excludes `priv/`, `.env` files, logs, dependencies, build output, and Git metadata. Related image assets are identified by filename and can be displayed without reading their binary contents. The assistant can use registered Slack command tools, public terminal commands, and internal `/api/` GET/POST requests through separate guarded tools. RAG API calls cannot use external URLs or credential headers; endpoint-level authentication, CSRF, confirmation, and rate limits remain authoritative.

The `rag sources` terminal command supports comma-separated `--type`, path `--search`, and bounded `--limit` filters. `rag:use-tool` can invoke the same RAG tool definitions, including `runTerminalCommand` and `runApiCommand`, without exposing administrative terminal commands or arbitrary shell execution.

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

[![Scripts](https://img.shields.io/badge/Scripts-20-blueviolet)](docs/testing.md#scripts)

| Command                     | Purpose                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `npm start`                 | Build, lint, and start the bot and dashboard concurrently.               |
| `npm test`                  | Run all tests, validate the manifest and commands, and lint the client.  |
| `npm run test:single`       | Run all tests without validation or linting.                             |
| `npm run bot`               | Start only the Slack bot.                                                |
| `npm run server`            | Start only the dashboard server.                                         |
| `npm run dev`               | Start the Vite client development server with hot reloading.             |
| `npm run build`             | Build the React client for production.                                   |
| `npm run preview`           | Preview the production build of the client.                              |
| `npm run build:preview`     | Build the client and preview the production build.                       |
| `npm run lint`              | Lint the client code.                                                    |
| `npm run generate-manifest` | Generate `manifest.json` for the bot.                                    |
| `npm run validate-manifest` | Validate the manifest against its schema.                                |
| `npm run validate-commands` | Validate command metadata against its schema.                            |
| `npm run stats`             | Generate command usage statistics.                                       |
| `npm run rag`               | Debug RAG retrieval and responses using a supplied query.                |
| `npm run rag:use-tool`      | Run the RAG tool integration script.                                     |
| `npm run release`           | Append release notes to the changelog.                                   |
| `npm run update`            | Generate the manifest and append release notes.                          |
| `npm run all`               | Run tests, update the manifest and release notes, and start the project. |

See [Testing](docs/testing.md#scripts) for more details.

## License

[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)

no need for credits, but if your using this code in a project, i'd love to see what you do with it so if you make something cool with it, please share it with me!

## Contributing

Contributions are NOT accepted. if you have any issues, bugs or feature requests, please open an issue on the repository or reach out to me on the [Slackzilla Server](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) and ill try to help you out.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/rylvion/slackzilla/output/github-contribution-grid-snake-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/rylvion/slackzilla/output/github-contribution-grid-snake.svg">
  <img alt="GitHub contribution snake animation" src="https://raw.githubusercontent.com/rylvion/slackzilla/output/github-contribution-grid-snake.svg">
</picture>
