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
                context.sendError(res, 403, "CSRF_INVALID", "The CSRF token is missing, invalid, or expired. Refresh the session and include a valid CSRF token in the request.")
                return true
            }

            const action = String(body.action || "").toLowerCase()
            const dangerousActions = [
                "start", "stop", "restart", "redeploy", "delete-log", "delete-lines",
                "delete-last", "delete-line", "reset-telemetry", "rotate-logs", "restore-log", "delete-log-archive"
            ]

            if (dangerousActions.includes(action) && body.confirmed !== true) {
                context.sendError(res, 409, "CONFIRMATION_REQUIRED", "This action requires explicit confirmation. Set 'confirmed' to true in the request body to proceed.")
                return true
            }

            if (["delete-lines", "delete-line", "delete-last"].includes(action)) {
                const values = action === "delete-lines" ? [body.start, body.end] : [action === "delete-line" ? body.line : body.count]
                if (!values.every(value => Number.isInteger(Number(value)) && Number(value) > 0)) {
                    context.sendError(res, 400, "INVALID_LOG_RANGE", "Invalid log range. Line numbers and deletion counts must be positive integers. Provide valid 'start' and 'end' values for delete-lines, a 'line' value for delete-line, or a 'count' value for delete-last.")
                    return true
                }
            }

            try {
                if (action === "delete-log") {
                    context.store.deleteLogFile()
                    context.refreshAndBroadcastLogs()
                    context.sendOk(res, { action, message: "log file cleared" })
                    return true
                }

                if (action === "delete-lines") {
                    const snapshot = context.store.deleteLogLines(body.start, body.end)
                    context.refreshAndBroadcastLogs()
                    context.sendOk(res, { action, size: snapshot.size })
                    return true
                }

                if (action === "delete-last") {
                    const snapshot = context.store.deleteLastLogLines(body.count || 100)
                    context.refreshAndBroadcastLogs()
                    context.sendOk(res, { action, size: snapshot.size })
                    return true
                }

                if (action === "delete-line") {
                    const line = Number(body.line)
                    const snapshot = context.store.deleteLogLines(line, line)
                    context.refreshAndBroadcastLogs()
                    context.sendOk(res, { action, size: snapshot.size })
                    return true
                }

                if (action === "rotate-logs") {
                    const archive = context.store.rotateLog()
                    context.refreshAndBroadcastLogs()
                    context.sendOk(res, { action, archive })
                    return true
                }

                if (action === "restore-log") {
                    const snapshot = context.store.restoreLogArchive(body.archive, body.saveCurrent === true)

                    context.refreshAndBroadcastLogs()
                    context.sendOk(res, { action, size: snapshot.size })
                    return true
                }

                if (action === "delete-log-archive") {
                    context.store.deleteLogArchive(body.archive)
                    context.sendOk(res, { action, archive: body.archive })
                    return true
                }

                if (action === "reset-telemetry") {
                    context.resetTelemetry()
                    context.refreshAndBroadcastStatus()
                    context.sendOk(res, { action })
                    return true
                }

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
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
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
                    context.refreshAndBroadcastStatus()
                    context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                    context.sendOk(res, { status: context.renderStatusSummary() })
                    return true
                }

                if (action === "refresh-status") {
                    context.refreshAndBroadcastStatus()
                    context.sendOk(res, { status: context.renderStatusSummary() })
                    return true
                }

                if (action === "refresh-logs") {
                    const snapshot = context.refreshAndBroadcastLogs()
                    context.sendOk(res, {
                        size: snapshot.size
                    })
                    return true
                }

                context.sendError(res, 400, "UNKNOWN_CONTROL_ACTION", `Unknown control action '${action}'. Provide a supported action, view docs/post/admin-control.md to see a list of supoprted actions.`)
                return true
            } catch (error) {
                context.recordServerError(error, `admin-control:${action}`)
                const state = context.saveDeploymentState({
                    status: "failed",
                    lastDeploymentAt: new Date().toISOString(),
                    lastDeploymentOutput: [error.message],
                    lastDeploymentResult: "failed"
                })

                context.refreshAndBroadcastStatus()
                context.broadcast(context.adminClients, "deploy", state)
                context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                context.sendError(res, 500, "CONTROL_ACTION_FAILED", `The '${action}' control action failed due to an internal server error:\n ${error.message}`)
                return true
            }
        })
        .catch(error => {
            context.sendError(res, 400, "BAD_REQUEST", `The request could not be processed. ${error.message}`)
            return true
        })
}

module.exports = {
    handleControlApi
}
