# Devlog 6 - command buffet
time logged: (still progressing :D stay tuned)
date: 22/07/2026

okay since most of the major architectural refactors are done, i can finally focus on adding more commands to Slackzilla. this devlog is about the new commands that i added to the bot, which are mostly utility commands that can be used for various purposes.

- `base64 encoding`
- `hashing` - supports multiple algorithms, default: sha256
- `decoder` - decodes every algorithm that hashing supports
- `random ids`(uuid)
- `secure tokens`
- `random numbers`
- `unix date conversion`
- `text case conversion` (camel, pascal, snake, kebab)
- `character counter`
- `rock paper scissors`
- `magic 8ball` (the only entertainment command added in this devlog)

the trickier parts were the input parsers. `hash` has to decide whether the first word is an algorithm or part of the text, `case` needs to split words without mangling the content too much, and `unix` has to switch between timestamps and readable dates without getting confused by weird inputs. i also added guardrails for invalid ranges and missing text so the bot gives a useful reply instead of just silently failing.

the fun commands were the easiest win. `8ball` just picks from a response list, and `rps` does a quick match against the player choice and the bot choice to decide whether it was a win, lose, or tie. it is very low stakes code, which is honestly refreshing after the manifest workflow stuff from last time.

all utilities commands all have a `help` command associated to it

the current utilities commands include:
- `/sz-base64` - encodes a string to base64
- `/sz-hash` - generates a hash of a string, default: sha256
- `/sz-decode` - decodes a base64 encoded string
- `/sz-uuid` - generates a random uuid
- `/sz-token` - generates a random secure token
- `/sz-random` - generates a random number in a given range
- `/sz-unix` - converts a unix timestamp to a human-readable date and vice versa
- `/sz-case` - converts a string to camelCase, PascalCase, snake_case, or kebab-case
- `/sz-count` - counts the number of characters in a string
- `/sz-rps` - plays rock paper scissors with the bot
- `/sz-calc` - evaluates mathematical expression

so all of it has a 2nd argument for help, so for example `/sz-hash help` will show the usage and examples of the command.

i also added on `package.json`, 2 new scripts 
```json
    "validate-commands": "ajv validate -s schemas/command.schema.json -d src/data/commands.json",
    "count-commands": "node scripts/countCommands.js"
```

one to validate the `commands.json` file against the `command.schema.json` file, and another to count the number of commands in the `commands.json` file. this will help me keep track of how many commands are in the bot and also make sure that the `commands.json` file is valid before a pull request is merged.

currently, the bot has 22 commands in total, and 11 of them are utility commands.

i need some feedback on what other commands i should add to the bot, so if you have any ideas, please let me know. (im running out of ideas \*sighs\*)

im also planning on adding a web dashboard to the bot, which will allow users to see the bot's status, logs, and other information in a more user-friendly way. this will be a big change, so stay tuned for that in the next devlog

TL;DR: added a bunch of new slash commands for Slackzilla, kept the implementations small and native where possible, and tightened up the input handling so the new tools fail a little more gracefully.

___

<a href="devlog5.md">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
		<img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 5" />
	</picture>
</a>

<p align="right">
	<em>
		<b>
			<a href="#">
				visit non existent devlog 7 (coming soon)
			</a>
		</b>
	</em>
</p>
