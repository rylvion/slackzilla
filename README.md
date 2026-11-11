# Welcome to Slackzilla

[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/rylvion/slackzilla/blob/main/LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-v24.15.0-green?logo=nodedotjs&logoColor=white)
[![Slackzilla Version](https://img.shields.io/badge/Slackzilla-v1.0.0--release-blueviolet)](https://github.com/rylvion/slackzilla/blob/main/)
[![Top Language](https://img.shields.io/github/languages/top/rylvion/slackzilla)](https://github.com/search?q=repo%3Arylvion%2Fslackzilla++language%3AJavaScript&type=code)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs&logoColor=white)

If your reading this... your're probably reviewing this project anyways, slackzilla is a full stack slack bot with a backend dashboard, api, webhook, AI assistant (with RAG capabilities), and a whole embedded TERMINAL.

here are some links:

- The hosted dashboard: [https://rylvion.hackclub.app](https://rylvion.hackclub.app)
- The Slack Help Server: [https://app.slack.com/client/E09V59WQY1E/C0CFLJA4YUB](https://app.slack.com/client/E09V59WQY1E/C0CFLJA4YUB)
- The Devlogs: [https://stardance.hackclub.com/projects/4967](https://stardance.hackclub.com/projects/4967)

Also a couple of reviewers also like idk, MISSED the help server somehow??? so im putting it here again: [https://app.slack.com/client/E09V59WQY1E/C0CFLJA4YUB](https://app.slack.com/client/E09V59WQY1E/C0CFLJA4YUB). please join it pls

## Slack Commands

All slack commands are listed BELOW AND in [https://rylvion.hackclub.app/commands](https://rylvion.hackclub.app/commands) or you can check in the terminal `command list` or navigate into the `cd command` directory and go to `cd execute` and then type `dir` you can see all the commands there

| Command        | Usage                                             | Description                                                                                                                                                                                    | Category      |
| -------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `/sz-ping`     | (none)                                            | checks if the bots responsive                                                                                                                                                                  | core          |
| `/sz-help`     | (none)                                            | shows ALL commands and description                                                                                                                                                             | core          |
| `/sz-info`     | (none)                                            | shows ver no., plat, uptime, memory usage, when its started, how much cmds it has and the hosted link                                                                                          | core          |
| `/sz-quote`    | (none)                                            | shows quote                                                                                                                                                                                    | entertainment |
| `/sz-joke`     | (none)                                            | fetches a jooke                                                                                                                                                                                | entertainment |
| `/sz-fact`     | (none)                                            | fun fact                                                                                                                                                                                       | entertainment |
| `/sz-hug`      | (none)                                            | hug ascii art                                                                                                                                                                                  | entertainment |
| `/sz-meme`     | (none)                                            | shows random meme (with gif)                                                                                                                                                                   | entertainment |
| `/sz-echo`     | `<message>`                                       | sends whatever you say back                                                                                                                                                                    | core          |
| `/sz-calc`     | `<expression>`                                    | calculates expression                                                                                                                                                                          | utility       |
| `/sz-roll`     | `<side><n><rolls>+<modifier>`                     | rolls a dice (default 1 to 6)                                                                                                                                                                  | utility       |
| `/sz-base64`   | `<string>`                                        | generates a base64-encoded string                                                                                                                                                              | utility       |
| `/sz-8ball`    | `<question>`                                      | It is certain.                                                                                                                                                                                 | entertainment |
| `/sz-rps`      | `<rock\|1 /paper\|2 /scissors\|3>`                | plays rock paper scissors                                                                                                                                                                      | entertainment |
| `/sz-uuid`     | (none)                                            | generates uuid                                                                                                                                                                                 | utility       |
| `/sz-token`    | `<length>`                                        | min: 1, def: 32, max: 256                                                                                                                                                                      | utility       |
| `/sz-random`   | `<min> <max>`                                     | self explanatory                                                                                                                                                                               | utility       |
| `/sz-case`     | `<camel\|pascal\|snake\|kebab> <text>`            | self explanatory                                                                                                                                                                               | utility       |
| `/sz-unix`     | `<timestamp\|date>`                               | self explanaotry                                                                                                                                                                               | utility       |
| `/sz-count`    | `<text>`                                          | self explanatory                                                                                                                                                                               | utility       |
| `/sz-hash`     | `<algorithm> <encrypt?> <iter?> <salt?> <string>` | generates a hash, default: `SHA-256`. `RSA-MD5`, `RSA-RIPEMD160`, `RSA-SHA1`, `RSA-SHA1-2`, `RSA-SHA224`, `RSA-SHA256`, `RSA-SHA3-224`, `RSA-SHA3-256`, `rand`, `pbkdf2`, `base64`, and `hex`. | utility       |
| `/sz-decode`   | `<algorithm> <string>`                            | decodes `base64`, `hex`, and `rand` data.                                                                                                                                                      | utility       |
| `/sz-feedback` | `<message>`                                       | Sends feedback to me                                                                                                                                                                           | utility       |
| `/sz-ask`      | `<question>`                                      | ask a question                                                                                                                                                                                 | utility       |
| `/sz-release`  | `<version>`                                       | `v[0\|1].[9\|0].[0-6]-[beta\|release]` see help for available versions                                                                                                                         | utility       |

ALL utilities commands have a `help` parameter which tells you how to use it unless its self explanatory and ALL commands can be executed in the [terminal](https://rylvion.hackclub.app/terminal)/[command executor](https://rylvion.hackclub.app/commands)

For terminal commands check [https://hackclub.enterprise.slack.com/docs/T0266FRGM/F0CFV0QG5H7](https://hackclub.enterprise.slack.com/docs/T0266FRGM/F0CFV0QG5H7) for the terminal guide

<div align="center">

## Pages

  <table>
    <tr>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app"><img src="assets/pages/home.png"width="100%" height="240" style="object-fit: cover" alt="dashboard"></a>
        <h3 align="center"><strong>Dashboard</strong></h3>
        <p align="center"><em>shows last 120 samples of telemetry data for CPU, RAM, netowrk inbound & outbound requests</em></p>
      </td>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/commands"><img src="assets/pages/cmds.png" width="100%" height="240" style="object-fit: cover" alt="commands"></a>
        <h3 align="center"><strong>Commands</strong></h3>
        <p align="center"><em>lists, categorise, and execute avaiable commands (apart from ask)</em></p>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/api"><img src="assets/pages/api.png" width="100%" height="240" style="object-fit: cover" alt="API"></a>
        <h3 align="center"><strong>API</strong></h3>
        <p align="center"><em>dynamically generated API routes found by RAG with search & method filters</em></p>
      </td>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/logs"><img src="assets/pages/logs.png" width="100%" height="240" style="object-fit: cover" alt="logs"></a>
        <h3 align="center"><strong>Logs</strong></h3>
        <p align="center"><em>view server logs</em></p>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/terminal"><img src="assets/pages/terminal.png" width="100%" height="240" style="object-fit: cover" alt="terminal"></a>
        <h3 align="center"><strong>Terminal</strong></h3>
        <p align="center"><em><a href="https://hackclub.enterprise.slack.com/docs/T0266FRGM/F0CFV0QG5H7">check terminal guide</a></em></p>
      </td>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/ai"><img src="assets/pages/rag.png" width="100%" height="240" style="object-fit: cover" alt="rag"></a>
        <h3 align="center"><strong>AI Assistant</st rong></h3>
        <p align="center"><em>asks questions with codebase context, and tools</em></p>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/admin"><img src="assets/pages/admin.png" width="100%" height="240" style="object-fit: cover" alt="admin page"></a>
        <h3 align="center"><strong>Admin</strong></h3>
        <p align="center"><em>view, manage, delete and execute actions</em></p>
      </td>
      <td align="center" width="50%">
        <a href="https://rylvion.hackclub.app/admin/errors"><img src="assets/pages/errors.png" width="100%" height="240" style="object-fit: cover" alt="errors"></a>
        <h3 align="center"><strong>Errors</strong></h3>
        <p align="center"><em>view and manage errors</em></p>
      </td>
    </tr>
    <tr>
      <td align="center" colspan="2">
        <a href="https://rylvion.hackclub.app/admin/events"><img src="assets/pages/events.png" width="100%" height="240" style="object-fit: cover" alt="server events"></a>
        <h3 align="center"><strong>Events</strong></h3>
        <p align="center"><em>view and manage all inbound requests</em></p>
      </td>
      <td align="center" width="50%">
      </td>
    </tr>
  </table>
</div>

## Contributing

Contributions are NOT accepted. If you have any issues, bugs, or feature requests, please open an issue on the repository or reach out through the [Slackzilla help Server](https://app.slack.com/client/E09V59WQY1E/C0CFLJA4YUB) and I'll try to help you out.

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/rylvion/slackzilla/output/github-contribution-grid-snake-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/rylvion/slackzilla/output/github-contribution-grid-snake.svg">
    <img alt="GitHub contribution snake animation" src="https://raw.githubusercontent.com/rylvion/slackzilla/output/github-contribution-grid-snake.svg">
  </picture>
</div>
