const hugArt = `
\`\`\`
             ___                   ____                  ___
        ____(   \\              .-'    \`-.              /   )____
        (____     \\_____       /  (O  O)  \\       _____/     ____)
        (____            \`-----(      )     )-----'            ____)
        (____     _____________\\  .____.  /_____________     ____)
        (______/                \`-.____.-'              \\______)
\`\`\`
`

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const userId = command.user_id

        await respond(
            `${hugArt}
            <@${userId}> gets a giant Slackzilla hug! 🤗`
        )
    })
}