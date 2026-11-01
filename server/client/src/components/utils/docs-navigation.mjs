export const groupOrder = ["Guides", "API Reference", "Extension Guides", "Development & Testing", "Devlogs", "Project Resources"]

export function documentGroup(document) {
    if (document.source === "README.md") return "Project Resources"
    if (document.source.startsWith("assets/devlogs/")) return "Devlogs"
    if (document.source.startsWith("docs/extension/")) return "Extension Guides"
    if (document.source.startsWith("docs/post/") || document.source === "docs/api.md") return "API Reference"
    if (["docs/testing.md", "docs/rag.md"].includes(document.source)) return "Development & Testing"
    return "Guides"
}

export function groupDocuments(documents) {
    const grouped = new Map(groupOrder.map(group => [group, []]))

    for (const item of documents) grouped.get(documentGroup(item)).push(item)
    return [...grouped].filter(([, items]) => items.length)
}
