import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ERROR_CODES, CLIENT_ERRORS } from "./utils/errors.js"
import PanelInteractions from "./PanelInteractions"

function ErrorPanel({
    code,
    error = null,
    action = () => window.location.reload(),
    actionLabel = "reload",
    showDetails = false,
    overlay = false,
    mode = "error",
    title,
    message,
    details,
    confirmLabel = "continue",
    cancelLabel = "cancel",
    onConfirm,
    onCancel
}) {
    const [showStack, setShowStack] = useState(false)
    const [copied, setCopied] = useState(false)
    const confirmRef = useRef(null)

    useEffect(() => {
        if (!overlay || mode !== "confirm") return undefined

        confirmRef.current?.focus()
        function handleKeyDown(event) {
            if (event.key === "Escape") onCancel?.()
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [mode, onCancel, overlay])

    if (overlay && mode === "confirm") {
        const confirmation = (
            <div className="error-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel?.() }}>
                <div className="error-boundary__content error-overlay__content" role="dialog" aria-modal="true" aria-labelledby="error-overlay-title">
                    <div className="error-boundary__header">
                        <div className="error-boundary__brand">
                            <span className="error-boundary__indicator"></span>
                            <span>SLACKZILLA</span>
                        </div>
                        <span className="error-boundary__header-status">CONFIRMATION</span>
                    </div>
                    <div className="error-boundary__body">
                        <div className="error-boundary__code">EXTERNAL_DESTINATION</div>
                        <h1 id="error-overlay-title">{title || "Open external link?"}</h1>
                        <p className="error-boundary__status"><span>LINK</span>{message || "This destination will open in a new browser tab."}</p>
                        {details && <p className="error-overlay__details">{details}</p>}
                        <div className="error-overlay__actions">
                            <button ref={confirmRef} className="error-boundary__reload" type="button" onClick={onConfirm}><span>&gt;</span> {confirmLabel}</button>
                            <button className="error-boundary__copy" type="button" onClick={onCancel}>{cancelLabel}</button>
                        </div>
                    </div>
                </div>
            </div>
        )

        return createPortal(confirmation, document.body)
    }

    const errorConfig = typeof code === "string" ? CLIENT_ERRORS[code] : ERROR_CODES[code]

    if (!errorConfig) {
        console.error(`Unknown error code: ${code}`)

        return (
            <>
            <div className="error-boundary">
                <div className="error-boundary__content">
                    <div className="error-boundary__header">
                        <div className="error-boundary__brand">
                            <span className="error-boundary__indicator"></span>
                            <span>SLACKZILLA</span>
                        </div>
                        <span className="error-boundary__header-status">UNKNOWN ERROR</span>
                    </div>

                    <div className="error-boundary__body">
                        <div className="error-boundary__code">UNKNOWN_ERROR</div>
                        <h1>Unknown Error</h1>
                        <p className="error-boundary__status"><span>ERR</span>An unrecognised error occurred.</p>
                    </div>
                </div>
            </div>
            <PanelInteractions pathname="error-panel" />
            </>
        )
    }

    const errorText = showStack? error?.stack || error?.toString() : error?.toString()

    const handleCopy = async () => {
        if (!errorText) return

        try {
            await navigator.clipboard.writeText(errorText)
            setCopied(true)
            setTimeout(() => { setCopied(false) }, 2000)
        } catch (copyError) {
            console.error("Failed to copy error:", copyError)
        }
    }

    return (
        <>
        <div className="error-boundary">
            <div className="error-boundary__content">

                <div className="error-boundary__header">
                    <div className="error-boundary__brand">
                        <span className="error-boundary__indicator"></span>
                        <span>SLACKZILLA</span>
                    </div>

                    <span className="error-boundary__header-status">{errorConfig.status}</span>
                </div>

                <div className="error-boundary__body">
                    <div className="error-boundary__code">{typeof errorConfig.code === "number" ? `ERROR_${errorConfig.code}` : errorConfig.code}</div>
                    <h1>{errorConfig.title}</h1>
                    <p className="error-boundary__status"><span>ERR</span>{errorConfig.message}</p>
                    <p className="error-boundary__description">{errorConfig.description}</p>

                    {action && (<button className="error-boundary__reload" onClick={action}><span>&gt;</span> {actionLabel}</button>)}

                    {showDetails && error && (
                        <div className="error-boundary__details">
                            <div className="error-boundary__details-header">
                                <span>ERROR DETAILS</span>

                                <div className="error-boundary__actions">
                                    <button className="error-boundary__copy" onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</button>
                                    <button className="error-boundary__copy" onClick={() => { setShowStack(prev => !prev); setCopied(false)}}>
                                        {showStack ? "Hide Stack" : "View Stack"}
                                    </button>
                                </div>
                            </div>

                            <pre className="error-boundary__error">{errorText}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <PanelInteractions pathname="error-panel" />
        </>
    )
}

export default ErrorPanel
