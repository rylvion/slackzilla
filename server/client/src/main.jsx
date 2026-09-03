// DO NOT touch this file unless you know what your doing, this loads and renders the ENTIRE React app, WITHOUT THIS nothing will work 
// to run this run `npm run dev` and open 'http://localhost:5173' (unless your in the server read documentation for more details)

import { StrictMode } from "react"
import { HelmetProvider } from "react-helmet-async"
import { createRoot } from "react-dom/client"
import "./css/dashboard.css"
import App from "./App.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"

// const healthy = await fetch("/api/health")
//     .then(async res => {
//         if (!res.ok) throw new Error("Health check failed")
//         const contentType = res.headers.get("content-type")
//         if (!contentType?.includes("application/json")) { throw new Error("Health endpoint returned non-JSON response") }
//         const data = await res.json()
//         if (data.status !== "ok") { throw new Error("Health endpoint returned unhealthy status") }

//         return true
//     })
//     .catch(() => false)


// if (import.meta.env.DEV) {
//     console.log("React app is running in developer mode [Port: 5173] (" + (healthy ? "its healthy :D" : "unhealthy api :(") + " )")
// }

// if (!healthy) {
//     console.error("React app failed to connect to the server API. Please check the server logs for more information.")
//     document.body.innerHTML = `
//         <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center;">
//             <h1 style="color: #ff5f56;">Server API Unreachable</h1>
//             <p style="color: #50665a;">The React app could not connect to the server API. Please check the server logs for more information.</p>
//             <p style="color: #50665a;">If you are running in development mode, ensure that the server is running and accessible at <code>http://localhost:5173</code>.</p>
//         </div>
//     `
//     throw new Error("Server API Unreachable")
// }

createRoot(document.getElementById("root")).render(
    <HelmetProvider>
        <StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </StrictMode>
    </HelmetProvider>
)
