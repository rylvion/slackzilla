# POST `/api/terminal`

**Last updated:** 30/10/2026

## Overview

`POST /api/terminal` executes registered Slackzilla terminal commands and returns structured JSON responses. It powers the embedded browser terminal and supports command families such as `status`, `logs`, `rag`, `command` and `sudo`.

This is **not a shell**. It cannot execute arbitrary operating-system commands, load arbitrary modules or access arbitrary files. Browser-only commands such as `dir`, `cd` and `storage` are virtual and handled separately by `Terminal.jsx`.

## Request

Requests use JSON with a command name and optional arguments:

```json
{
  "command": "logs",
  "args": ["--tail", "20"]
}
```

The endpoint validates command names and arguments before execution. Commands must be registered in `server/lib/terminal/commands.js`.

## Commands and permissions

Commands are divided into two permission levels:

- **Public:** `help`, `version`, `status`, `uptime`, `logs`, `api`, `docs`, `rag` and `command`.
- **Administrative:** `sudo`, which requires an authenticated administrator session.

The `sudo` command supports inspecting controls, checking status and executing administrative actions. Mutating actions require fresh password verification and explicit confirmation.

## Security and rate limiting

Administrative requests require:

- A valid `slackzilla_admin_session` cookie.
- A valid CSRF token.
- Fresh password re-authentication and confirmation for mutating actions.

The re-authentication token is bound to the specific operation, preventing it from being reused for a different control.

Terminal requests are limited to **20 requests per 60 seconds**, with a 500 ms cooldown. Excess requests receive `429 RATE_LIMITED`.

## Responses and errors

Responses use Slackzilla's standard JSON envelope:

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

Errors return `ok: false`, an error code and a description. Common failures include invalid arguments, unknown commands, missing authentication, failed CSRF validation and rate limiting.

Server-side diagnostics are recorded separately rather than exposing credentials in terminal responses.

## Implementation

The request passes through:

1. `server/server.js` routes the request to `server/api/terminal/index.js`.
2. The handler identifies the session and applies rate limiting.
3. `parser.js` validates the request.
4. `permissions.js` checks command access.
5. `commands.js` executes the registered handler.

Administrative actions are delegated to `server/api/control/index.js`, sharing the same implementation used by the dashboard.

**Related files:** `server/lib/terminal/`, `server/api/terminal/`, `server/api/control/` and `web/src/Terminal.jsx`.