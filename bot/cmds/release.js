
const { log } = require('../utils/logger')
const botMeta = require('../meta.js')
const releaseHistory = require('../../release-history.json')

module.exports = (app, meta) => {
    const releases = Object.entries(releaseHistory)
    const normalise = version => version.toLowerCase().trim().replace(/^v/, '').replace(/[^a-z0-9]/g, '')

    const findRelease = version => releases.find(([key]) => normalise(key) === normalise(version))?.[0]

    const fuzzyRelease = version => {
        const input = normalise(version)
        if (!input) return null

        let best = null
        let bestScore = 0

        for (const [key] of releases) {
            const candidate = normalise(key)
            const score = Math.max(
                candidate.includes(input) || input.includes(candidate) ? 0.8 : 0,
                new Set(input).size? [...new Set(input)].filter(char => candidate.includes(char)).length / Math.max(input.length, candidate.length) : 0
            )

            if (score > bestScore) [bestScore, best] = [score, key]
        }

        return bestScore >= 0.65 ? best : null
    }

    const respond = (response, blocks) => response({
        response_type: 'ephemeral',
        attachments: [{ color: botMeta.themeColor, blocks }]
    })


    const releaseBlocks = (version, release) => {
        const blocks = [
            { type: 'header', text: { type: 'plain_text', text: `Slackzilla ${version}` } },
            { type: 'section', text: { type: 'mrkdwn', text: `*${release.summary.slice(0, 2900)}*` } },
            { type: 'divider' }
        ]

        let current = '*Changes*\n'

        for (const change of release.changes || []) {
            const line = `• ${change}\n`

            if (current.length + line.length > 2900) {
                blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current } })
                current = ''
            }

            for (let i = 0; i < line.length; i += 2900) {
                if (current.length + Math.min(2900, line.length - i) > 2900) {
                    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current } })
                    current = ''
                }
                current += line.slice(i, i + 2900)
            }
        }

        if (current) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current } })
        blocks.push({type: 'context', elements: [{ type: 'mrkdwn', text: `Slackzilla • ${version}` }]})
        if (blocks.length > 50) throw new Error(`Too many Slack blocks: ${blocks.length}/50`)

        return blocks
    }


    app.command(meta.cmd, async ({ ack, respond: reply, command }) => {
        await ack()

        try {
            const args = command.text?.trim()


            if (args?.toLowerCase() === 'help') {
                const available = releases.map(([version, release]) =>`• *${version}*${version === botMeta.version ? ' `[CURRENT]`' : ''}\n  ${release.summary}`).join('\n\n')

                await reply({
                    response_type: 'ephemeral',
                    attachments: [{
                        color: botMeta.themeColor,
                        blocks: [
                            { type: 'header', text: { type: 'plain_text', text: 'Slackzilla Release' } },
                            { type: 'section', text: { type: 'mrkdwn', text: 'check out the release notes for Slackzilla, including previous versions and their changes.' } },
                            { type: 'section', text: { type: 'mrkdwn', text: '*Usage:*\n`/sz-release` - pulls up the latest release\n`/sz-release v1.0.0-release` - shows a specific release\n`/sz-release 0.9.4` - fuzzy matches \n`/sz-release help` - err your looking at it???' } },
                            { type: 'divider' },
                            { type: 'section', text: { type: 'mrkdwn', text: `*Available releases (${releases.length}):*\n\n${available}`.slice(0, 2900) } }
                        ]
                    }]
                })

                log.success('{user} requested {cmd} help', command)
                return
            }


            const version = args || botMeta.version
            const exact = args ? findRelease(args) : null
            const key = exact || (!args ? version : null)
            const release = key ? releaseHistory[key] || botMeta.releaseNotes : null

            if (release?.changes?.length) {
                await reply({
                    response_type: 'ephemeral',
                    attachments: [{ color: botMeta.themeColor, blocks: releaseBlocks(key, release) }]
                })

                log.success('{user} viewed release {0} using {cmd}', command, key)
                return
            }

            if (!args && !release?.changes?.length) {
                await reply({ response_type: 'ephemeral', text: `No release notes are available for *${version}*.` })
                log.error('{user} requested {cmd}, but no release notes were available: version={0}', command, version)
                return
            }

            const fuzzy = fuzzyRelease(args)
            const available = releases.map(([key, release]) => `${key === botMeta.version ? '[CURRENT] ' : ''}*${key}* - ${release.summary}`).join('\n')
            await respond(reply, [{
                type: 'section',
                text: {type: 'mrkdwn', text: `❌ No matching release found for \`${args}\`.${fuzzy ? `\n\nDid you mean *${fuzzy}*?` : ''}\n\n*Current available release notes:*\n${available}`}
            }])

            log.error('{user} requested an unknown release using {cmd}', command)
        } catch (error) {
            log.error('{user} failed to execute {cmd}: {0}', command, error.message)
            await reply({ response_type: 'ephemeral', text: `Failed to load the release notes: ${error.message}` })
        }
    })
}
