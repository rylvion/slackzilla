# Slackzilla server setup

this is the current checklist for getting the bot, webhook, and hosted dashboard running on one server.

## what runs where

1. `bot/bot.js` runs the Slack bot over Socket Mode.
2. `server/server.js` serves the dashboard, admin pages, api routes, and webhook handler.
3. `server/deploy.sh` is called when a signed push webhook lands on the server. (pulls latest changes)
4. `server/slackzilla.service` runs the bot process. 
5. `server/slackzilla-webhook.service` runs the dashboard and webhook server.

## what you need first

1. a linux server with `sudo` access.
2. a github repo that can run actions.
3. your slack app credentials.
4. a public url or reverse proxy for port `9000`, because the same server now serves the webhook and dashboard.

## install checklist

1. clone the repo on the server. (`git clone https://github.com/rylvion/slackzilla.git`)
2. install `git`, `curl`, `ca-certificates`, `nano`, `openssl`, and `nodejs`.
3. run `npm ci` in the repo root.
4. create `bot/.env` from `bot/.env.example` and fill in `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_SIGNING_SECRET`.
5. create `server/.env` from `server/.env.example`.
6. set `WEBHOOK_SECRET` to the same value you will use in github secrets.
7. set `PROJECT_DIR` to the full repo path on the server.
8. set `REPO_URL` to the git remote you want deployed.
9. keep `BRANCH=main` unless you want the deploy flow to get weird.
10. generate `ADMIN_PASSWORD_HASH` as a pbkdf2 hash.
11. set `ADMIN_SESSION_SECRET` to a random secret.
12. set `COOKIE_SECURE=true` if the dashboard sits behind https.

or you can skip all this and run `./server/setup.sh` to do it for you, but you will still need to fill in the slack credentials and secrets.

## API and dashboard configuration

1. `PORT=9000` is the default dashboard and webhook port.
2. the public server should expose `/`, `/status`, `/logs`, `/admin`, `/api/*`, and `/webhook` through the same port or reverse proxy. (and `/api/admin/*` is authenticated with the admin password)
3. set `WEBHOOK_SECRET` in `server/.env` and use the same value in the github action secret named `WEBHOOK_SECRET`.
4. set `WEBHOOK_URL` in github actions to something like `http://your-server:9000/webhook`.
5. set `COOKIE_SECURE=true` when the dashboard is behind https, otherwise leave it on `false` for plain http testing.
6. if you want the dashboard to manage a differently named systemd service, set `SERVICE_NAME` to that service name.
7. if your webhook service has a different unit name, set `WEBHOOK_SERVICE_NAME` so deploy restarts target the right process.
8. `PROJECT_DIR` should point at the absolute repo path on the server so the dashboard can read git metadata.
9. `REPO_URL` should match the remote that the deploy script should use.
10. set `SLACK_BOT_TOKEN` in `server/.env` if you want feedback responses sent directly from the dashboard. The server also falls back to `bot/.env` for local development, but the server environment is preferred.

## systemd setup

1. copy `server/slackzilla.service` to `/etc/systemd/system/slackzilla.service`.
2. copy `server/slackzilla-webhook.service` to `/etc/systemd/system/slackzilla-webhook.service`.
3. run `sudo systemctl daemon-reload`.
4. run `sudo systemctl enable --now slackzilla.service slackzilla-webhook.service`.

## github actions setup

1. add a repo secret called `WEBHOOK_URL` that points at the webhook endpoint, usually something like `http://your-server:9000/webhook`.
2. add a repo secret called `WEBHOOK_SECRET` and make it exactly match `server/.env`.
3. push to `main` and the workflow should send a signed webhook to the server.

## API routes and registration

The backend uses Node's built-in `http` module, not Express. An API implementation is a handler in `server/api/<name>/index.js` that receives `{ req, res, url, context }`. It checks the path and method, sends a response, and returns `true` when it handled the request. Return `false` for requests owned by another handler.

Every handler must be registered in two places:

1. Import it near the other API imports in `server/server.js`.
2. Call it from `handleApi` in `server/server.js`.

Use `context.sendOk(res, data)` for successful JSON responses and `context.sendError(res, status, code, message)` for errors. Use `context.parseBody(req)` for request bodies. Private admin handlers must require a session, and state-changing handlers must verify the session CSRF token.

The frontend registry at `server/client/src/components/utils/api-routes.js` is documentation metadata only. It does not mount routes. Keep its `livesAt` and `schema` paths aligned with the implementation and schema files. JSON schemas currently describe the contract but are not automatically validated at runtime.

Current API handlers are in `server/api/status/`, `server/api/logs/`, `server/api/metrics/`, `server/api/admin/`, `server/api/feedback/`, and `server/api/control/`.

### Command and codebase assistant APIs

`GET /api/commands` lists every command with its stable metadata ID. `GET /api/commands/<id>` returns command help and usage metadata. `POST /api/commands/<id>` accepts a JSON body such as `{ "text": "2 + 3" }` and returns the responses produced by the existing Slack command handler.

`POST /api/ask` accepts `{ "question": "How does feedback work?" }`. It searches relevant repository files and uses `AI_API_KEY` with `AI_MODEL` when configured to answer from that context. To explicitly run a command and include its result, send `{ "question": "Run the calculator", "commandId": "calculator", "commandText": "2 + 3" }`. Command execution is explicit; a normal question does not execute a command.

The API adapter invokes the same command modules used by Slack, so a command only needs to be added to `bot/data/commands.json` and implemented in `bot/cmds/` to become discoverable. The adapter captures text and Slack block responses as JSON; external effects performed by a command still occur, so expose these endpoints only to trusted clients in production.

## dashboard routes

1. `/` shows the landing page.
2. `/status` shows uptime and runtime metrics.
3. `/logs` shows the log viewer.
4. `/admin` opens the authenticated control panel.
5. `/api/status`, `/api/logs`, `/api/metrics`, and `/api/admin/*` back the dashboard data.

## sanity checks

1. `systemctl status slackzilla.service`
2. `systemctl status slackzilla-webhook.service`
3. `journalctl -u slackzilla -f output=cat`
4. `journalctl -u slackzilla-webhook.service -f`
5. open `http://your-server:9000/`, `http://your-server:9000/status`, and `http://your-server:9000/logs` in a browser.
6. test a public API with `curl http://localhost:9000/api/status`; use an API client for authenticated or state-changing requests.

## when it breaks

1. if the bot does not start, check `bot/.env` first.
2. if deploys fail, compare `WEBHOOK_SECRET` in github secrets with `server/.env`.
3. if `/admin` refuses to open, double check `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `COOKIE_SECURE`.
4. if the webhook endpoint is unreachable, check your reverse proxy or firewall rules.
5. if you change `server/server.js`, restart `slackzilla-webhook.service` so the new dashboard code is picked up.

If you need more help, join [#slackzilla-troubleshooting](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) or dm me at `@rylvion` on slack or `@rylvion2` on discord.
