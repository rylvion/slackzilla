async function slackApi(method, payload = {}) {
    const token = process.env.SLACK_BOT_TOKEN

    if (!token) {
        throw new Error("missing SLACK_BOT_TOKEN")
    }

    const response = await fetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(payload)
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.ok) {
        const message = data.error || `${method} request failed`
        throw new Error(message)
    }

    return data
}

async function sendFeedbackResponse({
    userId,
    feedbackId,
    submittedAt,
    feedbackText,
    responseText
}) {
    if (!userId) {
        throw new Error("missing slack user id")
    }

    const dm = await slackApi("conversations.open", {
        users: userId
    })

    const message = [
        `Feedback ID: ${feedbackId}`,
        `Time Submitted: ${submittedAt}`,
        "",
        "Feedback:",
        feedbackText,
        "",
        "Response:",
        responseText
    ].join("\n")

    await slackApi("chat.postMessage", {
        channel: dm.channel?.id,
        text: message
    })

    return {
        channelId: dm.channel?.id || null
    }
}

module.exports = {
    slackApi,
    sendFeedbackResponse
}
