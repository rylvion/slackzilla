const staticMeta = require("../../bot/meta")

let botMeta = null

function initialiseBotMeta() {
    botMeta = {
        ...staticMeta,
        startedAt: Date.now(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: () => process.memoryUsage().rss,
        scopes: [...staticMeta.oauthScopes]
    }

    return botMeta
}

function getBotMeta() {
    return botMeta
}

module.exports = {
    initialiseBotMeta,
    getBotMeta
}