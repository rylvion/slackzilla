# Slackzilla server setup

this is the current checklist for getting the bot, webhook, and hosted dashboard running on one server.

## what runs where

1. `src/bot.js` runs the Slack bot over Socket Mode.
2. `server/server.js` serves the dashboard, logs, status pages, admin pages, api routes, and webhook handler.
3. `server/deploy.sh` is called when a signed push webhook lands on the server.
4. `server/slackzilla.service` runs the bot process.
5. `server/slackzilla-webhook.service` runs the dashboard and webhook server.

## what you need first

1. a linux server with `sudo` access.
2. a github repo that can run actions.
3. your slack app credentials.
4. a public url or reverse proxy for port `9000`, because the same server now serves the webhook and dashboard.

## install checklist

1. clone the repo on the server.
2. install `git`, `curl`, `ca-certificates`, `nano`, `openssl`, and `nodejs`.
3. run `npm ci` in the repo root.
4. create `src/.env` from `src/.env.example` and fill in `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_SIGNING_SECRET`.
5. create `server/.env` from `server/.env.example`.
6. set `WEBHOOK_SECRET` to the same value you will use in github secrets.
7. set `PROJECT_DIR` to the full repo path on the server.
8. set `REPO_URL` to the git remote you want deployed.
9. keep `BRANCH=main` unless you want the deploy flow to get weird.
10. generate `ADMIN_PASSWORD_HASH` as a pbkdf2 hash.
11. set `ADMIN_SESSION_SECRET` to a random secret.
12. set `COOKIE_SECURE=true` if the dashboard sits behind https.

## api and dashboard configuration

1. `PORT=9000` is the default dashboard and webhook port.
2. the public server should expose `/`, `/status`, `/logs`, `/admin`, `/api/*`, and `/webhook` through the same port or reverse proxy.
3. set `WEBHOOK_SECRET` in `server/.env` and use the same value in the github action secret named `WEBHOOK_SECRET`.
4. set `WEBHOOK_URL` in github actions to something like `http://your-server:9000/webhook`.
5. set `COOKIE_SECURE=true` when the dashboard is behind https, otherwise leave it on `false` for plain http testing.
6. if you want the dashboard to manage a differently named systemd service, set `SERVICE_NAME` to that service name.
7. if your webhook service has a different unit name, set `WEBHOOK_SERVICE_NAME` so deploy restarts target the right process.
8. `PROJECT_DIR` should point at the absolute repo path on the server so the dashboard can read git metadata.
9. `REPO_URL` should match the remote that the deploy script should use.
10. set `SLACK_BOT_TOKEN` in the server environment if you want feedback responses sent directly from the dashboard.

## systemd setup

1. copy `server/slackzilla.service` to `/etc/systemd/system/slackzilla.service`.
2. copy `server/slackzilla-webhook.service` to `/etc/systemd/system/slackzilla-webhook.service`.
3. run `sudo systemctl daemon-reload`.
4. run `sudo systemctl enable --now slackzilla.service slackzilla-webhook.service`.

## github actions setup

1. add a repo secret called `WEBHOOK_URL` that points at the webhook endpoint, usually something like `http://your-server:9000/webhook`.
2. add a repo secret called `WEBHOOK_SECRET` and make it exactly match `server/.env`.
3. push to `main` and the workflow should send a signed webhook to the server.

## dashboard routes

1. `/` shows the landing page.
2. `/status` shows uptime and runtime metrics.
3. `/logs` shows the log viewer.
4. `/admin` opens the authenticated control panel.
5. `/api/status`, `/api/logs`, and `/api/admin/*` back the dashboard data.

## sanity checks

1. `systemctl status slackzilla.service`
2. `systemctl status slackzilla-webhook.service`
3. `journalctl -u slackzilla -f output=cat`
4. `journalctl -u slackzilla-webhook.service -f`
5. open `http://your-server:9000/`, `http://your-server:9000/status`, and `http://your-server:9000/logs` in a browser.

## when it breaks

1. if the bot does not start, check `src/.env` first.
2. if deploys fail, compare `WEBHOOK_SECRET` in github secrets with `server/.env`.
3. if `/admin` refuses to open, double check `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `COOKIE_SECURE`.
4. if the webhook endpoint is unreachable, check your reverse proxy or firewall rules.
5. if you change `server/server.js`, restart `slackzilla-webhook.service` so the new dashboard code is picked up.

If you need more help, join [#slackzilla-troubleshooting](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) or dm me at `@rylvion` on slack or `@rylvion2` on discord.
