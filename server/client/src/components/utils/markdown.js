import DOMPurify from "dompurify"
import { marked } from "marked"

marked.setOptions({
    gfm: true,
    breaks: true
})

export function activityToMarkdown(activity) {
    const source = activity && typeof activity === "object" ? activity : {}
    const dateValue = new Date(source.timestamp || Date.now())
    const date = Number.isNaN(dateValue.getTime()) ? new Date() : dateValue
    const pad = (value, length = 2) => String(value).padStart(length, "0")
    const timestamp = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
    const type = String(source.type || "activity").toUpperCase()
    const status = source.status ? ` **${source.status}**` : ""
    const hasTokenUsage = String(source.type || "").toLowerCase() === "ai" &&
        source.metadata &&
        ("inputTokens" in source.metadata || "outputTokens" in source.metadata || "totalTokens" in source.metadata)
    const tokenUsageMetadata = hasTokenUsage
        ? Object.fromEntries(Object.entries(source.metadata).filter(([key]) => key !== "inputBreakdown"))
        : null
    const tokenRequests = hasTokenUsage && Array.isArray(source.metadata.requests) ? source.metadata.requests : []
    const metadata = source.metadata
        ? `\n\n${Object.entries(source.metadata)
            .map(([key, value]) => {
                if (key === "inputBreakdown" || key === "requests" || hasTokenUsage) return ""
                if (value === null || value === undefined) {
                    return `- ${key}=null`
                }

                if (typeof value === "object" && !Array.isArray(value)) {
                    return `### ${key}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
                }

                if (!Array.isArray(value)) return `- ${key}=${value}`

                if (!value.length) return `### ${key}\n- none`

                if (typeof value[0] === "object" && value[0] !== null) {
                    const columns = [...new Set(value.flatMap(item => Object.keys(item)))]
                    const header = `| ${columns.join(" | ")} |`
                    const separator = `| ${columns.map(() => "---").join(" | ")} |`
                    const formatCell = cell => {
                        if (cell === null || cell === undefined) return ""
                        if (typeof cell === "object") return `\`${JSON.stringify(cell)}\``
                        return String(cell)
                    }
                    const rows = value.map(item => `| ${columns.map(column => formatCell(item[column])).join(" | ")} |`)
                    return `### ${key}\n${[header, separator, ...rows].join("\n")}`
                }

                const items = value.map(item => `- ${item}`).join("\n")

                return `### ${key}\n${items}`
            })
            .join("\n")}${hasTokenUsage ? `\n\n### token usage\n${["inputTokens", "outputTokens", "totalTokens"]
                .filter(key => key in source.metadata)
                .map(key => `- ${key}=${source.metadata[key]}`)
                .join("\n")}\n\n### requests\n${tokenRequests.length
                ? [
                    "| request | input | output | total | input breakdown | output breakdown |",
                    "| --- | ---: | ---: | ---: | --- | --- |",
                    ...tokenRequests.map((request, index) => `| ${index + 1} | ${request.input ?? 0} | ${request.output ?? 0} | ${request.total ?? 0} | \`${JSON.stringify(request.inputBreakdown || {})}\` | \`${JSON.stringify(request.outputBreakdown || {})}\` |`)
                ].join("\n")
                : "- none"}\n\nToken usage JSON:\n\`\`\`json\n${JSON.stringify(tokenUsageMetadata, null, 2)}\n\`\`\`` : ""}`
        : ""

    return `**${timestamp}** \`${type}\`${status} - ${source.message || "RAG activity updated"}${metadata}`
}

export function markdownToHtml(markdown) {
    if (markdown === null || markdown === undefined) return ""

    const source = String(markdown)
    if (!source.trim()) return ""

    try {
        const slugCounts = new Map()
        const renderer = new marked.Renderer()
        
        renderer.heading = ({ text, tokens, depth }) => {
            const base = String(text ?? "")
                .replace(/<[^>]*>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;|&apos;/g, "'")
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-") || "section"

            const count = slugCounts.get(base) || 0
            slugCounts.set(base, count + 1)

            const id = count ? `${base}-${count}` : base
            const content = marked.Parser.parseInline(tokens)

            return `<h${depth} id="${id}">${content}</h${depth}>\n`
        }


        const html = marked.parse(source, { renderer })
        .replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, depth, attributes, content) => {
            if (/\bid=["'][^"']+["']/i.test(attributes)) return match

            const text = content.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
            const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section"

            return `<h${depth}${attributes} id="${id}">${content}</h${depth}>`
        })
        .replace(
            /<p>([\s\S]*?)<\/p>/gi, (paragraph, content) => {
            const badgeContent = content.replace(/<br\s*\/?>/gi, "").trim()
            const containsOnlyBadges = /^(?:\s*(?:<a\b[^>]*>\s*<img\b[^>]*>\s*<\/a>|<img\b[^>]*>)\s*){2,}$/i.test(badgeContent)

            return containsOnlyBadges? `<p class="markdown-badges">${content.replace(/<br\s*\/?>(?:\s*)/gi, "")}</p>` : paragraph
        })

        return DOMPurify.sanitize(html, {ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^:]*$)/i})

    } catch (error) {
        console.error("Markdown rendering failed:", error)
        return DOMPurify.sanitize(source)
    }
}