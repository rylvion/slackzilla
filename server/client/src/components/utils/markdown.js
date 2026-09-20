function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

export function activityToMarkdown(activity) {
    const date = new Date(activity.timestamp || Date.now())
    const pad = (value, length = 2) => String(value).padStart(length, "0")
    const timestamp = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
    const type = String(activity.type || "activity").toUpperCase()
    const status = activity.status ? ` **${activity.status}**` : ""
    const metadata = activity.metadata
        ? `\n\nMetadata:\n${Object.entries(activity.metadata)
            .map(([key, value]) => {
                if (!Array.isArray(value)) return `- ${key}=${value}`

                if (!value.length) return `### ${key}\n- none`

                if (typeof value[0] === "object") {
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

    return `**${timestamp}** \`${type}\`${status} - ${activity.message || "RAG activity updated"}${metadata}`
}

export function markdownToHtml(markdown) {
    const codeBlocks = []
    const inlineCode = []
    const withCodePlaceholders = escapeHtml(markdown).replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
        const placeholder = `MARKDOWNCODE${codeBlocks.length}TOKEN`
        codeBlocks.push(`<pre><code>${code}</code></pre>`)
        return placeholder
    })

    const protectedMarkdown = withCodePlaceholders.replace(/`([^`]+)`/g, (_, code) => {
        const placeholder = `MARKDOWNINLINE${inlineCode.length}TOKEN`
        inlineCode.push(`<code>${code}</code>`)
        return placeholder
    })

    return protectedMarkdown
        .replace(/((?:^\|[^\n]+\|\n?)+)/gm, block => {
            const rows = block.trim().split("\n").map(row => row.split("|").slice(1, -1).map(cell => cell.trim()))
            const headings = rows[0] || []
            const body = rows.slice(2)

            return `<table><thead><tr>${headings.map(cell => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        })
        .replace(/^### (.+)$/gm, "<h4>$1</h4>")
        .replace(/((?:^- .+$\n?)+)/gm, block => block.trim().split("\n").map(item => `<div class="markdown-list-item">${item.slice(2)}</div>`).join(""))
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/\n/g, "<br />")
        .replace(/MARKDOWNINLINE(\d+)TOKEN/g, (_, index) => inlineCode[Number(index)] || "")
        .replace(/MARKDOWNCODE(\d+)TOKEN/g, (_, index) => codeBlocks[Number(index)] || "")
}
