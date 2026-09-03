# Slackzilla RAG Assistant

Slackzilla's RAG assistant answers questions about the repository by retrieving relevant project context before asking an AI model to produce an answer. RAG means Retrieval-Augmented Generation:

```text
user question
    -> retrieve relevant repository context
    -> optionally retrieve related image assets
    -> optionally execute an explicitly named command
    -> send context and results to the model
    -> return answer, sources, images, and command result
```

The implementation is in `server/lib/rag.js`. The HTTP endpoint is `POST /api/ask`; the Slack interface is `/sz-ask`; and the public dashboard client is the `/ai` page.

## What RAG Does Here

The assistant is repository-aware rather than a general chatbot. It searches the checked-out Slackzilla source tree and gives the model matching code or documentation snippets. This helps answers stay grounded in the actual implementation instead of relying only on model memory.

The assistant returns:

- `answer`: the model answer or a local fallback message.
- `sources`: matching text-file paths, starting lines, and lexical scores.
- `images`: matching visual assets with public URLs.
- `command`: the captured result when a command was explicitly executed.

## Retrieval Pipeline

### 1. File collection

`collectFiles()` recursively walks the repository root. Text retrieval currently permits these extensions:

```text
.js .jsx .mjs .json .md .css .html .yml .service .conf .example
```

The collector excludes `.git`, `node_modules`, build output, logs, `.vscode`, and `priv`. Files ending in `.env` are also excluded even if their extension would otherwise match. This prevents private prompts, secrets, generated dependencies, and noisy runtime logs from entering model context.

Images are collected separately by `collectImages()`. The supported image extensions are `.png`, `.jpg`, `.jpeg`, `.gif`, and `.webp`. Image files are not opened as text and are not sent to the model as binary data.

### 2. Tokenisation

The current retriever is lexical and deterministic. It lowercases input, replaces path separators, underscores, and hyphens with spaces, and extracts alphanumeric tokens of at least two characters.

For each text file, the content is divided into overlapping-style windows of up to 60 lines, starting every 40 lines. A document window receives one point for each unique question token also found in its path or text. Results are sorted by descending score and limited to eight windows. Each returned text snippet is capped at 3,500 characters.

This is not an embedding or vector-database retriever yet. It does not calculate semantic similarity, generate vectors, or use a hosted search index. Exact terminology in the question generally produces the strongest results.

### 3. Image discovery

Image retrieval uses path tokens rather than image understanding. For example, a question containing `calculator` can match a path containing `calc` through an alias rule. A calculator question can therefore return:

```text
assets/attachments/d4/calc-behind-the-scenes.png
```

The response contains a browser URL such as:

```text
/assets/attachments/d4/calc-behind-the-scenes.png
```

The React AI page renders returned image assets as related visual references. The model receives the image path and URL as metadata, but the current server does not perform OCR, computer-vision analysis, or image embeddings.

## Model Generation

If `AI_API_KEY` is absent, the service does not call an external provider. It returns a local response explaining that the key is not configured, together with retrieved source metadata. An explicitly executed command can still return its local result without an AI key.

When configured, the service sends an OpenAI-compatible request to `AI_URL`:

```text
POST <AI_URL>/chat/completions
Authorization: Bearer <AI_API_KEY>
Content-Type: application/json
```

`AI_URL` may be either a provider base URL, such as:

```text
https://ai.hackclub.com/proxy/v1
```

or a complete endpoint:

```text
https://ai.hackclub.com/proxy/v1/chat/completions
```

The service normalises both forms and avoids appending `/chat/completions` twice. `AI_MODEL` selects the model, defaulting to `openai/gpt-oss-20b:free`.

The model receives a system instruction that requires it to answer from supplied repository context, acknowledge insufficient context, include relevant paths, and avoid claiming command execution unless a command result is present.

## HTTP API

### Basic question

```bash
curl -X POST http://localhost:9000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does admin authentication work?"}'
```

A successful response is wrapped in the standard Slackzilla envelope:

```json
{
  "ok": true,
  "data": {
    "answer": "...",
    "sources": [
      {
        "path": "server/lib/auth.js",
        "start": 1,
        "score": 3
      }
    ],
    "images": [],
    "command": null
  }
}
```

`GET /api/ask` returns a small description of the POST request format. Other methods receive `405 METHOD_NOT_ALLOWED`.

### Explicit command execution

