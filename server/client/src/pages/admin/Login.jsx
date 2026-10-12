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
        <PageShell title="Admin Login" description="Login to the admin panel">
            <section className="panel">
                <div className="panel-header">
                    <h1>Admin Login</h1>
                    <span className="panel-subtitle">Login to the admin panel</span>
                </div>
                <div className="panel-body">
                    {error && <p className="error-banner">{error}</p>}
                    <form className="admin-login-form" onSubmit={submit}>
                        <label htmlFor="password">Password</label>
                        <input type="password" name="password" id="password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required />
                        <button type="submit" disabled={busy}>{busy ? "Logging in..." : "Login"}</button>
                    </form>
                </div>
            </section>
        </PageShell>
    )
}

export default AdminLogin
