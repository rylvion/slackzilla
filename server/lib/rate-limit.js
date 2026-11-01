
function createRateLimiter({ windowMs, maxRequests, cooldownMs }) {
    const clients = new Map()
    let checks = 0

    function check(key) {
        const now = Date.now()
        let state = clients.get(key)

        if (!state) {
            state = { requests: [], lastAcceptedAt: 0 }
            clients.set(key, state)
        }

        state.requests = state.requests.filter(timestamp => timestamp > now - windowMs)
        const cooldownRemaining = state.lastAcceptedAt? cooldownMs - (now - state.lastAcceptedAt) : 0

        if (cooldownRemaining > 0) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(cooldownRemaining / 1000)) }

        if (state.requests.length >= maxRequests) {
            const retryAfterMs = state.requests[0] + windowMs - now

            return {
                allowed: false,
                retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
            }
        }

        state.requests.push(now)
        state.lastAcceptedAt = now

        checks++

        if (checks >= 100) {
            checks = 0

            for (const [clientKey, client] of clients) {
                client.requests = client.requests.filter(timestamp => timestamp > now - windowMs)

                if (!client.requests.length && now - client.lastAcceptedAt >= Math.max(windowMs, cooldownMs)) {
                    clients.delete(clientKey)
                }
            }
        }

        return { allowed: true, retryAfterSeconds: 0 }
    }

    return { check }
}

module.exports = { createRateLimiter }
