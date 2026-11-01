import { useLocation, useNavigate } from "react-router-dom"
import ErrorPanel from "../components/ErrorPanel.jsx"

function NotFound() {
    const navigate = useNavigate()
    const location = useLocation()

    const requestedUrl = `${window.location.origin}${location.pathname}${location.search}${location.hash}`

   const error = new Error(`Route not found: ${requestedUrl}`)

    error.name = "NotFoundError"
    error.code = 404
    error.details = {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        route: "not-found"
    }
    
    return <ErrorPanel code={404} error={error} action={() => navigate("/")} actionLabel="return home" showDetails={true} />
}

export default NotFound
