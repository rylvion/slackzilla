import { getCommands } from "../utils/commands.js"

function Panel() {
    const commands = getCommands()

    //TODO: maybe add category filter, or search functionality after core features are implemented
    return (
        <div className="panel">
            <div className="panel-header">
                <h2>Commands Reference</h2>
                <span className="panel-subtitle">
                    {commands.length} available
                </span>
            </div>

            <div className="panel-body">
                {commands.length > 0 ? (
                    <div className="command-list">
                        {commands.map(command => (
                            <div className="command-item" key={command.id}>
                                <span className="command-name"> {command.cmd || "Unknown command"} </span>
                                <span className="command-description"> {command.description || "No description available"} </span>
                                <span className="command-category"> {command.category || "Unknown category"} </span>
                                <span className="command-hint"> {command.usage_hint || "none"} </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="muted"> Commands failed to render </p>
                )}
            </div>
        </div>
    )
}

export default Panel