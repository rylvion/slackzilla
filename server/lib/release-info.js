const path = require("path")

const projectRoot = path.resolve(__dirname, "..", "..")
const packageJson = require(path.join(projectRoot, "package.json"))
const releaseHistory = require(path.join(projectRoot, "release-history.json"))

function normaliseVersion(version) {
    return String(version || "")
        .toLowerCase()
        .trim()
        .replace(/^v/, "")
        .replace(/[^a-z0-9]/g, "")
}

function findVersion(requestedVersion) {
    if (!requestedVersion) return packageJson.version

    const normalised = normaliseVersion(requestedVersion)
    return Object.keys(releaseHistory).find(version => normaliseVersion(version) === normalised) || null
}

function getReleaseInfo(requestedVersion) {
    const currentVersion = packageJson.version
    const version = findVersion(requestedVersion)

    if (version === currentVersion) {
        return {
            currentVersion,
            version,
            summary: packageJson.releaseNotes?.summary || null,
            changes: packageJson.releaseNotes?.changes || []
        }
    }

    const release = version ? releaseHistory[version] : null

    return {
        currentVersion,
        version,
        summary: release?.summary || null,
        changes: release?.changes || []
    }
}

module.exports = {
    getReleaseInfo
}
