# POST API Documentation
**Last updated at:** _29/09/2026_

Each page in this section provides a guide for a specific POST API endpoint. These guides document the endpoint's purpose, authentication requirements, supported operations, and expected request format.

## Documentation Structure

Each page should follow the structure below:

| Section           | Content                                                                                                                       | Optional                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Overview          | What the endpoint does and when it should be used.                                                                            | `true`                                         |
| Supported Actions | The actions supported by the endpoint, including their parameters, requirements, and behaviour.                               | `true`                                         |
| Error Responses   | Endpoint-specific error codes, their causes, and recommended resolutions.                                                     | `true`                                         |
| Authentication    | How to authenticate requests to the endpoint, including any required credentials or security tokens.                          | `false` (if authentication is required)        |
| Request Payload   | The expected request body format, including required fields, data types, and validation rules for each action                 | `true` (but can be shortened/not exact)        |
| Example Requests  | Example requests for each supported action. May be included in the Request Payload section rather than documented separately. | `false` (if payload is detailed/comprehensive) |
| Implementation    | The source files, dependents, functions and other components responsible for handling the endpoint.                           | `true`                                         |
| Testing           | How to test the endpoint, including any required setup, test cases, and expected results.                                     | `true`                                         |

## Current POST APIs

| Endpoint                       | Description                                                                                    | File                                   | Auth req? |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------- | --------- |
| `POST /api/commands/:id`       | Executes an existing Slack command and captures its response.                                  | [commands.md](commands.md)             | No        |
| `POST /api/ask`                | Submits a question to the codebase assistant and streams the response.                         | [ask.md](ask.md)                       | No        |
| `POST /api/admin/feedback/:id` | Performs actions on feedback entries, including marking as read, responding, and deleting.     | [admin-feedback.md](admin-feedback.md) | Yes       |
| `POST /api/admin/control`      | Executes administrative actions involving services, deployment, logs, telemetry, and archives. | [admin-control.md](admin-control.md)   | Yes       |
| `POST /webhook`                | Receives deployment notifications and triggers the configured webhook handler.                 | [webhook.md](../webhook.md)            | Yes       |

## Authentication

All `/api/admin/*` endpoints require authentication via the `slackzilla_admin_session` cookie and a valid CSRF token. The CSRF token can be provided in the `X-CSRF-Token` header or as a `csrf` property in the request body.
