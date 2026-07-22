const { log } = require("../utils/logger")

const answers = [
    "it is certain",
    "it is decidedly so",
    "without a doubt",
    "yes definitely",
    "you may rely on it",
    "as i see it, yes",
    "most likely",
    "outlook good",
    "yes",
    "signs point to yes",
    "reply hazy, try again",
    "ask again later",
    "better not tell you now",
    "cannot predict now",
    "concentrate and ask again",
    "don't count on it",
    "my reply is no",
    "my sources say no",
    "outlook not so good",
    "very doubtful"
]

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        const question = command.text?.trim()

        if (!question) {
            log.error("{user} used {cmd} with no question", command)

            await respond("❌ ask the 8ball a question first")
            return
        }

        const answer = answers[Math.floor(Math.random() * answers.length)]

        log.success("{user} asked the 8ball via {cmd}", command)

        await respond(`🎱 *question:* ${question}
*answer:* ${answer}`)
    })
}