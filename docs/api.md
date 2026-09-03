# Slackzilla API Guide

The dashboard API is implemented by plain Node `http` handlers under `server/api/`. It is not an Express application. Each handler receives `{ req, res, url, context }`, checks the method and path, writes a response, and returns `true` when it handled the request.

## Response Envelope

Successful JSON responses use:

```json
{
   "ok": true,
   "data": {}
}
```

Errors use:

```json
{
   "ok": false,
   "code": "ERROR_CODE",
   "error": "Human-readable explanation"
}
```

Use `context.sendOk()` and `context.sendError()` in new handlers. Use `context.parseBody(req)` for JSON or URL-encoded bodies.

## Public Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/status` | Current bot, host, deployment, memory, disk, CPU, and network telemetry. |
| `GET` | `/api/status/stream` | SSE status updates. |
| `GET` | `/api/metrics` | Command totals, unique users/channels, and recent command activity. |
| `GET` | `/api/logs` | Bounded log snapshot as JSON. |
| `GET` | `/api/logs/stream` | SSE log snapshot and new log lines. |
| `GET` | `/api/logs/download` | Bounded raw log snapshot as plain text. |
| `GET` | `/api/commands` | Stable IDs and metadata for all commands. |
| `GET` | `/api/commands/:id` | Help and usage metadata for one command. |
| `POST` | `/api/commands/:id` | Execute an existing command and capture its response. |
| `GET` | `/api/ask` | Describes the assistant request format. |
| `POST` | `/api/ask` | Retrieves repository context and asks the configured model a question. |

## Command Execution

Command IDs come from `bot/data/commands.json`, not from the display label. Example:

```bash
curl -X POST http://localhost:9000/api/commands/calculator \
   -H "Content-Type: application/json" \
   -d '{"text":"2 + 3"}'
```

The adapter loads the same module used by Slack, supplies a synthetic command object, captures `respond()` calls, and returns them as `data.responses`. Commands can have external effects, so expose this endpoint only to trusted clients.

## Codebase Assistant

```bash
curl -X POST http://localhost:9000/api/ask \
   -H "Content-Type: application/json" \
   -d '{"question":"How does admin authentication work?"}'
```

The assistant retrieves matching text chunks from the repository, excluding `priv/`, `.env` files, logs, dependencies, build output, and Git metadata. It returns an answer and source paths. Image assets can be returned separately for relevant questions; their binary contents are not parsed as text.

The model is called only when `AI_API_KEY` is configured. `AI_URL` may be either a provider base URL or a complete `/chat/completions` URL. The server normalises both forms. Without a key, the endpoint returns a useful configuration message and retrieved source metadata.

## Admin Endpoints

Admin endpoints require the `slackzilla_admin_session` cookie. State-changing requests additionally require the session CSRF token in `X-CSRF-Token` or the `csrf` body property.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/summary` | Admin status, feedback preview, deployment configuration, logs, and CSRF token. |
| `GET` | `/api/admin/events` | Authenticated admin SSE stream. |
| `GET` | `/api/admin/feedback` | Search/filter feedback with `q` and `status`. |
| `GET` | `/api/admin/feedback/:id` | Read one feedback item. |
| `POST` | `/api/admin/feedback/:id` | Mark read/unread, respond, or delete. Deletion requires `confirmed: true`. |
| `POST` | `/api/admin/control` | Refresh, service control, or redeploy. Dangerous actions require `confirmed: true`. |

Example state-changing request:

```json
{
   "action": "read",
   "csrf": "session-csrf-token"
}
```

## Adding an Endpoint

1. Create `server/api/my-api/index.js`.
2. Export a handler that checks method and pathname.
3. Import it in `server/server.js`.
4. Add it to `handleApi()`.
5. Add metadata to `server/client/src/components/utils/api-routes.js`.
6. Add a JSON schema under the API directory if a documented contract is useful.
7. Run `npm run build`, `npm run lint`, and a real `curl` request.

Example:

```js
function handleMyApi({ req, res, url, context }) {
      if (url.pathname !== "/api/my-api" || req.method !== "GET") return false

      context.sendOk(res, { message: "Hello from Slackzilla" })
      return true
}

module.exports = { handleMyApi }
```

The frontend registry documents an endpoint; it does not serve or mount it.