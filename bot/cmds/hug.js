const { log } = require("../utils/logger.js")

const hugArt = `
\`\`\`
             ___                   ____                  ___
        ____(   \\              .-'    \`-.              /   )____
        (____     \\_____       /  (O  O)  \\       _____/     ____)
        (____            \`-----(      )     )-----'            ____)
        (____     _____________\\  .____.  /_____________     ____)
        (______/                \`-.____.-'              \\______ )
\`\`\`
`

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        await respond(`${hugArt}\n<@${command.user_id}> gets a giant Slackzilla hug! 🤗`)

        log.info("{user} used {cmd}", command)
    })
}