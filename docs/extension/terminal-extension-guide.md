# Terminal Extension Guide

This guide covers the Slackzilla terminal at [`/terminal`](../../server/client/src/pages/Terminal.jsx). It describes the explicit local command table and restricted backend command API; it does not define a plugin system or an operating-system shell.

## TOC

| Content                                                 | Description                                      | Subsections                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [Architecture](#architecture)                           | Overview of the frontend and backend components. | none                                                                                                                                    |
| [Adding a command](#adding-a-command)                   | How to add a local or backend command.           | [Dispatch location](#dispatch-location), [Adding a backend command](#adding-a-backend-command), [Output and colour](#output-and-colour) |
| [Changing terminal colours](#changing-terminal-colours) | How to change the xterm theme.                   | none                                                                                                                                    |
| [Adding keyboard shortcuts](#adding-keyboard-shortcuts) | How to add a new keyboard shortcut.              | none                                                                                                                                    |
| [Input editing and history](#input-editing-and-history) | How the input buffer, cursor, and history work.  | none                                                                                                                                    |
| [Resizing and lifecycle](#resizing-and-lifecycle)       | How the terminal resizes and cleans up.          | none                                                                                                                                    |
| [Extension guidelines](#extension-guidelines)           | Best practices for extending the terminal.       | none                                                                                                                                    |

## Architecture

The terminal is composed of two frontend surfaces:

- [`Terminal.jsx`](../../server/client/src/pages/Terminal.jsx) owns the xterm.js instance, the local command table, input buffer, cursor, history, keyboard handling, output formatting, and lifecycle cleanup.
- [`terminal.css`](../../server/client/src/css/terminal.css) owns the terminal page layout and xterm container

\*also uses [`routes.js`](../../server/client/src/components/utils/routes.js) to lazy-load the `/terminal` page.\* (but that doesnt rlly count so...)

The backend files [`server/api/terminal/index.js`](../../server/api/terminal/index.js), [`commands.js`](../../server/lib/terminal/commands.js), [`parser.js`](../../server/lib/terminal/parser.js), and [`permissions.js`](../../server/lib/terminal/permissions.js) implement a restricted command API. Read-only requests are public and use a terminal-specific rate limiter. Administrative requests additionally use the existing administrator session and CSRF validation.

`Terminal.jsx` creates an `XTerm` instance on mount, loads `FitAddon`, and opens xterm in `.terminal-container`. A `ResizeObserver` calls `fitAddon.fit()` when the container's width or height changes. The observer and xterm data subscription are disposed, and the terminal is disposed, on unmount.

Local commands are synchronous and write directly to xterm. Backend command families such as `status`, `api`, `docs`, `rag`, `command`, and `sudo` send bounded requests to `POST /api/terminal`, then format structured responses. No command is evaluated as JavaScript or passed to an operating system shell.

Browser-local utilities include `history`, `terminal`, `refresh`, and `timestamp`; these do not require a session or network request. Their handlers receive the parsed argument array from `executeCommand()`.

Quoted arguments are parsed as one value, and JSON punctuation inside a token is preserved. Multiline paste is normalized to spaces and inserted as one command rather than being submitted as several overlapping requests. The current input, draft, recent history, and virtual context stack are stored in session storage only; responses and credentials are never stored.

The xterm effect keeps one data listener while authentication state changes. Identity is read from live refs so logout changes the prompt and subsequent `sudo` commands immediately use the unauthenticated login flow. Prompt redraw clears the complete multiline prompt block before repainting secret input.

## Adding a command

When adding a command, follow these rules: (even when typing in the terminal, these rules are enforced by the parser and dispatcher)

- Command names MUST NOT be empty.
- Command names are case-insensitive. Leading and trailing whitespace is trimmed.
- Command names MUST start with a letter (`a-z`, case-insensitive).
- Command names MUST contain only letters (`a-z`), numbers (`0-9`), and hyphens (`-`).
- Command names MUST NOT start with a number, hyphen, or special character.
- Command names MUST NOT contain spaces. Use [subcommands](#sub-commands) to organise related commands.
- Underscores and all other special characters are prohibited in command names.
- Backend command names MUST NOT exceed 32 characters.
- Backend command input MUST NOT exceed 4,096 characters, contain more than 8 arguments, or have individual arguments longer than 2,048 characters.
- Backend arguments MUST be strings and MUST NOT contain ASCII control characters.

Local terminal commands and backend commands use separate dispatch paths. Ensure new commands follow the validation and permission requirements of the path they use.

### Dispatch location

Commands are registered in the `localCommands` array near the top of [`Terminal.jsx`](../../server/client/src/pages/Terminal.jsx) around line ~120. `executeCommand()` trims the submitted input, takes the first whitespace-separated token as the command name, lowercases it, and looks it up in that array.

Each local command currently has this shape:

```js
{
    aliases: ["today", "date"],
    description: "display the current date",
    run: () => {
        const newDate = new Date().toLocaleDateString("en-GB")
        return `${colour("date", "BLUE")}  ${colour(newDate, "cyan")}`
    }
}
```

The first entry in `aliases` is the **canonical command name**, which is displayed in the `help` output. The optional `noHelp` boolean controls whether a command supports the `--help` flag. By default, `noHelp` MUST be omitted, allowing `--help` to display usage information without executing the command. Set `noHelp: true` only when explicitly required, as it disables help handling and causes the command to execute normally regardless of the supplied flags or arguments.

**Do NOT use `noHelp: true` for public commands without a specific reason.** It is intended for exceptional commands where intercepting `--help` would interfere with their normal behaviour. For example, `cls --help` must clear the terminal rather than display usage information, while `re --help` must reload the terminal. Setting `noHelp: true` ensures these commands execute immediately, regardless of the supplied arguments. **Always omit `noHelp` unless you explicitly need to disable help handling.**

The `description` field is metadata for the command table. The current `help` output is explicitly formatted, so adding a command also requires adding a row to the `help.run()` result.

The existing local dispatcher accepts quoted and multi-word arguments and passes the parsed argument array to `run(args)`. Backend requests are parsed and bounded by [`parser.js`](../../server/lib/terminal/parser.js), and a backend command must be explicitly registered with a permission requirement. Do not use `eval`, spawn a process, or add arbitrary shell execution.

Family help is handled before dispatch: `help api`, `api --help`, `docs --help`, `rag --help`, `command --help`, and `sudo --help` show usage without making a backend request.

### Virtual directories

`dir` is a read-only virtual-directory listing operation; it must not push a context. `cd` is the context-changing operation. Root `dir` lists available local and backend entries. `command> dir` lists only `.`, `..`, `inspect`, and `execute`; `api> dir` lists `.`, `..`, `get`, `post`, `list`, and `inspect`; `logs> dir` lists `.`, `..`, `head`, `tail`, and `follow`; `storage> dir` lists `.`, `..`, `session`, and `local`. In `command/execute>`, the listing is derived from the Slack command registry and usage metadata: argument-taking commands are `<DIR>` entries and direct commands are `<CMD>` entries.

The documentation search handler accepts `--sources N` (a positive integer result limit) and `--no-verbose` (omit excerpts) without changing the underlying document retrieval pipeline.

When adding a context, handle `dir` and `cd` before family dispatch so they cannot be interpreted as Slack command IDs or backend subcommands. `cd ..`, `cd..`, `exit`, and idle Ctrl+C must pop exactly one context. Commands entered inside an argument directory must be translated back to the existing `command execute <id> [arguments]` adapter; do not create a second command registry.

### Adding a backend command

Add a new entry to the `commands` object in [`commands.js`](../../server/lib/terminal/commands.js) with a description, explicit permission, usage string, and bounded handler. The handler receives an object containing `args`, the shared server `context`, and the authenticated `session` (when present):

```js
ready: {
    description: "return a fixed readiness result",
    usage: "ready",
    permission: PERMISSIONS.PUBLIC,
    execute: ({ context }) => ({
        ready: context.renderStatusSummary().botOnline === true
    })
}
```

Then add `ready` to the `serverCommands` metadata in `Terminal.jsx`, add its syntax to `serverUsage` if it has family help, and format its response in `formatServerOutput()`. Keep the three layers aligned: the backend registry is authoritative for execution, the frontend metadata drives help and directory listings, and the formatter controls terminal presentation.

#### Reading data from an existing API

Do not make a backend command call the terminal endpoint or use a browser URL. Reuse the underlying server helper or store that already powers the API. The terminal handler receives the same server `context` used by API modules, so it can read shared data directly:

```js
status: {
    description: "return the public application status summary",
    usage: "status",
    permission: PERMISSIONS.PUBLIC,
    execute: ({ context }) => context.renderStatusSummary()
}
```

For a new command that needs data exposed by another API, first inspect that API module and extract or reuse its context helper. For example, use `context.store.getLogSnapshot()` and `context.splitLogLines()` for logs, `context.getBotMetrics()` for bot metrics, or `context.buildAdminSummary()` only in an authenticated administrative command. If the existing API has no reusable helper, add a small shared helper and have both the API module and terminal command call it; do not duplicate response logic or issue an HTTP request back into Slackzilla.

Use `args` for validated command arguments and `session` only for identity or authorization context. Never accept a client-supplied role, session ID, CSRF token, or private route as proof of permission. Mark read-only data as `PERMISSIONS.PUBLIC`; administrative data or mutations must use `PERMISSIONS.ADMIN` and remain behind the existing session and CSRF checks.

For external services, call an existing server-side integration utility only when the feature already permits that service. Bound timeouts and response sizes, redact credentials, and avoid returning raw upstream errors to public users. If the data belongs to a browser-only API such as `sessionStorage` or `localStorage`, implement it in the frontend terminal context instead of pretending it is server data.

Example of a command that combines an argument with existing server data:

```js
logs: {
    description: "inspect recent public server log entries",
    usage: "logs [--tail N]",
    permission: PERMISSIONS.PUBLIC,
    execute: ({ args, context }) => executeLogs(args, context)
}
```

The request is then sent through `POST /api/terminal` as `{ command: "logs", args: ["--tail", "20"] }`; the terminal API performs registration, permission, rate-limit, and error handling before invoking the handler.

### Output and colour

Use the existing `colour(text, colourName)` helper rather than scattering raw escape sequences. A command can return a string containing ANSI sequences:

```js
run: () => [colour("RESULT", "purple"), `  ${colour("ready", "green")}`].join("\r\n")
```

`executeCommand()` writes returned output followed by a newline and then prints a new prompt. The `clear` command is the special case: its `run()` returns `null`, and the dispatcher clears the visible terminal before printing a prompt. Backend requests show loading text, have a timeout, and can be cancelled with Ctrl+C. `command execute <id> [arguments]` calls the existing registered Slack command adapter; it does not load arbitrary modules or execute shell text.

Privileged operations use the existing admin-control route. The client performs operation-bound master-password re-authentication, waits for the terminal API's existing cooldown, then submits the confirmed operation. Identical privileged commands already queued by duplicate input events are ignored until completion; this prevents repeated prompts without increasing server limits. `sudo logout` and `sudo execute logout` share the same control path and refresh the client session after success.

## Changing terminal colours

The xterm theme is defined in the `new XTerm({...})` options in [`Terminal.jsx`](../../server/client/src/pages/Terminal.jsx). The current palette is:

| Role           | Colour    |
| -------------- | --------- |
| Background     | `#090e0b` |
| Foreground     | `#d5e8d9` |
| Cursor         | `#50fa7b` |
| Selection      | `#24472e` |
| Black          | `#090e0b` |
| Red            | `#ff6b6b` |
| Green          | `#50fa7b` |
| Yellow         | `#e8f58a` |
| Blue           | `#8be9fd` |
| Magenta        | `#bd93f9` |
| Cyan           | `#75e6b3` |
| White          | `#d5e8d9` |
| Bright black   | `#52705a` |
| Bright red     | `#ff8585` |
| Bright green   | `#8affaa` |
| Bright yellow  | `#f3ffad` |
| Bright blue    | `#a4e9ff` |
| Bright magenta | `#d6acff` |
| Bright cyan    | `#a4ffd0` |
| Bright white   | `#ffffff` |

The `ANSI` object in the same file maps semantic output colours to ANSI sequences. For example, `colour("error:", "red")` produces a red terminal-compatible string, while `colour("help", "cyan")` produces cyan text. CSS cannot recolour text already rendered by xterm; output colour belongs in the xterm theme and ANSI strings.

## Adding keyboard shortcuts

Keyboard input is handled by the `handleData(data)` function registered with `terminal.onData(handleData)` in [`Terminal.jsx`](../../server/client/src/pages/Terminal.jsx). xterm supplies control characters for shortcuts and escape sequences for cursor/history navigation.

Add a control branch before the printable-character branch, and return after handling it:

Do not treat escape sequences as printable text. Preserve the existing branches for Enter (`\r`), Ctrl+C (`\u0003`), Ctrl+L (`\u000c`), Ctrl+Backspace (`\u0017`), Backspace (`\u007f`), and the four arrow sequences. xterm owns the focused input surface, so handling the control data and returning prevents it from becoming normal input. Idle Ctrl+C pops one virtual context; Ctrl+C during a request aborts that request and restores the current prompt.

## Input editing and history

The `input` object inside the mount effect contains:

- `buffer`: the current command text.
- `cursor`: a character offset within `buffer`.
- `history`: successfully submitted, non-empty commands.
- `historyIndex`: the current history navigation position.
- `draft`: text typed before entering history navigation.

`redrawInput()` clears the current visual line, writes the coloured prompt and buffer, and moves the xterm cursor back from the end to `input.cursor`. Left and right arrows update only the cursor when movement is possible. Backspace removes the character immediately before the cursor. Ctrl+Backspace (`\u0017`) removes the word immediately before the cursor and preceding whitespace while preserving text after the cursor.

Enter submits the trimmed command. Empty commands are not added to history. Consecutive duplicate commands are suppressed. Privileged commands also have a single-flight queue guard so duplicate submissions cannot execute sequentially. Pressing Up from a fresh line saves the draft; pressing Down past the newest history entry restores it. The current buffer, draft, recent history, and context stack are restored from session storage after navigation or reload; responses are not replayed.

## Resizing and lifecycle

The sizing boundary is intentional:

- `terminal-shell-content` is a flex column with a viewport-relative height and `min-height: 0`.
- `terminal-panel` is a shrinkable flex child with `min-height: 0`, `min-width: 0`, and hidden overflow.
- `terminal-container` is also shrinkable in both axes; xterm's viewport owns internal scrolling.
- The terminal page does not set an intrinsic minimum height that can exceed its parent.

These constraints prevent the xterm element's intrinsic content size from increasing the page height. The `ResizeObserver` watches the bounded container, caches its last width/height, and skips duplicate fits. It must not be changed to observe an element whose size is changed by the fit operation itself. Always disconnect the observer, dispose the xterm data subscription, and dispose the terminal in the effect cleanup.

## Extension guidelines

- Keep local commands small, predictable, and explicitly registered
- Use `colour()` and the existing semantic ANSI names for output.
- Update `help` whenever a command is added or removed.
- Never execute arbitrary shell commands or add a backend handler that reads private files, exposes secrets, or runs processes.
- Preserve the explicit input buffer and cursor model.
- Dispose xterm subscriptions, observers, and instances during cleanup.
- Keep terminal layout changes in `terminal.css`; avoid unrelated global CSS changes.
- Validate with `npm run build`, `npm run lint`, and `npm test`.