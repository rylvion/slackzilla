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
        const question = command.text?.trim()

        if (question?.toLowerCase() === "help") {
            log.success("{user} viewed {cmd} help", command)

            await respond(
                "🎱 *8ball command help*\n" +
                "> Ask a yes or no question and I'll tell you the answer.\n" +
                "> Example: `Will it rain tomorrow?`",
                "> IT must end with a question mark `?`",
                "",
                "A list of possible answers:\n" +
                answers.map((answer, index) => `${index + 1}. ${answer}`).join("\n")
            )
            return
        }

        if (!question ) {
            log.error("{user} used {cmd} with no question", command)
            await respond("❌ ask a question")
            return
        }

        const answer = answers[Math.floor(Math.random() * answers.length)]

        log.success("{user} used {cmd} to ask the 8ball and it sadly responded with: {0}", command, answer)
        await respond(answer)
    })
}