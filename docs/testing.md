# Testing

**Last Updated:** _14/10/2026_

This guide covers the project's automated tests, validation checks, RAG tools, and npm scripts used during development.

## Running Tests

`npm run test` will run 45 tests, validates the manifest and commands, and lints the code. This runs the automated tests in `test/`, validates `manifest.json` and `bot/data/commands.json` against their schemas, and lints the client code.

```bash
C:\dev\projects\my\bots\slack\slackzilla>npm test

> slackzilla@v0.9.7-beta test
> node --test "test/**/*.test.js" && npm run validate-manifest && npm run validate-commands && npm run lint

✔ groups identical errors while retaining occurrence metadata and one stack (4.7054ms)
✔ keeps event groups separate when query values differ (0.5524ms)
✔ returns safe authenticated session metadata and the existing CSRF token (6.0358ms)
✔ returns an unauthenticated response for missing and invalid sessions (1.6405ms)
✔ returns an unauthenticated response for an expired session (9.8231ms)
✔ returns an unauthenticated response after logout invalidates the session (0.9107ms)
✔ detects routes inside combined pathname and method conditions (8.9388ms)
✔ ignores negative pathname comparisons without a false return (1.2122ms)
✔ detects routes matched using includes() (1.2802ms)
✔ detects routes matched using startsWith() (1.7357ms)
✔ detects negated prefix guards that return false (1.4398ms)
✔ detects single-line negated prefix guards (0.8567ms)
✔ extracts HTTP methods from combined route conditions (0.7063ms)
✔ infers methods from checks following a prefix route guard (1.8961ms)
✔ does not apply methods from one route to a separate route (1.4317ms)
✔ indexes the session route with its accepted HTTP method (446.0313ms)
✔ infers methods from negated method guards that return false (0.4854ms)
✔ loads Markdown documents from supported sources (2.4159ms)
✔ sorts documents by route (1.8372ms)
✔ maps the documentation index to /docs (0.2133ms)
✔ maps the README to /docs/readme (0.2819ms)
✔ maps nested documentation files to their routes (0.3547ms)
✔ does not create a document for an unknown route (0.3192ms)
✔ assigns the expected document categories (0.2742ms)
✔ extracts titles from Markdown headings (0.2587ms)
✔ searches documents by title (1.6796ms)
✔ searches document content case-insensitively (0.7769ms)
✔ searches document headings (0.3839ms)
✔ returns no results for empty or whitespace-only queries (0.1388ms)
✔ returns no results for unmatched queries (0.1404ms)
✔ respects the search result limit (0.2103ms)
✔ includes a relevant excerpt in search results (0.3563ms)
✔ preserves external Markdown links (0.6403ms)
✔ rewrites relative Markdown links to documentation routes (0.2297ms)
✔ preserves query strings and heading fragments in links (0.1409ms)
✔ preserves fragment-only links (0.0897ms)
✔ rewrites HTML href attributes (0.1286ms)
✔ rewrites HTML src attributes (0.0839ms)
✔ groups documents in the expected navigation sections (0.2868ms)
✔ assigns README and devlog documents to their correct groups (0.0783ms)
✔ does not mutate the original document list when grouping (0.6001ms)
✔ falls back to available tool results when the final response is empty (1.1819ms)
✔ gives docs files a higher retrieval score (0.6155ms)
✔ keeps response text and tool calls across streamed rounds (26.5467ms)
✔ answerQuestion returns tool evidence when a later model round is empty (692.9055ms)
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 947.6235

> slackzilla@v0.9.7-beta validate-manifest
> ajv validate -s schemas/manifest.schema.json -d manifest.json

manifest.json valid

> slackzilla@v0.9.7-beta validate-commands
> ajv validate -s schemas/command.schema.json -d bot/data/commands.json

bot/data/commands.json valid

> slackzilla@v0.9.7-beta lint
> eslint ./server/client
```

`npm test:single` will run only the automated tests in `test/` without validating the manifest or commands, or linting the code.
see above for the output of the test and to run the tests, use the following command:

