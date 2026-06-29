const path = require('path')
const fs = require('fs')
require('dotenv').config({path: path.resolve(__dirname, '.env')})

const { App } = require('@slack/bolt');

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true
});

global.botMeta = {
    startedAt: Date.now(),
    nodeVersion: process.version,
    platform: process.platform,
    memory: () => process.memoryUsage().rss,
    version: "[alpha] but idk what version im on rn"
}

const cmds = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'commands.json'), 'utf8'))

for (const [name, meta] of Object.entries(cmds)) {
    const file = path.join(__dirname, 'cmds', meta.file)

    if (!fs.existsSync(file)) {
        console.log(`Missing command file: ${meta.file}`)
        continue
    }

    const cmd = require(file)

    if (typeof cmd === 'function') {
        cmd(app, meta)
    } else {
        console.log(`Command ${meta.file} does not export a function`)
    }
}

// require('./src/cmds/ping.js')(app)
// require('./src/cmds/help.js')(app)
// require('./src/cmds/info.js')(app)
// require('./src/cmds/quote.js')(app)
// require('./src/cmds/jokes.js')(app)
// require('./src/cmds/funfact.js')(app)
// require('./src/cmds/hug.js')(app)

(async () => {
    await app.start(process.env.PORT || 3000)
    console.log('All systems initialised')
    console.log('Ready for launch in T minus 3... 2... 1...')
})();
