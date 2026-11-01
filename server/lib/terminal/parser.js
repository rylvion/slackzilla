const MAX_INPUT_LENGTH = 4096
const MAX_COMMAND_LENGTH = 32
const MAX_ARGUMENTS = 8
const MAX_ARGUMENT_LENGTH = 2048

function createParserError(code, message) {
    const error = new Error(message)
    error.code = code
    error.statusCode = 400
    return error
}

function validateCommandName(value) {
    const name = String(value || "").trim().toLowerCase()

    if (!name) throw createParserError("COMMAND_REQUIRED", "command is required")
    if (name.length > MAX_COMMAND_LENGTH || !/^[a-z][a-z0-9-]*$/.test(name)) throw createParserError("COMMAND_INVALID", "command name is invalid")
    return name
}

function validateArguments(args) {
    if (!Array.isArray(args)) throw createParserError("ARGUMENTS_INVALID", "arguments must be an array")
    if (args.length > MAX_ARGUMENTS) throw createParserError("ARGUMENTS_TOO_MANY", "too many arguments")

    return args.map(argument => {
        if (typeof argument !== "string" || argument.length > MAX_ARGUMENT_LENGTH || /[\u0000-\u001f\u007f]/.test(argument)) {
            throw createParserError("ARGUMENT_INVALID", "argument is invalid")
        }
        return argument
    })
}

function parseCommand(input) {
    if (typeof input !== "string") throw createParserError("INPUT_INVALID", "command input must be a string")
    if (input.length > MAX_INPUT_LENGTH) throw createParserError("INPUT_TOO_LONG", "command input is too long")

    const tokens = tokenize(input)
    if (!tokens.length) throw createParserError("COMMAND_REQUIRED", "command is required")

    return {
        name: validateCommandName(tokens.shift()),
        args: validateArguments(tokens)
    }
}

function tokenize(input) {
    const tokens = []
    let token = ""
    let quote = null
    let escaped = false

    for (const character of String(input)) {
        if (escaped) {
            token += character
            escaped = false
        } else if (character === "\\") {
            escaped = true
        } else if (quote) {
            if (character === quote) quote = null
            else token += character
        } else if ((character === "'" || character === "\"") && !token) {
            quote = character
        } else if (character === "'" || character === "\"") {
            token += character
        } else if (/\s/.test(character)) {
            if (token) {
                tokens.push(token)
                token = ""
            }
        } else {
            token += character
        }
    }

    if (escaped) token += "\\"
    if (quote) throw createParserError("QUOTES_UNCLOSED", "quoted argument is not closed")
    if (token) tokens.push(token)
    return tokens
}

function parseCommandRequest(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw createParserError("BODY_INVALID", "request body must be an object")
    }

    const name = validateCommandName(body.command)
    const args = validateArguments(body.args || [])

    return { name, args }
}

module.exports = {
    MAX_INPUT_LENGTH,
    MAX_COMMAND_LENGTH,
    MAX_ARGUMENTS,
    MAX_ARGUMENT_LENGTH,
    parseCommand,
    parseCommandRequest,
    tokenize
}
