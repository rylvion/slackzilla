[Dashboard](../attachments/d8/dashboard.png)

# Devlog 8 - server hosted dashboard finally happened
time logged: 17hr 47min 45s
date: 16/08/2026

The server hosted dashboard is finally here! It is hosted with the webhook, connected to the bot, and shows logs, status, and other information.

## architecture

The Slackzilla server-hosted dashboard is the web control centre sitting alongside the webhook (runs on the same port). The server runs the dashboard, API routes, authentication/session handling, CSRF protection, logging, monitoring and administrative controls. The dashboard has been moving from the earlier static `local/pages` prototype (see devlog 7) towards an EJS-based server-rendered architecture, with shared layouts/partials and a global dashboard styling system. The server also handles the GitHub deployment webhook on port `9000`, while Nginx sits in front of the application. The dashboard is intended to expose things such as bot status, logs, statistics, monitoring, API documentation and admin controls rather than sshing into the server and running commands manually

I’ve been separating the dashboard’s presentation layer, API layer and server logic. During development, I encountered and fixed several contract problems where route modules expected helpers such as `context.sendError()` and `context.sendOk()` that the runtime context did not provide. I also changed the authentication-aware API/SSE routes so unauthenticated requests return proper JSON/HTTP responses rather than accidentally redirecting an EventSource connection into an HTML login page. The dashboard has admin-only functionality, CSRF protection and server-side authentication, whilst the bot itself uses Slack’s Events/Slash Command mechanisms for incoming Slack activity. Slack’s Events API delivers subscribed events to the HTTP endpoint, while slash commands are sent to the configured app endpoint via HTTP POST.

`/api/admin` routes are protected by an authenticated admin session and CSRF protection. Admin authentication uses a session cookie, which is only created after logging in through `rylvion.hackclub.app/admin/login`. The admin password is never stored in plaintext. It is stored as a `PBKDF2-HMAC-SHA512` hash in the server environment, using a random salt and a high iteration count. The dashboard does not allow the password to be created or changed, so the server environment must be updated manually before restarting the service. CSRF tokens are generated server-side and sent to the authenticated client via a cookie. For POST requests, the client must return the token in the X-CSRF-Token header, preventing unauthorised or forged requests from triggering admin actions.

`/api/` (excluding `/api/admin`) has no authentication

Port 9000 is used for the webhook and the dashboard whilst the bot itself runs on socket mode.

The api that currently has these endpoints
base url: `https://rylvion.hackclub.app/api/`

* GET `/api/status` - returns the bot status and other information
* GET `/api/logs` - returns the bot logs from `slackzilla.log` as JSON, including the file size in bytes
* POST `/api/admin/control` - allow the admin to control the accepts several actions such as `start`, `stop`, `restart`, `redeploy`, `refresh`, `refresh-logs`, `refresh-status` (self explanatory actions) with dangerous actions (such as `redeploy`, `restart` and `stop` ) contains a confirmation prompt to prevent accidental execution of the action.
* GET `/api/admin/feedback` - returns database feedback as JSON
* GET `/api/admin/feedback/:id` - returns the feedback with the given ID as JSON
* POST `/api/admin/feedback/:id` - allows the admin to control and accepts 3 actions such as `delete`, `read`, `unread`, `respond`.
* GET `/api/admin/events`- is a SSE (Server Sent Event) endpoint that allows the admin to receive real time events from the server such as logs, status, feedbacks and other information about the bot.

___

<a href="devlog7.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 7" />
  </picture>
</a>

<p align="right">
  <em>
    <b>
      <a href="#">
        visit non existent devlog 9 (coming soon)
      </a>
    </b>
  </em>
</p>

<p align="center">
  <em>
    <b>
      <a href="https://rylvion.hackclub.app" target="_blank">
        visit hosted dashboard
      </a>
    </b>
  </em>
</p>