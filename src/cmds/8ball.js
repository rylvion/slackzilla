const { log } = require("../utils/logger")

const answers = [
    "It is certain.",
    "It is decidedly so.",
    "Without a doubt.",
    "Yes definitely.",
    "You may rely on it.",
    "As I see it, yes.",
    "Most likely.",
    "Outlook good.",
    "Yes.",
    "Signs point to yes.",
    "Reply hazy, try again.",
    "Ask again later.",
    "Better not tell you now.",
    "Cannot predict now.",
    "Concentrate and ask again.",
    "Don't count on it.",
    "My reply is no.",
    "My sources say no.",
    "Outlook not so good.",
    "Very doubtful."
]

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        const question = command.text?.trim()

        if (!question || !question.endsWith("?")) {
            log.error("{user} used {cmd} with no question", command)

            await respond("❌ ask a yes or no question ending with `?`")
            return
        }

        const answer = answers[Math.floor(Math.random() * answers.length)]

        log.success("{user} asked the 8ball via {cmd}", command)

        await respond(answer)
    })
}