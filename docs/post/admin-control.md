# `POST /api/admin/control`

**Last updated at:** _15/10/2026_

## TOC

| Section                                 | Description                                               | Subsections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Overview](#overview)                   | Summary of the endpoint's purpose and requirements.       | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [Supported actions](#supported-actions) | List of available control actions and their requirements. | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [Error responses](#error-responses)     | Possible error responses and their meanings.              | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [Authentication](#authentication)       | Details on required authentication and CSRF protection.   | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [Request Payload](#request-payload)     | Structure of the JSON request body.                       | [headers](#headers), [body](#body), [example](#example), [refresh](#refresh), [refresh-status](#refresh-status), [refresh-logs](#refresh-logs), [start](#start), [stop](#stop), [restart](#restart), [redeploy](#redeploy), [delete-log](#delete-log), [delete-lines](#delete-lines), [delete-line](#delete-line), [delete-last](#delete-last), [rotate-logs](#rotate-logs), [restore-log](#restore-log), [delete-log-archive](#delete-log-archive), [reset-telemetry](#reset-telemetry), [delete-event](#delete-event), [delete-error](#delete-error), [delete-event-group](#delete-event-group), [delete-error-group](#delete-error-group), [delete-events](#delete-events), [delete-errors](#delete-errors) |
| [Implementation](#implementation)       | Explanation of how each action is executed.               | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [Testing](#testing)                     | Instructions for testing the endpoint.                    | [requirements](#requirements), [browser-devtools](#1-browser-devtools), [bash-wsl-curl](#2-bash--wsl-curl), [powershell](#3-powershell), [notes](#notes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Overview

The `POST /api/admin/control` endpoint provides 23 authenticated administrative controls for managing Slackzilla's runtime services, deployments, logs, telemetry, log archives, server history records, and administrator sessions.

All requests must be sent as JSON and include a valid administrative session (`slackzilla_admin_session` cookie) and `csrf` token or `X-CSRF-Token` header.

Actions that modify services or stored data additionally require explicit confirmation through the `confirmed` property.

The `logout` control ends the current administrator session and clears the `slackzilla_admin_session` cookie. It is authenticated, CSRF-protected, and requires `confirmed: true` when called through this endpoint or the terminal control adapter.

## Supported actions

| Action               | Additional fields                                        | Confirmation | Purpose                                                                                       | Link                                      |
| -------------------- | -------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `refresh`            | None                                                     | No           | Refreshes runtime status and broadcasts updated admin status and summary data.                | [refresh](#refresh)                       |
| `refresh-status`     | None                                                     | No           | Refreshes and returns the current runtime status.                                             | [refresh-status](#refresh-status)         |
| `refresh-logs`       | None                                                     | No           | Refreshes the current log snapshot and returns its size.                                      | [refresh-logs](#refresh-logs)             |
| `logout`             | None                                                     | Yes          | Invalidates the current administrator session and clears its session cookie.                  | [logout](#logout)                         |
| `start`              | None                                                     | Yes          | Starts the configured bot systemd service.                                                    | [start](#start)                           |
| `stop`               | None                                                     | Yes          | Stops the configured bot systemd service.                                                     | [stop](#stop)                             |
| `restart`            | None                                                     | Yes          | Restarts the configured bot systemd service.                                                  | [restart](#restart)                       |
| `redeploy`           | None                                                     | Yes          | Runs the configured deployment script and updates deployment state.                           | [redeploy](#redeploy)                     |
| `delete-log`         | None                                                     | Yes          | Clears the current log file.                                                                  | [delete-log](#delete-log)                 |
| `delete-lines`       | `start` [`number`], `end` [`number`]                     | Yes          | Deletes a range of log lines. Both values must be positive integers.                          | [delete-lines](#delete-lines)             |
| `delete-line`        | `line` [`number`]                                        | Yes          | Deletes one log line. The line number must be a positive integer.                             | [delete-line](#delete-line)               |
| `delete-last`        | `count` [`number`]                                       | Yes          | Deletes the specified number of lines from the end of the log.                                | [delete-last](#delete-last)               |
| `rotate-logs`        | None                                                     | Yes          | Rotates the current log into an archive.                                                      | [rotate-logs](#rotate-logs)               |
| `restore-log`        | `archive` [`string`], optional `saveCurrent` [`boolean`] | Yes          | Restores a log archive. Set `saveCurrent` to `true` to save the current log before restoring. | [restore-log](#restore-log)               |
| `delete-log-archive` | `archive` [`string`]                                     | Yes          | Deletes a stored log archive.                                                                 | [delete-log-archive](#delete-log-archive) |
| `reset-telemetry`    | None                                                     | Yes          | Clears runtime telemetry history and broadcasts the updated status.                           | [reset-telemetry](#reset-telemetry)       |
| `delete-event`       | `id` [`string` (UUID)]                                   | Yes          | Deletes one server event occurrence by UUID; it cannot clear event history.                   | [delete-event](#delete-event)             |
| `delete-error`       | `id` [`string` (UUID)]                                   | Yes          | Deletes one server error occurrence by UUID; other occurrences remain.                        | [delete-error](#delete-error)             |
| `delete-event-group` | `groupId` [`string`]                                     | Yes          | Deletes every occurrence in one grouped server event signature.                               | [delete-event-group](#delete-event-group) |
| `delete-error-group` | `groupId` [`string`]                                     | Yes          | Deletes every occurrence in one grouped server error fingerprint.                             | [delete-error-group](#delete-error-group) |
| `delete-events`      | `ids` [`string[]` (UUIDs)]                               | Yes          | Deletes selected or filtered server event occurrences in one operation.                       | [delete-events](#delete-events)           |
| `delete-errors`      | `ids` [`string[]` (UUIDs)]                               | Yes          | Deletes selected or matching server error occurrences in one operation.                       | [delete-errors](#delete-errors)           |

Some actions include additional data. For example, `refresh-logs` returns the refreshed log size, `rotate-logs` returns the created archive, and `redeploy` returns the deployment state.

Invalid or unknown actions return an error response. Dangerous actions without confirmation return `409 CONFIRMATION_REQUIRED`. Invalid log ranges return `400 INVALID_LOG_RANGE`.

All deletion controls require the literal boolean `confirmed: true`. Missing, false, or non-boolean confirmation returns `409 CONFIRMATION_REQUIRED`.

Control action failures are recorded as server errors and return `500 CONTROL_ACTION_FAILED`.

## Error responses

For the `POST /api/admin/control` endpoint, the following error responses may be returned:

| Status | Error                    | Condition                                                                         | How to fix                                                                        |
| ------ | ------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `400`  | `BAD_REQUEST`            | Request body cannot be parsed.                                                    | Send valid JSON with the required fields                                          |
| `400`  | `INVALID_LOG_RANGE`      | Log line or count values are not positive integers.                               | Provide valid positive integers for the relevant fields.                          |
| `400`  | `UNKNOWN_CONTROL_ACTION` | Unrecognised control action.                                                      | Use a supported action listed above                                               |
| `403`  | `CSRF_INVALID`           | csrf token is missing or invalid.                                                 | Provide a valid token via `X-CSRF-Token` or the `csrf` body property.             |
| `409`  | `CONFIRMATION_REQUIRED`  | A protected action was requested without `"confirmed": true`.                     | Include `"confirmed": true` in the request body.                                  |
| `500`  | `CONTROL_ACTION_FAILED`  | Control action failed. The error is recorded, and the admin summary is broadcast. | Check server logs for the underlying error and resolve the cause before retrying. |

**Note:** All errors are returned through the standard error response handler. The `500` response is accompanied by an updated admin summary broadcast.

An example of a `500 CONTROL_ACTION_FAILED` response is:

```json
{
    "ok": false,
    "code": "CONTROL_ACTION_FAILED",
    "error": "The 'restart' control action failed due to an internal server error:\n spawn systemctl ENOENT"
}
```

and a stack trace is recorded in the server logs. To see this error check `/admin/errors` or `/api/admin/errors` for the recorded error.

```bash
Error: spawn systemctl ENOENT
    at ChildProcess._handle.onexit (node:internal/child_process:287:19)
    at onErrorNT (node:internal/child_process:508:16)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

\*this error will happen to all windows hosts since `systemctl` is not available.

## Authentication

Authentication is required for all requests to this endpoint.

Requests must include:

- A valid `slackzilla_admin_session` cookie to establish the authenticated administrative session.
- A valid CSRF token supplied through either the `X-CSRF-Token` request header or the `csrf` property in the JSON request body.

The CSRF token must match the token associated with the authenticated session. If both the header and body property are provided, the body property takes precedence.

Requests that fail CSRF validation return `403 CSRF_INVALID`.

Actions that require confirmation must additionally include `"confirmed": true` in the request body. Requests for protected actions without confirmation return `409 CONFIRMATION_REQUIRED`.

## Request Payload

The endpoint accepts a JSON request body. Every request must include a valid `action` and CSRF token. Protected actions must also include `"confirmed": true`.

### Headers

| Header         | Required    | Description                                                           |
| -------------- | ----------- | --------------------------------------------------------------------- |
| `Content-Type` | Yes         | Must be `application/json`.                                           |
| `Cookie`       | Yes         | Must contain a valid `slackzilla_admin_session` cookie.               |
| `X-CSRF-Token` | Conditional | CSRF token. Required when `csrf` is not supplied in the request body. |

### Body

| Field         | Type               | Required                                   | Description                                                                     |
| ------------- | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `action`      | `string`           | Yes                                        | Control action to execute. Must be a supported action.                          |
| `csrf`        | `string`           | Conditional                                | CSRF token. Required when `X-CSRF-Token` is not provided.                       |
| `confirmed`   | `boolean`          | Conditional                                | Must be `true` for protected actions.                                           |
| `start`       | `integer`          | `delete-lines`                             | Starting log line. Must be a positive integer.                                  |
| `end`         | `integer`          | `delete-lines`                             | Ending log line. Must be a positive integer.                                    |
| `line`        | `integer`          | `delete-line`                              | Log line to delete. Must be a positive integer.                                 |
| `count`       | `integer`          | `delete-last`                              | Number of lines to delete. Must be a positive integer.                          |
| `archive`     | `string`           | `restore-log`, `delete-log-archive`        | Archive identifier.                                                             |
| `saveCurrent` | `boolean`          | Optional for `restore-log`                 | Set to `true` to save the current log before restoring.                         |
| `id`          | `string` (UUID)    | `delete-event`, `delete-error`             | UUID of the server event or error occurrence to delete.                         |
| `groupId`     | `string`           | `delete-event-group`, `delete-error-group` | Stable group fingerprint. Must use the appropriate `event-` or `error-` prefix. |
| `ids`         | `string[]` (UUIDs) | `delete-events`, `delete-errors`           | Non-empty array of occurrence UUIDs to delete.                                  |
| `archive`     | `string`           | `delete-log-archive`                       | Identifier of the stored log archive to delete.                                 |

### Example

A basic request:

```json
{
    "action": "refresh"
}
```

A protected action:

```json
{
    "action": "restart",
    "confirmed": true
}
```

An action with additional fields:

```json
{
    "action": "delete-lines",
    "start": 2,
    "end": 5,
    "confirmed": true
}
```

A bulk deletion of server event/errors occurrences:

```json
{
    "action": "delete-events", // or "delete-errors"
    "ids": ["event-occurrence-uuid-1", "event-occurrence-uuid-2"],
    "confirmed": true,
    "csrf": "session-csrf-token"
}
```

The CSRF token may be supplied either through the `X-CSRF-Token` header or the `csrf` body property. If both are provided, the body property takes precedence. The `action` value must be one of the actions listed in [Supported Actions](#supported-actions). An example request might be

```bash
POST /api/admin/control HTTP/1.1
Host: rylvion.hackclub.app # (or your server host)
Content-Type: application/json
Cookie: slackzilla_admin_session=session-id.signature
X-CSRF-Token: your-csrf-token

{
    "action": "name-of-action",
    "confirmed": true # required for dangerous actions
    "csrf": "your-csrf-token" # not required if X-CSRF-Token header is provided
}
```

### `refresh`

Recalculates the current runtime status and admin dashboard summary, then broadcasts the updated information to connected clients. Returns the rendered status summary, including the current status data. The broadcast status snapshot excludes `telemetryHistory`.

### `refresh-status`

Refreshes the current runtime status and broadcasts the updated status and admin summary to connected clients. Returns the rendered status summary. Unlike `refresh`, this action is intended specifically for refreshing status rather than explicitly refreshing the broader dashboard data.

### `refresh-logs`

Reloads the current log snapshot and broadcasts the updated logs to connected clients. Log clients receive the complete snapshot, while admin clients receive the last 50 lines. The admin summary is also updated. Returns the total log file size in bytes.

### `logout`

Invalidates the authenticated administrator session server-side and clears the `slackzilla_admin_session` cookie. The request still requires the existing session and valid CSRF token. When called from the terminal, the terminal first performs operation-bound master-password re-authentication, waits for the terminal request limiter cooldown, then sends the confirmed control request. A successful response is `{ "action": "logout", "authenticated": false }`.

The terminal refreshes `/api/session` after success so its identity and prompt immediately change from `hecker` to `noob`. A later `sudo` command enters the normal login flow without requiring a page reload.

### `start`

Starts the configured bot systemd service. After the command completes successfully, the endpoint refreshes and broadcasts the runtime status. Returns the executed action.

### `stop`

Stops the configured bot systemd service. After the command completes successfully, the endpoint refreshes and broadcasts the runtime status. Returns the executed action.

### `restart`

Restarts the configured bot systemd service. After the command completes successfully, the endpoint refreshes and broadcasts the runtime status. Returns the executed action.

### `redeploy`

Runs the configured deployment script and captures its standard output and standard error in the application log. Saves the resulting deployment state, refreshes the runtime status, and broadcasts deployment and admin summary updates. Returns the saved deployment state. A deployment is considered successful when the script exits with code `0`.

```json
{
    "action": "redeploy",
    "confirmed": true
}
```

### `delete-log`

Clears the contents of the current log file without removing the file itself. The resulting file remains present with a size of 0 bytes. The endpoint refreshes and broadcasts the updated log information, then returns the executed action and a confirmation message.

```json
{
    "action": "delete-log",
    "confirmed": true
}
```

### `delete-lines`

Deletes an inclusive range of lines from the current log, starting at `start` and ending at `end`. Both values must be positive integers, and `start` must not exceed `end`. The endpoint refreshes and broadcasts the updated log information, then returns the executed action and updated log file size.

```json
{
    "action": "delete-lines",
    "start": 10,
    "end": 20, // it will delete line 20 as well since the range is inclusive
    "confirmed": true
}
```

### `delete-line`

Deletes one specified line from the current log. The `line` value must be a positive integer. The endpoint removes the line, refreshes and broadcasts the updated log information, and returns the executed action and updated log file size.

```json
{
    "action": "delete-line",
    "line": 15, // delete line 15
    "confirmed": true
}
```

### `delete-last`

Removes a specified number of lines from the end of the current log. If `count` is omitted or falsy, it defaults to 100 lines. If the requested count exceeds the number of available lines, the entire log is cleared. The endpoint refreshes and broadcasts the updated log information, then returns the executed action and updated log file size.

```json
{
    "action": "delete-last",
    "count": 50, // delete the last 50 lines
    "confirmed": true
}
```

### `rotate-logs`

Archives the current log and rotates it using the log storage system. The endpoint refreshes and broadcasts the updated log information, then returns details of the newly created archive.

### `restore-log`

Restores the current log from the specified archive. If `saveCurrent` is `true`, the existing log is saved before the restoration takes place. The endpoint then refreshes and broadcasts the updated log information and returns the restoration result.

### `delete-log-archive`

Permanently deletes the specified stored log archive. The endpoint refreshes and broadcasts the updated log information, then returns the archive deletion result.

### `reset-telemetry`

Clears the runtime telemetry history, refreshes the runtime status, and broadcasts the updated status to connected clients. Returns the resulting action status.

### `delete-event`

Deletes one server event occurrence identified by its UUID. Other occurrences, including those belonging to the same event group, remain untouched. The deletion is persisted to `metrics.json`, and subsequent grouped event responses reflect the updated occurrence count and group data.

### `delete-error`

Deletes one server error occurrence identified by its UUID. Other error occurrences, including those sharing the same error fingerprint, remain untouched. The deletion is persisted to `server-errors.json`, and subsequent grouped error responses reflect the updated occurrence count and timestamps.

### `delete-event-group`

Deletes every occurrence belonging to the specified server event group fingerprint. The `groupId` must identify the relevant event group. The updated event history is persisted to `metrics.json`, and the response reports the number of occurrences deleted. Unrelated event groups remain unchanged.

### `delete-error-group`

Deletes every occurrence belonging to the specified server error fingerprint. The `groupId` must identify the relevant error group. The updated error history is persisted to `server-errors.json`, and the response reports the number of occurrences deleted. Unrelated error groups remain unchanged.

### `delete-events`

Deletes the server event occurrences identified by the supplied, non-empty `ids` array. Each identifier must be a valid UUID. The filtered event history is persisted to `metrics.json`, and the response reports the number of records deleted. Records not selected for deletion remain available.

### `delete-errors`

Deletes the server error occurrences identified by the supplied, non-empty `ids` array. Each identifier must be a valid UUID. The filtered error history is persisted to `server-errors.json`, and the response reports the number of records deleted. Records not selected for deletion remain available.

## Implementation

notes: `context` is found on `server.js` and `context.store` is `server/database/store.js`

| Action                  | Dependent function                       | Description                                                                          | What function/action is used to perform this action                                                                                            | Originating file           |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Authentication          | `context.auth.requireSession()`          | Verifies that the request has an authenticated admin session.                        | Called before processing any control action.                                                                                                   | `server/lib/auth.js`       |
| Session logout          | `context.auth.logout()`                  | Invalidates the current session and clears the administrator cookie.                 | `logout`                                                                                                                                       | `server/lib/auth.js`       |
| CSRF validation         | `context.auth.verifyCsrf()`              | Validates the CSRF token before processing the action.                               | Called before processing any control action.                                                                                                   | `server/lib/auth.js`       |
| Request parsing         | `context.parseBody()`                    | Parses the incoming JSON request body.                                               | Called before processing any control action.                                                                                                   | `server/lib/http.js`       |
| Confirmation validation | `dangerousActions.includes()`            | Checks whether an action requires explicit confirmation before execution.            | Checks the `dangerousActions` array against the requested action.                                                                              | `handleControlApi()`       |
| Log deletion            | `context.store.deleteLogFile()`          | Clears the contents of the current log file.                                         | `delete-log`                                                                                                                                   | `server/database/store.js` |
| Log line deletion       | `context.store.deleteLogLines()`         | Deletes a specified range of log lines or a single line.                             | `delete-lines`, `delete-line`                                                                                                                  | `server/database/store.js` |
| Last log deletion       | `context.store.deleteLastLogLines()`     | Removes the specified number of lines from the end of the log.                       | `delete-last`                                                                                                                                  | `server/database/store.js` |
| Log rotation            | `context.store.rotateLog()`              | Archives the current log and rotates it.                                             | `rotate-logs`                                                                                                                                  | `server/database/store.js` |
| Log restoration         | `context.store.restoreLogArchive()`      | Restores a selected log archive, optionally saving the current log.                  | `restore-log`                                                                                                                                  | `server/database/store.js` |
| Archive deletion        | `context.store.deleteLogArchive()`       | Deletes a specified log archive.                                                     | `delete-log-archive`                                                                                                                           | `server/database/store.js` |
| Telemetry reset         | `context.resetTelemetry()`               | Clears collected telemetry data.                                                     | `reset-telemetry`                                                                                                                              | `server/server.js`         |
| Event group deletion    | `context.store.deleteServerEventGroup()` | Deletes all occurrences in one server event group and persists `metrics.json`.       | `delete-event-group`                                                                                                                           | `server/database/store.js` |
| Error group deletion    | `context.store.deleteServerErrorGroup()` | Deletes all occurrences in one server error group and persists `server-errors.json`. | `delete-error-group`                                                                                                                           | `server/database/store.js` |
| Event bulk deletion     | `context.store.deleteServerEvents()`     | Deletes the submitted event occurrence IDs and persists `metrics.json`.              | `delete-events`                                                                                                                                | `server/database/store.js` |
| Error bulk deletion     | `context.store.deleteServerErrors()`     | Deletes the submitted error occurrence IDs and persists `server-errors.json`.        | `delete-errors`                                                                                                                                | `server/database/store.js` |
| Deployment              | `context.runDeployScript()`              | Executes the deployment script and captures its output.                              | `redeploy`                                                                                                                                     | `server/lib/system.js`     |
| Deployment state        | `context.saveDeploymentState()`          | Saves the deployment status, timestamp, output and result.                           | `redeploy`, deployment error handler                                                                                                           | `server/database/store.js` |
| Service management      | `context.runSystemctl()`                 | Executes system service commands to start, stop or restart the bot.                  | `start`, `stop`, `restart`                                                                                                                     | `server/lib/system.js`     |
| Status refresh          | `context.refreshAndBroadcastStatus()`    | Refreshes system status and broadcasts the updated information.                      | `start`, `stop`, `restart`, `redeploy`, `reset-telemetry`, `refresh`, `refresh-status`, deployment error handler                               | `server/server.js`         |
| Log refresh             | `context.refreshAndBroadcastLogs()`      | Refreshes log data and broadcasts the updated logs to connected admin clients.       | `delete-log`, `delete-lines`, `delete-last`, `delete-line`, `rotate-logs`, `restore-log`, `refresh-logs`                                       | `server/server.js`         |
| Dashboard summary       | `context.buildAdminSummary()`            | Generates the admin dashboard summary, including the CSRF token.                     | `redeploy`, `refresh`, deployment error handler                                                                                                | `server/server.js`         |
| Event broadcasting      | `context.broadcast()`                    | Sends deployment, status or summary events to connected admin clients.               | `redeploy` (deploy and summary events), `refresh` (summary event), deployment error handler (deploy and summary events)                        | `server/server.js`         |
| Status rendering        | `context.renderStatusSummary()`          | Generates the current status summary for the API response.                           | `refresh`, `refresh-status`                                                                                                                    | `server/server.js`         |
| Error recording         | `context.recordServerError()`            | Records errors that occur during control action execution.                           | `catch` block for failed control actions.                                                                                                      | `server/server.js`         |
| Error response          | `context.sendError()`                    | Returns structured error responses for invalid requests or failed actions.           | Authentication, CSRF validation, confirmation validation, invalid log ranges, unknown actions, control action failures and malformed requests. | `server/lib/http.js`       |
| Success response        | `context.sendOk()`                       | Returns a successful API response containing the action result.                      | All successfully completed control actions.                                                                                                    | `server/lib/http.js`       |

## Testing

Test `POST /api/admin/control` using Browser DevTools, Bash/WSL, or PowerShell.

### Requirements

- An authenticated admin session with a valid `slackzilla_admin_session` cookie.
- A valid CSRF token sent through the `X-CSRF-Token` header.
- A supported `action`. Dangerous actions also require `confirmed: true`.

Replace `action-name` in the examples with a supported action.

### 1. Browser DevTools

Open DevTools (`F12`), select **Console**, and run:

```javascript
const csrf = document.querySelector('meta[name="csrf-token"]')?.content; // or retrieve it from `/api/session` if not present in the DOM

if (!csrf)
    throw new Error("CSRF token unavailable. Check admin authentication.");

const result = await fetch("/api/admin/control", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
    },
    credentials: "same-origin",
    body: JSON.stringify({
        action: "action-name",
        confirmed: true,
    }),
});

console.log(await result.json());
```

The browser automatically sends the session cookie.The CSRF meta tag is populated after the frontend retrieves the authenticated session from `/api/session`.

### 2. Bash / WSL (`curl`)

Requires `curl` and `jq`.

```bash
BASE_URL="http://localhost:9000"
SESSION_COOKIE="YOUR_SESSION_COOKIE"
ACTION="action-name"

CSRF=$(curl -fsS "$BASE_URL/api/session" \
    -H "Cookie: slackzilla_admin_session=$SESSION_COOKIE" \
    | jq -er '.data.csrfToken // empty') || {
    echo "Failed to retrieve CSRF token. Check your session."
    exit 1
}

curl -fsS "$BASE_URL/api/admin/control" \
    -H "Content-Type: application/json" \
    -H "Cookie: slackzilla_admin_session=$SESSION_COOKIE" \
    -H "X-CSRF-Token: $CSRF" \
    -d "{\"action\":\"$ACTION\",\"confirmed\":true}"
```

**WSL networking:** If Slackzilla runs on Windows and `localhost` does not reach it, find the Windows host address from WSL:

```bash
ip route | awk '/default/ {print $3}'
```

Set `BASE_URL` to `http://<WINDOWS_HOST_IP>:9000`, replacing the placeholder with the reported address.

Obtain your session cookie from your authenticated browser session or the embedded terminal's `sudo` authentication flow.

### 3. PowerShell

Replace the session cookie and action, then run:

```powershell
& {
    $BaseUrl = "http://localhost:9000"
    $SessionCookie = "YOUR_SESSION_COOKIE"
    $WebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $Cookie = New-Object System.Net.Cookie
    $Cookie.Name = "slackzilla_admin_session"
    $Cookie.Value = $SessionCookie
    $Cookie.Domain = ([uri]$BaseUrl).Host
    $WebSession.Cookies.Add($Cookie)

    $Session = Invoke-RestMethod -Uri "$BaseUrl/api/session" -WebSession $WebSession
    $Csrf = $Session.data.csrfToken

    if (-not $Csrf) {
        throw "CSRF token unavailable. Check your session."
    }

    $Headers = @{ "X-CSRF-Token" = $Csrf }
    $Body = @{ action = "action-name"; confirmed = $true } | ConvertTo-Json

    $Result = Invoke-RestMethod -Uri "$BaseUrl/api/admin/control" `
        -Method Post -WebSession $WebSession -Headers $Headers `
        -ContentType "application/json" -Body $Body

    $Result | ConvertTo-Json -Depth 10
}
```

### 4. all cases

```bash
POST /api/admin/control HTTP/1.1
Host: localhost:9000
Content-Type: application/json
Cookie: slackzilla_admin_session=YOUR_SESSION
X-CSRF-Token: YOUR_CSRF_TOKEN

{
    "action": "action-name",
    "confirmed": true
}
```

or type in the embedded terminal:

```bash
api post /api/admin/control --headers "X-CSRF-Token: YOUR_CSRF_TOKEN" --body '{"action":"action-name","confirmed":true}'
```

OR 

```bash
sudo execute YOUR_ACTION_NAME
Master Password re-prompt: *******
```

For terminal logout, use `sudo logout` or `sudo execute logout`. Both use the same authenticated, CSRF-protected control path and require master-password re-authentication and confirmation in the terminal.
### Notes

- `confirmed` can be omitted for actions that do not require confirmation.
- The `X-CSRF-Token` header is mandatory. A separate `csrf` body field is unnecessary when the header is provided.
- Successful requests return `ok: true`; failures return an error response.
- Control-action failures retain the underlying diagnostic message in the error response and are also recorded server-side.
- **Windows compatibility:** Actions such as `start`, `stop`, and `restart` depend on Linux's `systemctl` utility. Running them directly on Windows may return `CONTROL_ACTION_FAILED` with `spawn systemctl ENOENT`.
- **Security:** Never share your session cookie or CSRF token (it has 8hrs lifespan). Both are associated with your authenticated session.

### Terminal API diagnostics

The embedded terminal supports `api get` for an explicit allow-list of public same-origin API routes. Administrative API requests, including `api post /api/admin/control`, still require the current administrator session and CSRF token; the terminal retrieves the current token from `/api/session` when needed. It does not permit arbitrary external URLs or use terminal API requests to bypass control confirmation, re-authentication, or rate limits.

Successful terminal login reports only `Session: active` and `CSRF token: available`. Raw session cookies and raw CSRF values are not printed or persisted in terminal output.
