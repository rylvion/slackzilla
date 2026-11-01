import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import DocsLayout from "../components/DocsLayout"
import { documentGroup } from "../components/utils/docs-navigation.mjs"
import ErrorPanel from "../components/ErrorPanel"
import { documentByRoute, rewriteMarkdownLinks } from "../components/utils/docs"
import { markdownToHtml } from "../components/utils/markdown"
import "../css/docs.css"

function Docs() {
    const { pathname, hash, search } = useLocation()
    const navigate = useNavigate()
    const requestedRoute = pathname !== "/docs"? pathname.replace(/\/+$/, "") : pathname
    const route = requestedRoute.startsWith("/docs/") && requestedRoute.endsWith(".md") ? requestedRoute.slice(0, -3) : requestedRoute
    const isAllDocuments = route === "/docs/all"
    const groupMatch = route.match(/^\/docs\/group\/(.+)$/)
    const selectedGroup = groupMatch ? decodeURIComponent(groupMatch[1]) : null
    const isGroupIndex = selectedGroup !== null
    const isIndexPage = isAllDocuments || isGroupIndex
    const document = isIndexPage ? null : documentByRoute.get(route)
    const [externalLink, setExternalLink] = useState(null)

    useEffect(() => {
        sessionStorage.setItem('slackzilla_docs_page', `${pathname}${search}${hash}`)
    }, [pathname, search, hash])


    const allDocuments = useMemo(() => {
        return [...documentByRoute.values()].sort((a, b) => {
            const groupComparison = documentGroup(a).localeCompare(documentGroup(b))
            return groupComparison || a.title.localeCompare(b.title)
        })
    }, [])

    const visibleDocuments = useMemo(() => {
        if (!isGroupIndex) return allDocuments
        return allDocuments.filter(item => documentGroup(item).toLowerCase() === selectedGroup.toLowerCase())

    }, [allDocuments, isGroupIndex, selectedGroup])

    const documentsByGroup = useMemo(() => {return Object.groupBy(allDocuments, item => documentGroup(item))}, [allDocuments])
    const html = useMemo(() => document ? markdownToHtml(rewriteMarkdownLinks(document.markdown, document.source)) : "", [document])

    useEffect(() => {
        let frame1
        let frame2

        frame1 = window.requestAnimationFrame(() => {
            frame2 = window.requestAnimationFrame(() => {
                if (hash) {

                    const usedIds = new Set([...window.document.querySelectorAll("[id]")].map(element => element.id))

                    window.document.querySelectorAll(".docs-markdown h1, .docs-markdown h2, .docs-markdown h3, .docs-markdown h4, .docs-markdown h5, .docs-markdown h6").forEach(heading => {
                        if (heading.id) return

                        const base = heading.textContent.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section"

                        let id = base
                        let count = 1

                        while (usedIds.has(id)) { id = `${base}-${count++}`}

                        heading.id = id
                        usedIds.add(id)
                    })

                    let id
                    try { id = decodeURIComponent(hash.slice(1))}
                    catch { id = hash.slice(1) }

                    const target = window.document.getElementById(id)
                    if (target) target.scrollIntoView({block: "start",behavior: "smooth"})
                    return
                }

                window.scrollTo({ top: 0, left: 0, behavior: "instant"})
            })
        })

        return () => {
            window.cancelAnimationFrame(frame1)
            if (frame2) window.cancelAnimationFrame(frame2)
        }
    }, [route, hash, search, html])




    function handleContentClick(event) {
        const link = event.target.closest("a")
        if (!link) return

        const destination = link.getAttribute("href")
        let url

        try {
            url = new URL(destination, window.location.href)
        } catch {
            event.preventDefault()
            return
        }

        if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
            event.preventDefault()
            return
        }

        if (url.origin === window.location.origin && (url.pathname === "/docs" || url.pathname.startsWith("/docs/"))) {
            event.preventDefault()
            navigate(`${url.pathname}${url.search}${url.hash}`)
            return
        }

        event.preventDefault()
        setExternalLink(url.href)
    }

    return (
        <DocsLayout
            title={isAllDocuments ? "All Documentation" : isGroupIndex ? selectedGroup.toUpperCase() : document?.title || "Documentation"}
            subtitle={isAllDocuments ? `${allDocuments.length} documents available` : isGroupIndex ? `${visibleDocuments.length} documents in this group` : document?.source || "document not found"}
            activeRoute={route}
            overlay={externalLink && (
                <ErrorPanel
                    overlay={true}
                    mode="confirm"
                    title="Open external destination?"
                    message="This link will open in a new browser tab."
                    details={externalLink}
                    confirmLabel="open in new tab"
                    cancelLabel="stay here"
                    onConfirm={() => {
                        window.open(externalLink, "_blank", "noopener,noreferrer")
                        setExternalLink(null)
                    }}
                    onCancel={() => setExternalLink(null)}
                />
            )}>
                
            <main className="docs-main">
                <div className="docs-breadcrumb">
                    <Link to="/docs/all">DOCS</Link>
                    <span>/</span>

                    {isAllDocuments ? (
                        <strong>ALL DOCUMENTS</strong>
                    ) : isGroupIndex ? (
                        <>
                            <Link to={`/docs/group/${encodeURIComponent(selectedGroup)}`}>
                                {selectedGroup.toUpperCase()}
                            </Link>
                            <span>/</span>
                            <strong>DOCUMENT INDEX</strong>
                        </>
                    ) : document ? (
                        <>
                            <Link to={`/docs/group/${encodeURIComponent(documentGroup(document))}`}>
                                {documentGroup(document).toUpperCase()}
                            </Link>
                            <span>/</span>
                            <strong>{document.title}</strong>
                        </>
                    ) : (
                        <>
                            <span>NOT FOUND</span>
                            <span>/</span>
                            <strong>MISSING DOCUMENT</strong>
                        </>
                    )}
                </div>

                {isIndexPage ? (
                    <article className="markdown-content docs-markdown docs-index">
                        {isAllDocuments ? (
                            <>
                                <h2>All documentation</h2>
                                <p>Browse every registered documentation file by group.</p>

                                {Object.entries(documentsByGroup).map(([group, items]) => (
                                    <section className="docs-index-group" key={group}>
                                        <h3>
                                            <Link to={`/docs/group/${encodeURIComponent(group)}`}>
                                                {group}
                                            </Link>
                                            <span className="docs-index-count">{items.length}</span>
                                        </h3>

                                        <ul>
                                            {items.map(item => (
                                                <li key={item.route}>
                                                    <Link to={item.route}>{item.title}</Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </>
                        ) : (
                            <>
                                <h2>{selectedGroup}</h2>
                                <p>
                                    {visibleDocuments.length
                                        ? `Documentation files in the ${selectedGroup} group.`
                                        : "No documents were found in this group."}
                                </p>

                                {visibleDocuments.length > 0 && (
                                    <ul>
                                        {visibleDocuments.map(item => (
                                            <li key={item.route}>
                                                <Link to={item.route}>{item.title}</Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </article>
                ) : document ? (
                    <article
                        className="markdown-content docs-markdown"
                        onClick={handleContentClick}
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                ) : (
                    <article className="docs-markdown">
                        <h2>Document not found</h2>
                        <p>No documentation file is registered for <code>{pathname}</code>.</p>
                        <Link to="/docs">Return to documentation</Link>
                    </article>
                )}
            </main>
        </DocsLayout>
    )
}

export default Docs
