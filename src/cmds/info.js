const { log } = require("../utils/logger.js")

module.exports = (app, meta) => {
    const formatUptime = ms => {
        const seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)

        const s = seconds % 60
        const m = minutes % 60
        const h = hours

        return `${h}h ${m}m ${s}s`
    }

    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const botMeta = global.botMeta

        const uptime = formatUptime(Date.now() - botMeta.startedAt)
        const memory = (botMeta.memory() / 1024 / 1024).toFixed(1)

        log.info("{user} used {cmd}", command)

        log.success(
            "{user} checked bot status (uptime: {0}, memory: {1}MB)",
            command,
            uptime,
            memory
        )

        await respond(
            `
🤖 Slackzilla status

version: ${botMeta.version}
node: ${botMeta.nodeVersion}
platform: ${botMeta.platform}

uptime: ${uptime}
memory: ${memory}mb

started: ${new Date(botMeta.startedAt).toLocaleString()}
            `
        )
    })
}