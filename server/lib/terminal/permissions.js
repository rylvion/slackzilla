const PERMISSIONS = {
    PUBLIC: "public",
    ADMIN: "admin"
}

function canExecuteCommand(command, session) {
    if (!command) return false
    if (command.permission === PERMISSIONS.PUBLIC) return true
    return command.permission === PERMISSIONS.ADMIN && Boolean(session)
}

module.exports = {
    PERMISSIONS,
    canExecuteCommand
}
