const { log } = require('../utils/logger')
const botMeta = require('../meta.js')
const releaseHistory = require('../../release-history.json')

module.exports = (app, meta) => {
    const releases = Object.entries(releaseHistory)

    const normaliseVersion = version => {
        return version
            .toLowerCase()
            .trim()
            .replace(/^v/, '')
            .replace(/[^a-z0-9]/g, '')
    }

    const getReleaseKey = version => {
        const normalised = normaliseVersion(version)

        return releases.find(([key]) => {
            return normaliseVersion(key) === normalised
        })?.[0]
    }

    const getFuzzyRelease = version => {
        const normalised = normaliseVersion(version)

        if (!normalised) {
            return null
        }

        let bestMatch = null
        let bestScore = 0

        for (const [key] of releases) {
            const candidate = normaliseVersion(key)

            let score = 0

            if (candidate.includes(normalised) || normalised.includes(candidate)) {
                score = 0.8
            }

            let matchingCharacters = 0

            for (const character of normalised) {
                if (candidate.includes(character)) {
                    matchingCharacters++
                }
            }

            const characterScore =
                matchingCharacters / Math.max(normalised.length, candidate.length)

            score = Math.max(score, characterScore)

            if (score > bestScore) {
                bestScore = score
                bestMatch = key
            }
        }

        return bestScore >= 0.65 ? bestMatch : null
    }

    const formatReleaseList = () => {
        return releases
            .map(([version, release]) => {
                const current = botMeta.releaseNotes === release
                    || version === botMeta.version

                return `${current ? '[CURRENT] ' : ''}*${version}* - ${release.summary}`
            })
            .join('\n')
    }

    const createReleaseBlocks = (version, release) => {
        const changes = release.changes
            .map(change => `• ${change}`)
            .join('\n')

        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `Slackzilla ${version}`
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${release.summary}*`
                }
            },
            {
                type: 'divider'
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Changes*\n${changes}`
                }
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `Slackzilla • ${version}`
                    }
                ]
            }
        ]
    }

    app.command(meta.cmd, async ({ ack, respond, command }) => {
        await ack()

        try {
            const args = command.text?.trim()

            if (args?.toLowerCase() === 'help') {
                await respond({
                    response_type: 'ephemeral',
                    attachments: [
                        {
                            color: botMeta.themeColor,
                            blocks: [
                                {
                                    type: 'header',
                                    text: {
                                        type: 'plain_text',
                                        text: 'Slackzilla Release'
                                    }
                                },
                                {
                                    type: 'section',
                                    text: {
                                        type: 'mrkdwn',
                                        text: 'Displays release notes for a specific Slackzilla version, or the current release when no version is supplied.'
                                    }
                                },
                                {
                                    type: 'section',
                                    text: {
                                        type: 'mrkdwn',
                                        text: '*Usage:*\n`/sz-release` - Displays the current release notes\n`/sz-release v0.9.4-beta` - Displays the release notes for v0.9.4-beta\n`/sz-release 0.9.4` - fuzzy matches and tells you mistyped version\n\n*Help:*\n`/sz-release help`'
                                    }
                                }
                            ]
                        }
                    ]
                })

                log.info('{user} requested {cmd} help', command)
                return
            }

            const requestedVersion = args

            if (!requestedVersion) {
                const currentVersion = botMeta.version
                const currentRelease = botMeta.releaseNotes

                if (!currentRelease?.changes?.length) {
                    await respond({
                        response_type: 'ephemeral',
                        text: `No release notes are available for *${currentVersion}*.`
                    })

                    log.error(
                        '{user} requested {cmd}, but no release notes were available: version={0}',
                        command,
                        currentVersion
                    )

                    return
                }

                await respond({
                    response_type: 'ephemeral',
                    attachments: [
                        {
                            color: botMeta.themeColor,
                            blocks: createReleaseBlocks(
                                currentVersion,
                                currentRelease
                            )
                        }
                    ]
                })

                log.info(
                    '{user} executed {cmd} command for current release {0}',
                    command,
                    currentVersion
                )

                return
            }

            const exactVersion = getReleaseKey(requestedVersion)

            if (exactVersion) {
                const release = releaseHistory[exactVersion]

                await respond({
                    response_type: 'ephemeral',
                    attachments: [
                        {
                            color: botMeta.themeColor,
                            blocks: createReleaseBlocks(
                                exactVersion,
                                release
                            )
                        }
                    ]
                })

                log.info(
                    '{user} viewed release {0} using {cmd}',
                    command,
                    exactVersion
                )

                return
            }

            const fuzzyMatch = getFuzzyRelease(requestedVersion)

            const availableReleases = formatReleaseList()

            let message = `❌ No matching release found for \`${requestedVersion}\`.`

            if (fuzzyMatch) {
                message += `\n\nDid you mean *${fuzzyMatch}*?`
            }

            message += `\n\n*Current available release notes:*\n${availableReleases}`

            await respond({
                response_type: 'ephemeral',
                attachments: [
                    {
                        color: botMeta.themeColor,
                        blocks: [
                            {
                                type: 'section',
                                text: {
                                    type: 'mrkdwn',
                                    text: message
                                }
                            }
                        ]
                    }
                ]
            })

            log.info(
                '{user} requested unknown release {0} using {cmd}',
                command,
                requestedVersion
            )
        } catch (error) {
            log.error(
                '{user} failed to execute {cmd}: {0}',
                command,
                error.message
            )

            await respond({
                response_type: 'ephemeral',
                text: `Failed to load the release notes: ${error.message}`
            })
        }
    })
}