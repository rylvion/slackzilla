import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import PageShell from "../../components/PageShell"
import { refreshSession } from "../../components/utils/api"
import "../../css/admin/base.css"
import "../../css/admin/login.css"

function AdminLogin() {
    const navigate = useNavigate()
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        fetch("/admin/login", { headers: { Accept: "text/html" } }).then(response => {
            if (!response.redirected || new URL(response.url).pathname !== "/admin") return null
            return refreshSession()
        }).then(session => {
            if (session?.authenticated) navigate("/admin", { replace: true })
        }).catch(() => {})
    }, [navigate])

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        setError("")

        try {
            const response = await fetch("/admin/login", {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            })
            const result = await response.json()

            if (!response.ok || result.ok === false) {
                const retryAfter = Number(response.headers.get("Retry-After"))

                if (response.status === 429 && retryAfter > 0) {
                    const minutes = Math.floor(retryAfter / 60)
                    const seconds = retryAfter % 60
                    const wait = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

                    throw new Error(`Too many login attempts. Try again in ${wait}.`)
                }

                throw new Error(result.error || `Login failed with ${response.status}`)
            }

            await refreshSession()
            navigate(result.data?.redirect || "/admin")
        } catch (requestError) {
            setError(requestError.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <PageShell title="Admin Login" description="Login to the admin panel" shellClassName="login-shell">
            <section className="panel panel--interactive admin-login-panel" data-panel-id="admin-login">
                <div className="panel-header admin-login-header">
                    <div>
                        <span className="admin-login-prompt">&gt; ROOT ACCESS</span>
                        <h1>Administrator Console</h1>
                    </div>
                    <span className="panel-subtitle">RESTRICTED</span>
                </div>
                <div className="panel-body admin-login-body">
                    <p className="admin-login-description">Authenticate to continue to the Slackzilla administrator console.</p>
                    <form className="admin-login-form" onSubmit={submit}>
                        <label htmlFor="password">Password</label>
                        <input type="password" name="password" id="password" placeholder="Enter administrator password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" />
                        <button type="submit" disabled={busy} aria-busy={busy}>{busy ? "> AUTHENTICATING..." : "> LOGIN"}</button>
                    </form>
                    <div className={`admin-login-status${error ? " admin-login-status--error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">
                        {error ? error : "Authentication required"}
                    </div>
                    <p className="admin-login-footer">SLACKZILLA // RESTRICTED</p>
                </div>
            </section>
        </PageShell>
    )
}

export default AdminLogin
