# Slackzilla Embedded Terminal

The Slackzilla embedded terminal is a developer-oriented terminal interface rendered in the browser using **xterm.js**, a JavaScript terminal emulator integrated into the React dashboard. It exposes useful local utilities and read-only views of existing Slackzilla functionality.

It is **not** a real operating-system shell. It does not execute arbitrary commands, access the host filesystem, start processes, or provide direct operating-system access.

## Opening the terminal

Open the dashboard's **Terminal** navigation item or visit [`/terminal`](../server/client/src/pages/Terminal.jsx) directly. The route is registered in [`routes.js`](../server/client/src/components/utils/routes.js), and the built-in server allowlist includes the `/terminal` browser route.

## Available commands

Local commands are interpreted in the browser:

| Command              | Args    | Flags              | Description                                                  |
| -------------------- | ------- | ------------------ | ------------------------------------------------------------ |
| `help`               | none    | none               | Lists the available local commands.                          |
| `cls`, `clear`       | none    | none               | Clears visible output without clearing history.              |
| `whoami`, `identity` | none    | none               | Displays the current terminal identity (`noob` or `hecker`). |
| `ver`                | none    | none               | Displays the client package version locally.                 |
| `history`            | none    | `--clear`, `-c`    | Shows commands entered during this terminal session.         |
| `time`, `timestamp`  | `value` | `--readable`, `-r` | Converts a Unix timestamp or shows current ISO time.         |

(see the [Terminal Extension Guide](./extension/terminal-extension-guide.md) for instructions on adding new local commands).

| Command                            | Description                                                               | Example                                           |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `status`                           | Returns a limited application status summary.                             | `status`                                          |
| `uptime`                           | Returns the application's uptime.                                         | `uptime`                                          |
| `api list`                         | Lists indexed API routes.                                                 | `api list --method GET`                           |
| `api inspect /api/status`          | Inspects an indexed route.                                                | `api inspect /api/status`                         |
| `api get /api/status`              | Performs an allow-listed same-origin GET request.                         | `api get /api/status`                             |
| `api post /api/example`            | Performs an internal same-origin POST through its normal API handler.     | `api post /api/example --body '{"example":true}'` |
| `logs`                             | Displays the latest ten redacted log entries.                             | `logs --tail 50`                                  |
| `storage`                          | Inspects browser session and local storage.                               | `cd storage`                                      |
| `version`                          | Displays the current or a historical release and its notes.               | `version v0.9.6-beta --verbose`                   |
| `docs list`                        | Lists Markdown documentation.                                             | `docs list`                                       |
| `docs search <text>`               | Searches documentation excerpts.                                          | `docs search webhook`                             |
| `rag status`                       | Shows the local RAG index status.                                         | `rag status`                                      |
| `rag sources`                      | Lists indexed source files with optional type, search, and limit filters. | `rag sources --type jsx --limit 20`               |
| `rag search <text>`                | Searches indexed source chunks.                                           | `rag search terminal`                             |
| `command list`                     | Lists Slack command metadata.                                             | `command list`                                    |
| `command inspect <id>`             | Shows one Slack command definition.                                       | `command inspect ping`                            |
| `command execute <id> [arguments]` | Executes a registered Slack command through the shared adapter.           | `command execute ping`                            |
| `sudo controls`                    | Lists approved administrative controls.                                   | `sudo controls`                                   |
| `sudo status`                      | Shows a filtered administrative status summary.                           | `sudo status`                                     |
| `sudo inspect <id>`                | Shows one administrative control definition.                              | `sudo inspect stop`                               |
| `sudo execute <id>`                | Re-authenticates, confirms, and executes one control.                     | `sudo execute refresh`                            |
| `sudo logout`                      | Re-authenticates, confirms, and ends the administrator session.           | `sudo logout`                                     |

Use `help api`, `api --help`, `docs --help`, `rag --help`, `command --help`, or `sudo --help` for family-specific usage. `version --help` prints its syntax before the available release identifiers. Arguments may be quoted, for example `docs search "rate limiting"`.

