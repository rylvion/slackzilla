export const DOCS_SIDEBAR_STORAGE_KEY = "slackzilla-docs-sidebar-collapsed"

export function getDocsSidebarCollapsed(storage, viewportWidth = 1280) {
    const saved = storage?.getItem?.(DOCS_SIDEBAR_STORAGE_KEY)
    if (saved === "true" || saved === "false") return saved === "true"

    return true
}

export function toggleDocsSidebar(collapsed) {
    return !Boolean(collapsed)
}

export function docsLayoutClassName(collapsed) {
    return `docs-layout${collapsed ? " docs-layout--collapsed" : ""}`
}
