import { useNavigate } from "react-router-dom"
import ErrorPanel from "../components/ErrorPanel.jsx"

function NotFound() {
    const navigate = useNavigate()
    const handleReturnHome = () => { navigate("/") }
    <ErrorPanel code={404} action={handleReturnHome} actionLabel="return home"/>
}

export default NotFound