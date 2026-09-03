const store = require("../../server/database/store")

function recordCommandUsage(commandName, command) {
    store.recordCommandUsage(commandName, command)
}

function getCommandStats() {
    return store.getCommandStats()
}

module.exports = {
    recordCommandUsage,
    getCommandStats
}