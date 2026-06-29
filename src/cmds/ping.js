module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command, ack: _ack }) => {
        const start = Date.now()

        await ack()

        const latency = Date.now() - start

        await respond(
            `🏓 pong!
            latency: ${latency}ms
            user: <@${command.user_id}>`
        )
    })
}