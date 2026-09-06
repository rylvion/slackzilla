const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

const { App } = require('@slack/bolt')
const { log } = require('./utils/logger')
const { recordCommandUsage } = require('./utils/metrics')
const { recordBotHeartbeat } = require("../server/database/store")
const { initialiseBotMeta, getBotMeta } = require("../server/lib/bot-meta")

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true
})

const originalCommand = app.command.bind(app)

app.command = (commandName, handler) => {
    originalCommand(commandName, async args => {
        try {
            recordCommandUsage(commandName, args.command)
        } catch (err) {
            log.error("failed to record usage for {0}: {1}", null, commandName, err.message)
        }

        return handler(args)
    })
}

initialiseBotMeta()

function updateBotHeartbeat() {
    try {
        const botMeta = getBotMeta()
        
        recordBotHeartbeat({
            pid: process.pid,
            startedAt: new Date(botMeta.startedAt).toISOString(),
            version: botMeta.version,
            nodeVersion: botMeta.nodeVersion,
            platform: botMeta.platform,
            memory: process.memoryUsage().rss
        })
    } catch (err) {
        log.error("failed to update bot heartbeat: {0}", null, err.message)
    }
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

app.event("app_mention", async ({ event, say }) => {
    const text = String(event.text || "").replace(/<@[^>]+>\s*/g, "").trim()

    if (!text) {
        await say({
            text: `hi <@${event.user}>. try /sz-help for the full command list or /sz-feedback to send feedback.`
        })
        return
    }

    await say({
        text: `hi <@${event.user}>. i saw your mention. try /sz-help or /sz-feedback if you want to send me something.`
    })
})

;(async () => {
    await app.start(process.env.PORT || 3000)

    updateBotHeartbeat()
    setInterval(updateBotHeartbeat, 15000)

    log.start()
    log.info("All systems initialised")
    log.info('Ready for launch in T minus 3... 2... 1...')

    log.success("BOOM! Slackzilla is now online and ready to serve your commands")
})()
