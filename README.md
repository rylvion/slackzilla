# Slackzilla

███████╗██╗      █████╗  ██████╗██╗  ██╗███████╗██╗██╗     ██╗      █████╗ 
██╔════╝██║     ██╔══██╗██╔════╝██║ ██╔╝╚══███╔╝██║██║     ██║     ██╔══██╗
███████╗██║     ███████║██║     █████╔╝   ███╔╝ ██║██║     ██║     ███████║
╚════██║██║     ██╔══██║██║     ██╔═██╗  ███╔╝  ██║██║     ██║     ██╔══██║
███████║███████╗██║  ██║╚██████╗██║  ██╗███████╗██║███████╗███████╗██║  ██║
╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝

slackzilla has a modular slash-command system, a manifest generator, a hosted server dashboard, and a local preview that mirrors the server.

## Links
- [Hosted dashboard](https://rylvion.hackclub.app/) - https://rylvion.hackclub.app/
- [Local preview](https://rylvion.github.io/slackzilla/) - https://rylvion.github.io/slackzilla/
- [Wiki](https://github.com/rylvion/slackzilla/wiki) - https://rylvion.github.io/slackzilla/wiki
- [devlogs (stardance/hackclub)](https://stardance.hackclub.com/projects/4967) - https://stardance.hackclub.com/projects/4967
- [devlogs (github)](https://github.com/rylvion/slackzilla/blob/main/assets/devlogs/devlogs.md) - https://github.com/rylvion/slackzilla/blob/main/assets/devlogs/devlogs.md
- [docs](https://rylvion.github.io/slackzilla/docs/) - https://rylvion.github.io/slackzilla/docs/
- [slackzilla help](https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2) - https://app.slack.com/client/E09V59WQY1E/C0B8NGLD7K2
- [repo](https://github.com/rylvion/slackzilla) - https://github.com/rylvion/slackzilla

## What it does
It has 5 main components: *See more info at [the docs](https://rylvion.github.io/slackzilla/docs/)*

1. A Slack bot that runs on a server and responds to slash commands (through a command system that is data-driven and modular, allowing for easy addition of new commands.)
2. A webhook handler that recieves a push from GitHub and triggers 2 actions: a server restart with the latest changes and a manifest rebuild.
3. A manifest generator that builds the Slack app manifest from the source data.
4. A hosted dashboard that shows live server status, logs, and an admin control panel. [Not implemented yet]
5. A local preview that mirrors the hosted dashboard and can be built into static pages.


## Setup

1. Install dependencies with `npm ci`.
2. Copy `src/.env.example` to `src/.env` and fill in the Slack bot credentials.
3. Copy `server/.env.example` to `server/.env` and fill in the dashboard and deployment settings.
4. Run the bot with `npm start`.
5. Run the dashboard server with `node server/server.js` or the systemd service from `server/`.
6. Build the static local preview with `npm run build:pages`.

## Environment files

### `src/.env`

- `SLACK_BOT_TOKEN` - to get this token, go to your Slack app settings, click "Install App" in the left sidebar, and copy the "Bot User OAuth Token" from the page.
- `SLACK_APP_TOKEN` - go on the general page and create a token name called `slackzilla-socket` (or any it doesnt matter) with the scope `connections:write` and copy the token. 
- `SLACK_SIGNING_SECRET` - on the general page, click "Show" under "App Credentials" and copy the "Signing Secret".
and optional ai service keys for commands that use AI.
- `AI_API_KEY` - to get this key go to https://ai.hackclub.com to get a free token to get an ai
- `AI_MODEL` - `openai/gpt-oss-20b:free` is free (max output: 32,768 tokens, context windows: 131,072 tokens) check https://ai.hackclub.com/models/openai/gpt-oss-20b:free for more info
- `AI_URL` - https://ai.hackclub.com/proxy/v1/chat/completions

### `server/.env`

For `WEBHOOK_SECRET` the following is a recommended way to generate a secure token:
1. Generating a token for this is easy, you can use any of the following methods:
1.1. `/sz-hash rand 32`, on the bot in slack (dont worry the server wont store the token!)
1.2. `open-ssl rand -hex 32` in wsl/linux
1.3. `[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 })).ToLower()` on `pwsh` 7.0 or later
1.4. `-join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))` on `windows powershell` 5.1 or later
2. Copy it and paste it into the `WEBHOOK_SECRET` field in `server/.env`. This token is used to verify that incoming webhook requests are from GitHub.
3. In your GitHub repository, go to "Settings" > "Secrets and Variables" > "New Repositary Secret". Paste the `WEBHOOK_SECRET` token into the "Secret" field.

- `PORT` - the port the server will listen on, default is `9000`, this is the main port for dashboard, webhook handler and api.
- `PROJECT_DIR` - the path to the project directory, default is `~/projs/slackzilla` (the current directory)
- `REPO_URL`- the URL of the GitHub repository, default is `https://github.com/rylvion/slackzilla.git`
- `BRANCH` - the branch to pull from, default is `main`
- `SERVICE_NAME` - the name of the systemd service, default is `slackzilla`

For  `ADMIN_PASSWORD_HASH`, the following is a recommended way to generate a secure hash:
1. Generating a hash for this is easy, you can use any of the following methods:
1.1. `/sz-hash pbkdf2 sha512 600000 mypassword`, on the bot in slack (dont worry the server wont store the password!)
1.2. `python3 -c "import hashlib, os, binascii; salt = os.urandom(16); password = b'mypassword'; dk = hashlib.pbkdf2_hmac('sha512', password, salt, 600000); print(f'pbkdf2\$sha512\$600000\${binascii.hexlify(salt).decode()}\${binascii.hexlify(dk).decode()}')"` in cli/python3 3.6 or later
1.3. `$s=New-Object byte[] 16;[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($s);$p=[System.Text.Encoding]::UTF8.GetBytes("mypassword");$h=(New-Object System.Security.Cryptography.Rfc2898DeriveBytes($p,$s,600000,[System.Security.Cryptography.HashAlgorithmName]::SHA512)).GetBytes(64);$saltHex=($s|%{ $_.ToString('x2') }) -join '';$hashHex=($h|%{ $_.ToString('x2') }) -join ''; "pbkdf2`$sha512`$600000`$$saltHex`$$hashHex"` on `powershell` any version
1.4. `ruby -ropenssl -e 'salt=OpenSSL::Random.random_bytes(16);pwd="mypassword";iter=600000;dk=OpenSSL::PKCS5.pbkdf2_hmac(pwd,salt,iter,64,"sha512");puts "pbkdf2$sha512$#{iter}$#{salt.unpack1("H*")}$#{dk.unpack1("H*")}"'` - linux/wsl/ruby
2. Copy it and paste it into the `ADMIN_PASSWORD_HASH` field in `server/.env`. This hash is used to verify the admin password for the dashboard.

For `ADMIN_SESSION_SECRET`, the following is a recommended way to generate a secure secret:
1. Generating a secret for this is easy, you can use any of the following methods:
1.1. do `/sz-hash rand 32`, on the bot in slack (dont worry the server wont store the secret!)
1.2. `open-ssl rand -hex 32` in wsl/linux
1.3. `[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 })).ToLower()` on `pwsh` 7.0 or later
1.4. `-join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))` on `windows powershell` 5.1 or later
2. Copy it and paste it into the `ADMIN_SESSION_SECRET` field in `server/.env`. This secret is used to sign the session cookies for the dashboard.

- `COOKIE_SECURE` - `bool` value that determines if the dashboard cookies should be secure (only sent over HTTPS). Set to `true` if the dashboard is behind HTTPS, otherwise set to `false` for plain HTTP testing.

See `server/.env.example` for the full set of current server defaults.

## Commands

```
--------------------------------------------------
Category                 Count     Percent
--------------------------------------------------
Core                     4         17.4%
Entertainment            7         30.4%
Utility                  12        52.2%
--------------------------------------------------
Total                    23        100%
--------------------------------------------------
```
The slash commands are data-driven. If you want to add or update one, edit `src/data/commands.json` and add the logic in `src/cmds/`. View [The Command Guide](https://github.com/rylvion/slackzilla/wiki/Adding-a-New-Command) for more details.

Utility commands also has a help command associated to it (e.g., `/sz-[cmd] help`) so users can see usage and examples.

## Scripts

- `npm start` - start the bot
- `npm run generate-manifest` - rebuild the Slack manifest from the source data
- `npm run validate-manifest` - validate the generated manifest
- `npm run validate-commands` - validate `src/data/commands.json`
- `npm run build:pages` - build the local preview into `dist/`
- `npm run cmd-stats` - print command usage stats

## License
[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)

no need for credits, but if your using this code in a project, i'd love to see what you do with it so if you make something cool with it, please share it with me! 