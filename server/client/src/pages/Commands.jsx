import Panel from "../components/commands/Panel"
import PageShell from "../components/PageShell"
import { useEffect, useState } from "react"
import { getJson } from "../components/utils/api"
import "../css/commands.css"

function Commands() {
    const state = window.__SLACKZILLA__ || {}
    const [commands, setCommands] = useState([])
    const [commandId, setCommandId] = useState("")
    const [commandText, setCommandText] = useState("")
    const [response, setResponse] = useState(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        getJson("/api/commands")
            .then(data => setCommands(data.commands || []))
            .catch(requestError => setError(requestError.message))
    }, [])

    async function runCommand(event) {
        event.preventDefault()
        if (!commandId) return

        setBusy(true)
        setError("")
        setResponse(null)

        try {
            const data = await getJson(`/api/commands/${commandId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: commandText })
            })
            setResponse(data)
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <PageShell title="Commands" description="Slackzilla command reference" active="commands" state={state}>
                <section id="commands" className="panel">
                    <div className="panel-header">
                        <h1>Commands</h1>
                        <span className="panel-subtitle">Slackzilla command reference</span>
                    </div>

                    <div className="panel-body">
                        <p>Browse the available Slackzilla commands and their usage information.</p>
                    </div>

                    <div className="panel-body command-runner">
                        <h2>Run a command</h2>
                        <form onSubmit={runCommand}>
                            <label htmlFor="command-id">Command</label>
                            <select id="command-id" value={commandId} onChange={event => setCommandId(event.target.value)} required>
                                <option value="">Select a command</option>
                                {commands.map(command => <option key={command.id} value={command.id}>{command.command} - {command.description}</option>)}
                            </select>
                            <label htmlFor="command-text">Arguments</label>
                            <input id="command-text" value={commandText} onChange={event => setCommandText(event.target.value)} placeholder="Optional command arguments" />
                            <button className="button command-run-button" type="submit" disabled={busy || !commandId}>{busy ? "Running..." : "Run command"}</button>
                        </form>
                        {error && <p className="command-error">{error}</p>}
                        {response && <pre className="command-response">{response.responses?.map(item => typeof item === "string" ? item : JSON.stringify(item, null, 2)).join("\n")}</pre>}
                    </div>

                    <div id="command-panel" className="panel-body">
                        <Panel />
                    </div>
                </section> 
            </PageShell>
        </>
    )
}

export default Commands