Documentation search supports `docs search <text> --sources N` to limit the number of results and `--no-verbose` to omit excerpts. Numeric source limits must be positive integers.

Backend command families use the structured `POST /api/terminal` endpoint and only execute registered handlers. `api get` and `api post` are the exception: they make same-origin requests to explicitly permitted internal API routes and display the returned HTTP status and body. `sudo` retains the existing administrator session, CSRF, master-password re-authentication, operation-bound token, confirmation, and server-side control checks.

Command names are normalized to lowercase. Empty input is ignored. Unknown commands show a red error message and do not make a network request.

## Virtual directories and navigation

The terminal provides a virtual Windows-style directory model; it does not access the host filesystem. `dir` lists the current context without changing it, while `cd` changes context only for valid virtual directories.

- At the root prompt, `dir` lists local and backend command entries.
- `cd command` enters `command>`. Its `dir` contains `.`, `..`, `inspect`, and `execute`.
- `cd inspect` and `cd execute` enter `command/inspect>` and `command/execute>`.
- In `command/execute>`, `dir` is derived from the Slack command registry. Argument-taking commands are `<DIR>` entries; direct commands are `<CMD>` entries. `cd hash` enters `command/execute/hash>` and arguments can be entered directly there.
- `cd api` enters `api>`. Its `dir` contains `.`, `..`, `get`, `post`, `list`, and `inspect`; `cd get` and `cd post` enter request-specific contexts, while `cd inspect` enters `api/inspect>`.
- `cd logs` enters `logs>`; its `dir` contains `.`, `..`, `head`, `tail`, and `follow`.
- `cd storage` enters `storage>`; its `dir` contains `.`, `..`, `session`, and `local`. Storage prompts retain the full context path, such as `storage/session>`.
- `cd ..`, `cd..`, and `exit` move to the parent context. Idle `Ctrl+C` also moves up one context; at the root it only clears the current input.

Directory listings are derived from existing terminal and Slack command metadata. They do not create a second command registry or change Slack command argument parsing.

## Authentication and privileged operations

The terminal starts as `noob`. `sudo` without an authenticated administrator session enters the existing master-password login flow. After login, the identity and prompt become `hecker`; after `sudo logout`, the server session and cookie are invalidated, the client session is refreshed, and the prompt returns to `noob` without a page reload.

Mutating controls use operation-bound master-password re-authentication followed by confirmed control execution. The client respects the terminal API's existing cooldown between those two requests. Duplicate queued privileged submissions are ignored until the current operation finishes; a later intentional command remains allowed.

Failed control actions preserve useful diagnostics returned by the admin-control endpoint. For example, a Windows host may report `spawn systemctl ENOENT` for `sudo execute stop` because `systemctl` is unavailable; the failure is also recorded server-side.

## Input controls

The current cursor refers to the position where the next character will appear when typing a command. It indicates where text will be inserted or deleted.

| Key combination           | Action                                                                                            | Code               |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| Enter                     | Execute the current command or submit an interactive prompt.                                      | `\r`               |
| Backspace                 | Delete the character before the cursor.                                                           | `\u007f`           |
| Ctrl+Backspace            | Delete the word before the cursor, including preceding whitespace.                                | `\u0017`           |
| Left arrow                | Move the cursor one character left.                                                               | `\u001b[D`         |
| Right arrow               | Move the cursor one character right.                                                              | `\u001b[C`         |
| Ctrl+Left arrow           | Move the cursor one word left.                                                                    | Keyboard event     |
| Ctrl+Right arrow          | Move the cursor one word right.                                                                   | Keyboard event     |
| Up arrow                  | Navigate to the previous command in history.                                                      | `\u001b[A`         |
| Down arrow                | Navigate forwards through command history or restore the current draft.                           | `\u001b[B`         |
| Escape                    | Clear the current command input.                                                                  | `\u001b`           |
| Ctrl+C                    | Cancel a running request; while idle, clear input and move up one virtual context when available. | `\u0003`           |
| Ctrl+C with selected text | Copy the selected terminal text to the clipboard.                                                 | Keyboard event     |
| Ctrl+L                    | Clear the visible terminal output while retaining command history.                                | `\u000c`           |
| Printable characters      | Insert text at the current cursor position.                                                       | Character input    |
| Multiline paste           | Split pasted text into individual commands and queue them for execution.                          | Newline characters |

