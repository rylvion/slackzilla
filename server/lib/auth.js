const crypto = require("crypto")

function parseCookies(cookieHeader = "") {
    return cookieHeader.split(";").reduce((cookies, pair) => {
        const index = pair.indexOf("=")

        if (index === -1) {
            return cookies
        }

        const name = pair.slice(0, index).trim()
        const value = pair.slice(index + 1).trim()

        if (name) {
            cookies[name] = decodeURIComponent(value)
        }

        return cookies
    }, {})
}

function buildCookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`]

    if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`)
    if (options.path) parts.push(`Path=${options.path}`)
    if (options.httpOnly) parts.push("HttpOnly")
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
    if (options.secure) parts.push("Secure")

    return parts.join("; ")
}

function timingSafeEqual(a, b) {
    const left = Buffer.from(String(a))
    const right = Buffer.from(String(b))

    return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function createAuth(options) {
    const {
        passwordHash,
        sessionSecret,
        cookieSecure = false,
        sessionTtlMs = 1000 * 60 * 60 * 8,
        loginWindowMs = 1000 * 60 * 10,
        loginMaxAttempts = 5
    } = options

    const sessions = new Map()
    const loginChallenges = new Map()
    const loginAttempts = new Map()

    function isApiRequest(req) {
        try {
            const pathname = new URL(req.url, "http://localhost").pathname
            const accept = String(req.headers.accept || "")

            return pathname.startsWith("/api/") || accept.includes("text/event-stream") || accept.includes("application/json")
        } catch {
            return false
        }
    }

    function hashPassword(password, salt, iterations, algorithm) {
        return crypto.pbkdf2Sync(password, salt, Number(iterations), 64, algorithm || "sha512").toString("hex")
    }

    function verifyPassword(password) {
        if (!passwordHash) {
            return false
        }

        const parts = String(passwordHash).split("$")

        if (parts.length !== 5 || parts[0] !== "pbkdf2") {
            return false
        }

        const [, algorithm, iterations, salt, hash] = parts
        const candidate = hashPassword(password, salt, iterations, algorithm)

        return timingSafeEqual(candidate, hash)
    }

    function signSession(sessionId) {
        return crypto.createHmac("sha256", sessionSecret).update(sessionId).digest("hex")
    }

    function createSession(ip) {
        const sessionId = crypto.randomUUID()
        const csrfToken = crypto.randomBytes(32).toString("hex")
        const expiresAt = Date.now() + sessionTtlMs

        sessions.set(sessionId, {
            sessionId,
            csrfToken,
            ip,
            createdAt: new Date().toISOString(),
            expiresAt
        })

        return sessions.get(sessionId)
    }

    function getRequestIp(req) {
        return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim()
    }

    function getSessionFromRequest(req) {
        const cookies = parseCookies(req.headers.cookie || "")
        const value = cookies.slackzilla_admin_session

        if (!value) {
            return null
        }

        const [sessionId, signature] = value.split(".")

        if (!sessionId || !signature) {
            return null
        }

        if (!timingSafeEqual(signature, signSession(sessionId))) {
            return null
        }

        const session = sessions.get(sessionId)

        if (!session) {
            return null
        }

        if (session.expiresAt <= Date.now()) {
            sessions.delete(sessionId)
            return null
        }

        return session
    }

    function setCookie(res, name, value, options = {}) {
        const cookie = buildCookie(name, value, {
            path: "/",
            httpOnly: true,
            sameSite: "Strict",
            secure: cookieSecure,
            ...options
        })

        const current = res.getHeader("Set-Cookie")

        if (!current) {
            res.setHeader("Set-Cookie", [cookie])
            return
        }

        const cookies = Array.isArray(current) ? current.slice() : [current]
        cookies.push(cookie)
        res.setHeader("Set-Cookie", cookies)
    }

    function clearCookie(res, name) {
        setCookie(res, name, "", { maxAge: 0 })
    }

    function issueLoginChallenge(req, res) {
        const token = crypto.randomBytes(32).toString("hex")
        const ip = getRequestIp(req)

        loginChallenges.set(token, {
            ip,
            expiresAt: Date.now() + 1000 * 60 * 15
        })

        setCookie(res, "slackzilla_login_csrf", token, {
            httpOnly: true,
            sameSite: "Strict",
            secure: cookieSecure,
            maxAge: 15 * 60,
            path: "/admin/login"
        })

        return token
    }

    function verifyLoginChallenge(req) {
        const cookies = parseCookies(req.headers.cookie || "")
        const submitted = req.body?.csrf || req.body?.login_csrf || req.headers["x-csrf-token"]
        const token = submitted || cookies.slackzilla_login_csrf
        const challenge = token && loginChallenges.get(token)

        if (!challenge) {
            return false
        }

        if (challenge.expiresAt <= Date.now()) {
            loginChallenges.delete(token)
            return false
        }

        if (challenge.ip !== getRequestIp(req)) {
            return false
        }

        loginChallenges.delete(token)
        return true
    }

    function checkLoginRateLimit(req) {
        const key = getRequestIp(req)
        const now = Date.now()
        const state = loginAttempts.get(key) || { count: 0, resetAt: now + loginWindowMs, blockedUntil: 0 }

        if (state.resetAt <= now) {
            state.count = 0
            state.resetAt = now + loginWindowMs
            state.blockedUntil = 0
        }

        if (state.blockedUntil > now) {
            loginAttempts.set(key, state)
            return {
                ok: false,
                retryAfter: Math.ceil((state.blockedUntil - now) / 1000)
            }
        }

        loginAttempts.set(key, state)
        return { ok: true }
    }

    function recordFailedLogin(req) {
        const key = getRequestIp(req)
        const now = Date.now()
        const state = loginAttempts.get(key) || { count: 0, resetAt: now + loginWindowMs, blockedUntil: 0 }

        if (state.resetAt <= now) {
            state.count = 0
            state.resetAt = now + loginWindowMs
        }

        state.count += 1

        if (state.count >= loginMaxAttempts) {
            state.blockedUntil = now + loginWindowMs
            state.count = 0
        }

        loginAttempts.set(key, state)
    }

    function clearLoginAttempts(req) {
        loginAttempts.delete(getRequestIp(req))
    }

    function createSessionCookie(sessionId) {
        return `${sessionId}.${signSession(sessionId)}`
    }

    function login(req, res, password) {
        const rateLimit = checkLoginRateLimit(req)

        if (!rateLimit.ok) {
            return {
                ok: false,
                status: 429,
                message: "too many login attempts"
            }
        }

        if (!verifyLoginChallenge(req)) {
            return {
                ok: false,
                status: 403,
                message: "invalid csrf token"
            }
        }

        if (!verifyPassword(password)) {
            recordFailedLogin(req)
            return {
                ok: false,
                status: 401,
                message: "invalid credentials"
            }
        }

        clearLoginAttempts(req)

        const session = createSession(getRequestIp(req))
        setCookie(res, "slackzilla_admin_session", createSessionCookie(session.sessionId), {
            httpOnly: true,
            sameSite: "Strict",
            secure: cookieSecure,
            maxAge: Math.floor(sessionTtlMs / 1000),
            path: "/"
        })

        clearCookie(res, "slackzilla_login_csrf")

        return {
            ok: true,
            session
        }
    }

    function logout(req, res) {
        const session = getSessionFromRequest(req)

        if (session) {
            sessions.delete(session.sessionId)
        }

        clearCookie(res, "slackzilla_admin_session")
        return true
    }

    function requireSession(req, res) {
        const session = getSessionFromRequest(req)

        if (!session) {
            if (isApiRequest(req)) {
                res.statusCode = 401
                res.setHeader("Content-Type", "application/json; charset=utf-8")
                res.end(JSON.stringify({
                    ok: false,
                    code: "AUTH_REQUIRED",
                    error: "admin session required"
                }))
                return null
            }

            res.statusCode = 302
            res.setHeader("Location", "/admin/login")
            res.end()
            return null
        }

        return session
    }

    function verifyCsrf(req, session) {
        const token = req.body?.csrf || req.headers["x-csrf-token"]
        return Boolean(session && token && timingSafeEqual(token, session.csrfToken))
    }

    return {
        issueLoginChallenge,
        login,
        logout,
        requireSession,
        verifyCsrf,
        getSessionFromRequest,
        getRequestIp,
        setCookie,
        verifyPassword
    }
}

module.exports = {
    createAuth,
    parseCookies,
    buildCookie
}
