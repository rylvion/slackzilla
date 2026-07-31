const fs = require("fs")
const path = require("path")

const colours = {
    reset: "\x1b[0m",
    grey: "\x1b[90m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
}

const logFilePath = process.env.SLACKZILLA_LOG_FILE || path.join(process.cwd(), "server", "logs", "slackzilla.log")

function appendToLogFile(line) {
    try {
        fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
        fs.appendFileSync(logFilePath, `${line}\n`)
    } catch {
        // keep console logging working even if file logging fails
    }
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
const grey = t => wrap(String(t), "grey")


function parseInfo(message, command=null, args = [], levelColour = "") {
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
    const line = render("reset", message, command, args)
    console.log(line)
    appendToLogFile(line)
}

function logSuccess(message, command, ...args) {
    const line = render("green", message, command, args)
    console.log(line)
    appendToLogFile(line)
}

function logError(message, command, ...args) {
    const line = render("red", message, command, args)
    console.log(line)
    appendToLogFile(line)
}

function logStart() {
    const lines = [
        "",
        "",
        cyan(" ███████╗██╗      █████╗  ██████╗██╗  ██╗███████╗██╗██╗     ██╗      █████╗ "),
        cyan(" ██╔════╝██║     ██╔══██╗██╔════╝██║ ██╔╝╚══███╔╝██║██║     ██║     ██╔══██╗"),
        cyan(" ███████╗██║     ███████║██║     █████╔╝   ███╔╝ ██║██║     ██║     ███████║"),
        cyan(" ╚════██║██║     ██╔══██║██║     ██╔═██╗  ███╔╝  ██║██║     ██║     ██╔══██║"),
        cyan(" ███████║███████╗██║  ██║╚██████╗██║  ██╗███████╗██║███████╗███████╗██║  ██║"),
        cyan(" ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝"),
        "",
        grey("=".repeat(80)),
        `${cyan(" Started ")}${grey(":")} ${colours.reset}${getTime()}`,
        `${cyan(" Version ")}${grey(":")} ${colours.reset}${require("../../package.json").version}`,
        `${cyan(" Node    ")}${grey(":")} ${colours.reset}${process.version}`,
        `${cyan(" PID     ")}${grey(":")} ${colours.reset}${process.pid}`,
        `${cyan(" Platform")}${grey(":")} ${colours.reset}${process.platform} ${process.arch}`,
        `${cyan(" Host    ")}${grey(":")} ${colours.reset}${require("os").hostname()}`,
        grey("=".repeat(80)),
        ""
    ]

    const output = lines.join("\n")

    console.log(output)
    appendToLogFile(output)
}

const log = {
    info: logInfo,
    success: logSuccess,
    error: logError,
    start: logStart,
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
    cyan,
    grey
}
