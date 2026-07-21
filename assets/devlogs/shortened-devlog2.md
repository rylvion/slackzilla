# Devlog 2 - server setup & modular command system & more [03/07/2026]
time logged: 10hr 45 min

so since the last devlog, i've have worked on LOADS of things including behind the scene (this doesnt get tracked on hacaktime :( ), i dont even know if this will hit the char limit, but anyways, here are the logs

EDIT: IT DID HIT THE CHAR LIMIT, turns out the original devlog was ~9.6k characters 💀 while the limit is only 4k, so this is the shortened version. the full one is still in priv/devlogs/devlog2.md if anyone wants the extended edition.z

## Commits logs
### [e47c48ac0970b49015e920607a59657259122f2f](https://github.com/rylvion/slackzilla/commit/e47c48ac0970b49015e920607a59657259122f2f) - made the cur proj into more modular featuring dynamic command loading system w commands.json as the source of truth
on this, i figured out that packing every single thing into one file is a bad idea, so i made a modular command system that loads commands dynamically from a commands.json file, this way, i can add new commands without having to touch the main bot.js file, and also, it makes it easier to manage commands since they are all in one place


### [03b07ffc6f44d0231f9073f637caee1f9437705a)](https://github.com/rylvion/slackzilla/commit/03b07ffc6f44d0231f9073f637caee1f9437705a) - added more detailed server logging with time & user at the start of most console logs onto terminal [coloured output]

this was way more of a pain than i thought it was gonna be. after countless rounds of testing i finally got it working how i wanted. the ansi colours kept either leaking into the rest of the terminal or resetting back to the default colour when i needed them to go back to the current log level. i was genuinely losing my mind because every "fix" just broke something else. after hours of messing around i ended up making a wrapper so instead of resetting after things like the username or command, it switches back to whatever the current log level colour is (info, success or error), then only resets once right at the end of the log. it took way longer than it should've and nearly made me give up, but it finally does exactly what i wanted and nothing leaks anymore.

added `src/utils/logger.js` and switched almost every `console.log` over to it. it adds timestamps, users, commands and coloured log levels.
and changed all the console logs in `src/bot.js` and `src/cmds/` to use the new logger api

### [b81c739cc06edba2895695e51dbbf88d8868f19f](https://github.com/rylvion/slackzilla/commit/b81c739cc06edba2895695e51dbbf88d8868f19f) - overhauled readme

well as the name implies its pretty self explanatory lol but i massively expanded the README with better documentation and setup instructions.

## Server setup
find more info in the setup guide on Step 7 out of 8 in https://stardance.hackclub.com/missions/slack-bot/guide#step-7

i had to apply for a Nest server and get SSH access.

yeah so basically my starting gear is a potato server (2GB RAM, 16GB storage) but that's more than enough for this bot.

i also got to mess around with linux for a bit (*yes i am a windows user*). honestly... i kinda liked it and i'm like 80% convinced i'll switch one day (but too much of a hassle to switch rn, but maybe in the future).

after installing everything, setting up the environment variables and creating a `systemd` service, i finally got the bot running 24/7.

TL;DR: i got the bot running 24/7 in the server and it works perfectly fine, and i can now add new commands without having to touch the main bot.js file, and also, and added detailed server logging with time & user

aight y'all i spent an ENTIRE HOUR writing this devlog and THEN i had to rewrite a shortened down version, y'all better rate me 9/9 for story telling, rylvion signing out 🫡 
pls see my [full devlog version](./devlog2.md)

---

<a href="devlog1.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 1" />
  </picture>
</a>

<p align="right">
  <em><b>
    <a href="devlog3.md">
      visit devlog 3
    </a>
  </b></em>
</p>

<p align="center">
  <em><b>
    <a href="devlog2.md">
      view full devlog
    </a>
  </b></em>
</p>

