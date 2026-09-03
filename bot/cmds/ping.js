const { log } = require("../utils/logger.js")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        const start = Date.now()
        await ack()
        const latency = Date.now() - start

        log.info("{user} used {cmd}", command)

        log.success(
            "{user} pinged bot (latency: {0}ms)",
            command,
            latency
        )

        await respond(
            `🏓 pong!
latency: ${latency}ms
user: <@${command.user_id}>`
        )
    })
}