### Interactive prompt controls

When an interactive prompt is active, such as when authenticating with `sudo`, the following controls apply.

| Key combination                             | Action                                        |
| ------------------------------------------- | --------------------------------------------- |
| Enter                                       | Submit the prompt value.                      |
| Backspace                                   | Delete the character before the cursor.       |
| Ctrl+Backspace                              | Clear the entire prompt value.                |
| Ctrl+C                                      | Cancel the prompt and return `null`.          |
| Escape                                      | Cancel the prompt and return `null`.          |
| Printable characters                        | Insert characters into the prompt input.      |
| Printable characters during a secret prompt | Display `*` instead of the entered character. |

Prompt redraw clears and repaints the complete prompt block, including multiline privileged-operation labels, so typing a password does not append duplicate prompt labels.

## Prompt and colours

The prompt is:

```
slackzilla@noob:~$
```

The username and prompt symbol use green, the hostname uses cyan, and the directory uses purple. xterm.js renders the prompt and command output, so colours are produced with ANSI escape sequences and the xterm theme rather than CSS classes.

Output uses a restrained palette:

| Name     | ANSI escape sequence | Colour code          |
| -------- | -------------------- | -------------------- |
| `reset`  | `\x1b[0m`            | Reset formatting     |
| `bold`   | `\x1b[1m`            | Bold text            |
| `cyan`   | `\x1b[38;5;117m`     | 256-colour index 117 |
| `blue`   | `\x1b[38;5;75m`      | 256-colour index 75  |
| `BLUE`   | `\x1b[38;5;33m`      | 256-colour index 33  |
| `green`  | `\x1b[38;5;84m`      | 256-colour index 84  |
| `muted`  | `\x1b[38;5;245m`     | 256-colour index 245 |
| `purple` | `\x1b[38;5;141m`     | 256-colour index 141 |
| `red`    | `\x1b[38;5;210m`     | 256-colour index 210 |
| `RED`    | `\x1b[38;5;196m`     | 256-colour index 196 |
| `orange` | `\x1b[38;5;208m`     | 256-colour index 208 |
| `ORANGE` | `\x1b[38;5;202m`     | 256-colour index 202 |
| `white`  | `\x1b[38;5;255m`     | 256-colour index 255 |
| `yellow` | `\x1b[38;5;228m`     | 256-colour index 228 |

## Difference from a real shell

The terminal is a React page backed by xterm.js. The dispatcher uses the `localCommands` array, virtual context metadata, and the explicit backend registry in [`commands.js`](../server/lib/terminal/commands.js). It never provides a real shell.

It does not:

- execute operating-system commands;
- provide a general-purpose shell; the restricted `sudo` family only exposes explicitly approved controls;
- access files, environment variables, processes, or arbitrary network services through terminal commands;
- send arbitrary command text to the backend; only the documented registered command families use the API;
- persist command output or credentials; input, draft, history, and context may be restored in the browser session.

The backend registry is implemented in [`commands.js`](../server/lib/terminal/commands.js), with request validation in [`parser.js`](../server/lib/terminal/parser.js), permissions in [`permissions.js`](../server/lib/terminal/permissions.js), and HTTP handling in [`server/api/terminal/index.js`](../server/api/terminal/index.js). Read-only commands are public; only administrative operations require the existing administrator session and CSRF protection.

## High-level architecture

1. [`routes.js`](../server/client/src/components/utils/routes.js) lazy-loads the `/terminal` page.
2. [`Terminal.jsx`](../server/client/src/pages/Terminal.jsx) creates and disposes the xterm.js instance while keeping one input listener across authentication-state changes.
3. [`FitAddon`](../server/client/src/pages/Terminal.jsx) fits the terminal to its bounded container.
4. `handleData()` maintains the input buffer, cursor, keyboard controls, and history.
5. `executeCommand()` dispatches local commands directly and sends registered backend families to the terminal API.
6. [`terminal.css`](../server/client/src/css/terminal.css) constrains the panel and keeps output scrolling internally.

