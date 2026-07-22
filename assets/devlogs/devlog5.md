<p align="center">
    <img src="../attachments/d5/image.png">
</p>

# Devlog 5 - manifest workflow
time logged: 6hr 47min
date: 21/07/2026

ok so i kinda lied in the last devlog. this ended up being another major architectural change to slackzilla. the slack manifest system was always the most brittle part of the pipeline and manually maintaining `manifest.json` was a guaranteed way to let things drift. today i finally automated the entire manifest workflow. the new setup makes `commands.json` and `meta.js` the single source of truth. i wrote a manifest generator that loads all metadata like descriptions colours oauth scopes bot info and merges it with the command definitions to build a complete slack manifest object. once assembled it writes `manifest.json` and syncs it during deployment. validation is baked directly into the generator. i wired AJV into both stages. every command is validated against `command.schema.json` and the final manifest is validated again against slack's official schema. if anything fails the generator stops immediately with a clear error instead of producing a broken file. this caught several issues especially after i moved all schemas into a dedicated `schemas/` directory to clean up the project structure.

the github actions workflow also got a major overhaul. every push now generates the manifest validates commands and manifest rotates the slack configuration token updates github secrets syncs the manifest through the slack api and deploys the bot. changing a slash command in `commands.json` now updates both the bot and the slack app config automatically. no more manual edits to `manifest.json` or the slack app settings. the entire pipeline is now self maintaining and fully automated. token rotation was the biggest pain. slack configuration tokens only last twelve hours so storing them in github secrets was not enough. i created a fine grained github PAT with permission to modify repo secrets and wrote `rotateManifestToken.js` to handle the full refresh cycle. it rotates the manifest token receives a new refresh token and updates both secrets so the next deployment does not break.

i spent way too long debugging an `invalid_refresh_token` error. note that slack's copy button does not copy the existing refresh token it generates a new pair. every time i clicked it the previously saved token became invalid instantly. once i realised that i started updating github secrets immediately after copying the new pair so everything stayed in sync. after that the rotated token still was not being passed correctly between github actions steps. i switched to `GITHUB_OUTPUT` so the rotation step could hand the new token to the manifest sync step. then slack started returning `not_authed` which led to another rabbit hole. the manifest update endpoint requires the token in the correct auth header not the request body. once i fixed the request format the entire pipeline finally ran clean end to end.

TL;DR slackzilla now auto generates its slack manifest validates everything with AJV rotates configuration tokens syncs the manifest during deployment and updates the bot server with minimal manual work. after a lot of debugging around token rotation schema mismatches and github actions quirks the deployment pipeline is basically self maintaining except refreshing the github PAT every ninety days.


---

<a href="devlog4.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 4" />
  </picture>
</a>

<p align="right">
  <em>
    <b>
      <a href="devlog6.md">
        visit devlog 6
      </a>
    </b>
  </em>
</p>