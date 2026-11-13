
import Panel from "../components/commands/Panel"
import PageShell from "../components/PageShell"
import { useEffect, useRef, useState } from "react"
import { getJson } from "../components/utils/api"
import "../css/commands.css"

function Commands() {
    const [commands, setCommands] = useState([])
    const [loadError, setLoadError] = useState("")
    const [expandedId, setExpandedId] = useState("")
    const [argumentsById, setArgumentsById] = useState({})
    const [busyIds, setBusyIds] = useState([])
    const [results, setResults] = useState({})
    const busyRef = useRef(new Set())

    useEffect(() => {
        let active = true

        getJson("/api/commands")
            .then(data => { if (active) setCommands(data.commands || []) })
            .catch(error => { if (active) setLoadError(error.message)})

        return () => { active = false }
    }, [])

    async function runCommand(command, text = "") {
        if (busyRef.current.has(command.id)) return

        busyRef.current.add(command.id)
        setBusyIds([...busyRef.current])
        setResults(previous => ({...previous, [command.id]: { loading: true, error: "", response: null }}))

        try {
            const data = await getJson(`/api/commands/${encodeURIComponent(command.id)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            })

            setResults(previous => ({...previous, [command.id]: { loading: false, error: "", response: data }}))
        } catch (error) {
            setResults(previous => ({...previous, [command.id]: { loading: false, error: error.message, response: null }}))
        } finally {
            busyRef.current.delete(command.id)
            setBusyIds([...busyRef.current])
        }
    }

    function handleCommandClick(command) {
        if (busyRef.current.has(command.id)) return

        if (!command.usageHint?.trim()) {
            setExpandedId("")
            runCommand(command)
            return
        }

        setExpandedId(current => current === command.id ? "" : command.id)
    }

    const handleArgumentsChange = (commandId, value) => setArgumentsById(previous => ({ ...previous, [commandId]: value }))

    function handleArgumentsSubmit(event, command) {
        event.preventDefault()
        runCommand(command, argumentsById[command.id] || "")
    }

    return (
        <PageShell title="Commands" description="Slackzilla command reference">
            <section id="commands" className="panel">
                <div className="panel-header">
                    <h1>Commands</h1>
                </div>

                {loadError && <div className="panel-body"><p className="command-error">{loadError}</p></div>}

                <Panel
                    commands={commands}
                    expandedId={expandedId}
                    argumentsById={argumentsById}
                    busyIds={busyIds}
                    results={results}
                    onCommandClick={handleCommandClick}
                    onArgumentsChange={handleArgumentsChange}
                    onArgumentsSubmit={handleArgumentsSubmit}
                />
            </section>
        </PageShell>
    )
}

export default Commands
