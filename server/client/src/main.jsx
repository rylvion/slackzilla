// DO NOT touch this file unless you know what your doing, this loads and renders the ENTIRE React app, WITHOUT THIS nothing will work 
// to run this run `npm start` in the server folder, then go to http://localhost:9000 to your browser

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
