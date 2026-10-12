# Testing
**Last Updated:** *09/10/2026*

This guide covers the project's automated tests, validation checks, RAG tools, and npm scripts used during development.

## Running Tests

`npm run test:all` will run 17 tests, validates the manifest and commands, and lints the code. This runs the automated tests in `test/`, validates `manifest.json` and `bot/data/commands.json` against their schemas, and lints the client code.

```bash
C:\dev\projects\my\bots\slack\slackzilla>npm run test:all

> slackzilla@v0.9.6-beta test:all
> node --test "test/**/*.test.js" && npm run validate-manifest && npm run validate-commands && npm run lint

✔ returns safe authenticated session metadata and the existing CSRF token (3.3504ms)
✔ returns an unauthenticated response for missing and invalid sessions (0.9184ms)
✔ returns an unauthenticated response for an expired session (11.6061ms)
✔ returns an unauthenticated response after logout invalidates the session (0.675ms)
✔ detects routes inside combined pathname and method conditions (5.0022ms)
✔ ignores negative pathname comparisons without a false return (0.5522ms)
✔ detects routes matched using includes() (0.8044ms)
✔ detects routes matched using startsWith() (1.0516ms)
✔ detects negated prefix guards that return false (0.9706ms)
✔ detects single-line negated prefix guards (0.5571ms)
✔ extracts HTTP methods from combined route conditions (0.5368ms)
✔ infers methods from checks following a prefix route guard (1.5845ms)
✔ does not apply methods from one route to a separate route (0.8311ms)
✔ falls back to available tool results when the final response is empty (1.4028ms)
✔ gives docs files a higher retrieval score (0.3781ms)
✔ keeps response text and tool calls across streamed rounds (17.5543ms)
✔ answerQuestion returns tool evidence when a later model round is empty (98.1718ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 223.528

> slackzilla@v0.9.6-beta validate-manifest
> ajv validate -s schemas/manifest.schema.json -d manifest.json

manifest.json valid

> slackzilla@v0.9.6-beta validate-commands
> ajv validate -s schemas/command.schema.json -d bot/data/commands.json

bot/data/commands.json valid

> slackzilla@v0.9.6-beta lint
> eslint ./server/client
```

## Using tools

The project provides CLI tools for inspecting RAG behaviour and testing individual tools. (See the [RAG documentation](docs/rag.md#) for more information.)

```bash
npm run rag:use-tool -- --getStatus
npm run rag:use-tool -- --getCommands
npm run rag:use-tool -- --getReleaseInfo
npm run rag:use-tool -- --runCommand
npm run rag:use-tool -- --getLogs
npm run rag:use-tool -- --getMetrics
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

## Scripts

| Script                      | Command                                                                                                           | Description                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm start`                 | `npm run build && npm run lint && concurrently --names "BOT,SERVER" "npm run bot" "node server/server.js"`        | Build the project, lint the code, and start both the bot and server concurrently. |
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
| `npm run cmd-stats`         | `node scripts/stats.js`                                                                                           | Generate statistics about the commands                                            |
| `npm run rag`               | `node scripts/debug-rag.js`                                                                                       | Debug RAG retrieval and responses using a supplied query.                                             |
| `npm run rag:use-tool`      | `node scripts/rag-use-tool.js`                                                                                    | Run the RAG tool script (parameters)                                              |
| `npm run release`           | `node scripts/appendReleaseNotes.js`                                                                              | Append release notes to the changelog                                             |
| `npm run test:all`          | `node --test "test/**/*.test.js" && npm run validate-manifest && npm run validate-commands && npm run lint`       | Run all tests, validate manifest and commands, and lint the code                  |
| `npm run update`            | `npm run generate-manifest && npm run release`                                                                    | Generate the manifest and append release notes                                    |
| `npm run all`               | `npm run test:all && npm run update && npm start`                                                                 | Run all tests, update the manifest and release notes, and start the project       |



---

# Testing

This guide covers the project's automated tests, validation checks, RAG tools, and npm scripts used during development.

## Running the test suite

Run the following command from the project root:

```bash
npm run test:all
```

This runs the automated tests in `test/`, validates `manifest.json` and `bot/data/commands.json` against their schemas, and lints the client code.

The example output below shows a successful run with 17 passing tests, no failures, valid manifest and command files, and no reported lint errors.

[Keep the existing test output here.]

## RAG tools

The project provides CLI tools for inspecting RAG behaviour and testing individual tools.

### Debugging RAG responses

Run `npm run rag` with a query to investigate retrieval and response behaviour.

### Running individual tools

Use `npm run rag:use-tool` followed by the tool flag to execute an individual tool or inspect its parameters.

[Keep the existing tool examples and relevant `--help` output here.]

### Running commands through the RAG tool

Use `runCommand` with a registered command ID and optional text input:

```bash
npm run rag:use-tool -- --runCommand --commandId <command_id> --text "<input_text>"
```

The command ID identifies the registered command. The text argument supplies its input. Commands blocked from AI tool execution, including `/sz-ask`, cannot be run through this tool.

## Available npm scripts

The following table lists the project's npm scripts and their purposes.

[Keep the existing scripts table here.]
