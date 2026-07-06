# Slackzilla server setup

this is the ugly but honest checklist for getting the server side running.

## what you need first

1. a linux server with `sudo` access and (optional) `root` access, however you can configure this on 
2. a github repo that can run actions.
3. your slack bot tokens from the app settings.
4. a public URL for the webhook server on port `9000`, or a reverse proxy that points to it. (e.g. if you have a domain, you can point `https://yourdomain.com/webhook` to `http://your-server:9000/webhook`)

## files that matter
1. `src/.env` stores the slack bot credentials.
2. `server/.env` stores the deployment webhook secret and repo info.
3. `server/server.js` receives the webhook and runs `server/deploy.sh`.s
4. `server/slackzilla.service` runs the bot.
5. `server/slackzilla-webhook.service` runs the deploy webhook server.

## setup steps

1. clone the repo on the server.
2. install `git`, `curl`, `ca-certificates`, `nano`, `openssl`, and `nodejs`.
3. run `npm ci` in the repo root.
4. create `src/.env` from `src/.env.example` and fill in `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_SIGNING_SECRET`.
5. create `server/.env` from `server/.env.example`.
6. set `WEBHOOK_SECRET` to the same secret you will put in github secrets.
7. set `PROJECT_DIR` to the full repo path on the server.
8. set `REPO_URL` to the git remote you want deployed.
9. keep `BRANCH` on `main` unless you enjoy making future-you sad.
10. copy `server/slackzilla.service` to `/etc/systemd/system/slackzilla.service`.
11. copy `server/slackzilla-webhook.service` to `/etc/systemd/system/slackzilla-webhook.service`.
12. run `sudo systemctl daemon-reload`.
13. run `sudo systemctl enable --now slackzilla.service slackzilla-webhook.service`.

## github actions bit

1. add a repo secret called `WEBHOOK_URL` that points at the server webhook endpoint, usually something like `http://your-server:9000/webhook`.
2. add a repo secret called `WEBHOOK_SECRET` and make it exactly match `server/.env`.
3. push to `main` and the workflow will send a signed webhook to the server.

## sanity checks

1. `systemctl status slackzilla.service`
2. `systemctl status slackzilla-webhook.service`
3. `journalctl -u slackzilla.service -f`
4. `journalctl -u slackzilla-webhook.service -f`
5. hit the webhook server root URL in a browser to make sure it answers.

## when it breaks
1. if the bot does not start, check `src/.env` first because that is usually the problem.
2. if deploys fail, compare `WEBHOOK_SECRET` in github secrets with `server/.env`.
3. if the webhook server cannot be reached, fix firewall rules or your reverse proxy.
4. if you change `server/server.js`, restart `slackzilla-webhook.service` by hand because the deploy script only restarts the bot service.

If you need any more help join [#slackzilla-troubleshooting](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) or dm me my name is `@rylvion` or on discord its `@rylvion2` 
i will respond within 1 working day, *i dont visit slack that often, nor do i get notifications i think*