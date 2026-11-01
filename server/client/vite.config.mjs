import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const virtualModuleId = 'virtual:slackzilla-docs'
const resolvedVirtualModuleId = `\0${virtualModuleId}`
const projectRoot = path.resolve(process.cwd())

function collectMarkdown(directory, prefix = '') {
    if (!fs.existsSync(directory)) return {}

    return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolutePath = path.join(directory, entry.name)
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

        if (entry.isDirectory()) return Object.entries(collectMarkdown(absolutePath, relativePath))
        if (!entry.isFile() || !entry.name.endsWith('.md')) return []

        return [[relativePath.replaceAll('\\', '/'), fs.readFileSync(absolutePath, 'utf8')]]
    }))
}

function docsVirtualModule() {
    return {
        name: 'slackzilla-docs',
        resolveId(id) {return id === virtualModuleId ? resolvedVirtualModuleId : undefined },
        load(id) {
            if (id !== resolvedVirtualModuleId) return undefined

            const sources = {
                ...collectMarkdown(path.join(projectRoot, 'docs'), 'docs'),
                ...collectMarkdown(path.join(projectRoot, 'assets', 'devlogs'), 'assets/devlogs'),
                'README.md': fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8')
            }

            return `export default ${JSON.stringify(sources)}`
        }
    }
}

export default defineConfig({
    root: 'server/client',
    plugins: [docsVirtualModule(), react()],
    build: { sourcemap: true }
})