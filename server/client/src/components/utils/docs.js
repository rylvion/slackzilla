import markdownSources from "virtual:slackzilla-docs"

function withoutExtension(value) {
    return value.replace(/\.md$/i, "")
}

function titleFromMarkdown(markdown, fallback) {
    const match = String(markdown).match(/^#\s+(.+)$/m)
    return match ? match[1].replace(/[`*_]/g, "").trim() : fallback
}

const buildDocument = ({ id, source, route, markdown, category }) => ({id, source, route, markdown: String(markdown || ""), category, title: titleFromMarkdown(markdown, id)})
const entries = modules => Object.entries(modules)

function docsRoute(relative) {
    if (relative === "docs.md") return "/docs"
    if (relative.toLowerCase().endsWith("/readme.md")) return `/docs/${relative.slice(0, -"/README.md".length)}`
    return `/docs/${withoutExtension(relative)}`
}

const docs = entries(markdownSources)
    .filter(([source]) => source.startsWith("docs/"))
    .map(([source, markdown]) => {
        const relative = source.slice("docs/".length)
        const route = docsRoute(relative)
        return buildDocument({
            id: `docs/${relative}`,
            source: `docs/${relative}`,
            route,
            markdown,
            category: relative === "docs.md" ? "Index" : relative.split("/")[0]
        })
    })

const devlogs = entries(markdownSources)
    .filter(([source]) => source.startsWith("assets/devlogs/"))
    .map(([source, markdown]) => {
        const relative = source.slice("assets/devlogs/".length)
        return buildDocument({
            id: `assets/devlogs/${relative}`,
            source: `assets/devlogs/${relative}`,
            route: `/docs/devlogs/${withoutExtension(relative)}`,
            markdown,
            category: "Devlogs"
        })
    })

const readme = entries(markdownSources).filter(([source]) => source === "README.md").map(([, markdown]) => buildDocument({
    id: "README.md",
    source: "README.md",
    route: "/docs/readme",
    markdown,
    category: "Project"
}))[0]

export const documents = [...docs, ...devlogs, ...(readme ? [readme] : [])]
    .sort((a, b) => a.route.localeCompare(b.route))

export const documentByRoute = new Map(documents.map(document => [document.route, document]))

const searchableDocuments = documents.map(document => {
    const headings = [...document.markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => match[1].replace(/[`*_]/g, "").trim())
    const plainText = document.markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[`*_>#|~-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    return { document, headings, plainText, lowerTitle: document.title.toLowerCase(), lowerSource: document.source.toLowerCase(), lowerHeadings: headings.map(heading => heading.toLowerCase()), lowerBody: plainText.toLowerCase() }
})

function excerptFor(entry, query) {
    const lowerQuery = query.toLowerCase()
    const bodyIndex = entry.lowerBody.indexOf(lowerQuery)
    const heading = entry.headings.find((item, index) => entry.lowerHeadings[index].includes(lowerQuery))
    const source = bodyIndex >= 0 ? entry.plainText : heading || entry.document.title
    const index = bodyIndex >= 0 ? bodyIndex : Math.max(0, source.toLowerCase().indexOf(lowerQuery))
    const start = Math.max(0, index - 90)
    const end = Math.min(source.length, index + Math.max(query.length, 90))

    return {
        text: `${start > 0 ? "…" : ""}${source.slice(start, end).trim()}${end < source.length ? "…" : ""}`,
        heading: heading || null
    }
}

export function searchDocuments(query, limit = 30) {
    const cleanQuery = String(query || "").trim()
    if (!cleanQuery) return []

    const lowerQuery = cleanQuery.toLowerCase()
    const terms = lowerQuery.split(/\s+/).filter(Boolean)

    return searchableDocuments
        .map(entry => {
            let score = 0
            if (entry.lowerTitle === lowerQuery) score += 1000
            else if (entry.lowerTitle.includes(lowerQuery)) score += 700
            if (entry.lowerSource.includes(lowerQuery)) score += 300
            if (entry.lowerHeadings.some(heading => heading.includes(lowerQuery))) score += 450
            if (entry.lowerBody.includes(lowerQuery)) score += 100

            for (const term of terms) {
                if (entry.lowerTitle.includes(term)) score += 80
                if (entry.lowerHeadings.some(heading => heading.includes(term))) score += 45
                if (entry.lowerBody.includes(term)) score += 15
            }

            return score ? { ...entry, score, ...excerptFor(entry, lowerQuery) } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
        .slice(0, limit)
}

function normalisePath(value) {
    const parts = value.split("/")
    const result = []

    for (const part of parts) {
        if (!part || part === ".") continue
        if (part === "..") result.pop()
        else result.push(part)
    }

    return result.join("/")
}



function rewriteTarget(target, source) {
    if (!target || target.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(target)) return target

    const match = target.match(/^([^?#]*)([?#].*)?$/)
    const pathname = match?.[1] || target
    const suffix = match?.[2] || ""

    if (!pathname) return target

    const cleanPath = pathname.replace(/\\/g, "/")
    const absolute = cleanPath.startsWith("/")
    const normalisedTarget = cleanPath.replace(/^\/+/, "")

    if (normalisedTarget.startsWith("assets/devlogs/") && normalisedTarget.endsWith(".md")) return `/docs/devlogs/${withoutExtension(normalisedTarget.slice("assets/devlogs/".length))}${suffix}`
    if (absolute && normalisedTarget.startsWith("docs/")) return `${docsRoute(withoutExtension(normalisedTarget.slice("docs/".length)))}${suffix}`
    if (absolute && normalisedTarget.endsWith(".md")) return `${docsRoute(withoutExtension(normalisedTarget))}${suffix}`
    if (absolute) return `${cleanPath}${suffix}`

    const sourcePath = source.replace(/\\/g, "/").replace(/^\/+/, "")
    const sourceParts = sourcePath.split("/")
    sourceParts.pop()

    const isReadme = sourcePath.toLowerCase() === "readme.md"
    const baseParts = isReadme ? [] : sourceParts

    let resolved = normalisePath([...baseParts, normalisedTarget].join("/"))

    if (resolved.startsWith("docs/assets/devlogs/")) resolved = resolved.slice("docs/".length)
    if (resolved.startsWith("assets/devlogs/")) return `/docs/devlogs/${withoutExtension(resolved.slice("assets/devlogs/".length))}${suffix}`
    if (resolved.startsWith("docs/docs/")) resolved = resolved.slice("docs/".length)
    if (resolved.startsWith("docs/") && resolved.endsWith(".md")) return `${docsRoute(withoutExtension(resolved.slice("docs/".length)))}${suffix}`
    if (resolved.endsWith(".md")) return `${docsRoute(withoutExtension(resolved))}${suffix}`
    if (resolved.startsWith("assets/")) return `/${resolved}${suffix}`
    if (resolved.startsWith("docs/")) return `${docsRoute(resolved.slice("docs/".length))}${suffix}`

    return target
}

export function rewriteMarkdownLinks(markdown, source) {
    const badges = []

    let rewritten = String(markdown || "").replace(/(!\[[^\]]*\]\()([^\s)]+)(\)\]\()([^\s)]+)(\))/g, (match, imagePrefix, imageTarget, middle, linkTarget, suffix) => {
        const badge = `${imagePrefix}${rewriteTarget(imageTarget, source)}${middle}${rewriteTarget(linkTarget, source)}${suffix}`
        const placeholder = `DOCBADGEPLACEHOLDER${badges.length}END`
        badges.push(badge)
        return placeholder    
    })

    rewritten = rewritten.replace(/(!?\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (match, prefix, target, suffix) => `${prefix}${rewriteTarget(target, source)}${suffix}`)
    rewritten = rewritten.replace(/(\bhref\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, target, suffix) => `${prefix}${rewriteTarget(target, source)}${suffix}`)
    rewritten = rewritten.replace(/(\bsrc\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, target, suffix) => `${prefix}${target}${suffix}`)
    
    rewritten = rewritten.replace(/(\bsrcset\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, value, suffix) => {
        const rewrittenValue = value.split(",").map(candidate => {
            const parts = candidate.trim().split(/\s+/)
            if (!parts[0]) return candidate
            parts[0] = rewriteTarget(parts[0], source)
            return parts.join(" ")
        }).join(", ")

        return `${prefix}${rewrittenValue}${suffix}`
    })

    return rewritten.replace(/DOCBADGEPLACEHOLDER(\d+)END/g, (match, index) => badges[Number(index)] ?? match)
}

