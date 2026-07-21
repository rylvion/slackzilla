const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

const { App } = require('@slack/bolt')
const { log } = require('./utils/logger')
const staticMeta = require('./meta')

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true
})

global.botMeta = {
    ...staticMeta,
    startedAt: Date.now(),
    nodeVersion: process.version,
    platform: process.platform,
    memory: () => process.memoryUsage().rss,
    scopes: [...staticMeta.oauthScopes]
}

const cmds = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'commands.json'), 'utf8')
)

for (const [name, meta] of Object.entries(cmds)) {
    if (typeof meta !== 'object' || meta === null)
        continue
    
    const file = path.join(__dirname, 'cmds', meta.file)

    if (!fs.existsSync(file)) {
        log.error("Missing command file: {0}", null, meta.file)
        continue
    }

    const cmd = require(file)

    if (typeof cmd === 'function') {
        cmd(app, meta)
    } else {
        log.error("Command {0} does not export a function", null, meta.file)
    }
}

(async () => {
    await app.start(process.env.PORT || 3000)

    log.info("All systems initialised")
    log.info('Ready for launch in T minus 3... 2... 1...')

    log.success("BOOM! Slackzilla is now online and ready to serve your commands")
})()