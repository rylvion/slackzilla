import React from "react"
import ErrorPanel from "./ErrorPanel"

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            hasError: false,
            error: null
        }
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error
        }
    }

    componentDidCatch(error, errorInfo) {
        console.error("React rendering error:", error)
        console.error("Component stack:", errorInfo.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorPanel
                    code="REACT_RENDER_ERROR"
                    error={this.state.error}
                    showDetails={true}
                />
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary