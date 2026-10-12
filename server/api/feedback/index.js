const { sendFeedbackResponse } = require("../../lib/slack")

function handleFeedbackApi({ req, res, url, context }) {
    if (url.pathname === "/api/admin/feedback" && req.method === "GET") {
        const session = context.auth.requireSession(req, res)
        if (!session) return true

        const feedback = context.store.listFeedback({
            query: url.searchParams.get("q") || "",
            status: url.searchParams.get("status") || "all"
        })

        context.sendOk(res, { feedback })
        return true
    }

    if (!url.pathname.startsWith("/api/admin/feedback/")) {
        return false
    }

    const session = context.auth.requireSession(req, res)
    if (!session) return true

    const id = url.pathname.split("/").pop()

    if (req.method === "GET") {
        const feedback = context.store.listFeedback({ status: "all" }).find(item => item.id === id)

        if (!feedback) {
            context.sendError(res, 404, "FEEDBACK_NOT_FOUND", `Feedback with ID '${id}' not found. Check the feedback list to ensure it exists.`)
            return true
        }

        context.sendOk(res, { feedback })
        return true
    }

    if (req.method !== "POST") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", `Method '${req.method}' is not supported for this endpoint. Use POST to submit feedback actions.`)
        return true
    }

    return context.parseBody(req)
        .then(async body => {
            req.body = body

            if (!context.auth.verifyCsrf(req, session)) {
                context.sendError(res, 403, "CSRF_INVALID", "The CSRF token is missing, invalid, or expired. Refresh the session and include a valid CSRF token in the request.")
                return true
            }

            const action = String(body.action || body.status || "").toLowerCase()
            const feedback = context.store.listFeedback({ status: "all" }).find(item => item.id === id)

            if (!feedback) {
                context.sendError(res, 404, "FEEDBACK_NOT_FOUND", `Feedback with ID '${id}' not found. Check the feedback list to ensure it exists.`)
                return true
            }

            if (action === "delete") {
                if (body.confirmed !== true) {
                    context.sendError(res, 409, "CONFIRMATION_REQUIRED", "Deleting feedback requires explicit confirmation. Set 'confirmed' to true in the request body to proceed.")
                    return true
                }

                const ok = context.store.deleteFeedback(id)
                if (ok) {
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                    context.sendOk(res, { deleted: true })
                } else {
                    context.sendError(res, 404, "FEEDBACK_NOT_FOUND", `Feedback with ID '${id}' not found. Check the feedback list to ensure it exists.`)
                }
                return true
            }

            if (action === "read" || action === "unread") {
                const updated = context.store.updateFeedback(id, {
                    status: action === "read" ? "read" : "unread",
                    responseError: null
                })

                if (!updated) {
                    context.sendError(res, 404, "FEEDBACK_NOT_FOUND", `Feedback with ID '${id}' not found. Check the feedback list to ensure it exists.`)
                    return true
                }

                context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                context.sendOk(res, { feedback: updated })
                return true
            }

            if (action === "respond") {
                const responseText = String(body.response || body.message || "").trim()

                if (!responseText) {
                    context.sendError(res, 400, "RESPONSE_REQUIRED", "A response message is required. Provide a non-empty string using the 'response' or 'message' field.")
                    return true
                }

                if (responseText.length > 4000) {
                    context.sendError(res, 400, "RESPONSE_TOO_LONG", `Response exceeds the 4000-character limit. Received ${responseText.length} characters. Shorten the response and try again.`)
                    return true
                }

                if (!feedback.userId) {
                    const updated = context.store.updateFeedback(id, {
                        status: "read",
                        response: responseText,
                        responseError: "Missing Slack user ID for DM delivery"
                    })
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                    context.sendError(res, 409, "FEEDBACK_DM_MISSING_USER", "Unable to deliver the response via Slack DM because the feedback entry has no associated Slack user ID. The response has been saved, but no message was sent.", {
                        data: { feedback: updated }
                    })
                    return true
                }

                const prepared = context.store.updateFeedback(id, {
                    status: "read",
                    response: responseText,
                    responseError: null
                })

                try {
                    const delivery = await sendFeedbackResponse({
                        userId: feedback.userId,
                        feedbackId: feedback.id,
                        submittedAt: feedback.timestamp,
                        feedbackText: feedback.message,
                        responseText
                    })

                    const updated = context.store.updateFeedback(id, {
                        status: "responded",
                        response: responseText,
                        responseSentAt: new Date().toISOString(),
                        responseError: null
                    })

                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                    context.broadcast(context.adminClients, "feedback", { feedback: updated })
                    context.sendOk(res, {
                        feedback: updated,
                        delivery
                    })
                    return true
                } catch (error) {
                    const updated = context.store.updateFeedback(id, {
                        status: prepared.status || "read",
                        response: responseText,
                        responseError: error.message
                    })

                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                    context.sendError(res, 502, "FEEDBACK_DM_FAILED", `The feedback response was saved, but Slack failed to deliver the DM. Check the Slack API error and verify the bot's permissions and the recipient's availability.`, {
                        data: { feedback: updated }
                    })
                    return true
                }
            }

            context.sendError(res, 400, "INVALID_FEEDBACK_ACTION", `Unknown feedback action '${action}'. Supported actions are listed on \`docs/api.md\`.`)
            return true
        })
        .catch(error => {
            context.sendError(res, 400, "BAD_REQUEST", `The feedback request could not be processed. ${error.message}`)
            return true
        })
}

module.exports = {
    handleFeedbackApi
}
