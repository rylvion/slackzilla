# Devlog 2 - server setup & modular command system & more [03/07/2026]
time logged: 10hr 45 min
---

so since the last devlog, i've have worked on LOADS of things including behind the scene (this doesnt get tracked on hacaktime :( ), i dont even know if this will hit the char limit, but anyways, here are the logs

## Commits logs
### [e47c48ac0970b49015e920607a59657259122f2f](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f) - made the cur proj into more modular featuring dynamic command loading system w commands.json as the source of truth
on this, i figured out that packing every single thing into one file is a bad idea, so i made a modular command system that loads commands dynamically from a commands.json file, this way, i can add new commands without having to touch the main bot.js file, and also, it makes it easier to manage commands since they are all in one place
so the curr structure of the project is like this now:

```bash
rylvion@DESKTOP-DA71DF0:/mnt/c/dev/projects/my/bots/slack/slackzilla$ tree -I "node_modules|.git" -a
.
├── .gitignore
├── .vscode
│   └── launch.json
├── LICENSE
├── README.md
├── package-lock.json
├── package.json
├── priv
│   └── devlogs
│       ├── devlog1.md
│       └── devlog2.md
└── src
    ├── .env
    ├── .env.example
    ├── bot.js
    ├── cmds
    │   ├── fact.js
    │   ├── help.js
    │   ├── hug.js
    │   ├── info.js
    │   ├── jokes.js
    │   ├── ping.js
    │   └── quote.js
    ├── data
    │   └── commands.json
    └── utils
        ├── loadcommand.js
        └── logger.js
```

instead of like 1 file with all the commands, now the commands are in their own files and are loaded dynamically from the `commands.json` file, this way, i can add new commands without having to touch the main `bot.js` file, and also, it makes it easier to manage commands since they are all in one place

Files changed:
* [.vscode/launch.json](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-bd5430ee7c51dc892a67b3f2829d1f5b6d223f0fd48b82322cfd45baf9f5e945) - changed the launch.json from `${workspaceFolder\\bot.js}` and changed terminal to integrated to external
* [README.md](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5) - specified instructions 
* [bot.js](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-11c5110d191fc5150a06b8a9fe9aa65c5937bfd3c499b7b0a02f3284dd24605d) - deleted file (this was the main one) the other one went into `src/bot.js`
* [package.json](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7bc6507b6481575d519) - it orriginally had `index.js` but that was never a file so i just changed it to `bot.js`, i also added 2 enteries to the scripts
    ```json
    "start": "node src/bot.js",
    "dev": "node src/bot.js" 
    ```
* [src/bot.js](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-eccd86fca21bf18f16c33e56d78a057ed364743326438601731484529bf4a058) - main file dynamically load commands
* [src/data/commands.json](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-2edcf4ac84462b408466a40b1fcc1b5ccb9f036ae5252474dec07a7c3721050f) - this is the source of truth for all commands, it contains the command name, description, category, and the file that contains the logic for the command
* [src/utils/loadcommand.js](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f#diff-440b57f0864c740449747f04059493977ca6602f9047cbecc2933eec3fc6dc9e) - this loads a command from `commands.json` and registers it with the app, it then verifies the command and its logic file exist before calling the command's register function. if any check fails, it logs an error to the console.
and then are loads of files left but these are generic so i wont tell you the details, but you can views the commits for more details


### [03b07ffc6f44d0231f9073f637caee1f9437705a)](https://github.com/rylvion/slackzilla/commit/03b07ffc6f44d0231f9073f637caee1f9437705a) - added more detailed server logging with time & user at the start of most console logs onto terminal [coloured output]

this was way more of a pain than i thought it was gonna be. after countless rounds of testing i finally got it working how i wanted. the ansi colours kept either leaking into the rest of the terminal or resetting back to the default colour when i needed them to go back to the current log level. i was genuinely losing my mind because every "fix" just broke something else. after hours of messing around i ended up making a wrapper so instead of resetting after things like the username or command, it switches back to whatever the current log level colour is (info, success or error), then only resets once right at the end of the log. it took way longer than it should've and nearly made me give up, but it finally does exactly what i wanted and nothing leaks anymore.

added [src/utils/logger.js](https://github.com/rylvion/slackzilla/commit/03b07ffc6f44d0231f9073f637caee1f9437705a#diff-380d439957b1ea48f4624d231e040af8bb63c44d41bb7d5bba5d7d2d3ea9c809) - which is a logger that logs to the console with time, user, and command at the start of most console logs onto terminal, it also has coloured output for different log levels (info, success, error) and also has a function to parse the message and replace placeholders with actual values, now that i looked back i havent did it in `src/utils/loadcommand.js`

and changed all the console logs in `src/bot.js` and `src/cmds/` to use the new logger api

### [b81c739cc06edba2895695e51dbbf88d8868f19f](https://github.com/rylvion/slackzilla/commit/b81c739cc06edba2895695e51dbbf88d8868f19f) - overhauled readme

well as the name implies i added loads of things to the [readme](https://github.com/rylvion/slackzilla/commit/b81c739cc06edba2895695e51dbbf88d8868f19f#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5), including a more detailed explanation of the project, its features, and how to use it.

## Server setup
find more info in the setup guide on Step 7 out of 8 in https://stardance.hackclub.com/missions/slack-bot/guide#step-7

i had to apply for nest, log in 
and hten got ssh access to the server
the specs include:
* **OS:** Ubuntu 26.04 LTS (GNU/Linux 7.0.12-1-pve x86_64)
* **CPU:** 2 Cores 
* **RAM (Memory):** 2048 MB
* **Disk (Storage):** 16 GB

yeah so basically my starting gear is a potato server but thats more than enough for this bot

so i had to play aorund with linux to get use to it, *yes i am a windows user* found some pretty interesting stuff it also drove a hard bargain on making me consider to switch to linux, im like 70% sure i will switch to linux in the future, but rn it has all my stuff on it so maybe thats a future me ting

okay now back to task

1. i installed prequisites like `nodejs`, `npm`, `git`, `curl`, `ca-certificates` and `nano`
2. clone repo and install dependencies using `git clone https://github.com/rylvion/slackzilla.git` and `npm install`
3. used `cp src/.env.example src/.env` to rename the `.env.example` file to `.env` and then added the `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and `SLACK_SIGNING_SECRET`.
4. then did a load of junk to ge tthe bot running 24/7 in the server including making this file and running it:
```bash
root@rylvion:/etc/systemd/system# cat slackzilla.service
[Unit]
Description=Slackzilla
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Restart=always
RestartSec=5
WorkingDirectory=/root/projs/slackzilla
ExecStart=/usr/bin/node src/bot.js

[Install]
WantedBy=multi-user.target
```

TL;DR: i got the bot running 24/7 in the server and it works perfectly fine, and i can now add new commands without having to touch the main bot.js file, and also, and added detailed server logging with time & user
aight y'all i spent an ENTIRE HOUR writing this dev log y'all better rate me 9/9 for story telling, rylvion signing out 🫡 

---


<a href="devlog1.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" />
  </picture>
</a>

<p align="right">
  <em>
    <b>
      <a href="devlog3.md">
        visit devlog 3
      </a>
    </b>
  </em>
</p>