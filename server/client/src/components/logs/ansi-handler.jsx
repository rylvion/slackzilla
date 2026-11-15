
function ansiLine({ number, text, highlightLine, highlighted, onCtrlClick }, index) {
    // eslint-disable-next-line no-control-regex
    const tokens = String(text).split(/(\u001b\[[0-?]*[ -/]*[@-~])/g)
    const parts = []

    const colours = {
        30: "ansi-black",
        31: "ansi-red",
        32: "ansi-green",
        33: "ansi-yellow",
        34: "ansi-blue",
        35: "ansi-magenta",
        36: "ansi-cyan",
        37: "ansi-white",
        90: "ansi-muted",
        91: "ansi-red-bright",
        92: "ansi-green-bright",
        93: "ansi-yellow-bright",
        94: "ansi-blue-bright",
        95: "ansi-magenta-bright",
        96: "ansi-cyan-bright",
        97: "ansi-white-bright"
    }

    const state = {
        foreground: "",
        bold: false,
        dim: false,
        italic: false,
        underline: false
    }

    function getClasses() {
        return [
            state.foreground,
            state.bold ? "ansi-bold" : "",
            state.dim ? "ansi-dim" : "",
            state.italic ? "ansi-italic" : "",
            state.underline ? "ansi-underline" : ""
        ].filter(Boolean).join(" ")
    }

    tokens.forEach((token, tokenIndex) => {
        // eslint-disable-next-line no-control-regex
        const code = token.match(/^\u001b\[([0-9;]*)m$/)

        if (code) {
            const values = code[1].split(";").map(value => value === "" ? 0 : Number(value))

            for (const value of values) {
                if (value === 0) {state.foreground = ""; state.bold = false; state.dim = false; state.italic = false; state.underline = false}
                else if (value === 1) state.bold = true
                else if (value === 2) state.dim = true
                else if (value === 3) state.italic = true
                else if (value === 4) state.underline = true
                else if (value === 22) {state.bold = false; state.dim = false}
                else if (value === 23) state.italic = false
                else if (value === 24) state.underline = false
                else if (value === 39) state.foreground = ""
                else if (colours[value]) state.foreground = colours[value]
            }
        } else if (token) parts.push(<span className={getClasses()} key={`${index}-${tokenIndex}`}>{token}</span>)
    })

    // eslint-disable-next-line no-control-regex
    const plain = String(text).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    const logColours = [
        { match: /^npm WARN\b/i, colour: "ansi-orange" },
        { match: /^npm ERR!/i, colour: "ansi-red" },
        { match: /^npm notice\b/i, colour: "ansi-cyan" },
        { match: /^npm info\b/i, colour: "ansi-muted" },
        { match: /^added \d+ packages?/i, colour: "ansi-green" },
        { match: /^\d+ packages are looking for funding/i, colour: "ansi-muted" },
        { match: /^\d+ vulnerabilities? /i, colour: "ansi-orange" },
        { match: /^To address /i, colour: "ansi-muted" },
        { match: /^npm audit fix --force/i, colour: "ansi-red" },
        { match: /^npm audit fix/i, colour: "ansi-cyan" },
        { match: /^Run `?npm audit/i, colour: "ansi-muted" },
        { match: /^> slackzilla@/i, colour: "ansi-cyan" },
        { match: /^> vite build/i, colour: "ansi-blue" },
        { match: /^vite v[\d.]+/i, colour: "ansi-cyan" },
        { match: /^transforming\.\.\./i, colour: "ansi-muted" },
        { match: /^rendering chunks\.\.\./i, colour: "ansi-muted" },
        { match: /^computing gzip size\.\.\./i, colour: "ansi-muted" },
        { match: /^From https:\/\/github\.com\//i, colour: "ansi-cyan" },
        { match: /^\s*\* branch\b/i, colour: "ansi-blue" },
        { match: /^HEAD is now at\b/i, colour: "ansi-green" },
        { match: /^Running timer as unit:/i, colour: "ansi-green" },
        { match: /^Will run service as unit:/i, colour: "ansi-green" }
    ]
    //eslint-disable-next-line no-control-regex    
    const hasAnsiColours = tokens.some(token => /^\u001b\[([0-9;]*)m$/.test(token))
    const logColour = logColours.find(item => item.match.test(plain))?.colour
    const lineClasses = ["log-line", highlightLine === number ? "highlight" : "", highlighted ? "new-log" : ""].filter(Boolean).join(" ")

    return (
        <div className={lineClasses} id={`log-line-${number}`} key={index} onClick={(event) => {
            if (!event.ctrlKey && !event.metaKey) return
            onCtrlClick?.(number)
        }}>
            <span className="log-line-number">{number}</span>
            <span className="log-line-text">{logColour && !hasAnsiColours ? <span className={logColour}>{plain}</span> : parts}</span>
        </div>
    )   
}

export default ansiLine
