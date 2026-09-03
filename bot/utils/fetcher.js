const { log, red } = require("./logger")

async function fetchWithTimeout(url, timeout = 5000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    try {
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(id)

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
        }

        return res
    } catch (err) {
        clearTimeout(id)
        log.error("fetcher failed: {0}", red(err.message))
        throw err
    }
}

module.exports = { fetchWithTimeout }