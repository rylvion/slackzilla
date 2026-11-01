# `POST /api/terminal`

**Last updated at:** _30/10/2026_

## Overview

`POST /api/terminal` executes one explicitly registered Slackzilla terminal command and returns its structured result. It is the server boundary used by the embedded browser terminal for backend command families such as `status`, `logs`, `rag`, `command`, and `sudo`.

This is a command dispatcher, not a shell. It does not execute operating-system commands, load arbitrary modules, read arbitrary files, or proxy arbitrary URLs. Browser-only features such as `dir`, `cd`, `storage`, and the terminal's `api get`/`api post` helpers are implemented by `Terminal.jsx`; they are not additional server commands on this endpoint.

## Request payload

The request must use JSON:

```json
{
    "command": "logs",
    "args": ["--tail", "20"]
}
```

| Field     | Type       | Required | Description                                                                                                                                                      |
| --------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command` | `string`   | Yes      | Registered terminal command name. Names are trimmed and normalised to lowercase.                                                                                 |
| `args`    | `string[]` | No       | Ordered command arguments. Omitted or `null` values are treated as an empty array only when the parser receives the request body through the normal client path. |

Validation limits:

- command name: 1–32 characters, beginning with a letter and containing only letters, numbers, and hyphens;
- maximum 8 arguments;
- maximum 2,048 characters per argument;
- no ASCII control characters in arguments;
- the browser's free-form terminal parser limits one typed command line to 4,096 characters; the structured API request separately enforces the command and argument limits above.

The endpoint does not parse a shell command string. Clients should send the already-tokenised `command` and `args` fields. Quoting and JSON argument parsing belong to the browser terminal's input parser.

## Response format

Successful responses use the standard API envelope:

```json
{
    "ok": true,
    "data": {
        "command": "status",
        "data": {
            "botOnline": true,
            "uptimeText": "12m 4s"
        }
    }
}
```

Errors use the standard envelope:

```json
{
    "ok": false,
    "code": "COMMAND_NOT_FOUND",
    "error": "terminal command is not registered"
}
```

Command-specific errors may include additional fields such as `retryAfter`. Server-side diagnostics are recorded in the normal server error/log stores where appropriate; the terminal response remains concise and must not expose credentials.

## Registered commands and permissions

The authoritative registry is [`server/lib/terminal/commands.js`](../../server/lib/terminal/commands.js). Each entry has a description, usage string, permission, and handler.

### Public commands

These commands do not require an administrator session:

| Command   | Purpose                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `help`    | List registered terminal command families.                                                                          |
| `version` | Read the current or historical release; `--help` lists releases and `--verbose` returns full release notes.         |
| `status`  | Return the public status summary.                                                                                   |
| `uptime`  | Return the public uptime.                                                                                           |
| `logs`    | Read bounded, redacted log entries or follow the log stream through the browser terminal.                           |
| `api`     | List or inspect indexed API route metadata.                                                                         |
| `docs`    | List and search Markdown documentation.                                                                             |
| `rag`     | Read RAG status, list filtered sources, or search indexed content.                                                  |
| `command` | List, inspect, or execute registered Slack command adapters. Unsupported commands such as `/sz-ask` remain blocked. |

Examples:

```json
{"command":"version","args":["v0.9.6-beta","--verbose"]}
{"command":"rag","args":["sources","--type","jsx,json","--search","terminal","--limit","20"]}
{"command":"command","args":["list"]}
```

### Administrative commands

`sudo` is registered with administrator permission. The endpoint requires a valid `slackzilla_admin_session` before the handler can run, and the request must pass CSRF validation. Mutating controls also require the operation-bound re-authentication and confirmation flow described below.

Supported administrative forms include:

```text
sudo status
sudo controls
sudo inspect <control-id>
sudo execute refresh
sudo logout
```

`sudo execute <control-id>` is routed through the existing admin-control API. Unknown control IDs are rejected before authentication prompts or confirmation. `sudo logout` and `sudo execute logout` share the same control implementation.

## Authentication and CSRF

Public terminal commands use the caller's normal request identity and do not require login. Administrative terminal commands require:

1. the `slackzilla_admin_session` HttpOnly session cookie;
2. a valid session CSRF token in `X-CSRF-Token` or the request body field used by the existing authentication flow; and
3. for mutating controls, a fresh master-password re-authentication token and `confirmed: true`.

The normal browser login flow is handled by `/admin/login`. After login, `/api/session` exposes safe session metadata and the current CSRF token to the authenticated browser. The terminal uses that state to update its identity and prompt immediately. It never prints the raw session cookie or CSRF token in terminal output or history.

The browser submits the privileged flow as separate requests. The re-authentication request identifies the mutating control and supplies the password; the execution request supplies the resulting operation-bound token and confirmation. The server validates and consumes the token for the exact control, so a token issued for one operation cannot authorise another.

## Rate limiting and duplicate requests

Terminal POST requests use the terminal rate limiter: 20 requests per 60 seconds per authenticated session or client IP, with a 500 ms cooldown between requests. A rejected request returns `429 RATE_LIMITED` and may include `Retry-After` and `retryAfter` details.

The browser also uses a single-flight guard for privileged submissions and redraws interactive prompts instead of appending a new label for every typed character. This prevents duplicate prompts without weakening the server-side rate limit. Server-side authorization remains required for every request.

## Errors

| Status | Code                 | Meaning                                                                                         |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `400`  | `BODY_INVALID`       | Request body is not a JSON object.                                                              |
| `400`  | `COMMAND_REQUIRED`   | No command name was supplied.                                                                   |
| `400`  | `COMMAND_INVALID`    | Command name violates the terminal naming rules.                                                |
| `400`  | `ARGUMENTS_INVALID`  | Arguments are not a bounded string array.                                                       |
| `400`  | `ARGUMENTS_TOO_MANY` | More than eight arguments were supplied.                                                        |
| `400`  | `ARGUMENT_INVALID`   | An argument is too long or contains a control character.                                        |
| `400`  | `COMMAND_NOT_FOUND`  | The command is not registered.                                                                  |
| `400`  | `TERMINAL_FAILED`    | A registered command failed during execution.                                                   |
| `401`  | `AUTH_REQUIRED`      | An administrator command requires a valid session.                                              |
| `403`  | `CSRF_INVALID`       | The session CSRF token is missing or invalid.                                                   |
| `403`  | `COMMAND_FORBIDDEN`  | The command is not permitted for the current session.                                           |
| `403`  | `REAUTH_REQUIRED`    | Fresh master-password verification and confirmation are required.                               |
| `429`  | `RATE_LIMITED`       | The terminal request limit or cooldown was exceeded.                                            |
| `500`  | `CONTROL_FAILED`     | The delegated administrative control failed; the underlying diagnostic is recorded server-side. |

Unknown administrative controls return a clear control-not-found error before re-authentication or confirmation is requested.

## Browser terminal API helpers

The terminal's `api get` and `api post` commands are separate browser functionality. They only accept same-origin `/api/` paths. GET is restricted to the terminal's public route allowlist and administrative routes; POST requests may target internal API routes for normal users, but the destination API still enforces its own authentication, CSRF, confirmation, method, and rate-limit rules. The browser automatically obtains the current CSRF token for an authenticated administrative route when available.

These helpers do not make `/api/terminal` a general proxy and do not permit external URLs. JSON response bodies are formatted for readability, while HTTP status codes and useful error bodies remain visible.

## Implementation

The request path is:

1. `server/server.js` dispatches `/api/terminal` to `server/api/terminal/index.js`.
2. The handler identifies the session and applies the terminal rate limiter.
3. `server/lib/terminal/parser.js` validates the body, command name, and arguments.
4. `server/lib/terminal/permissions.js` checks the registered command permission.
5. `server/lib/terminal/commands.js` executes the registered handler using the shared server context.
6. `context.sendOk()` or `context.sendError()` writes the standard response envelope.

Administrative control execution is delegated to `server/api/control/index.js`, preserving the same admin-control implementation used by the dashboard.