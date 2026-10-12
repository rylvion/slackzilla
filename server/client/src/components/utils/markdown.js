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
    const metadata = source.metadata
        ? `\n\n${Object.entries(source.metadata)
            .map(([key, value]) => {
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
                    const rows = value.map(item => `| ${columns.map(column => item[column] ?? "").join(" | ")} |`)
                    return `### ${key}\n${[header, separator, ...rows].join("\n")}`
                }

                const items = value.map(item => `- ${item}`).join("\n")

                return `### ${key}\n${items}`
            })
            .join("\n")}`
        : ""

    return `**${timestamp}** \`${type}\`${status} - ${source.message || "RAG activity updated"}${metadata}`
}

export function markdownToHtml(markdown) {
    if (markdown === null || markdown === undefined) return ""

    const source = String(markdown)
    if (!source.trim()) return ""

    try {
        const html = marked.parse(source)

        return DOMPurify.sanitize(html, {
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^:]*$)/i
        })
    } catch {
        return DOMPurify.sanitize(source)
    }
}
