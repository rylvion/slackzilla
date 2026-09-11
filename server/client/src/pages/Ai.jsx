import { useState } from "react"
import PageShell from "../components/PageShell"
import { getJson } from "../components/utils/api"
import "../css/ai.css"

function Ai() {
    const [question, setQuestion] = useState("")
    const [result, setResult] = useState(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    async function ask(event) {
        event.preventDefault()
        if (!question.trim()) return

        setBusy(true)
        setError("")
        setResult(null)

        try {
            const data = await getJson("/api/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: question.trim()
                })
            })
            setResult(data)
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <PageShell title="AI Assistant" description="Ask questions about Slackzilla">
            <section className="panel ai-panel">
                <div className="panel-header">
                    <h1>Slackzilla AI</h1>
                    <span className="panel-subtitle">repository-aware assistant</span>
                </div>
                <div className="panel-body ai-body">
                    <form className="ai-form" onSubmit={ask}>
                        <label htmlFor="ai-question">Question</label>
                        <textarea
                            id="ai-question"
                            value={question}
                            onChange={event => setQuestion(event.target.value)}
                            placeholder="Ask how Slackzilla works..."
                            rows="5"
                            onKeyDown={event => {
                                if (event.ctrlKey && event.key === "Enter") {
                                    event.preventDefault()
                                    event.currentTarget.form.requestSubmit()
                                }
                            }}
                            required
                        />
                        <button className="button ai-submit" type="submit" disabled={busy || !question.trim()}>
                            {busy ? "Thinking..." : "Ask Slackzilla"}
                        </button>
                    </form>

                    {error && <p className="error-banner">{error}</p>}

                    {result && <div className="ai-result">
                        <div className="ai-result-header">
                            <h2>Answer</h2>
                        </div>
                        <div className="ai-answer">{result.answer}</div>
                        {result.sources?.length > 0 && <div className="ai-sources">
                            <h3>Retrieved sources</h3>
                            {result.sources.map(source => <div className="ai-source" key={`${source.path}-${source.start}`}><code>{source.path}:{source.start}</code><span>match score {source.score}</span></div>)}
                        </div>}
                        {result.images?.length > 0 && <div className="ai-images">
                            <h3>Related visual assets</h3>
                            <div className="ai-image-grid">
                                {result.images.map(image => <figure key={image.path} className="ai-image-card">
                                    <img src={image.url} alt={`Repository asset ${image.path}`} />
                                    <figcaption><code>{image.path}</code></figcaption>
                                </figure>)}
                            </div>
                        </div>}
                    </div>}
                </div>
            </section>
        </PageShell>
    )
}

export default Ai
