# Slackzilla
a chaotic little Slack bot that does stuff… sometimes correctly

## now nerdy stuff 
cur scopes:
- `app_mentions:read`
- `channels:history`
- `chat:write`
- `commands`

### anyways to setup the bot:
1. create a new Slack app at https://api.slack.com/apps
2. enable Socket Mode in the "Socket Mode" section and generate an App-Level Token with the `connections:write` scope.
3. install the app to your workspace and get the Bot User OAuth Token from the "OAuth & Permissions" section.
4. use `git clone https://github.com/rylvion/slackzilla.git` to clone the repo.
5. create a .env file in the root of the project and add the following environment variables:
    SLACK_BOT_TOKEN=your-bot-user-oauth-token
    SLACK_APP_TOKEN=your-app-level-token
    SLACK_SIGNING_SECRET=your-signing-secret
6. setup the bot using `npm install` to install the dependencies.
7. run the bot using `node bot.js` and it should connect to Slack and start listening for events.

err i think thats it idk.. what to write here tbh

also btw this has an MIT license so do whatever you want with it, free of credits, but i'd love to see what you do with it so if you make something cool with it, please share it with me! (also if you find any bugs or have any suggestions for improvements, please let me know!)


