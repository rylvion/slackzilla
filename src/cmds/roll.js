const { log } = require("../utils/logger")

function rollDice(sides = 6) {
    return Math.floor(Math.random() * sides) + 1
}

function parseRoll(input) {
    const match = input.match(/^(\d+)?d(\d+)([+-]\d+)?$/i)

    if (!match) {
        return null
    }

    const amount = Number(match[1]) || 1
    const sides = Number(match[2])
    const modifier = Number(match[3]) || 0

    if (amount <= 0 || sides <= 0) {
        return null
    }

    if (amount > 100 || sides > 1000) {
        return null
    }

    return {
        amount,
        sides,
        modifier
    }
}

function rollExpression(amount, sides, modifier) {
    const rolls = Array.from({ length: amount }, () => rollDice(sides))


    const total = rolls.reduce((sum, value) => sum + value, 0) + modifier

    return {
        rolls,
        total
    }
}

function getHelp() {
    return `
> 🎲 *roll command help*
>  **Usage:**
> \`/sz-roll\` - rolls a d6 (default)
> \`/sz-roll 20\` - rolls a d20 (up to 20 sides)
> \`/sz-roll 2d6\` - rolls two d6 dice
> \`/sz-roll 2d20+5\` - rolls two d20 dice and add 5

> **Examples:**
> • /sz-roll d8
> • /sz-roll 3d10
> • /sz-roll 1d20+10
`
}

module.exports = (app, meta) => {
    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        const input = command.text.trim().toLowerCase()

        if (input === 'help') {
            await respond({ text: getHelp() })

            log.info('Displayed roll command help')
            return
        }

        let expression = input

        if (/^\d+$/.test(input)) {
            expression = `1d${input}`
        }

        if (!expression.includes('d')) {
            expression = '1d6'
        }

        const roll = parseRoll(expression)

        if (!roll) {
            await respond({
                text: 'invalid roll format. Use `/sz-roll help` for examples.'
            })

            log.error(`invalid roll input: ${input}`)
            return
        }

        const res = rollExpression(
            roll.amount,
            roll.sides,
            roll.modifier
        )

        const modifierText = roll.modifier !== 0
            ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}`
            : ''

        await respond({
            text: ( 
            `🎲 rolled **${expression}**\n` +
            `Rolls: ${res.rolls.join(', ')}${modifierText}\n` +
            `Total: **${res.total}**`
            )
        })

        log.success(`Rolled ${expression}: ${res.total}`)
    })
}