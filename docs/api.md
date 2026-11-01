# Slackzilla API Guide

**Last updated at:** _31/10/2026_

The dashboard API is implemented by plain Node `http` handlers under `server/api/`. It is not an Express application. Each handler receives `{ req, res, url, context }`, checks the method and path, writes a response, and returns `true` when it handled the request.

| Section                                   | Description                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Response Envelope](#response-envelope)   | Standard JSON response format for success and error responses.                                                     |
| [Public Endpoints](#public-endpoints)     | Endpoints available to all clients, including status, telemetry, logs, commands, and the codebase assistant.       |
| [Admin Endpoints](#admin-endpoints)       | Endpoints requiring the `slackzilla_admin_session` cookie, including feedback, control actions, and server events. |
| [Terminal API](#terminal-api)             | Bounded registered terminal commands and their permission model.                                                   |
| [RAG Tools](#rag-tools)                   | Tool interfaces exposed to the repository-aware assistant.                                                         |
| [Adding an Endpoint](#adding-an-endpoint) | Guide for adding new API endpoints, including request handling, response formatting, and error handling.           |
| [API Error Codes](#api-error-codes)       | List of error codes returned by the API, including status codes, error codes, descriptions, and source files.      |

## Response Envelope

Successful JSON responses use:

```json
{
    "ok": true,
    "data": {}
}
```

All API errors use the following response structure

```json
{
    "ok": false,
    "code": "ERROR_CODE",
    "error": "Human-readable explanation"
}
```

with an additional fields depending on the error code.

Use `context.sendOk()` and `context.sendError()` in new handlers. Use `context.parseBody(req)` for JSON or URL-encoded bodies.

## Public Endpoints

| Method | Path                    | Purpose                                                                                                     |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/status`           | Current bot, host, deployment, and runtime summary without telemetry history.                               |
| `GET`  | `/api/status/stream`    | SSE status updates without telemetry history.                                                               |
| `GET`  | `/api/telemetry`        | Current runtime telemetry and the last 120 samples.                                                         |
| `GET`  | `/api/telemetry/stream` | SSE telemetry snapshots, including the last 120 samples.                                                    |
| `GET`  | `/api/metrics`          | Command totals, unique users/channels, and recent command activity.                                         |
| `GET`  | `/api/logs`             | Bounded log snapshot as JSON.                                                                               |
| `GET`  | `/api/logs/stream`      | SSE log snapshot and new log lines.                                                                         |
| `GET`  | `/api/logs/download`    | Bounded raw log snapshot as plain text.                                                                     |
| `GET`  | `/api/commands`         | Stable IDs and metadata for all commands.                                                                   |
| `GET`  | `/api/commands/:id`     | Help and usage metadata for one command.                                                                    |
| `POST` | `/api/commands/:id`     | Execute an existing command and capture its response.                                                       |
| `GET`  | `/api/ask`              | Describes the assistant request format.                                                                     |
| `POST` | `/api/ask`              | Retrieves repository context and streams activity, optional tool calls, answer tokens, and completion data. |
| `GET`  | `/api/routes`           | Returns indexed repository HTTP routes.                                                                     |
| `GET`  | `/api/release`          | Returns the current or requested release version, changes, and source file references.                      |
| `GET`  | `/api/session`          | Current authentication state, safe session metadata, and session CSRF token when authenticated.             |
| `POST` | `/api/terminal`         | Executes one registered terminal command; permission and authentication depend on the command.              |

### Special Endpoints

These endpoints are separate from the `/api/` modules. The webhook verifies its signature before processing a deployment request. The admin login creates the signed administrator session used by protected endpoints.

| Method | Path           | Purpose                                                                                          |
| ------ | -------------- | ------------------------------------------------------------------------------------------------ |
| `POST` | `/webhook`     | Receives authenticated deployment notifications and triggers the configured deployment workflow. |
| `POST` | `/admin/login` | Authenticates an admin user and returns a session cookie.                                        |

## Terminal API

`POST /api/terminal` accepts only registered terminal commands. It is rate limited and validates the command name and argument array before dispatching:

```json
{
    "command": "logs",
    "args": ["--tail", "20"]
}
```

Limits are currently 4,096 characters for the logical input, 32 characters for the command name, 8 arguments per request, and 2,048 characters per argument. Arguments must be strings without control characters. Successful responses use the normal envelope:

```json
{
    "ok": true,
    "data": {
        "command": "logs",
        "data": {}
    }
}
```

Public terminal commands include `help`, `version`, `status`, `uptime`, `logs`, `api`, `docs`, `rag`, and `command`. Administrative `sudo` operations require the current administrator session and CSRF validation. Mutating controls additionally use operation-bound master-password re-authentication and explicit confirmation. An internal POST submitted through the terminal does not bypass the destination API's own authentication, CSRF, confirmation, or rate-limit checks.

The browser terminal's `api get` and `api post` commands are same-origin helpers layered over existing `/api/` routes. GET requests are allow-listed; POST requests may reach internal routes for normal users, but the destination handler remains authoritative. External URLs and arbitrary shell commands are not supported.

## RAG Tools

The `/api/ask` assistant and `npm run rag:use-tool` expose these registered tools:

| Tool                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `getStatus`          | Read current status and deployment information.                                                     |
| `runApiCommand`      | Call an internal `/api/` route with GET or POST; external URLs and credential headers are rejected. |
| `runTerminalCommand` | Run a registered public terminal command; admin commands and shell execution are unavailable.       |
| `getCommands`        | List, filter, or inspect Slack command metadata.                                                    |
| `getReleaseInfo`     | Read current or historical release information.                                                     |
| `runCommand`         | Execute a registered Slack command, except blocked recursive AI commands.                           |
| `getLogs`            | Read a bounded recent log view.                                                                     |
| `getErrors`          | Read bounded structured server errors; stacks are omitted unless requested by the tool interface.   |
| `getRoutes`          | List indexed repository HTTP routes.                                                                |

Tool output is sanitized and bounded. `runApiCommand` accepts only internal `/api/` paths and rejects headers containing credentials, cookies, CSRF values, passwords, secrets, tokens, or API keys. Tool execution does not grant administrator privileges; the target endpoint still enforces its normal controls.

## Admin Endpoints

Admin endpoints require the `slackzilla_admin_session` cookie. State-changing requests additionally require the session CSRF token in `X-CSRF-Token` or the `csrf` body property.

| Method | Path                              | Purpose                                                                                                                         |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/summary`              | Admin status, feedback preview, deployment configuration, and logs.                                                             |
| `GET`  | `/api/admin/summary/stream`       | Streams admin summary updates over SSE.                                                                                         |
| `GET`  | `/api/admin/feedback`             | Search/filter feedback with `q` and `status`.                                                                                   |
| `GET`  | `/api/admin/feedback/:id`         | Read one feedback item.                                                                                                         |
| `GET`  | `/api/admin/feedback/:id/replies` | Read replies to a feedback item.                                                                                                |
| `POST` | `/api/admin/feedback/:id`         | Mark read/unread, respond, or delete. Deletion requires `confirmed: true`.                                                      |
| `POST` | `/api/admin/control`              | Authenticated administrative control actions for services, deployment, logs, telemetry, log archives, and event/error deletion. |
| `GET`  | `/api/admin/errors`               | Retrieves grouped server errors and their individual occurrence metadata.                                                       |
| `GET`  | `/api/admin/errors/stream`        | Streams server error updates over SSE.                                                                                          |
| `GET`  | `/api/admin/events`               | Retrieves grouped server events and their individual occurrence metadata.                                                       |
| `GET`  | `/api/admin/log-archives`         | Lists available log archives.                                                                                                   |

Example state-changing request:

```json
{
    "action": "read",
    "csrf": "session-csrf-token"
}
```

## Adding an Endpoint

See [The API Extension Guide](api-extension-guide.md) for details on adding new endpoints.

## API Error Codes

| Status | Error Code                 | Description                                                                                                                                                                          | API Endpoint                                                                                             |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `400`  | `BAD_REQUEST`              | The request could not be processed. This error is returned when an exception occurs while handling a feedback or control request.                                                    | `/api/feedback`, `/api/admin/control`                                                                    |
| `400`  | `INVALID_FEEDBACK_ACTION`  | The requested feedback action is not recognised or is not supported by the feedback endpoint.                                                                                        | `/api/feedback`                                                                                          |
| `400`  | `INVALID_LOG_RANGE`        | The requested log range is invalid. The supplied range must meet the requirements of the log retrieval operation.                                                                    | `/api/admin/control`                                                                                     |
| `400`  | `RESPONSE_REQUIRED`        | A response is required to complete the feedback action. The request cannot be processed without a response.                                                                          | `/api/feedback`                                                                                          |
| `400`  | `RESPONSE_TOO_LONG`        | The submitted response exceeds the maximum permitted length of 4,000 characters. The response must be shortened before it can be submitted.                                          | `/api/feedback`                                                                                          |
| `400`  | `UNKNOWN_CONTROL_ACTION`   | The requested control action is not recognised. The action must match one of the supported operations handled by the control endpoint.                                               | `/api/admin/control`                                                                                     |
| `403`  | `CSRF_INVALID`             | The request failed CSRF validation because the token is missing or invalid. The request is rejected to protect the admin endpoint against cross-site request forgery.                | `/api/feedback`, `/api/admin/control`                                                                    |
| `403`  | `COMMAND_NOT_AVAILABLE`    | The requested command is not available for execution. The command may be disabled, restricted, or otherwise unavailable in the current context.                                      | `/api/commands`                                                                                          |
| `404`  | `COMMAND_NOT_FOUND`        | The requested command could not be found. The command name or identifier may be invalid, or the command may not exist in the available command list.                                 | `/api/commands`                                                                                          |
| `404`  | `FEEDBACK_NOT_FOUND`       | The requested feedback entry could not be found. The supplied feedback identifier does not correspond to an existing entry.                                                          | `/api/feedback`                                                                                          |
| `404`  | `RELEASE_NOT_FOUND`        | The requested release could not be found. The supplied release identifier does not match an available release.                                                                       | `/api/release`                                                                                           |
| `405`  | `METHOD_NOT_ALLOWED`       | The HTTP method used in the request is not supported by the endpoint. The request must use a method accepted by the relevant route.                                                  | `/api/ask`, `/api/commands`, `/api/feedback`, `/api/metrics`, `/api/routes`, `/api/release`, `/api/logs` |
| `409`  | `CONFIRMATION_REQUIRED`    | The requested action requires explicit confirmation before it can proceed. This prevents potentially destructive operations from being executed without the required confirmation.   | `/api/feedback`, `/api/admin/control`                                                                    |
| `409`  | `FEEDBACK_DM_MISSING_USER` | The feedback response was saved successfully, but the system could not send a Slack direct message because no associated Slack user ID was available.                                | `/api/feedback`                                                                                          |
| `429`  | `RATE_LIMITED`             | The request was rejected because the client has exceeded the allowed rate limit. The client must wait before making additional requests.                                             | `/api/commands`, `/api/ask`                                                                              |
| `400`  | `COMMAND_REQUIRED`         | A terminal command name was not supplied.                                                                                                                                            | `/api/terminal`                                                                                          |
| `400`  | `COMMAND_INVALID`          | The terminal command name does not match the permitted command-name format.                                                                                                          | `/api/terminal`                                                                                          |
| `400`  | `ARGUMENTS_INVALID`        | Terminal arguments must be an array of bounded strings without control characters.                                                                                                   | `/api/terminal`                                                                                          |
| `400`  | `ARGUMENTS_TOO_MANY`       | The terminal request contains more than eight arguments.                                                                                                                             | `/api/terminal`                                                                                          |
| `400`  | `COMMAND_NOT_FOUND`        | The requested terminal command is not registered.                                                                                                                                    | `/api/terminal`                                                                                          |
| `401`  | `AUTH_REQUIRED`            | The terminal command requires an authenticated administrator session.                                                                                                                | `/api/terminal`                                                                                          |
| `403`  | `COMMAND_FORBIDDEN`        | The terminal command is not permitted for the current session.                                                                                                                       | `/api/terminal`                                                                                          |
| `429`  | `RATE_LIMITED`             | The terminal request exceeded its short request window or cooldown.                                                                                                                  | `/api/terminal`                                                                                          |
| `500`  | `ASK_FAILED`               | The assistant request failed while being processed. The server encountered an unexpected error and could not complete the request.                                                   | `/api/ask`                                                                                               |
| `500`  | `COMMAND_FAILED`           | The command request failed while being processed. The server encountered an error and could not return the expected command result.                                                  | `/api/commands`                                                                                          |
| `500`  | `CONTROL_ACTION_FAILED`    | The requested control action failed during execution. The server encountered an unexpected error while attempting to perform the operation.                                          | `/api/admin/control`                                                                                     |
| `500`  | `LOG_RETRIEVAL_FAILED`     | The server could not retrieve the requested logs. An error occurred while accessing or processing the log data.                                                                      | `/api/logs`                                                                                              |
| `500`  | `METRICS_RETRIEVAL_FAILED` | The server could not retrieve metrics. An error occurred while collecting or processing the requested metrics data.                                                                  | `/api/metrics`                                                                                           |
| `502`  | `FEEDBACK_DM_FAILED`       | The feedback response was saved successfully, but delivery of the Slack direct message failed. The notification could not be delivered even though the response itself was recorded. | `/api/feedback`                                                                                          |
