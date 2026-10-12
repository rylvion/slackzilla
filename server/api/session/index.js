function handleSessionApi({ req, res, context }) {
    if (req.method !== "GET") return false

    const session = context.auth.getSessionFromRequest(req)

    if (!session) {
        context.sendOk(res, {
            authenticated: false,
            csrfToken: null,
            session: null
        })
        return true
    }

    context.sendOk(res, {
        authenticated: true,
        csrfToken: session.csrfToken,
        session: {
            createdAt: session.createdAt,
            expiresAt: new Date(session.expiresAt).toISOString(),
            lastActivityAt: session.lastActivityAt,
            client: {
                ip: session.ip,
                userAgent: session.userAgent
            }
        }
    })
    return true
}

module.exports = {
    handleSessionApi
}