For extension work, see the [Terminal Extension Guide](./extension/terminal-extension-guide.md).

---

### what is xterm.js?

xterm.js is an open-source terminal emulator for the web. It provides the terminal display, cursor, scrollback, keyboard input events, and ANSI escape-sequence rendering. Slackzilla uses `@xterm/xterm` to render the terminal interface and `@xterm/addon-fit` to calculate the number of rows and columns that fit its container. React manages the component lifecycle and Slackzilla's command logic; xterm.js does not execute commands or provide a shell by itself. For more information, see the [xterm.js documentation](https://xtermjs.org/docs/).

## Current limitations

- Backend families include `status`, `uptime`, `logs`, `api`, `docs`, `rag`, `command`, and `sudo`; local utilities include `timestamp`, `terminal`, `refresh`, and `history`.
- Backend arguments are strictly bounded.
- Session storage contains the terminal state (input, draft, history, context, and cleared-output marker); terminal responses and credentials are not stored. `cls`/`clear` persists an empty output state across navigation or reload.
- Backend requests are rate limited. Administrative requests additionally require an authenticated administrator session and CSRF validation.
- `sudo controls`, `sudo status`, and `sudo inspect <id>` expose approved administrative metadata. `sudo execute <id>` and `sudo logout` use the existing authenticated admin-control architecture.
- There is no shell protocol or arbitrary backend execution.
- The shared dashboard shell may still request its normal status data; documented terminal command families use the backend terminal API.

## Public diagnostics and virtual storage

`logs` reads the existing server log collection. It shows the latest ten entries by default, supports `--head`, `--tail`, bounded `--start`/`--end` ranges, and `follow`/`tail --watch` through the existing log SSE stream. Requests are limited to fifty entries and redact passwords, tokens, session cookies, and CSRF values. `cd logs` exposes `dir`, `head`, `tail`, and `follow` using the same handlers.

The `api` context supports same-origin `api get PATH` and `api post PATH --headers "Name: value" --body JSON`. POST requests may target internal `/api/` routes for normal users, but the destination handler remains authoritative: protected routes still enforce their own session, CSRF, confirmation, authentication, method, and rate-limit checks. The terminal obtains the current CSRF token from the session when an authenticated request needs it.

The RAG can use the `runApiCommand` tool for internal GET/POST routes. It cannot provide credential headers or reach external URLs; endpoint-level protections remain active.

`rag sources` accepts `--type`, `--search`, and `--limit`, for example `rag sources --type jsx`, `rag sources --type json,jsx --search terminal --limit 20`, or `rag sources --limit 50`. Search matches source paths case-insensitively. Type matching supports common extensions including JavaScript, JSX, JSON, Markdown, HTML, YAML, and explicit extensions.

`version` accepts an optional release identifier and `--verbose`, in either order. `version --help` prints `version [--verbose] [VERSION]` and `version --help` before the available release list. Historical release notes are limited to 15 entries by default; `--verbose` returns the complete notes for the selected release.

`storage` is a browser-side virtual directory with `session` and `local` children. `dir`, `view KEY`, and `delete KEY` operate on actual browser storage. After administrator authentication, directory listings include the stored values; before authentication they show keys only. The terminal state key cannot be deleted through the terminal. Relative paths such as `cd ../local` share the normal context-stack navigation. A cookies directory is intentionally not exposed because Slackzilla authentication cookies are HttpOnly and cannot be safely inspected from page JavaScript.

After administrator login the terminal reports that the session is active and that a CSRF token is available; it never prints the session cookie or raw CSRF token.

## All sources related to the terminal

- [Terminal page](../server/client/src/pages/Terminal.jsx)
- [Terminal styles](../server/client/src/css/terminal.css)
- [Frontend route registry](../server/client/src/components/utils/routes.js)
- [Terminal API](../server/api/terminal/index.js)
- [Command registry](../server/lib/terminal/commands.js)
- [Parser](../server/lib/terminal/parser.js)
- [Permissions](../server/lib/terminal/permissions.js)
