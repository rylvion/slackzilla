import { Link, useSearchParams } from "react-router-dom"
import DocsLayout from "../components/DocsLayout"
import { searchDocuments } from "../components/utils/docs"
import "../css/docs.css"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightedText({ text, query }) {
    if (!query) return text

    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "ig"))
    return parts.map((part, index) => part.toLowerCase() === query.toLowerCase()
        ? <mark key={`${part}-${index}`}>{part}</mark>
        : <span key={`${part}-${index}`}>{part}</span>)
}

function DocsSearch() {
    const [params] = useSearchParams()
    const query = params.get("q") || ""
    const results = searchDocuments(query)

    return (
        <DocsLayout title="Documentation Search" subtitle="DOCS / SEARCH" searchQuery={query} activeRoute="/docs/search">
            <main className="docs-main docs-search-main">
                <div className="docs-breadcrumb">DOCS <span>/</span> SEARCH <span>/</span> <strong>{query || "ALL DOCUMENTATION"}</strong></div>
                <div className="docs-search-results">
                    {query ? (
                        <>
                            <div className="docs-search-summary"><strong>{results.length}</strong> result{results.length === 1 ? "" : "s"} for <code>{query}</code></div>
                            {results.length > 0 ? results.map(result => (
                                <article className="docs-search-result" key={result.document.id}>
                                    <div className="docs-search-result-meta">{result.document.source}</div>
                                    <h2><Link to={result.document.route}><HighlightedText text={result.document.title} query={query} /></Link></h2>
                                    {result.heading && <div className="docs-search-result-heading">Section: {result.heading}</div>}
                                    <p><HighlightedText text={result.text} query={query} /></p>
                                </article>
                            )) : (
                                <div className="docs-search-empty">
                                    <h2>No matching documentation</h2>
                                    <p>Try a filename, heading, API endpoint or another technical term.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="docs-search-empty">
                            <h2>Search Slackzilla documentation</h2>
                            <p>Search document titles, headings, API routes and Markdown content.</p>
                        </div>
                    )}
                </div>
            </main>
        </DocsLayout>
    )
}

export default DocsSearch
