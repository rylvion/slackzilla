# `POST /api/admin/control`

**Last updated at:** _06/10/2026_

## TOC

| Section                                 | Description                                               | Subsections                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Overview](#overview)                   | Summary of the endpoint's purpose and requirements.       | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [Supported actions](#supported-actions) | List of available control actions and their requirements. | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [Error responses](#error-responses)     | Possible error responses and their meanings.              | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [Authentication](#authentication)       | Details on required authentication and CSRF protection.   | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [Request Payload](#request-payload)     | Structure of the JSON request body.                       | [headers](#headers), [body](#body), [example](#example), [refresh](#refresh), [refresh-status](#refresh-status), [refresh-logs](#refresh-logs), [start](#start), [stop](#stop), [restart](#restart), [redeploy](#redeploy), [delete-log](#delete-log), [delete-lines](#delete-lines), [delete-line](#delete-line), [delete-last](#delete-last), [rotate-logs](#rotate-logs), [restore-log](#restore-log), [delete-log-archive](#delete-log-archive), [reset-telemetry](#reset-telemetry) |
| [Implementation](#implementation)       | Explanation of how each action is executed.               | `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [Testing](#testing)                     | Instructions for testing the endpoint.                    | [requirements](#requirements), [browser-devtools](#1-browser-devtools), [bash-wsl-curl](#2-bash--wsl-curl), [powershell](#3-powershell), [notes](#notes)                                                                                                                                                                                                                                                                                                                                                  |

## Overview

The `POST /api/admin/control` endpoint provides 15 authenticated administrative controls for managing Slackzilla's runtime services, deployments, logs, telemetry, and log archives.

All requests must be sent as JSON and include a valid administrative session (`slackzilla_admin_session` cookie) and `csrf` token or `X-CSRF-Token` header.

Actions that modify services or stored data additionally require explicit confirmation through the `confirmed` property.

## Supported actions

| Action               | Additional fields                 | Confirmation | Purpose                                                                                       | Link                                      |
| -------------------- | --------------------------------- | ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `refresh`            | None                              | No           | Refreshes runtime status and broadcasts updated admin status and summary data.                | [refresh](#refresh)                       |
| `refresh-status`     | None                              | No           | Refreshes and returns the current runtime status.                                             | [refresh-status](#refresh-status)         |
| `refresh-logs`       | None                              | No           | Refreshes the current log snapshot and returns its size.                                      | [refresh-logs](#refresh-logs)             |
| `start`              | None                              | Yes          | Starts the configured bot systemd service.                                                    | [start](#start)                           |
| `stop`               | None                              | Yes          | Stops the configured bot systemd service.                                                     | [stop](#stop)                             |
| `restart`            | None                              | Yes          | Restarts the configured bot systemd service.                                                  | [restart](#restart)                       |
| `redeploy`           | None                              | Yes          | Runs the configured deployment script and updates deployment state.                           | [redeploy](#redeploy)                     |
| `delete-log`         | None                              | Yes          | Clears the current log file.                                                                  | [delete-log](#delete-log)                 |
| `delete-lines`       | `start`, `end`                    | Yes          | Deletes a range of log lines. Both values must be positive integers.                          | [delete-lines](#delete-lines)             |
| `delete-line`        | `line`                            | Yes          | Deletes one log line. The line number must be a positive integer.                             | [delete-line](#delete-line)               |
| `delete-last`        | `count`                           | Yes          | Deletes the specified number of lines from the end of the log.                                | [delete-last](#delete-last)               |
| `rotate-logs`        | None                              | Yes          | Rotates the current log into an archive.                                                      | [rotate-logs](#rotate-logs)               |
| `restore-log`        | `archive`, optional `saveCurrent` | Yes          | Restores a log archive. Set `saveCurrent` to `true` to save the current log before restoring. | [restore-log](#restore-log)               |
| `delete-log-archive` | `archive`                         | Yes          | Deletes a stored log archive.                                                                 | [delete-log-archive](#delete-log-archive) |
| `reset-telemetry`    | None                              | Yes          | Clears runtime telemetry history and broadcasts the updated status.                           | [reset-telemetry](#reset-telemetry)       |

Some actions include additional data. For example, `refresh-logs` returns the refreshed log size, `rotate-logs` returns the created archive, and `redeploy` returns the deployment state.

Invalid or unknown actions return an error response. Dangerous actions without confirmation return `409 CONFIRMATION_REQUIRED`. Invalid log ranges return `400 INVALID_LOG_RANGE`.

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

| Field         | Type    | Required                            | Description                                               |
| ------------- | ------- | ----------------------------------- | --------------------------------------------------------- |
| `action`      | String  | Yes                                 | Control action to execute. Must be a supported action.    |
| `csrf`        | String  | Conditional                         | CSRF token. Required when `X-CSRF-Token` is not provided. |
| `confirmed`   | Boolean | Conditional                         | Must be `true` for protected actions.                     |
| `start`       | Integer | `delete-lines`                      | Starting log line. Must be a positive integer.            |
| `end`         | Integer | `delete-lines`                      | Ending log line. Must be a positive integer.              |
| `line`        | Integer | `delete-line`                       | Log line to delete. Must be a positive integer.           |
| `count`       | Integer | `delete-last`                       | Number of lines to delete.                                |
| `archive`     | String  | `restore-log`, `delete-log-archive` | Archive identifier.                                       |
| `saveCurrent` | Boolean | `restore-log`                       | Set to `true` to save the current log before restoring.   |

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


### Refresh

`refresh` refreshes the current runtime status and broadcasts the updated status and admin summary to connected clients. It calls `context.refreshAndBroadcastStatus()` and `context.buildAdminSummary()` before returning the rendered status summary in the response. The returned `status` follows the `/api/status` response structure, while the broadcast status snapshot excludes `telemetryHistory`.

### Refresh Status

`refresh-status` refreshes the current runtime status and broadcasts the updated status and admin summary to connected clients using `context.refreshAndBroadcastStatus()`, then returns the rendered status summary. The returned `status` follows the `/api/status` response structure, while the broadcast status snapshot excludes `telemetryHistory`.

### Refresh Logs

`refresh-logs` refreshes the current log snapshot and broadcasts the updated logs to connected clients using `context.refreshAndBroadcastLogs()`. The complete log snapshot is sent to log clients, the last 50 lines are sent to admin clients, and an updated admin summary is broadcast before the action returns the total log file size in bytes.

### Start

`start` starts the configured bot systemd service using `context.runSystemctl("start", context.runtimeConfig.botServiceName)`, waits for the command to complete successfully, refreshes and broadcasts the runtime status, and returns the executed action.

### Stop

`stop` stops the configured bot systemd service using `context.runSystemctl("stop", context.runtimeConfig.botServiceName)`, waits for the command to complete successfully, refreshes and broadcasts the runtime status, and returns the executed action.

### Restart

`restart` restarts the configured bot systemd service using `context.runSystemctl("restart", context.runtimeConfig.botServiceName)`, waits for the command to complete successfully, refreshes and broadcasts the runtime status, and returns the executed action.

### Redeploy

`redeploy` executes the configured deployment script using `context.runDeployScript()`, captures its standard output and standard error in the application log, saves the resulting deployment state with `context.saveDeploymentState()`, refreshes and broadcasts the runtime status, broadcasts the deployment and admin summary events, and returns the saved deployment state. A deployment is considered successful when the script exits with code `0`.

### Delete Log

`delete-log` clears the contents of the current log file using `context.store.deleteLogFile()`, refreshes and broadcasts the updated log information, and returns the executed action with a confirmation message. The log file itself remains in place with a size of 0 bytes.

### Delete Lines

`delete-lines` removes a specified range of lines from the current log using `context.store.deleteLogLines(body.start, body.end)`, refreshes and broadcasts the updated log information, and returns the executed action with the updated log file size. Both `start` and `end` must be positive integers, and `start` must not exceed `end`.

### Delete Line

`delete-line` removes a single specified line by passing the line number as both the start and end position to `context.store.deleteLogLines()`, then refreshes and broadcasts the updated log information before returning the executed action and updated log file size. The `line` value must be a positive integer.

### Delete Last

`delete-last` removes a specified number of lines from the end of the current log using `context.store.deleteLastLogLines()`, refreshes and broadcasts the updated log information, and returns the executed action with the updated log file size. If `count` is omitted or falsy, it defaults to 100 lines, and if the requested count exceeds the available lines, the log is cleared.

### Rotate Logs

`rotate-logs` rotates the current log into an archive using `context.store.rotateLog()`, refreshes and broadcasts the updated log information, and returns the created archive information.

### Restore Log

`restore-log` restores a selected log archive using `context.store.restoreLogArchive()`, optionally saving the current log first when `saveCurrent` is `true`. The action then refreshes and broadcasts the updated log information before returning the restoration result.

### Delete Log Archive

`delete-log-archive` deletes the specified stored log archive using `context.store.deleteLogArchive()`, refreshes and broadcasts the updated log information, and returns the result of the archive deletion.

### Reset Telemetry

`reset-telemetry` clears the runtime telemetry history using `context.resetTelemetry()`, refreshes and broadcasts the updated runtime status, and returns the resulting action status.

## Implementation

notes: `context` is found on `server.js` and `context.store` is `server/database/store.js`

| Action                  | Dependent function                    | Description                                                                    | What function/action is used to perform this action                                                                                            | Originating file           |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Authentication          | `context.auth.requireSession()`       | Verifies that the request has an authenticated admin session.                  | Called before processing any control action.                                                                                                   | `server/lib/auth.js`       |
| CSRF validation         | `context.auth.verifyCsrf()`           | Validates the CSRF token before processing the action.                         | Called before processing any control action.                                                                                                   | `server/lib/auth.js`       |
| Request parsing         | `context.parseBody()`                 | Parses the incoming JSON request body.                                         | Called before processing any control action.                                                                                                   | `server/lib/http.js`       |
| Confirmation validation | `dangerousActions.includes()`         | Checks whether an action requires explicit confirmation before execution.      | Checks the `dangerousActions` array against the requested action.                                                                              | `handleControlApi()`       |
| Log deletion            | `context.store.deleteLogFile()`       | Clears the contents of the current log file.                                   | `delete-log`                                                                                                                                   | `server/database/store.js` |
| Log line deletion       | `context.store.deleteLogLines()`      | Deletes a specified range of log lines or a single line.                       | `delete-lines`, `delete-line`                                                                                                                  | `server/database/store.js` |
| Last log deletion       | `context.store.deleteLastLogLines()`  | Removes the specified number of lines from the end of the log.                 | `delete-last`                                                                                                                                  | `server/database/store.js` |
| Log rotation            | `context.store.rotateLog()`           | Archives the current log and rotates it.                                       | `rotate-logs`                                                                                                                                  | `server/database/store.js` |
| Log restoration         | `context.store.restoreLogArchive()`   | Restores a selected log archive, optionally saving the current log.            | `restore-log`                                                                                                                                  | `server/database/store.js` |
| Archive deletion        | `context.store.deleteLogArchive()`    | Deletes a specified log archive.                                               | `delete-log-archive`                                                                                                                           | `server/database/store.js` |
| Telemetry reset         | `context.resetTelemetry()`            | Clears collected telemetry data.                                               | `reset-telemetry`                                                                                                                              | `server/server.js`         |
| Deployment              | `context.runDeployScript()`           | Executes the deployment script and captures its output.                        | `redeploy`                                                                                                                                     | `server/lib/system.js`     |
| Deployment state        | `context.saveDeploymentState()`       | Saves the deployment status, timestamp, output and result.                     | `redeploy`, deployment error handler                                                                                                           | `server/database/store.js` |
| Service management      | `context.runSystemctl()`              | Executes system service commands to start, stop or restart the bot.            | `start`, `stop`, `restart`                                                                                                                     | `server/lib/system.js`     |
| Status refresh          | `context.refreshAndBroadcastStatus()` | Refreshes system status and broadcasts the updated information.                | `start`, `stop`, `restart`, `redeploy`, `reset-telemetry`, `refresh`, `refresh-status`, deployment error handler                               | `server/server.js`         |
| Log refresh             | `context.refreshAndBroadcastLogs()`   | Refreshes log data and broadcasts the updated logs to connected admin clients. | `delete-log`, `delete-lines`, `delete-last`, `delete-line`, `rotate-logs`, `restore-log`, `refresh-logs`                                       | `server/server.js`         |
| Dashboard summary       | `context.buildAdminSummary()`         | Generates the admin dashboard summary, including the CSRF token.               | `redeploy`, `refresh`, deployment error handler                                                                                                | `server/server.js`         |
| Event broadcasting      | `context.broadcast()`                 | Sends deployment, status or summary events to connected admin clients.         | `redeploy` (deploy and summary events), `refresh` (summary event), deployment error handler (deploy and summary events)                        | `server/server.js`         |
| Status rendering        | `context.renderStatusSummary()`       | Generates the current status summary for the API response.                     | `refresh`, `refresh-status`                                                                                                                    | `server/server.js`         |
| Error recording         | `context.recordServerError()`         | Records errors that occur during control action execution.                     | `catch` block for failed control actions.                                                                                                      | `server/server.js`         |
| Error response          | `context.sendError()`                 | Returns structured error responses for invalid requests or failed actions.     | Authentication, CSRF validation, confirmation validation, invalid log ranges, unknown actions, control action failures and malformed requests. | `server/lib/http.js`       |
| Success response        | `context.sendOk()`                    | Returns a successful API response containing the action result.                | All successfully completed control actions.                                                                                                    | `server/lib/http.js`       |

## Testing

You can test the endpoint using a simple script or command-line request. The following examples demonstrate how to send requests to `/api/admin/control` using Browser DevTools, Bash/WSL (`curl`), or PowerShell.

### Requirements

- You must be logged in as an admin user to test this endpoint.
- You must have a valid `slackzilla_admin_session` cookie to access `/api/session`.
- The `action` field must contain a valid, supported action.
- A valid CSRF token must be provided in the `X-CSRF-Token` request header.
- The `confirmed` field is required for dangerous actions.

### 1. Browser DevTools

Open the browser's Developer Tools (`F12`), navigate to the Console tab, and execute the following script:

```javascript
const csrfElement = document.querySelector('meta[name="csrf-token"]');
const csrf = csrfElement?.getAttribute("content");

if (!csrf) {
    throw new Error(
        "CSRF token not found in meta tag. Ensure you are logged in and the session has loaded.",
    );
}

const result = await fetch("/api/admin/control", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
    },
    credentials: "same-origin",
    // modify the action field to test different actions
    body: JSON.stringify({
        action: "action-name",
        confirmed: true,
    }),
});

console.log(await result.json());
```

The script retrieves the CSRF token from the `<meta name="csrf-token">` element in the document head and uses it in the subsequent POST request.

The browser automatically includes the `slackzilla_admin_session` cookie when `credentials` is set to `"same-origin"`. The meta tag is populated by the frontend after retrieving the authenticated session from `/api/session`, so ensure the session has loaded before executing the script.

### 2. Bash / WSL (`curl`)

The following example uses `curl` and `jq` to retrieve the CSRF token and send the request.

Replace `YOUR_SESSION_COOKIE` with the value of your authenticated `slackzilla_admin_session` cookie and modify the action as required.

```bash
BASE_URL="http://localhost:9000" # or "http://$(ip route | grep default | awk '{print $3}'):9000" if your onwindows
SESSION_COOKIE="YOUR_SESSION_COOKIE"

CSRF=$(curl -fsS "$BASE_URL/api/session" \
    -H "Cookie: slackzilla_admin_session=$SESSION_COOKIE" \
    | jq -r '.data.csrfToken')

if [ -z "$CSRF" ] || [ "$CSRF" = "null" ]; then
    echo "Failed to retrieve CSRF token. Check your session cookie and admin authentication."
    exit 1
fi

# modify the action field to test different actions
curl -X POST "$BASE_URL/api/admin/control" \
    -H "Content-Type: application/json" \
    -H "Cookie: slackzilla_admin_session=$SESSION_COOKIE" \
    -H "X-CSRF-Token: $CSRF" \
    -d '{
        "action": "action-name",
        "confirmed": true
    }'
```

When running this request from WSL against a server running on Windows, `localhost` refers to the WSL environment rather than the Windows host. In this case, set `BASE_URL` to the Windows host address reported by:

```bash
ip route | grep default | awk '{print $3 ":9000"}'
```

it might be something like `172.XX.XX.XX:9000`. all you have to do is paste that in to the `BASE_URL`

Make sure you change the `action` field to one of the supported actions listed above. The `confirmed` field is required for dangerous actions.

**Requirements:**

- `curl` must be installed.
- `jq` must be installed to extract the CSRF token from the JSON response.
- The session cookie must be valid and belong to an authenticated admin session.

### 3. PowerShell

The following example uses `Invoke-RestMethod` to retrieve the CSRF token and send the POST request.

Replace `YOUR_SESSION_COOKIE` with the value of your authenticated `slackzilla_admin_session` cookie.

```pwsh
& {
    $BaseUrl = "http://localhost:9000"
    $SessionCookie = "YOUR_SESSION_COOKIE"

    $WebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    $Cookie = New-Object System.Net.Cookie
    $Cookie.Name = "slackzilla_admin_session"
    $Cookie.Value = $SessionCookie
    $Cookie.Domain = ([uri]$BaseUrl).Host

    $WebSession.Cookies.Add($Cookie)

    $Session = Invoke-RestMethod `
        -Uri "$BaseUrl/api/session" `
        -Method Get `
        -WebSession $WebSession

    $Csrf = $Session.data.csrfToken

    if (-not $Csrf) {
        throw "CSRF token not found. Check your session cookie and admin authentication."
    }

    $Headers = @{
        "X-CSRF-Token" = $Csrf
        "Content-Type" = "application/json"
    }

    $Body = @{
        action = "action-name"
        confirmed = $true
    } | ConvertTo-Json

    $Result = Invoke-RestMethod `
        -Uri "$BaseUrl/api/admin/control" `
        -Method Post `
        -WebSession $WebSession `
        -Headers $Headers `
        -Body $Body

    $Result | ConvertTo-Json -Depth 10
}
```

**Requirements:**

- PowerShell must be available.
- The session cookie must be valid and belong to an authenticated admin session.

### Notes

- Replace `"action-name"` with one of the supported actions.
- The `confirmed` field is required for dangerous actions and can be omitted for other actions.
- The `X-CSRF-Token` header is required for every request.
- The `csrf` field in the request body is optional if the `X-CSRF-Token` header is provided.
- Do not share session cookies or CSRF tokens, as they are associated with your authenticated session.
- A successful request returns an `ok: true` response.
- Failed requests return an appropriate error response indicating the reason for failure.
- Control actions that depend on Linux utilities such as `systemctl` may fail when Slackzilla is running on Windows. For example, the `stop`, `restart`, and `start` actions require `systemctl` and will return `CONTROL_ACTION_FAILED` with a `spawn systemctl ENOENT` error when tested directly on Windows.
