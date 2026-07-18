# Devlog 3 - github actions webhook request (13/07/2026)
**time logged:** 6hr 01min 

i added a webhook dispatcher that automatically triggers a deployment whenever i commit to the main branch. Instead of manually pulling changes on the server and restarting the service myself, the GitHub Action now sends a signed webhook to my deployment server, which verifies it and runs the deploy script for me.

i also added 2 more commands
- `/sz-meme` - this makes a meme
- `/sz-echo [str]` - this echoes the string

you can see the flowchart below and see the full [devlog 3 here](slackzilla/assets/devlogs/devlog3.md) (hyperlinked)

TL;DR whenever i commit the server automatically receives it and slackzilla updates to the latest version

---

<a href="devlog2.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png">
    <img align="left" width="70" src="https://cdn.hackclub.com/019c1b78-0beb-7c82-9479-51e12c90a5b4/image.png" alt="Back Button" aria-label="Visit Devlog 2" />
  </picture>
</a>

<p align="center">
  <em>
    <b>
      <a href="https://github.com/rylvion/slackzilla/wiki/Adding-a-New-Command">
        check out adding a new command guide on the wiki
      </a>
    </b>
  </em>
</p>

<p align="right">
  <em>
    <b>
      <a href="devlog4.md">
        visit devlog 4
      </a>
    </b>
  </em>
</p>

