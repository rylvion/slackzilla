const colours = {
    reset: "\x1b[0m",
    grey: "\x1b[90m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
}

function getTime() {
    const d = new Date()
    const pad = (n, z = 2) => String(n).padStart(z, "0")
    return `[${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}]`
}

const prefix = () => `${colours.grey}${getTime()}${colours.reset} `

function wrap(text, colour) {
    return `${colours[colour]}${text}${colours.reset}`
}

const red = t => wrap(String(t), "red")
const green = t => wrap(String(t), "green")
const yellow = t => wrap(String(t), "yellow")
const cyan = t => wrap(String(t), "cyan")

function parseInfo(message, command, args = [], levelColour = "") {
    const level = colours[levelColour] || ""
    if (command) {
        const user = `${colours.cyan}${command.user_name}${level}${colours.grey} (${command.user_id})${level}`
        const cmd = `${colours.yellow}${command.command ?? command.cmd}${level}`
        message = message.replaceAll("{user}", user).replaceAll("{cmd}", cmd)
    }
    for (let i = 0; i < args.length; i++) {
        message = message.replaceAll(`{${i}}`, String(args[i]))
    }
    return message
}

function render(levelColour, message, command, args) {
    const level = colours[levelColour] || ""
    return `${prefix()}${level}${parseInfo(message, command, args, levelColour)}${colours.reset}`
}

function logInfo(message, command, ...args) {
    console.log(render("reset", message, command, args))
}

function logSuccess(message, command, ...args) {
    console.log(render("green", message, command, args))
}

function logError(message, command, ...args) {
    console.log(render("red", message, command, args))
}

const log = {
    info: logInfo,
    success: logSuccess,
    error: logError
}

module.exports = {
    colours,
    getTime,
    prefix,
    parseInfo,
    log,
    red,
    green,
    yellow,
    cyan
}
