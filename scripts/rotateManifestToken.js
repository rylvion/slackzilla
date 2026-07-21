const sodium = require('sodium-native')
const { Octokit } = require('@octokit/rest')

const slackRefreshToken = process.env.SLACK_REFRESH_TOKEN
const githubToken = process.env.GH_SECRET_PAT
const repository = process.env.GITHUB_REPOSITORY

function fail(message) {
    console.error(`token rotation failed: ${message}`)
    process.exit(1)
}

if (!slackRefreshToken) {
    fail('missing SLACK_REFRESH_TOKEN')
}

if (!githubToken) {
    fail('missing GH_SECRET_PAT')
}

if (!repository) {
    fail('missing GITHUB_REPOSITORY')
}

const [owner, repo] = repository.split('/')

if (!owner || !repo) {
    fail('invalid repository format')
}

async function rotateSlackToken() {
    const body = new URLSearchParams()
    body.append('refresh_token', slackRefreshToken)

    const response = await fetch('https://slack.com/api/tooling.tokens.rotate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    })

    const text = await response.text()
    console.log(`HTTP ${response.status}`)

    let data

    try {
        data = JSON.parse(text)
    } catch {
        fail(`Slack returned invalid JSON:\n${text}`)
    }

    if (!data.ok) {
        console.error(`HTTP ${response.status}`)
        console.error(JSON.stringify(data, null, 2))
        fail(`Slack rotation failed: ${data.error}`)
    }

    return {
        accessToken: data.token,
        refreshToken: data.refresh_token
    }
}

async function encryptSecret(value, publicKey) {
    const message = Buffer.from(value)
    const key = Buffer.from(publicKey, 'base64')

    const encrypted = Buffer.alloc(
        sodium.crypto_box_SEALBYTES + message.length
    )

    sodium.crypto_box_seal(
        encrypted,
        message,
        key
    )

    return encrypted.toString('base64')
}

async function updateGithubSecret(name, value, octokit) {
    const keyResponse = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/secrets/public-key',
        {
            owner,
            repo
        }
    )

    const encryptedValue = await encryptSecret(
        value,
        keyResponse.data.key
    )

    await octokit.request(
        'PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}',
        {
            owner,
            repo,
            secret_name: name,
            encrypted_value: encryptedValue,
            key_id: keyResponse.data.key_id
        }
    )

    console.log(`updated ${name}`)
}

async function main() {
    console.log('rotating Slack manifest token...')

    const tokens = await rotateSlackToken()

    console.log('slack token rotation successful')

    if (!tokens.refreshToken) {
        fail('slack did not return a new refresh token')
    }

    if (process.env.GITHUB_ENV) {
        fs.appendFileSync(
            process.env.GITHUB_ENV,
            `SLACK_MANIFEST_TOKEN=${tokens.accessToken}\n`
        )
    }

    const octokit = new Octokit({
        auth: githubToken
    })

    await updateGithubSecret(
        'SLACK_MANIFEST_TOKEN',
        tokens.accessToken,
        octokit
    )

    await updateGithubSecret(
        'SLACK_REFRESH_TOKEN',
        tokens.refreshToken,
        octokit
    )

    console.log('token rotation complete')
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})