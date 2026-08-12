function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
    res.statusCode = statusCode
    res.setHeader("Content-Type", contentType)
    res.end(text)
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(payload, null, 2))
}

function sendHtml(res, statusCode, html) {
    res.statusCode = statusCode
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.end(html)
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0

        req.on("data", chunk => {
            size += chunk.length
            if (size > 1024 * 1024) {
                reject(new Error("payload too large"))
                req.destroy()
                return
            }

            chunks.push(chunk)
        })

        req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8")
            const contentType = req.headers["content-type"] || ""

            if (contentType.includes("application/json")) {
                try {
                    resolve(raw ? JSON.parse(raw) : {})
                } catch (err) {
                    reject(err)
                }
                return
            }

            const form = new URLSearchParams(raw)
            resolve(Object.fromEntries(form.entries()))
        })

        req.on("error", reject)
    })
}

function sendOk(res, data = {}, statusCode = 200) {
    sendJson(res, statusCode, {
        ok: true,
        ...data
    })
}

function sendError(res, statusCode, code, error, details = {}) {
    sendJson(res, statusCode, {
        ok: false,
        code,
        error,
        ...details
    })
}

module.exports = {
    sendText,
    sendJson,
    sendHtml,
    parseBody,
    sendOk,
    sendError
}
