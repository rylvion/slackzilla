const { getBotState } = require("../../server/database/store")
const { log } = require("../utils/logger.js")
const { getTotal, getCategoryCounts, getTotalCategoryCount } = require("../../scripts/stats.js")

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

        const botState = getBotState()

        if (!botState.startedAt) {
            log.error("{user} used {cmd} but bot state is not available, curr state: {0} ", command, botState)
            await respond("bot state is not available. Please check the bot logs for errors and report them using the `/sz-feedback` command.")
            return
        }

        const uptime = formatUptime(Date.now() - new Date(botState.startedAt).getTime())
        const memory = (botState.memory / 1024 / 1024).toFixed(1)


        await respond(
            `
🤖 Slackzilla status

**version:** ${botState.version}
**node:** ${botState.nodeVersion}
**platform:** ${botState.platform}

**uptime:** ${uptime}
**memory:** ${memory}mb

**started:** ${new Date(botState.startedAt).toLocaleString()}

**commands:** ${getTotal()} total (${getTotalCategoryCount()} categories, avg ${(getTotal() / getTotalCategoryCount()).toFixed(1)} cmds per category)
**categories:** ${Object.entries(getCategoryCounts()).map(([cat, count]) => `${cat}: ${count}`).join(", ")}
**hosted on:** ${process.platform == "win32" ? "http://localhost:9000 (could be a different port)": "https://rylvion.hackclub.app/"}
`
        )

        log.success("{user} used {cmd} to check bot status (uptime: {0}, memory: {1}MB)", command, uptime, memory)
    })
}