Command execution is opt-in. A request can identify a stable command metadata ID:

```json
{
  "question": "Generate an administrator-compatible password hash",
  "commandId": "hash",
  "commandText": "pbkdf2 sha512 600000 helloWorld"
}
```

The server loads the existing command module, supplies a synthetic command object, captures calls to `respond()`, waits for asynchronous responses, and includes the captured result in `data.command`.

Commands are not sandboxed. They may generate secrets, call external APIs, send Slack messages, write files, or perform other side effects. The command API and RAG command execution must therefore be treated as trusted functionality, even though the endpoint is currently public in the local architecture.

## Natural-Language Command Requests

The assistant can infer an explicit command when the question contains a recognised `/sz-*` command. For example:

```text
generate a pbkdf2 hash string with the password helloWorld,
600000 iterations using the /sz-hash command
```

The RAG service translates this into the command input:

```text
pbkdf2 sha512 600000 helloWorld
```

The existing `/sz-hash` handler then generates the result. This inference currently contains special handling for PBKDF2 requests and generic handling for other recognised slash commands. If a question mentions a command only as documentation, do not assume it will execute unless the request is clearly an execution request or includes `commandId` through the HTTP API.

## Slack Integration

The `/sz-ask` handler in `bot/cmds/ask.js` uses the same `answerQuestion()` function as the dashboard API. It acknowledges the Slack command, sends a thinking response, asks the RAG service, and responds with the answer. When a command is explicitly requested in the Slack question, the command result is supplied to the model and returned to the user.

This shared service keeps Slack and HTTP behaviour aligned. Changes to retrieval, provider handling, or command inference affect both interfaces.

## Security and Privacy Boundaries

The retriever excludes `priv/` and `.env` files by design. Do not weaken those exclusions to make a question easier to answer. If a safe public document is needed by the assistant, place it under an appropriate non-private documentation path.

The assistant can still expose information from files that are allowed into retrieval. Review public source files, API responses, and model prompts before deploying the endpoint to an untrusted network. Never include API keys, passwords, session cookies, or private user data in the question text.

Command execution is a separate risk from retrieval. A read-only question should not execute a command. Clients that expose command selection should clearly separate question answering from command execution and should add authentication or authorisation before production exposure.

The upstream AI provider may apply its own safety filters. Responses such as safety classifications are provider output and should not be bypassed by disabling safeguards.

## Failure Modes

| Symptom | Likely cause |
| --- | --- |
| `AI_API_KEY is not configured` | No key is available to the dashboard process. |
| `AI request failed with ...` | Provider URL, model, key, quota, or upstream service problem. |
| `Not found` from the provider | `AI_URL` is invalid or contains an incorrect path. The service accepts base and complete endpoint forms. |
| Empty answer | Provider returned no usable `choices[0].message.content`. |
| No sources | Question terms did not match allowed paths or text windows. |
| No image result | The image filename/path did not contain tokens matching the question or an alias. |
| Empty command response | The command failed, timed out, or did not call `respond()`. |
| Command side effect occurred | Command modules are reused directly and are not sandboxed. |

## Extending the Retriever

To add a safe text format, update `allowedExtensions` and ensure the file can be read as UTF-8 text. To add an image format, update `imageExtensions` and the static server content-type map in `server/server.js`.

For better semantic retrieval, the lexical `score` function can later be replaced with an embedding provider and vector index. Keep the returned shape compatible with `{ path, start, score }` so the React page and API consumers do not need to change.

For image understanding, add a separate vision-capable provider path. Do not pass every repository image automatically: retrieve images by relevance, enforce the same private-directory exclusions, and keep image URLs restricted to files intentionally served by the static handler.

For command safety, introduce an allowlist of read-only commands, authentication, rate limiting, audit events, and a sandbox before exposing execution to untrusted users.

## Validation

Run the normal project checks:

```bash
npm run build
npm run lint
node --check server/lib/rag.js
node --check server/lib/command-runner.js
node --check server/api/ask/index.js
```

Test retrieval without calling the model:

```bash
node -e "const {retrieve,retrieveImages}=require('./server/lib/rag'); console.log(retrieve('feedback API')); console.log(retrieveImages('calculator flowchart'))"
```

Test a deterministic command through the shared adapter:

```bash
node -e "require('./server/lib/command-runner').runCommand('calculator','2 + 3').then(console.log)"
```
