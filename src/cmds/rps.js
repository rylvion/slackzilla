const { log } = require("../utils/logger")

const choices = {
    rock: "rock",
    1: "rock",
    paper: "paper",
    2: "paper",
    scissors: "scissors",
    3: "scissors"
}

const icons = {
    rock: "🪨",
    paper: "📄",
    scissors: "✂️"
}

const outcomes = {
    rock: { rock: "tie", paper: "lose", scissors: "win" },
    paper: { rock: "win", paper: "tie", scissors: "lose" },
    scissors: { rock: "lose", paper: "win", scissors: "tie" }
}

function pickBotChoice() {
    const list = ["rock", "paper", "scissors"]
    return list[Math.floor(Math.random() * list.length)]
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        const input = command.text?.trim().toLowerCase()
        const playerChoice = choices[input]

        if (!playerChoice) {
            log.error("{user} used {cmd} with invalid input: {0}", command, input || "<empty>")

            await respond("❌ pick rock, paper, or scissors")
            return
        }

        const botChoice = pickBotChoice()
        const result = outcomes[playerChoice][botChoice]

        log.success("{user} played rps via {cmd}: {0} vs {1}", command, playerChoice, botChoice)

        await respond(`🪨📄✂️ you picked *${playerChoice}* ${icons[playerChoice]}
i picked *${botChoice}* ${icons[botChoice]}
result: *${result}*`)
    })
}