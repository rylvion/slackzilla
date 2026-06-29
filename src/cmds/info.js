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

    app.command(meta.cmd, async ({ ack, respond }) => {
        await ack()

        const meta = global.botMeta

        const uptime = formatUptime(Date.now() - meta.startedAt)
        const memory = (meta.memory() / 1024 / 1024).toFixed(1)

        await respond(
            `
            🤖 Slackzilla status

            version: ${meta.version}
            node: ${meta.nodeVersion}
            platform: ${meta.platform}

            uptime: ${uptime}
            memory: ${memory}mb

            started: ${new Date(meta.startedAt).toLocaleString()}`
        )
    })
}