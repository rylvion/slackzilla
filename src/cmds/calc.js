const { log, cyan } = require("../utils/logger")

function calculate(expr) {
    expr = expr.replace(/\s+/g, "")
    const tokens = expr.match(/(\d+(\.\d+)?|[+\-*/^()])/g)
    if (!tokens) throw new Error("invalid expression")

    const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "u-": 4 }
    const output = []
    const stack = []

    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i]

        if (t === "-" && (i === 0 || (tokens[i - 1] in prec) || tokens[i - 1] === "(")) {
            t = "u-"
        }

        if (!isNaN(t)) {
            output.push(parseFloat(t))
        } else if (t in prec) {
            while (
                stack.length &&
                stack[stack.length - 1] in prec &&
                (
                    prec[stack[stack.length - 1]] > prec[t] ||
                    (prec[stack[stack.length - 1]] === prec[t] && t !== "^" && t !== "u-")
                )
            ) {
                output.push(stack.pop())
            }
            stack.push(t)
        } else if (t === "(") {
            stack.push(t)
        } else if (t === ")") {
            while (stack.length && stack[stack.length - 1] !== "(") {
                output.push(stack.pop())
            }
            stack.pop()
        }
    }

    while (stack.length) output.push(stack.pop())

    const evalStack = []
    for (const t of output) {
        if (typeof t === "number") {
            evalStack.push(t)
        } else if (t === "u-") {
            evalStack.push(-evalStack.pop())
        } else {
            const b = evalStack.pop()
            const a = evalStack.pop()
            switch (t) {
                case "+": evalStack.push(a + b); break
                case "-": evalStack.push(a - b); break
                case "*": evalStack.push(a * b); break
                case "/": evalStack.push(a / b); break
                case "^": evalStack.push(a ** b); break
            }
        }
    }

    return evalStack[0]
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        log.info("{user} used {cmd}", command)

        try {
            const text = command.text?.trim()

            if (!text) {
                log.warn("{user} used {cmd} with no text", command)
                await respond("You need to give me a mathematical expression.")
                return
            }

            if (text.toLowerCase() === "help") {
                await respond(
                    "> *Available commands:*\n" +
                    ">  help        Show this help menu\n" +
                    "> *You can enter expressions like:*\n" +
                    ">  1 + 2 * 3\n" +
                    ">  (10 - 4) / 2\n" +
                    ">  3.5 * (2 + 7)" + 
                    "> etc...\n\n" +
                    "> *Supported operators:*\n" +
                    ">  +  -  *  /  ^  ( )\n" +
                    "> Unary minus is also supported (e.g., -5 + 3)"
                )
                return
            }

            const start = performance.now()
            const result = calculate(text)
            const end = performance.now()

            const seconds = ((end - start) / 1000).toFixed(6)

            log.success(
                "{user} calculated expression via {cmd}: '{0}'",
                command,
                cyan(text)
            )

            await respond(
                `**Result:** \`${result}\`\n` +
                `**Expression:** \`${text}\`\n` +
                `Computed within **${seconds}** *seconds*`
            )

        } catch (err) {
            log.error("{user} failed {cmd}: {0}", command, err.message)

            await respond(
                `❌ smth went wrong while evaluating your expression.\n` +
                `\`${err.message}\``
            )
        }
    })
}
