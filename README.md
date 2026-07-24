# Slackzilla
a chaotic little Slack bot that does stuff… sometimes correctly
now nerdy stuff for those devs that wanna 'skim & **scam**' my beautiful README for those who skipped past the tedious code and just wanna overview of what this bot does.

## cur scopes:
- `app_mentions:read`
- `channels:history`
- `chat:write`
- `commands`

## so... what does it actually do?

## features
It has 22 pre-defined commands that can be used in any channel the bot is in, and it also has a few other features that are not commands but are still useful.
its prefixed with `/sz-` and the commands are as follows:
- `/sz-help` - displays a list of all the commands and their descriptions.
- `/sz-info`- shows some meta data about the bot, such as its version, uptime, what platform and memory its running on.
- `/sz-hug` - sends a hug (ASCII art) to the user who invoked the command.
- `/sz-quote` - sends a random quote from api
- `/sz-joke` - sends a random joke from api
- `/sz-fact`- sends a random fact from api, shows an 'excuse' if the fact is not found
- `/sz-ping` - it shows latency
- `/sz-calc` - it evaluates mathematical expressions and returns the result. It supports multi-digit numbers, decimals, unary minus, and exponentiation.
- `/sz-roll` - it simulates dice rolls and returns the result. It supports normal dice notation like `d6`, custom dice sizes like `d20`, multiple dice such as `2d6`, and modifiers like `2d20+5`.
and many more commands,

### you can add sum of ur commands tooo:
i also made a scalable modular system out of this, so go on [src/data/commands.json](https://github.com/rylvion/slackzilla/tree/main/src/data/commands.json) (this is the source of truth) 
e.g. if you want to add a new command, you can add it to the commands.json file like this:
```js
"hug": { // this is the name of the command it doesnt has to match the name of the file, but it should be unique
        "cmd": "/sz-hug",                       // replace with your slash command
        "description": "sends a hug to a user", // shown in /sz-help
        "category": "entertainment",            // replace or create your own category
        "file": "hug.js"                        // JS file in `/src/cmds` that contains the logic for the command
        "usage_hint": ""                        // optional, if you want to show a usage hint in /sz-help leave an empty string if not needed
    }
```
*dont ask why i picked this `hug` cmd out of all other commands, i just did it for the sake of example*.

add logic in the actual file in the [src/cmds](https://github.com/rylvion/slackzilla/tree/main/src/cmds) folder.
ALSO its core that you have to register the command in https://api.slack.com/apps/[your-app-id]/slash-commands and add the command there too, otherwise it wont work, the bot will just ignore it. see more info also in the [Slack API docs](https://api.slack.com/interactivity/slash-commands) on how to register slash commands. 


## anyways to setup the bot:
you can view this in https://stardance.hackclub.com/missions/slack-bot/guide#step-3

1. create a new Slack app at https://api.slack.com/apps
2. enable Socket Mode in the "Socket Mode" section and generate an App-Level Token with the `connections:write` scope.
3. install the app to your workspace and get the Bot User OAuth Token from the "OAuth & Permissions" section.
4. Set scopes which could seen above e.g `app_mentions:read`, `channels:history`, `chat:write`, `commands` in the "OAuth & Permissions" section.
5. register slash commands on the "Slash Commands" section in https://api.slack.com/apps/[your-app-id]/slash-commands
6. use `git clone https://github.com/rylvion/slackzilla.git` to clone the repo.
7. create a .env file in the root of the project and add the following environment variables:
    `SLACK_BOT_TOKEN=your-bot-user-oauth-token`
    `SLACK_APP_TOKEN=your-app-level-token`
    `SLACK_SIGNING_SECRET=your-signing-secret`
8. setup the bot using `npm install` to install the dependencies.
9. run the bot using `npm start`.


however if you want to run the bot then you have to fill in all the 22 slash commands in the "Slash Commands" section in https://api.slack.com/apps/[your-app-id]/slash-commands, otherwise the bot will just ignore the command and not respond to it, so the other option is copying the contents of `manifest.json` and pasting it in the "App Manifest" section in https://api.slack.com/apps/[your-team-id]/[your-app-id]/app-manifest, then click on "Update Manifest" and it will automatically create all the slash commands for you. that'll be way more easier 



### server setup
you can also view this setup guide in Step 7 out of 8 in https://stardance.hackclub.com/missions/slack-bot/guide#step-7
also you can check out the [server setup guide](./server/server-setup.md) for more details on how to setup the bot on a server and run it 24/7.

if you want to run the bot in the server and on the background through `ssh` access do:

1. follow all the steps above to setup the bot apart from step 7, and add a 0th step and do `ssh user@your-server-ip` or `ssh user@hackclub.app`, if your using nest  
2. Create a service file using the cmd `nano /etc/systemd/system/[name].service` (*where [name] is the name of your service*) and add the following content:

```ini
[Unit]
Description=Slack Bot #  change this to the name of your service e.g. 'Slackzilla'
After=network-online.target
Wants=network-online.target 
 
[Service]
Type=simple
User=root 
Restart=always
RestartSec=5
WorkingDirectory=/root/<YOUR-REPO-NAME> # change this to the directory where you cloned the repo
ExecStart=/usr/bin/node src/bot.js # if you changed thte name of the main file, change this to the name of the main file
 
[Install]
WantedBy=multi-user.target
```
3. Reload, Enable and Start the service using the following commands:
```bash
systemctl daemon-reload
systemctl enable --now slackbot.service
```
4. Confirm its up and running using the following commands:
```bash
systemctl status slackbot.service
journalctl -u slackbot.service -f
```


err i think thats it idk.. what to write here tbh, id leave the rest to FUTURE ME 🫡
---

### TODO (aka. future me's problems)
<div align="center">
    <img width="150px" src="https://avatars.slack-edge.com/2026-06-02/11263859131749_09e589f8ab70488b9f33_96.png" alt="troll meme face" />
</div>

- add some contributing guidelines and a code of conduct
- fix some bugs and improve the code quality
- add more documentation
- add release tags and versioning

any other improvements or suggestions are welcome, just open an issue and ill see what i can do.

## License
[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)

also btw this has an MIT license so do whatever you want with it, free of credits, but i'd love to see what you do with it so if you make something cool with it, please share it with me! (also if you find any bugs or have any suggestions for improvements, please let me know!)


