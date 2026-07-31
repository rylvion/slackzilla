const fileInput = document.getElementById("file")
const log = document.getElementById("log")

const ansiColours = {
    30: "black",
    31: "red",
    32: "green",
    33: "yellow",
    34: "blue",
    35: "magenta",
    36: "cyan",
    37: "white",

    90: "bright-black",
    91: "bright-red",
    92: "bright-green",
    93: "bright-yellow",
    94: "bright-blue",
    95: "bright-magenta",
    96: "bright-cyan",
    97: "bright-white"
}

function loadDefaultLog() {
    fetch("../../data/slackzilla.log")
        .then(res => res.text())
        .then(renderLog)
        .catch(err => {
            log.innerHTML = `<div class="line">failed to load default log: ${escape(err.message)}</div>`
        })
}

fileInput.addEventListener("change", e => {
    const file = e.target.files[0]
    if (!file) {
        loadDefaultLog()
        return
    }

    file.text().then(renderLog)
})

document.body.addEventListener("dragover", e => {
    e.preventDefault()
})

document.body.addEventListener("drop", e => {
    e.preventDefault()

    const file = e.dataTransfer.files[0]
    if (!file) {
        loadDefaultLog()
        return
    }

    file.text().then(renderLog)
})

function renderLog(text) {
    log.innerHTML = ""

    for (const line of text.split(/\r?\n/)) {
        const div = document.createElement("div")
        div.className = "line"
        div.innerHTML = parseAnsi(escape(line))
        log.appendChild(div)
    }

    log.scrollTop = log.scrollHeight
}

function escape(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
}

function parseAnsi(text) {
    const regex = /\x1b\[([0-9;]+)m/g

    let html = ""
    let last = 0
    let current = ""

    for (const match of text.matchAll(regex)) {
        html += `<span class="${current}">${text.slice(last, match.index)}</span>`

        const codes = match[1].split(";").map(Number)

        for (const code of codes) {
            if (code === 0) {
                current = ""
            } else if (ansiColours[code]) {
                current = ansiColours[code]
            }
        }

        last = match.index + match[0].length
    }

    html += `<span class="${current}">${text.slice(last)}</span>`

    return html
}

    window.addEventListener("DOMContentLoaded", () => {
        loadDefaultLog()
})
