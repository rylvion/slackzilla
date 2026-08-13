function handleControlApi({ req, res, url, context }) {
    if (url.pathname !== "/api/admin/control" || req.method !== "POST") {
        return false
    }

    const session = context.auth.requireSession(req, res)
    if (!session) return true

    return context.parseBody(req)
        .then(async body => {
            req.body = body

            if (!context.auth.verifyCsrf(req, session)) {
                context.sendError(res, 403, "CSRF_INVALID", "invalid csrf token")
                return true
            }

            const action = String(body.action || "").toLowerCase()

            try {
                if (action === "redeploy") {
                    const result = await context.runDeployScript(context.deployScript, process.env, chunk => {
                        context.store.appendLogChunk(chunk)
                    })

                    const state = context.saveDeploymentState({
                        status: "success",
                        lastDeploymentAt: new Date().toISOString(),
                        lastDeploymentCommit: context.store.readDeploymentState().lastDeploymentCommit,
                        lastDeploymentOutput: result.output.split(/\r?\n/).filter(Boolean),
                        lastDeploymentResult: "success"
                    })

                    context.refreshAndBroadcastStatus()
                    context.broadcast(context.adminClients, "deploy", state)
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                    context.sendOk(res, { state })
                    return true
                }

                if (["start", "stop", "restart"].includes(action)) {
                    await context.runSystemctl(action, context.runtimeConfig.botServiceName)
                    context.refreshAndBroadcastStatus()
                    context.sendOk(res, { action })
                    return true
                }

                if (action === "refresh") {
                    const status = context.refreshAndBroadcastStatus()
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                    context.sendOk(res, { status })
                    return true
                }

                if (action === "refresh-status") {
                    const status = context.refreshAndBroadcastStatus()
                    context.sendOk(res, { status })
                    return true
                }

                if (action === "refresh-logs") {
                    const snapshot = context.refreshAndBroadcastLogs()
                    context.sendOk(res, {
                        size: snapshot.size
                    })
                    return true
                }

                context.sendError(res, 400, "UNKNOWN_CONTROL_ACTION", "unknown control action")
                return true
            } catch (error) {
                const state = context.saveDeploymentState({
                    status: "failed",
                    lastDeploymentAt: new Date().toISOString(),
                    lastDeploymentOutput: [error.message],
                    lastDeploymentResult: "failed"
                })

                context.refreshAndBroadcastStatus()
                context.broadcast(context.adminClients, "deploy", state)
                context.broadcast(context.adminClients, "summary", context.buildAdminSummary(session.csrfToken))
                context.sendError(res, 500, "CONTROL_ACTION_FAILED", error.message)
                return true
            }
        })
        .catch(error => {
            context.sendError(res, 400, "BAD_REQUEST", error.message)
            return true
        })
}

module.exports = {
    handleControlApi
}
