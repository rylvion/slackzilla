const fs = require('fs')
const path = require('path')

const packagePath = path.resolve(__dirname, '../package.json')
const releaseHistoryPath = path.resolve(__dirname, '../release-history.json')
const checkOnly = process.argv.includes('--check')

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
        console.error(`Failed to read ${filePath}`)
        console.error(error.message)
        process.exit(1)
    }
}

function writeJson(filePath, data) {
    try {
        fs.writeFileSync(
            filePath,
            JSON.stringify(data, null, 4) + '\n'
        )
    } catch (error) {
        console.error(`Failed to write ${filePath}`)
        console.error(error.message)
        process.exit(1)
    }
}

const packageJson = readJson(packagePath)
const releaseHistory = readJson(releaseHistoryPath)

const version = packageJson.version
const releaseNotes = packageJson.releaseNotes

if (!version) {
    console.error('package.json is missing a version')
    process.exit(1)
}

if (!releaseNotes) {
    console.error(`package.json is missing releaseNotes for ${version}`)
    process.exit(1)
}

if (
    typeof releaseNotes.summary !== 'string' ||
    !Array.isArray(releaseNotes.changes)
) {
    console.error(`Invalid releaseNotes format for ${version}`)
    process.exit(1)
}

const existingRelease = releaseHistory[version]

if (!existingRelease) {
    if (checkOnly) {
        console.error(`Release notes for ${version} are missing from release-history.json`)
        process.exit(1)
    }

    releaseHistory[version] = {
        summary: releaseNotes.summary,
        changes: releaseNotes.changes
    }

    writeJson(releaseHistoryPath, releaseHistory)

    console.log(`Added release notes for ${version}`)
    process.exit(0)
}

const summaryChanged = existingRelease.summary !== releaseNotes.summary
const changesChanged =
    JSON.stringify(existingRelease.changes) !== JSON.stringify(releaseNotes.changes)

if (!summaryChanged && !changesChanged) {
    console.log(`Release notes for ${version} are already up to date`)
    process.exit(0)
}

if (checkOnly) {
    console.error(`Release notes for ${version} are out of date`)
    process.exit(1)
}

releaseHistory[version] = {
    summary: releaseNotes.summary,
    changes: releaseNotes.changes
}

writeJson(releaseHistoryPath, releaseHistory)

console.log(`Updated release notes for ${version}`)
