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
    const version = findVersion(requestedVersion)
    const release = version ? releaseHistory[version] : null
    const releaseCommandPath = "bot/cmds/release.js"

    return {
        currentVersion: packageJson.version,
        packageReleaseNotes: packageJson.releaseNotes || null,
        requestedVersion: requestedVersion || null,
        version,
        release,
        availableVersions: Object.keys(releaseHistory),
        sources: [
            { path: "package.json", purpose: "current version and package release notes" },
            { path: "release-history.json", purpose: "versioned release summaries and changes" },
            { path: releaseCommandPath, purpose: "Slack release command lookup and formatting" }
        ],
        releaseCommand: {
            command: "/sz-release",
            implementation: releaseCommandPath,
            supports: ["current release", "exact version lookup", "fuzzy version suggestions"]
        }
    }
}

module.exports = {
    getReleaseInfo
}
