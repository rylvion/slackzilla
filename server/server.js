require('dotenv').config({ path: __dirname + '/.env' })

const crypto = require('crypto')
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')

const port = Number(process.env.PORT || 9000)
const webhookPath = '/webhook'
const deployScript = path.join(__dirname, 'deploy.sh')
const deployBranch = process.env.BRANCH || 'main'

if (!process.env.WEBHOOK_SECRET) {
  console.error('Missing WEBHOOK_SECRET in server/.env')
  process.exit(1)
}

let deployInFlight = null

/***
 * responds to an HTTP request with a status code and message
 * @param {import('http').ServerResponse} res - the HTTP response object
 * @param {number} statusCode - the HTTP status code
 * @param {string} message - the response message
 */
function respond(res, statusCode, message) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(message)
}


/***
 * verifies the signature of a GitHub webhook request
 * @param {string} signature - the signature from the request headers
 * @param {Buffer} body - the raw request body
 * @returns {boolean} - true if the signature is valid, false otherwise
 */
function verifySignature(signature, body) {
  if (!signature || typeof signature !== 'string') {
    return false
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`

  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

/***
 * runs the deployment script if no deployment is currently in progress
 * @returns {Promise<void>} - a promise that resolves when the deployment is complete
 */
function runDeploy() {
  if (deployInFlight) {
    return deployInFlight
  }

  deployInFlight = new Promise((resolve, reject) => {
    const child = spawn('bash', [deployScript], {
      cwd: __dirname,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout.on('data', chunk => {
      process.stdout.write(chunk)
    })

    child.stderr.on('data', chunk => {
      process.stderr.write(chunk)
    })

    child.on('error', reject)

    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`deploy.sh exited with code ${code}`))
      }
    })
  }).finally(() => {
    deployInFlight = null
  })

  return deployInFlight
}


/***
 * creates an HTTP server that listens for GitHub webhook events and triggers deployment
 * @param {import('http').IncomingMessage} req - the HTTP request object
 * @param {import('http').ServerResponse} res - the HTTP response object
 */
http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    respond(res, 200, 'Slackzilla webhook server is running\n')
    return
  }

  if (req.url !== webhookPath) {
    respond(res, 404, 'Not found\n')
    return
  }

  if (req.method !== 'POST') {
    respond(res, 405, 'Method not allowed\n')
    return
  }

  const chunks = []
  let size = 0

  req.on('data', chunk => {
    size += chunk.length

    if (size > 1024 * 1024) {
      req.destroy()
      return
    }

    chunks.push(chunk)
  })

  req.on('end', () => {
    const rawBody = Buffer.concat(chunks)
    const signature = req.headers['x-hub-signature-256']
    const event = req.headers['x-github-event']

    if (!verifySignature(signature, rawBody)) {
      respond(res, 401, 'Invalid signature\n')
      return
    }

    let payload

    try {
      payload = JSON.parse(rawBody.toString('utf8'))
    } catch {
      respond(res, 400, 'Invalid JSON payload\n')
      return
    }

    if (event !== 'push') {
      respond(res, 202, 'Ignored non-push event\n')
      return
    }

    const branchRef = `refs/heads/${deployBranch}`

    if (payload.ref !== branchRef) {
      respond(res, 202, `Ignored push for ${payload.ref || 'unknown ref'}\n`)
      return
    }

    if (deployInFlight) {
      respond(res, 409, 'Deployment already running\n')
      return
    }

    respond(res, 202, `Accepted deploy for ${branchRef}\n`)

    runDeploy().catch(err => {
      console.error('Deployment failed')
      console.error(err)
    })
  })
}).listen(port, () => {
  console.log(`Slackzilla webhook server listening on port ${port}`)
})