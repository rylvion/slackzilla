export function isAtBottom(container) {
    if (!container) return true

    const { scrollTop, scrollHeight, clientHeight } = container

    return scrollHeight - scrollTop - clientHeight < 20
}

export function scrollToBottom(container, smooth = true) {
    if (!container) return

    container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
    })
}

export function jumpToLine(container, lines, num, onHighlight) {
    if (!container || !lines.length) return

    const firstLine = lines[0].number
    const lastLine = lines[lines.length - 1].number

    const target = Math.min(Math.max(num, firstLine), lastLine)

    const el = document.getElementById(`log-line-${target}`)

    if (!el) return

    container.scrollTo({
        top: el.offsetTop - 20,
        behavior: "smooth",
    })

    onHighlight(target)

    setTimeout(() => {
        onHighlight((current) => current === target ? null : current)
    }, 2500)
}

export function jumpBy(container, lines, amount, jumpToLine) {
    if (!container || !lines.length) return

    const currentLine = lines.find((line) => {
        const el = document.getElementById(`log-line-${line.number}`)

        if (!el) return false

        const rect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        return rect.top >= containerRect.top
    })

    const currentNumber = currentLine?.number ?? lines[0].number

    jumpToLine(currentNumber + amount)
}
