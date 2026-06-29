// from https://jokeapi.dev/

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond }) => {
        await ack()

        try {
            const res = await fetch("https://v2.jokeapi.dev/joke/Any")

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }

            const data = await res.json()

            if (data.error) {
                throw new Error("API returned error: ", data)
            }

            let joke

            if (data.type === "single") {
                joke = data.joke
            } else {
                joke = `${data.setup}\n\n${data.delivery}`
            }

            await respond(`😂 ${joke}`)

        } catch (err) {
            console.error("joke error:", err)

            await respond("❌ couldn't fetch a joke right now... the humour engine broke")
        }
    })
}