```bash
npm run test:single
```

## Using tools

The project provides CLI tools for inspecting RAG behaviour and testing individual tools. (See the [RAG documentation](docs/rag.md#) for more information.)

```bash
npm run rag:use-tool -- --getStatus
npm run rag:use-tool -- --getCommands
npm run rag:use-tool -- --getReleaseInfo
npm run rag:use-tool -- --runCommand
npm run rag:use-tool -- --getLogs
npm run rag:use-tool -- --getRoutes
```

and each one has a `--help` option to get more information about the command.
e.g.

```bash
C:\dev\projects\my\bots\slack\slackzilla>npm run rag:use-tool -- --getCommands --help

> slackzilla@v0.9.6-beta rag:use-tool
> node scripts/rag-use-tool.js --getCommands --help

◇ injected env (9) from server\.env // tip: ⌘ override existing { override: true }
◇ injected env (6) from bot\.env // tip: ⌘ enable debugging { debug: true }
Tool: getCommands

Description:
Search and inspect registered Slackzilla commands. With no filters, return only the command IDs. Use filters to find commands by id, command, description, category, or usage hint. Multiple filters are combined. Use fuzzy to search text across command metadata. Use an exact id when you need the full details of one command. This tool only provides command metadata; use runCommand to execute a command.

Parameters:

  --id
    Type: string
    Exact command ID to inspect.

  --command
    Type: string
    Filter by the Slack command name, such as /sz-calc.

  --description
    Type: string
    Filter or search command descriptions.

  --category
    Type: string
    Filter by command category, such as utility or entertainment.

  --usageHint
    Type: string
    Filter by command usage syntax.

  --fuzzy
    Type: string
    Fuzzy text search across command ID, command name, description, category, and usage hint.

Usage:
  npm run rag:use-tool -- --getCommands
  npm run rag:use-tool -- --getCommands --help

C:\dev\projects\my\bots\slack\slackzilla>npm run rag:use-tool -- --runCommand --help

> slackzilla@v0.9.6-beta rag:use-tool
> node scripts/rag-use-tool.js --runCommand --help

◇ injected env (9) from server\.env // tip: ⌘ suppress logs { quiet: true }
◇ injected env (6) from bot\.env // tip: ⌁ auth for agents [www.vestauth.com]
Tool: runCommand

Description:
Run a registered Slackzilla command and return its output. All registered commands are available by default except commands explicitly blocked from AI tool execution. The /sz-ask command is blocked because it would recursively invoke the AI assistant. When the user asks to run or execute a command, call this tool instead of getCommands or inferring the output. Use commandId for the command to run and text only for the content that should be passed to that command. Do not include surrounding instructions about using the command unless the user explicitly asks for them to be included. If the user asks you to format, rewrite, summarise, or otherwise transform content before passing it to the command, apply that transformation first. Keep command arguments focused on the requested action and content, then use the command's output as evidence when generating the final answer. For example, 'run the info command' uses commandId 'info'. Do not attempt to run a blocked command.

Parameters:

  --commandId (required)
    Type: string

  --text
    Type: string
    Content to pass to the command. Exclude instructions about how to use the command unless explicitly requested.
    Maximum: 500

Usage:
  npm run rag:use-tool -- --runCommand
  npm run rag:use-tool -- --runCommand --help
```

## Running commands

for running commands, you can use the `npm run rag:use-tool` command with the appropriate flags. For example, to run a command with a specific command ID and text input, you can use:

```bash
npm run rag:use-tool -- --runCommand --commandId <command_id> --text "<input_text>"
```

## Debugging RAG

Any question can be debugged using the `npm run rag` command. This will allow you to test RAG retrieval and responses using a supplied query, with an optional `--ai` flag to enable AI responses. The command can be run as follows:

```bash
npm run rag -- "<your_query_here>"
```

and an example of it is rather lengthy, so i shortened it

```bash
C:\dev\projects\my\bots\slack\slackzilla>npm run rag -- What are the available commands in Slackzilla?

[1] docs/server-setup.md
Score: 70
LINES: 1-60
TYPE: markdown

[2] docs/api.md
Score: 65
LINES: 1-60
TYPE: markdown

[3] docs/architecture.md
Score: 65
LINES: 1-60
TYPE: markdown

[4] docs/docs.md
Score: 65
LINES: 1-50
TYPE: markdown

[5] docs/setup.md
Score: 65
LINES: 1-60
TYPE: markdown

[6] docs/post/admin-control.md
Score: 60
LINES: 441-500
TYPE: markdown

[7] docs/post/commands.md
Score: 60
LINES: 1-1
TYPE: markdown
This page is blank. Please fill in the content for the api, `POST api/commands/:id`

[8] docs/rag.md
Score: 60
LINES: 1-60
TYPE: markdown
```

and it can be used for files analysis e.g.

```bash
C:\dev\projects\my\bots\slack\slackzilla>npm run rag -- server/lib/rag/rag.js
CODE FILE: server/lib/rag/rag.js
IMPORTS:
- fs
- path
- crypto
- ./code-parser
- ./code-parser
- ./code-parser
- ../command-runner
- ../command-runner
- ../command-runner

FUNCTIONS:
- emitActivity (34-38)
- collectFiles (40-57)
- collectImages (60-78)
- relativePath (80-82)
- tokens (84-92)
- normalisePath (94-101)
- extractFileReferences (103-106)
- getFileMetadata (108-116)
- resolveImport (119-143)
- getDependencies (145-166)
- buildIndex (168-244)
- isIndexCurrent (248-278)
- loadIndex (280-289)
- findSymbols (291-316)
- getDependants (318-336)
- findEnvironmentVariable (338-359)
- extractEnvironmentVariables (361-363)
- findRoutes (365-398)
- getCodeContext (400-429)
- calculateScore (431-535)
- retrieve (537-593)
- retrieveImages (595-647)
- formatResponses (649-673)
- inferCommandInvocation (675-711)
- buildCodebaseContext (714-853)
- formatCodebaseContext (855-888)
- getChunkPriority (890-901)
- packContextChunks (903-925)
- packRepositoryContext (927-971)
- answerQuestion (973-1310)
- buildAiFallback (1312-1330)
- readAiResponse (1332-1435)
- normaliseUsage (1437-1449)
- estimateTokenCount (1451-1453)

CODE FILE: server/lib/rag/rag-tool-context.js
IMPORTS:
- ./rag
- ./rag
- ../command-runner
- ../release-info

FUNCTIONS:
- createRagToolContext (6-83)

SOURCE (6-83):
[source code omitted for brevity]

CODE FILE: server/lib/command-runner.js
IMPORTS:
- fs
- path

FUNCTIONS:
- listCommands (7-11)
- getCommand (13-16)
- waitForResponse (18-39)
- runCommand (41-93)

CODE FILE: server/lib/rag/code-parser.js
IMPORTS:
- acorn
- acorn-walk
- fs
- path

FUNCTIONS:
- parseJavaScript (6-174)
- getCallName (176-200)
- getFunctionName (202-205)
- getEnvironmentVariable (207-221)
- getRoute (223-251)
- getExportName (253-280)
- deduplicate (282-320)
- getStatements (323-327)
- visit (332-383)
- getAcceptedMethods (329-388)
- analyseFunction (390-458)
- inferRouteMethods (322-465)
- visit (470-498)
- getPathMethods (467-503)
- getPathRoutes (506-638)
- resolveFileReference (641-655)
- extractPathReferences (657-673)
- getFileType (675-687)
- getHeading (689-696)
- createChunks (698-717)

CODE FILE: scripts/debug-rag.js
IMPORTS:
- ../server/lib/rag/rag

CODE FILE: bot/cmds/ask.js
IMPORTS:
- ../utils/logger
- ../../server/lib/rag/rag
- ../../server/lib/rag/rag

FUNCTIONS:
- getHelp (6-17)
- getUsage (19-31)

CODE FILE: server/api/routes/index.js
IMPORTS:
- ../../lib/rag/rag

FUNCTIONS:
- listRoutes (3-8)
- handleRoutesApi (10-20)

ROUTES:
- HTTP /api/routes (11)

CODE FILE: server/api/ask/index.js
IMPORTS:
- ../../lib/rag/rag
- ../../lib/rag/rag-tools
- ../../lib/rag/rag-tool-context
- ../../lib/rate-limit

FUNCTIONS:
- handleAskApi (18-96)

ROUTES:
- HTTP /api/ask (19)

CODE FILE: server/lib/release-info.js
IMPORTS:
- path

FUNCTIONS:
- normaliseVersion (7-13)
- findVersion (15-20)
- getReleaseInfo (22-43)

SOURCE FILE: server/lib/rag/rag.js
LINES: 1-60
TYPE: javascript
[source code omitted for brevity]

CODE FILE: scripts/rag-use-tool.js
IMPORTS:
- ../server/lib/rag/rag-tools
- ../server/lib/rag/rag-tools
- ../server/lib/rag/rag-tool-context
- util
- ../server/server

FUNCTIONS:
- parseOptions (7-28)
- printUsage (30-43)
- main (45-128)

CODE FILE: server/database/store.js
IMPORTS:
- fs
- path
- crypto

FUNCTIONS:
- ensureDir (42-44)
- readJson (46-53)
- writeJson (55-58)
- appendLogLine (60-63)
- appendLogChunk (65-68)
- getLogSnapshot (70-93)
- readLogLines (95-97)
- writeLogLines (99-103)
- deleteLogLines (105-110)
- deleteLastLogLines (112-115)
- clearLog (117-119)
- deleteLogFile (121-125)
- listLogArchives (127-146)
- rotateLog (148-164)
- restoreLogArchive (166-207)
- deleteLogArchive (209-228)
- getArchiveMetadata (230-241)
- getServerErrors (243-246)
- fingerprint (248-250)
- groupServerErrors (252-282)
- recordServerError (284-289)
- deleteServerError (291-293)
- deleteServerErrors (295-302)
- deleteServerErrorGroup (304-308)
- readJsonArray (310-313)
- readFeedback (315-317)
- normaliseFeedbackEntry (319-335)
- saveFeedback (337-339)
- addFeedback (341-347)
- updateFeedback (349-368)
- deleteFeedback (370-380)
- listFeedback (382-404)
- readBotState (406-408)
- saveBotState (410-420)
- getBotState (422-424)
- recordBotHeartbeat (426-434)
- readMetrics (436-438)
- saveMetrics (440-442)
- recordServerEvent (444-458)
- getServerEvents (460-472)
- groupServerEvents (474-502)
- deleteServerEvent (504-506)
- deleteServerEvents (508-519)
- deleteServerEventGroup (521-525)
- recordCommandUsage (527-569)
- getCommandStats (571-579)
- getBotMetrics (581-592)
- readDeploymentState (594-596)
- saveDeploymentState (598-608)
- setDeploymentOutput (610-614)

SOURCE (304-308):
[source code omitted for brevity]

RELEVANT SYMBOLS:
- getServerErrors in server/database/store.js:243-246
- groupServerErrors in server/database/store.js:252-282
- recordServerError in server/database/store.js:284-289
- deleteServerError in server/database/store.js:291-293
- deleteServerErrors in server/database/store.js:295-302
- deleteServerErrorGroup in server/database/store.js:304-308
- recordServerEvent in server/database/store.js:444-458
- getServerEvents in server/database/store.js:460-472
- groupServerEvents in server/database/store.js:474-502
- deleteServerEvent in server/database/store.js:504-506
- deleteServerEvents in server/database/store.js:508-519
- deleteServerEventGroup in server/database/store.js:521-525
- createRagToolContext in server/lib/rag/rag-tool-context.js:6-83
- createRagTools in server/lib/rag/rag-tools.js:235-331
- recordServerError in server/server.js:190-204
- classifyServerRequest in server/server.js:658-666
- startServer in server/server.js:714-727

RELEVANT ROUTES:
- HTTP /api/admin/events in server/api/admin/index.js:25

DEPENDENCIES:
- server/lib/rag/code-parser.js
- server/lib/command-runner.js
- server/lib/rag/rag.js
- server/lib/release-info.js
- server/database/store.js
- server/lib/auth.js
- server/lib/http.js
- server/lib/system.js
- server/api/status/index.js
- server/api/telemetry/index.js
- server/api/logs/index.js
- server/api/metrics/index.js
- server/api/admin/index.js
- server/api/feedback/index.js
- server/api/control/index.js
- server/api/commands/index.js
- server/api/routes/index.js
- server/api/release/index.js
- server/api/ask/index.js
- server/api/session/index.js
- server/.env
- bot/.env
- server/deploy.sh

DEPENDANTS:
- bot/cmds/ask.js
- scripts/debug-rag.js
- server/api/ask/index.js
- server/api/routes/index.js
- server/lib/rag/rag-tool-context.js
- scripts/rag-use-tool.js
- bot/bot.js
- bot/cmds/feedback.js
- bot/cmds/info.js
- bot/utils/metrics.js
- server/lib/system.js
- server/server.js
- server/lib/rag/rag.js
```

## Scripts

| Script                      | Command                                                                                                           | Description                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm start`                 | `npm run build && npm run lint && concurrently --names "BOT,SERVER" "npm run bot" "node server/server.js"`        | Build the project, lint the code, and start both the bot and server concurrently. |
| `npm run test`              | `node --test "test/**/*.test.js" && npm run validate-manifest && npm run validate-commands && npm run lint`       | Run all tests, validate manifest and commands, and lint the code                  |
| `npm run test:single`       | `node --test "test/**/*.test.js"`                                                                                 | Run all tests only                                                                |
| `npm run bot`               | `node bot/bot.js`                                                                                                 | Start the Slack bot only                                                          |
| `npm run server`            | `node server/server.js`                                                                                           | Start the Server only                                                             |
| `npm run dev`               | `vite --open --config server/client/vite.config.mjs`                                                              | Start the development server for the client with hot reloading. (No backend)      |
| `npm run build`             | `vite build --config server/client/vite.config.mjs`                                                               | Build the client for production                                                   |
| `npm run preview`           | `vite preview --open --config server/client/vite.config.mjs`                                                      | Preview the production build of the client                                        |
| `npm run build:preview`     | `vite build --config server/client/vite.config.mjs && vite preview --open --config server/client/vite.config.mjs` | Build and preview the production build of the client                              |
| `npm run lint`              | `eslint ./server/client`                                                                                          | Lint the client code                                                              |
| `npm run generate-manifest` | `node scripts/generateManifest.js`                                                                                | Generate the manifest file for the bot                                            |
| `npm run validate-manifest` | `ajv validate -s schemas/manifest.schema.json -d manifest.json`                                                   | Validate the manifest file against the schema                                     |
| `npm run validate-commands` | `ajv validate -s schemas/command.schema.json -d bot/data/commands.json`                                           | Validate the commands file against the schema                                     |
| `npm run stats`             | `node scripts/stats.js`                                                                                           | Generate statistics about the commands                                            |
| `npm run rag`               | `node scripts/debug-rag.js`                                                                                       | Debug RAG retrieval and responses using a supplied query.                         |
| `npm run rag:use-tool`      | `node scripts/rag-use-tool.js`                                                                                    | Run the RAG tool script (parameters)                                              |
| `npm run release`           | `node scripts/appendReleaseNotes.js`                                                                              | Updates release notes                                                             |
| `npm run update`            | `npm run generate-manifest && npm run release`                                                                    | Generate the manifest and append release notes                                    |
| `npm run all`               | `npm run test && npm run update && npm start`                                                                     | Run all tests, update the manifest and release notes, and start the project       |
