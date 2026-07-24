const { log } = require("../utils/logger")
const cmds = require("../data/commands.json")

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const groups = {}

        Object.values(cmds).forEach(cmd => {
            const category = cmd.category || "other"

            if (!groups[category]) {
                groups[category] = []
            }

            groups[category].push(cmd)
        })

        const categoryNames = {
            core: "⚙️ core",
            utility: "🛠️ utility",
            entertainment: "🎉 entertainment",
            other: "📦 other"
        }

        let msg = "yo chat, here's everything i can do:\n"

        for (const [category, list] of Object.entries(groups)) {
            const count = list.length
            msg += `\n${categoryNames[category] || category} (${count} cmds)\n`

            list.forEach(cmd => {
                msg += `* ${cmd.cmd} - ${cmd.description}\n`
            })
        }

        msg += "\ntry one, worst case an inf while loop happens and ill explode or smth idk"

        log.info("{user} used {cmd}", command)
        log.success("{user} viewed command list", command)

        await respond(msg)
    })
}