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
            context.sendError(res, 404, "FEEDBACK_NOT_FOUND", "Feedback not found")
            return true
        }

        context.sendOk(res, { feedback })
        return true
    }

    if (req.method !== "POST") {
        context.sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed")
        return true
    }

    return context.parseBody(req)
        .then(async body => {
            req.body = body

            if (!context.auth.verifyCsrf(req, session)) {
                context.sendError(res, 403, "CSRF_INVALID", "invalid csrf token")
                return true
            }

            const action = String(body.action || body.status || "").toLowerCase()
            const feedback = context.store.listFeedback({ status: "all" }).find(item => item.id === id)

            if (!feedback) {
                context.sendError(res, 404, "FEEDBACK_NOT_FOUND", "Feedback not found")
                return true
            }

            if (action === "delete") {
                if (body.confirmed !== true) {
                    context.sendError(res, 409, "CONFIRMATION_REQUIRED", "confirmation required before deleting feedback")
                    return true
                }

                const ok = context.store.deleteFeedback(id)
                if (ok) {
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                    context.sendOk(res, { deleted: true })
                } else {
                    context.sendError(res, 404, "FEEDBACK_NOT_FOUND", "Feedback not found")
                }
                return true
            }

            if (action === "read" || action === "unread") {
                const updated = context.store.updateFeedback(id, {
                    status: action === "read" ? "read" : "unread",
                    responseError: null
                })

                if (!updated) {
                    context.sendError(res, 404, "FEEDBACK_NOT_FOUND", "Feedback not found")
                    return true
                }

                context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                context.sendOk(res, { feedback: updated })
                return true
            }

            if (action === "respond") {
                const responseText = String(body.response || body.message || "").trim()

                if (!responseText) {
                    context.sendError(res, 400, "RESPONSE_REQUIRED", "Response text is required")
                    return true
                }

                if (responseText.length > 4000) {
                    context.sendError(res, 400, "RESPONSE_TOO_LONG", "Response is too long")
                    return true
                }

                if (!feedback.userId) {
                    const updated = context.store.updateFeedback(id, {
                        status: "read",
                        response: responseText,
                        responseError: "Missing Slack user ID for DM delivery"
                    })
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                    context.sendError(res, 409, "FEEDBACK_DM_MISSING_USER", "Feedback cannot be sent because the Slack user ID is missing", {
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

                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
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

                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                    context.sendError(res, 502, "FEEDBACK_DM_FAILED", "Failed to send Slack DM", {
                        data: { feedback: updated }
                    })
                    return true
                }
            }

            context.sendError(res, 400, "INVALID_FEEDBACK_ACTION", "invalid feedback action")
            return true
        })
        .catch(error => {
            context.sendError(res, 400, "BAD_REQUEST", error.message)
            return true
        })
}

module.exports = {
    handleFeedbackApi
}
