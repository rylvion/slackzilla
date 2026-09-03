import commandData from "../../../../../bot/data/commands.json"

export function getCommands() {
    return Object.entries(commandData)
        .filter(([key]) => !key.startsWith("$"))
        .map(([id, command]) => ({ id, ...command }))
}

export function getCommandsLength() {
    return getCommands().length
}

export function getCommandList() {
    return getCommands().map(command => command.cmd)
}

export function getCommandById(id) {
    const commands = getCommands()
    return commands.find(command => command.id === id)
}

export function getCommandByCmd(cmd) {
    const commands = getCommands()
    return commands.find(command => command.cmd === cmd)
}

export function groupCommandsByCategory() {
    const commands = getCommands()

    return commands.reduce((acc, command) => {
        if (!acc[command.category]) {
            acc[command.category] = []
        }
        acc[command.category].push(command.name)
        return acc
    }, {})
}

export function getIdByCmd(cmd) {
    const command = getCommandByCmd(cmd)
    return command ? command.id : null
}

export function getCmdById(id) {
    const command = getCommandById(id)
    return command ? command.cmd : null
}

export function getDescriptionById(id) {
    const command = getCommandById(id)
    return command ? command.description : null
}

export function getDescriptionByCmd(cmd) {
    const command = getCommandByCmd(cmd)
    return command ? command.description : null
}
