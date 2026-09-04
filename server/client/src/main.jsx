// DO NOT touch this file unless you know what your doing, this loads and renders the ENTIRE React app, WITHOUT THIS nothing will work 
// to run this run `npm run dev` and open 'http://localhost:5173' (unless your in the server read documentation for more details)

import { StrictMode } from "react"
import { HelmetProvider } from "react-helmet-async"
import { createRoot } from "react-dom/client"
import "./css/dashboard.css"
import App from "./App.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"

createRoot(document.getElementById("root")).render(
    <HelmetProvider>
        <StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </StrictMode>
    </HelmetProvider>
)
