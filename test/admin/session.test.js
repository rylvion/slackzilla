const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")

const { createAuth } = require("../../server/lib/auth")
const { handleSessionApi } = require("../../server/api/session")

function request(cookie = "", headers = {}) {
    return {
        method: "GET",
        headers: { cookie, ...headers },
        socket: { remoteAddress: "127.0.0.1" }
    }
}

function sessionResponse(auth, req) {
    let data
    const res = {}

    handleSessionApi({
        req,
        res,
        context: {
            auth,
            sendOk: (_res, payload) => { data = payload }
        }
    })

    return data
}

function authWithSession(sessionTtlMs = 60_000) {
    const salt = "test-salt"
    const iterations = 1
    const algorithm = "sha512"
    const hash = crypto.pbkdf2Sync("password", salt, iterations, 64, algorithm).toString("hex")
    const auth = createAuth({
        passwordHash: `pbkdf2$${algorithm}$${iterations}$${salt}$${hash}`,
        sessionSecret: "session-secret",
        sessionTtlMs
    })
    const challengeResponse = {
        headers: {},
        setHeader(name, value) { this.headers[name] = value },
        getHeader(name) { return this.headers[name] }
    }
    const challenge = auth.issueLoginChallenge(request(), challengeResponse)
    const loginRequest = request(challengeResponse.headers["Set-Cookie"][0], { "user-agent": "test-agent" })
    loginRequest.body = { csrf: challenge }
    const loginResponse = {
        headers: {},
        setHeader(name, value) { this.headers[name] = value },
        getHeader(name) { return this.headers[name] }
    }
    const result = auth.login(loginRequest, loginResponse, "password")
    const cookie = loginResponse.headers["Set-Cookie"].find(value => value.startsWith("slackzilla_admin_session="))
        .split(";")[0]

    return { auth, cookie, result }
}

test("returns safe authenticated session metadata and the existing CSRF token", () => {
    const { auth, cookie, result } = authWithSession()
    const response = sessionResponse(auth, request(cookie, { "user-agent": "test-agent" }))

    assert.equal(response.ok, undefined)
    assert.equal(response.authenticated, true)
    assert.equal(response.csrfToken, result.session.csrfToken)
    assert.equal(response.session.client.ip, "127.0.0.1")
    assert.equal(response.session.client.userAgent, "test-agent")
    assert.equal(response.session.createdAt, result.session.createdAt)
    assert.equal(response.session.expiresAt, new Date(result.session.expiresAt).toISOString())
    assert.equal("sessionId" in response.session, false)
    assert.equal(auth.verifyCsrf(request(cookie, { "x-csrf-token": result.session.csrfToken }), result.session), true)
    assert.equal(auth.verifyCsrf(request(cookie, { "x-csrf-token": "wrong" }), result.session), false)
})

test("returns an unauthenticated response for missing and invalid sessions", () => {
    const { auth, cookie } = authWithSession()
    const missing = sessionResponse(auth, request())
    const invalid = sessionResponse(auth, request(`${cookie}tampered`))

    for (const response of [missing, invalid]) {
        assert.deepEqual(response, { authenticated: false, csrfToken: null, session: null })
    }
})

test("returns an unauthenticated response for an expired session", async () => {
    const { auth, cookie } = authWithSession(1)
    await new Promise(resolve => setTimeout(resolve, 5))

    assert.deepEqual(sessionResponse(auth, request(cookie)), {
        authenticated: false,
        csrfToken: null,
        session: null
    })
})

test("returns an unauthenticated response after logout invalidates the session", () => {
    const { auth, cookie } = authWithSession()
    const response = {
        headers: {},
        setHeader(name, value) { this.headers[name] = value },
        getHeader(name) { return this.headers[name] }
    }

    auth.logout(request(cookie), response)

    assert.deepEqual(sessionResponse(auth, request(cookie)), {
        authenticated: false,
        csrfToken: null,
        session: null
    })
})
