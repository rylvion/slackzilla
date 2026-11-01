const path = require('path')
const fs = require('fs')
const { log } = require('./logger')

const cmds = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'commands.json'), 'utf8')
)

function loadCommand(app, name) {
    const meta = cmds[name]

    if (!meta) {
        log.error(`Unknown command: ${name}`)
        return
    }

    const filePath = path.join(__dirname, '..', 'cmds', meta.file)

    if (!fs.existsSync(filePath)) {
        log.error(`Missing file for command ${name}: ${meta.file}`)
        return
    }

    const register = require(filePath)

    if (typeof register !== 'function') {
        log.error(`Invalid command module: ${meta.file}`)
        return
    }

    register(app, meta)
}

module.exports = loadCommand