# Authentication, Authorisation, and Request Security

This guide explains the security mechanisms implemented by Slackzilla's dashboard server. Authentication establishes identity; authorisation decides whether that identity may perform an operation.

## Authentication Versus Authorisation

Authentication occurs when an administrator submits the configured password and the server creates a session. The browser presents the signed session cookie on later requests.

Authorisation occurs when protected handlers call `auth.requireSession(req, res)`. A valid session grants access to the admin dashboard and admin APIs. The current system has one privileged role: an authenticated administrator.

React rendering `/admin` does not grant access. The server checks the session before serving protected data and before executing admin actions.

## PBKDF2 Password Verification

The server does not store the administrator password in plaintext. `ADMIN_PASSWORD_HASH` uses this format:

```text
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

The authenticated admin summary contains the session CSRF token. The client sends it in `X-CSRF-Token` and may also include it as `csrf` in the request body. Protected handlers call `auth.verifyCsrf(req, session)` before changing state.

CSRF checks protect service actions, feedback updates and replies, feedback deletion, and logout. The token is not a password and must not be logged or exposed in public responses.

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
