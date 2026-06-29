module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond }) => {
        await ack()

        try {
            const res = await fetch("https://zenquotes.io/api/random")

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }

            const data = await res.json()

            await respond(
            `💬 "${data[0].q}" ||| ${data[0].a}"`
            )

        } catch (err) {
            console.error("quote error:", err)

            await respond("❌ couldn't fetch a quote right now... wisdom is temporarily offline")
        }
    })
}