import Head from "./Head"
import Header from "./Header"
import MainSidebar from "./MainSidebar"
import InternalSidebar from "./InternalSidebar"

import { useEffect, useState } from "react"

function PageShell({ title, description, csrfToken='', links = [], active='', children }) {
    const [state, setState] = useState({})

    useEffect(() => {
        let cancelled = false

        async function fetchState() {
            try {
                const response = await fetch("/api/status")

                if (!response.ok) { throw new Error(`HTTP ${response.status}`)}

                const result = await response.json()

                if (!cancelled) { setState(result.data ?? result) }
            } catch (error) {
                console.error("Failed to fetch bot state:", error)
            }
        }

        fetchState()

        return () => {
            cancelled = true
        }
    }, [])
    
    return (
        <>
            <Head title={title} description={description} state={state} csrfToken={csrfToken} />
            <Header />
            <MainSidebar active={active} state={state} />
            <main className="main-content">
                {links.length > 0 && <InternalSidebar links={links} />}
                <div className="content">{children}</div>
            </main>
        </>
    )
}

export default PageShell