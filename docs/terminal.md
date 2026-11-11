# Slackzilla Embedded Terminal

Before reading this i reccomemend you read [https://hackclub.enterprise.slack.com/docs/T0266FRGM/F0CFV0QG5H7](https://hackclub.enterprise.slack.com/docs/T0266FRGM/F0CFV0QG5H7)

This is NOT A shell (`xterm.js`). it CANNOT execute arbitrary operating-system commands, load arbitrary modules or access arbitrary files. browser-only commands such as `dir`, `cd` and `storage` are handled separately by `Terminal.jsx`.

## Available commands

local commands are loaded client-sided and does not use api

| Command              | Args    | Flags              | Description                                                  |
| -------------------- | ------- | ------------------ | ------------------------------------------------------------ |
| `help`               | none    | none               | Lists the available local commands.                          |
| `cls`, `clear`       | none    | none               | Clears visible output without clearing history.              |
| `whoami`, `identity` | none    | none               | Displays the current terminal identity (`noob` or `hecker`). |
| `ver`                | none    | none               | Displays the client package version locally.                 |
| `history`            | none    | `--clear`, `-c`    | Shows commands entered during this terminal session.         |
| `time`, `timestamp`  | `value` | `--readable`, `-r` | Converts a Unix timestamp or shows current ISO time.         |

(see the [Terminal Extension Guide](./extension/terminal-extension-guide.md) for instructions on adding new local commands).

| Command                              | Description                                                                                         | Example                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `status`                             | Returns a limited application status summary.                                                       | `status`                                          |
| `uptime`                             | Returns the application's uptime.                                                                   | `uptime`                                          |
| `api list`                           | Lists indexed API routes.                                                                           | `api list --method GET`                           |
| `api inspect /api/status`            | Inspects an indexed route.                                                                          | `api inspect /api/status`                         |
| `api get /api/status`                | Performs an allow-listed same-origin GET request.                                                   | `api get /api/status`                             |
| `api post /api/example`              | Performs an internal same-origin POST through its normal API handler.                               | `api post /api/example --body '{"example":true}'` |
| `logs`                               | Displays the latest ten redacted log entries.                                                       | `logs --tail 50`                                  |
| `storage`                            | Inspects browser session and local storage.                                                         | `cd storage`                                      |
| `version`                            | Displays the current or a historical release and its notes.                                         | `version v0.9.6-beta --verbose`                   |
| `docs list`                          | Lists Markdown documentation.                                                                       | `docs list`                                       |
| `docs search <text>`                 | Searches documentation excerpts.                                                                    | `docs search webhook`                             |
| `rag status`                         | Shows the local RAG index status.                                                                   | `rag status`                                      |
| `rag analyse <file>`                 | Analyses an indexed repository file.                                                                | `rag analyse server/client/src/App.jsx`           |
| `rag sources`                        | Lists indexed source files with optional type, search, and limit filters.                           | `rag sources --type jsx --limit 20`               |
| `rag tools`                          | Lists registered RAG tools and their parameter schemas.                                             | `rag tools`                                       |
| `rag inspect <tool>`                 | Displays one RAG tool definition and schema.                                                        | `rag inspect getStatus`                           |
| `rag execute <tool> [JSON \| flags]` | Executes a registered RAG tool with JSON or schema-based flags.                                     | `rag execute getCommands --fuzzy terminal`        |
| `rag search <text>`                  | Searches indexed source chunks.                                                                     | `rag search terminal`                             |
| `command list`                       | Lists Slack command metadata.                                                                       | `command list`                                    |
| `command inspect <id>`               | Shows one Slack command definition.                                                                 | `command inspect ping`                            |
| `command execute <id> [arguments]`   | Executes a registered Slack command as `@terminal-user` (Terminal User) through the shared adapter. | `command execute ping`                            |
| `sudo controls`                      | Lists approved administrative controls.                                                             | `sudo controls`                                   |
| `sudo status`                        | Shows a filtered administrative status summary.                                                     | `sudo status`                                     |
| `sudo inspect <id>`                  | Shows one administrative control definition.                                                        | `sudo inspect stop`                               |
| `sudo execute <id>`                  | Re-authenticates, confirms, and executes one control.                                               | `sudo execute refresh`                            |
| `sudo logout`                        | Re-authenticates, confirms, and ends the administrator session.                                     | `sudo logout`                                     |


## Authentication and privileged operations

The terminal starts as a lvl 1 `noob`. After login via `sudo` or `/admin/login`, the identity and prompt become `hecker`; after `sudo logout`, the server session and cookie are invalidated, the client session is refreshed, and the prompt returns to `noob` without a page reload.

## Input controls

The current cursor refers to the position where the next character will appear when typing a command. It indicates where text will be inserted or deleted.

| Key combination           | Action                                                                                            | Code               |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| Enter                     | execute the current command or submit an interactive prompt.                                      | `\r`               |
| Backspace                 | delete the character before the cursor.                                                           | `\u007f`           |
| Ctrl+Backspace            | delete the word before the cursor, including preceding whitespace.                                | `\u0017`           |
| Left arrow                | move the cursor one character left.                                                               | `\u001b[D`         |
| Right arrow               | move the cursor one character right.                                                              | `\u001b[C`         |
| Ctrl+Left arrow           | move the cursor one word left.                                                                    | Keyboard event     |
| Ctrl+Right arrow          | move the cursor one word right.                                                                   | Keyboard event     |
| Up arrow                  | navigate to the previous command in history.                                                      | `\u001b[A`         |
| Down arrow                | navigate forwards through command history or restore the current draft.                           | `\u001b[B`         |
| Escape                    | clear the current command input.                                                                  | `\u001b`           |
| Ctrl+C                    | cancel a running request; while idle, clear input and move up one virtual context when available. | `\u0003`           |
| Ctrl+C with selected text | copy the selected terminal text to the clipboard.                                                 | Keyboard event     |
| Ctrl+L                    | clear the visible terminal output while retaining command history.                                | `\u000c`           |
| Printable characters      | insert text at the current cursor position.                                                       | Character input    |
| Multiline paste           | split pasted text into individual commands and queue them for execution.                          | `\n` |


--- 

### what is xterm.js?

xterm.js is an open-source terminal emulator for the web. It provides the terminal display, cursor, scrollback, keyboard input events, and ANSI escape-sequence rendering. Slackzilla uses `@xterm/xterm` to render the terminal interface and `@xterm/addon-fit` to calculate the number of rows and columns that fit its container. React manages the component lifecycle and Slackzilla's command logic; xterm.js does not execute commands or provide a shell by itself. 

for more information, i reccommend you read [this blog post](https://www.w3tutorials.net/blog/xterm-nodejs/) and maybe the [xterm.js documentation](https://xtermjs.org/docs/).

## All sources related to the terminal

- [Terminal page](../server/client/src/pages/Terminal.jsx)
- [Terminal styles](../server/client/src/css/terminal.css)
- [Frontend route registry](../server/client/src/components/utils/routes.js)
- [Terminal API](../server/api/terminal/index.js)
- [Command registry](../server/lib/terminal/commands.js)
- [Parser](../server/lib/terminal/parser.js)
- [Permissions](../server/lib/terminal/permissions.js)
