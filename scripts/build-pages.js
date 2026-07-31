const fs = require("fs/promises")
const path = require("path")

const { minify } = require("terser")
const { minify: minifyHTML } = require("html-minifier-terser")
const CleanCSS = require("clean-css")

const ROOT = process.cwd()

const SRC = {
    pages: path.join(ROOT, "local", "pages"),
    css: path.join(ROOT, "local", "css"),
    js: path.join(ROOT, "local", "js"),
    data: path.join(ROOT, "local", "data")
}

const DIST = path.join(ROOT, "dist")

const redirect = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; url=logs/">
    <script>
        location.replace("logs/")
    </script>
</head>
<body>
    Redirecting to <a href="logs/">logs</a>...
</body>
</html>`

await fs.writeFile(path.join(DIST, "index.html"), redirect)

console.log("ROOT  index.html")

async function removeDist() {
    await fs.rm(DIST, {
        recursive: true,
        force: true
    })

    await fs.mkdir(DIST, {
        recursive: true
    })
}

async function walk(dir) {
    const entries = await fs.readdir(dir, {
        withFileTypes: true
    })

    let files = []

    for (const entry of entries) {
        const full = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            files.push(...await walk(full))
        } else {
            files.push(full)
        }
    }

    return files
}

async function ensure(file) {
    await fs.mkdir(path.dirname(file), {
        recursive: true
    })
}

async function buildHTML() {
    const files = await walk(SRC.pages)

    for (const file of files) {
        if (!file.endsWith(".html")) continue

        const relative = path.relative(SRC.pages, file)
        const output = path.join(DIST, relative)

        const html = await fs.readFile(file, "utf8")

        const result = await minifyHTML(html, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeEmptyAttributes: true,
            minifyCSS: true,
            minifyJS: true
        })

        await ensure(output)
        await fs.writeFile(output, result)

        console.log(`HTML  ${relative}`)
    }
}

async function buildJS() {
    const files = await walk(SRC.js)

    for (const file of files) {
        if (!file.endsWith(".js")) continue

        const relative = path.relative(SRC.js, file)
        const output = path.join(DIST, "js", relative)

        const code = await fs.readFile(file, "utf8")

        const result = await minify(code, {
            compress: true,
            mangle: true
        })

        await ensure(output)
        await fs.writeFile(output, result.code)

        console.log(`JS    ${relative}`)
    }
}

async function buildCSS() {
    const files = await walk(SRC.css)

    const cleaner = new CleanCSS()

    for (const file of files) {
        if (!file.endsWith(".css")) continue

        const relative = path.relative(SRC.css, file)
        const output = path.join(DIST, "css", relative)

        const css = await fs.readFile(file, "utf8")
        const result = cleaner.minify(css)

        if (result.errors.length) {
            throw new Error(result.errors.join("\n"))
        }

        await ensure(output)
        await fs.writeFile(output, result.styles)

        console.log(`CSS   ${relative}`)
    }
}

async function copyData() {
    const files = await walk(SRC.data)

    for (const file of files) {
        const relative = path.relative(SRC.data, file)
        const output = path.join(DIST, "data", relative)

        await ensure(output)
        await fs.copyFile(file, output)

        console.log(`DATA  ${relative}`)
    }
}

async function main() {
    console.log("Building GitHub Pages...")

    await removeDist()

    await Promise.all([
        buildHTML(),
        buildCSS(),
        buildJS(),
        copyData()
    ])

    console.log("")
    console.log("Build complete.")
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})