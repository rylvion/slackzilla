function ansiLine({ number, text, highlightLine, highlighted, onCtrlClick }, index) {
    // eslint-disable-next-line no-control-regex
    const tokens = String(text).split(/(\u001b\[[0-9;]*m)/g)
    let className = ""
    const parts = []

    const colours = {
        31: "ansi-red",
        32: "ansi-green",
        33: "ansi-yellow",
        36: "ansi-cyan",
        90: "ansi-muted"
    }

    tokens.forEach((token, tokenIndex) => {
        // eslint-disable-next-line no-control-regex
        const code = token.match(/\u001b\[([0-9;]*)m/)

        if (code) {
            const value = code[1]
            className = value === "0" ? "" : colours[value] || className
        } else if (token) {
            parts.push( <span className={className} key={`${index}-${tokenIndex}`}>{token}</span> )
        }
    })

    const lineClasses = [
        "log-line",
        highlightLine === number ? "highlight" : "",
        highlighted ? "new-log" : ""
    ].filter(Boolean).join(" ")

    return (
        <div
            className={lineClasses}
            id={`log-line-${number}`}
            key={index}
            onClick={(event) => {
                if (!event.ctrlKey && !event.metaKey) return
                onCtrlClick?.(number)
            }}
        >
            <span className="log-line-number">{number}</span>
            <span className="log-line-text">{parts}</span>
        </div>
    )
}

export default ansiLine