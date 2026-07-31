<img src="../attachments/d7/logs.png">

# Devlog 7 - Adding a Web Dashboard (locally)
time logged: (still progressing :D stay tuned)
date: 30/07/2026

███████╗██╗      █████╗  ██████╗██╗  ██╗███████╗██╗██╗     ██╗      █████╗
██╔════╝██║     ██╔══██╗██╔════╝██║ ██╔╝╚══███╔╝██║██║     ██║     ██╔══██╗
███████╗██║     ███████║██║     █████╔╝   ███╔╝ ██║██║     ██║     ███████║
╚════██║██║     ██╔══██║██║     ██╔═██╗  ███╔╝  ██║██║     ██║     ██╔══██║
███████║███████╗██║  ██║╚██████╗██║  ██╗███████╗██║███████╗███████╗██║  ██║
╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝

added a local prototype view of the web dashboard for slackzilla, its hosted on [Github Pages](https://rylvion.github.io/slackzilla/) and is a static site that is not connected to the bot yet, it shows the design and layout of the dashboard and how it will look when its connected to the bot. the dashboard is designed to be responsive and works on both desktop and mobile devices. it has a clean and modern design that is easy to navigate.

for Github Pages hosting, i used `gh-pages` branch which meant creating a seperate workflow (`pages.yml`) to build and deploy the dashboard to the `dist/` folder. before that i needed a way to make it minified and optimised for production, so i used `terser`, `clean-css` and `html-minifier-terser` to minify the js, css and html files respectively, i do realise that this meant adding extra dependencies to the project (even though its not linked to the bot yet). The deployment website will be hosted on the bot's server (`rylvion.hackclub.app`) and on the same port as the webhook server 

i also added new logging functionality that return smth like this the one below, this helps me track the usage of the commands and see how many times they have been used, when they were last used and by whom. this will be useful for the dashboard to show command usage statistics and manage command permissions.

```js
{
  "commands": {
    "sz-hash": {
      "count": 3,
      "lastUsedAt": "2026-07-23T13:27:28.116Z",
      "lastUser": "rylvion",
      "lastUserId": "U0A84FA2NP2"
    }
  }
}
```

TL;DR: added a local prototype view of the web dashboard for slackzilla, its hosted on Github Pages and is a static site that is not connected to the bot yet, it shows the design and layout of the dashboard and how it will look when its connected to the bot and logging functionality that return command usage statistics and manage command permissions.

- introduced a new logging system that logs to both console and a file.
- added command usage tracking to record how often each command is used.
- enhanced server.js to serve dashboard, logs, and status pages.
- improved webhook handling and added signature verification.
- added a new metrics utility and feedback.js for tracking command usage statistics.

next devlog will be about connecting the dashboard to the bot & server and making it functional, its gonna be a long one so stay tuned for that
 
___

<a href="devlog6.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 6" />
  </picture>
</a>

<p align="right">
  <em>
    <b>
      <a href="#">
        visit non existent devlog 8 (coming soon)
      </a>
    </b>
  </em>
</p>
