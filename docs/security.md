# Authentication, Authorisation, and Request Security

This guide explains the security mechanisms implemented by Slackzilla's dashboard server. Authentication establishes identity; authorisation decides whether that identity may perform an operation.

## Authentication Versus Authorisation

Authentication occurs when an administrator submits the configured password and the server creates a session. The browser presents the signed session cookie on later requests.

Authorisation occurs when protected handlers call `auth.requireSession(req, res)`. A valid session grants access to the admin dashboard and admin APIs. The current system has one privileged role: an authenticated administrator.

React rendering `/admin` does not grant access. The server checks the session before serving protected data and before executing admin actions.

## PBKDF2 Password Verification

The server does not store the administrator password in plaintext. `ADMIN_PASSWORD_HASH` uses this format:

```bash
pbkdf2$<algorithm>$<iterations>$<salt>$<derived-key>
```

During login, `auth.js` parses the five fields and computes a 64-byte PBKDF2-HMAC result from the submitted password, stored salt, iteration count, and digest algorithm. The candidate is compared with the stored derived key using `crypto.timingSafeEqual()` after a length check.

PBKDF2 is a password verification format, not encryption. It cannot recover the original password. To change the admin password, generate a new hash, replace `ADMIN_PASSWORD_HASH`, and restart the server.

## Login Challenge and Session Cookies

`GET /admin/login` issues a random login challenge and stores it in the `slackzilla_login_csrf` cookie. The challenge is tied to the requesting IP and expires after 15 minutes. The cookie is `HttpOnly`, `SameSite=Strict`, and follows `COOKIE_SECURE`.

`POST /admin/login` verifies the challenge and password. On success, the server creates an in-memory session containing a random session ID, random CSRF token, client IP, creation time, and expiry time.

The browser receives `slackzilla_admin_session=<session-id>.<signature>`. The signature is HMAC-SHA256 using `ADMIN_SESSION_SECRET`. The server verifies the signature before looking up the session in its in-memory map.

Because sessions are in memory, restarting the dashboard invalidates every session. A copied cookie is not sufficient after restart because its session ID no longer exists in the session map.

The session cookie is `HttpOnly`, uses `Path=/` and `SameSite=Strict`, and uses `Secure` when `COOKIE_SECURE=true`. Enable `COOKIE_SECURE` only when the browser reaches the dashboard over HTTPS.

## CSRF Protection

Cross-site request forgery abuses automatically attached cookies. Slackzilla uses a synchroniser-token-style check for authenticated state-changing requests.

`GET /api/session` returns the session CSRF token and safe session metadata when the request has a valid session. The client sends the token in `X-CSRF-Token` and may also include it as `csrf` in the request body. Protected handlers call `auth.verifyCsrf(req, session)` before changing state.

CSRF checks protect service actions, feedback updates and replies, feedback deletion, and logout. The token is not a password and must not be logged or exposed in public responses.

The CSRF token is only returned by `/api/session` after a successful login. It is not available to unauthenticated clients, so it cannot be used to bypass the login challenge.

## Terminal Authentication and Command Security

The embedded terminal is a restricted command interface, not a shell. The browser sends registered backend commands to `POST /api/terminal` as a command name plus an argument array. The server validates the command against [`server/lib/terminal/commands.js`](../server/lib/terminal/commands.js), enforces its declared permission, and invokes the handler through the shared server context. Unregistered commands, arbitrary shell text, dynamic module names, filesystem paths, and external proxy URLs are not accepted.

Public terminal commands such as `status`, `uptime`, `logs`, `version`, `docs`, `rag`, and `command` do not require an administrator session, but they remain subject to input validation and terminal rate limiting. The `command` family only invokes registered Slack command adapters; blocked commands such as `/sz-ask` cannot recursively invoke the assistant through the terminal.

The `sudo` terminal family requires the same `slackzilla_admin_session` cookie and CSRF validation as other administrative APIs. Mutating controls use operation-bound master-password re-authentication followed by explicit confirmation. The server binds the re-authentication token to the requested control, consumes it once, and delegates execution to the existing admin-control handler. Unknown controls are rejected before credentials or confirmation are requested. `sudo logout` invalidates the session and clears the cookie through that shared control path.

Terminal requests are rate limited to 20 requests per 60 seconds per authenticated session or client IP, with a 500 ms cooldown. The browser additionally prevents duplicate privileged submissions and redraws interactive prompts so typed password characters cannot create repeated operation messages. These client safeguards do not replace server-side authorization or rate limiting.

The terminal can inspect browser `sessionStorage` and `localStorage` through its own page context. Storage values are shown only after administrator authentication, the terminal-state key is protected from deletion, and authentication cookies are not exposed because Slackzilla cookies are HttpOnly. The terminal never writes session cookies, raw CSRF tokens, or passwords into command history or terminal output.

The terminal's `api get` and `api post` helpers are same-origin browser requests, not an unrestricted server proxy. GET routes are allow-listed; internal POST routes may be submitted by normal users, but each destination API retains its own authentication, CSRF, confirmation, method, and rate-limit checks. RAG API and terminal tools additionally reject external URLs and credential-bearing headers.

See [`POST /api/terminal`](post/terminal-endpoint.md) for the complete payload, limits, command list, error codes, and implementation path.

## Dangerous Actions

The browser asks for confirmation before dangerous actions, but the security boundary is server-side. The control API rejects service actions without `confirmed: true` using `409 CONFIRMATION_REQUIRED`. Feedback deletion has the same requirement. A caller cannot bypass the browser prompt by posting directly without confirmation.

## Rate Limiting and Errors

Failed login attempts are tracked by client IP. Repeated failures eventually cause a temporary block and a `429` response. Invalid challenges produce `403`; invalid credentials produce `401`.

API requests receive JSON authentication errors rather than HTML redirects. Browser page requests may redirect to `/admin/login`; this distinction matters for `fetch()` and `EventSource` clients.

## Operational Rules

- Keep `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `SLACK_BOT_TOKEN`, and `WEBHOOK_SECRET` out of Git.
- Use HTTPS in production and set `COOKIE_SECURE=true` behind the TLS proxy.
- Restrict admin routes at the reverse proxy when an additional network boundary is appropriate.
- Treat command execution APIs as privileged functionality because commands may have external effects.
- Review public telemetry before exposing it externally.
- Restart the dashboard after changing environment variables.
