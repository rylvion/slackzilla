import PageShell from "../components/PageShell"
import "../css/docs.css"

function Docs() {
    return (
        <PageShell title="Docs" description="Slackzilla operations and extension guide" active="docs">
            <section className="panel">
                    <div className="panel-header">
                        <h1>API developer guide</h1>
                        <span className="panel-subtitle">create - register - test</span>
                    </div>

                    <div className="docs-content">
                        <p className="docs-lead">An API endpoint is a URL and HTTP method that lets another program request data or ask Slackzilla to perform an action. This project uses a small Node <code>http</code> server, so API handlers are plain functions rather than Express routers.</p>

                        <div className="docs-section">
                            <span className="eyebrow">01 / ARCHITECTURE</span>
                            <h2>How an API request works</h2>
                            <p>The server receives every request in <code>server/server.js</code>. The <code>handleApi</code> function checks each registered handler in order. A handler examines <code>url.pathname</code> and <code>req.method</code>, sends a response when it owns the request, and returns <code>true</code>. Returning <code>false</code> lets the next handler try.</p>
                            <p>API modules live under <code>server/api/&lt;name&gt;/index.js</code>. They receive <code>req</code>, <code>res</code>, <code>url</code>, and a shared <code>context</code>. Use <code>context.sendOk(res, data)</code> for successful JSON and <code>context.sendError(res, status, code, message)</code> for errors. JSON responses normally look like <code>{"{"}ok: true, data: ...{"}"}</code>.</p>
                        </div>

                        <div className="docs-section">
                            <span className="eyebrow">02 / THREE PARTS</span>
                            <h2>Implementation, schema, registry</h2>
                            <div className="doc-grid docs-three">
                                <article><h3>Implementation</h3><p>The JavaScript handler that receives the request and produces the response.</p><code>server/api/status/index.js</code></article>
                                <article><h3>Schema</h3><p>A JSON Schema describing the response shape. It is documentation and contract information; runtime validation is not currently automatic.</p><code>server/api/status/status.schema.json</code></article>
                                <article><h3>Registry</h3><p>Frontend metadata used to describe method, path, ownership, authentication and schema links. It does not create or serve an API.</p><code>server/client/src/components/utils/api-routes.js</code></article>
                            </div>
                        </div>

                        <div className="docs-section">
                            <span className="eyebrow">03 / WORKFLOW</span>
                            <h2>Add an API without learning the whole backend</h2>
                            <ol className="docs-steps">
                                <li>Create <code>server/api/myApi/</code>.</li>
                                <li>Add <code>server/api/myApi/index.js</code> and export <code>handleMyApi</code>.</li>
                                <li>Add <code>server/api/myApi/my-api.schema.json</code> describing the response.</li>
                                <li>Import the handler in <code>server/server.js</code> and add it to <code>handleApi</code>.</li>
                                <li>Add matching metadata to <code>api-routes.js</code>, linking <code>livesAt</code> and <code>schema</code>.</li>
                                <li>Build, start the server, and test the endpoint.</li>
                            </ol>
                        </div>

                        <div className="docs-section">
                            <span className="eyebrow">04 / EXAMPLE</span>
                            <h2>A complete small endpoint</h2>
                            <p>Folder structure:</p>
                            <pre><code>{`server/api/myApi/
|------index.js
|------my-api.schema.json`}</code></pre>
                            <p>Implementation:</p>
                            <pre><code>{`function handleMyApi({ req, res, url, context }) {
    if (url.pathname !== "/api/my-api" || req.method !== "GET") {
        return false
    }

    context.sendOk(res, { message: "Hello from my API" })
    return true
}

module.exports = { handleMyApi }`}</code></pre>
                            <p>Register it in <code>server/server.js</code>:</p>
                            <pre><code>{`const { handleMyApi } = require("./api/myApi")

async function handleApi(req, res, url) {
    if (await handleMyApi({ req, res, url, context })) return true
    // existing handlers follow
}`}</code></pre>
                                                <p>Schema file:</p>
                                                <pre><code>{`{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "My API response data",
    "type": "object",
    "required": ["message"],
    "properties": {
        "message": { "type": "string" }
    }  
}`}</code></pre>
                            <p>Link the implementation and schema in the frontend registry. Include an <code>id</code>, <code>operationId</code>, <code>uuid</code>, <code>method</code>, <code>path</code>, <code>description</code>, <code>tags</code>, <code>categories</code>, <code>livesAt</code>, <code>schema</code>, <code>parameters</code>, and <code>responses</code>.</p>
                        </div>

                        <div className="docs-section">
                            <span className="eyebrow">05 / SAFETY</span>
                            <h2>Requests, auth and CSRF</h2>
                            <p>Read query values from <code>url.searchParams</code>. For JSON or form bodies, use <code>context.parseBody(req)</code> and assign the result to <code>req.body</code>. Keep input validation close to the handler and return a useful status code.</p>
                            <p>Private endpoints must call <code>context.auth.requireSession(req, res)</code> before reading data. State-changing admin endpoints must also call <code>context.auth.verifyCsrf(req, session)</code>. Document these requirements in the registry so clients know what to send.</p>
                        </div>

                        <div className="docs-section">
                            <span className="eyebrow">06 / TESTING</span>
                            <h2>Test locally</h2>
                            <p>Build the client, then start the dashboard server. <code>npm start</code> starts both bot and server; <code>npm run build</code> followed by <code>npm run server</code> is the narrower dashboard check.</p>
                            <pre><code>{`npm start`}</code></pre>
                            <p>A browser is enough for a simple public <code>GET</code>. Use Postman or another API client for headers, query parameters, request bodies, authentication, CSRF, and methods such as <code>POST</code>.</p>
                            <p>Before considering an API complete, check its status code and response against the schema, confirm the handler is registered, verify <code>livesAt</code> and <code>schema</code> paths, and test authentication and CSRF rules where applicable.</p>
                        </div>
                    </div>
                </section>
            </PageShell>
        )
    }

    export default Docs