# Slackzilla API Guide

**Last updated at:** _29/09/2026_

The dashboard API is implemented by plain Node `http` handlers under `server/api/`. It is not an Express application. Each handler receives `{ req, res, url, context }`, checks the method and path, writes a response, and returns `true` when it handled the request.

| Section                                   | Description                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Response Envelope](#response-envelope)   | Standard JSON response format for success and error responses.                                                     |
| [Public Endpoints](#public-endpoints)     | Endpoints available to all clients, including status, telemetry, logs, commands, and the codebase assistant.       |
| [Admin Endpoints](#admin-endpoints)       | Endpoints requiring the `slackzilla_admin_session` cookie, including feedback, control actions, and server events. |
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

### Special Endpoints

| Method | Path       | Purpose                                                                                          |
| ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| `POST` | `/webhook` | Receives authenticated deployment notifications and triggers the configured deployment workflow. |

## Admin Endpoints

Admin endpoints require the `slackzilla_admin_session` cookie. State-changing requests additionally require the session CSRF token in `X-CSRF-Token` or the `csrf` body property.

| Method | Path                              | Purpose                                                                                                   |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/summary`              | Admin status, feedback preview, deployment configuration, and logs.                                       |
| `GET`  | `/api/admin/events`               | Authenticated admin SSE stream.                                                                           |
| `GET`  | `/api/admin/feedback`             | Search/filter feedback with `q` and `status`.                                                             |
| `GET`  | `/api/admin/feedback/:id`         | Read one feedback item.                                                                                   |
| `GET`  | `/api/admin/feedback/:id/replies` | Read replies to a feedback item.                                                                          |
| `POST` | `/api/admin/feedback/:id`         | Mark read/unread, respond, or delete. Deletion requires `confirmed: true`.                                |
| `POST` | `/api/admin/control`              | Authenticated administrative control actions for services, deployment, logs, telemetry, and log archives. |
| `GET`  | `/api/admin/errors`               | Retrieves the current server error snapshot.                                                              |
| `GET`  | `/api/admin/errors/stream`        | Streams server error updates over SSE.                                                                    |
| `GET`  | `/api/admin/server-events`        | Retrieves recent server events.                                                                           |
| `GET`  | `/api/admin/log-archives`         | Lists available log archives.                                                                             |

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

| Status | Error Code                 | Description                                                                                                                                                                          | Source                                                                                                                                                                        |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `BAD_REQUEST`              | The request could not be processed. This error is returned when an exception occurs while handling a feedback or control request.                                                    | `server/api/feedback/index.js`, `server/api/admin/control.js`                                                                                                                 |
| `400`  | `INVALID_FEEDBACK_ACTION`  | The requested feedback action is not recognised or is not supported by the feedback endpoint.                                                                                        | `server/api/feedback/index.js`                                                                                                                                                |
| `400`  | `INVALID_LOG_RANGE`        | The requested log range is invalid. The supplied range must meet the requirements of the log retrieval operation.                                                                    | `server/api/admin/control.js`                                                                                                                                                 |
| `400`  | `RESPONSE_REQUIRED`        | A response is required to complete the feedback action. The request cannot be processed without a response.                                                                          | `server/api/feedback/index.js`                                                                                                                                                |
| `400`  | `RESPONSE_TOO_LONG`        | The submitted response exceeds the maximum permitted length of 4,000 characters. The response must be shortened before it can be submitted.                                          | `server/api/feedback/index.js`                                                                                                                                                |
| `400`  | `UNKNOWN_CONTROL_ACTION`   | The requested control action is not recognised. The action must match one of the supported operations handled by the control endpoint.                                               | `server/api/admin/control.js`                                                                                                                                                 |
| `403`  | `CSRF_INVALID`             | The request failed CSRF validation because the token is missing or invalid. The request is rejected to protect the admin endpoint against cross-site request forgery.                | `server/api/feedback/index.js`, `server/api/admin/control.js`                                                                                                                 |
| `404`  | `COMMAND_NOT_FOUND`        | The requested command could not be found. The command name or identifier may be invalid, or the command may not exist in the available command list.                                 | `server/api/commands.js`                                                                                                                                                      |
| `404`  | `FEEDBACK_NOT_FOUND`       | The requested feedback entry could not be found. The supplied feedback identifier does not correspond to an existing entry.                                                          | `server/api/feedback/index.js`                                                                                                                                                |
| `404`  | `RELEASE_NOT_FOUND`        | The requested release could not be found. The supplied release identifier does not match an available release.                                                                       | `server/api/release.js`                                                                                                                                                       |
| `405`  | `METHOD_NOT_ALLOWED`       | The HTTP method used in the request is not supported by the endpoint. The request must use a method accepted by the relevant route.                                                  | `server/api/ask.js`, `server/api/commands.js`, `server/api/feedback/index.js`, `server/api/metrics.js`, `server/api/routes.js`, `server/api/release.js`, `server/api/logs.js` |
| `409`  | `CONFIRMATION_REQUIRED`    | The requested action requires explicit confirmation before it can proceed. This prevents potentially destructive operations from being executed without the required confirmation.   | `server/api/feedback/index.js`, `server/api/admin/control.js`                                                                                                                 |
| `409`  | `FEEDBACK_DM_MISSING_USER` | The feedback response was saved successfully, but the system could not send a Slack direct message because no associated Slack user ID was available.                                | `server/api/feedback/index.js`                                                                                                                                                |
| `500`  | `ASK_FAILED`               | The assistant request failed while being processed. The server encountered an unexpected error and could not complete the request.                                                   | `server/api/ask.js`                                                                                                                                                           |
| `500`  | `COMMAND_FAILED`           | The command request failed while being processed. The server encountered an error and could not return the expected command result.                                                  | `server/api/commands.js`                                                                                                                                                      |
| `500`  | `CONTROL_ACTION_FAILED`    | The requested control action failed during execution. The server encountered an unexpected error while attempting to perform the operation.                                          | `server/api/admin/control.js`                                                                                                                                                 |
| `500`  | `LOG_RETRIEVAL_FAILED`     | The server could not retrieve the requested logs. An error occurred while accessing or processing the log data.                                                                      | `server/api/logs.js`                                                                                                                                                          |
| `500`  | `METRICS_RETRIEVAL_FAILED` | The server could not retrieve metrics. An error occurred while collecting or processing the requested metrics data.                                                                  | `server/api/metrics.js`                                                                                                                                                       |
| `502`  | `FEEDBACK_DM_FAILED`       | The feedback response was saved successfully, but delivery of the Slack direct message failed. The notification could not be delivered even though the response itself was recorded. | `server/api/feedback/index.js`                                                                                                                                                |
