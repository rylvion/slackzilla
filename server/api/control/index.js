function handleControlApi({ req, res, url, context }) {
    if (url.pathname !== "/api/admin/control" || req.method !== "POST") {
        return false
    }

    const session = context.auth.requireSession(req, res)
    if (!session) return true

    return (req.body !== undefined ? Promise.resolve(req.body) : context.parseBody(req))
        .then(async body => {
            req.body = body

            if (!context.auth.verifyCsrf(req, session)) {
                context.sendError(res, 403, "CSRF_INVALID", "The CSRF token is missing, invalid, or expired. Refresh the session and include a valid CSRF token in the request.")
                return true
            }

            const action = String(body.action || "").toLowerCase()
            const dangerousActions = [
                "start", "stop", "restart", "redeploy", "delete-log", "delete-lines",
                "delete-last", "delete-line", "reset-telemetry", "rotate-logs", "restore-log", "delete-log-archive",
                "delete-event", "delete-error", "delete-event-group", "delete-error-group",
                "delete-events", "delete-errors", "logout"
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
                if (action === "logout") {
                    context.auth.logout(req, res)
                    context.sendOk(res, { action, authenticated: false })
                    return true
                }

                if (["delete-event", "delete-error", "delete-event-group", "delete-error-group", "delete-events", "delete-errors"].includes(action)) {
                    const id = typeof body.id === "string" ? body.id.trim() : ""
                    const ids = Array.isArray(body.ids) ? body.ids : []
                    const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
                    const groupId = typeof body.groupId === "string" ? body.groupId.trim() : ""
                    const isGroupAction = action.endsWith("-group")
                    const isBulkAction = action === "delete-events" || action === "delete-errors"
                    if ((!isGroupAction && !isBulkAction && !uuid(id)) || (isBulkAction && (!ids.length || ids.some(item => !uuid(item)))) || (isGroupAction && !/^(event|error)-[0-9a-f]{64}$/.test(groupId))) {
                        context.sendError(res, 400, "INVALID_IDENTIFIER", "A valid event or error id is required.")
                        return true
                    }
                    const result = action === "delete-event"
                        ? { deleted: context.store.deleteServerEvent(id) ? 1 : 0 }
                        : action === "delete-error"
                            ? { deleted: context.store.deleteServerError(id) ? 1 : 0 }
                            : action === "delete-event-group"
                                ? context.store.deleteServerEventGroup(groupId)
                                : action === "delete-error-group"
                                    ? context.store.deleteServerErrorGroup(groupId)
                                    : action === "delete-events"
                                        ? context.store.deleteServerEvents(ids)
                                        : context.store.deleteServerErrors(ids)
                    if (!result.deleted) {
                        context.sendError(res, 404, "NOT_FOUND", `The ${action === "delete-event" ? "event" : "error"} could not be found.`)
                        return true
                    }
                    context.sendOk(res, { action, deleted: result.deleted })
                    return true
                }

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
                    const queuedState = context.saveDeploymentState({
                        status: "queued",
                        lastDeploymentResult: "queued",
                        bannerStatus: "updating",
                        bannerVersion: null,
                        bannerVisibleUntil: null
                    })

                    context.scheduleDeploymentBannerExpiry()
                    context.refreshAndBroadcastStatus()
                    context.broadcast(context.adminClients, "deploy", queuedState)

                    try {
                        const result = await context.runDeployScript(context.deployScript, process.env, chunk => context.store.appendLogChunk(chunk))

                        const state = context.saveDeploymentState({
                            status: "success",
                            lastDeploymentAt: new Date().toISOString(),
                            lastDeploymentCommit: context.store.readDeploymentState().lastDeploymentCommit,
                            lastDeploymentOutput: result.output.split(/\r?\n/).filter(Boolean),
                            lastDeploymentResult: "success",
                            bannerStatus: "success",
                            bannerVersion: context.currentVersion,
                            bannerVisibleUntil: new Date(Date.now() + 30000).toISOString()
                        })

                        context.scheduleDeploymentBannerExpiry()
                        context.refreshAndBroadcastStatus()
                        context.broadcast(context.adminClients, "deploy", state)
                        context.broadcast(context.adminClients, "summary", context.buildAdminSummary())
                        context.sendOk(res, { state })
                        return true

                    } catch (error) {
                        const state = context.saveDeploymentState({
                            status: "failed",
                            lastDeploymentAt: new Date().toISOString(),
                            lastDeploymentOutput: error.output
                                ? error.output.split(/\r?\n/).filter(Boolean)
                                : [error.message],
                            lastDeploymentResult: "failed",
                            bannerStatus: "failed",
                            bannerVersion: null,
                            bannerError: error.stack || error.output?.trim() || error.message,
                            bannerVisibleUntil: new Date(Date.now() + 30000).toISOString()
                        })

                        context.scheduleDeploymentBannerExpiry()
                        context.refreshAndBroadcastStatus()
                        context.broadcast(context.adminClients, "deploy", state)
                        context.broadcast(context.adminClients, "summary", context.buildAdminSummary())

                        res.writeHead(500, { "Content-Type": "application/json" })
                        res.end(JSON.stringify({ error: error.message, state }))

                        return true
                    }
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
