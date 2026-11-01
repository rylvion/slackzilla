
import { useEffect } from "react"

let nextPanelZIndex = 1001

function PanelInteractions({ pathname }) {
    useEffect(() => {
        const mobileQuery = window.matchMedia("(max-width: 700px)")
        let cleanupPanels = () => {}

        try {
            localStorage.removeItem("slackzilla-panel-layout-v2")
        } catch {
            // ignore persisted layout
        }

        function attachInteractions() {
            if (mobileQuery.matches) return () => {}

            const panels = [...document.querySelectorAll(".panel, .error-boundary, .error_boundary")]
            const cleanups = []

            panels.forEach((panel, index) => {
                const isErrorBoundary = panel.matches(".error-boundary, .error_boundary")
                const interactionTarget = isErrorBoundary
                    ? panel.querySelector(".error-boundary__content, .error_boundary__content")
                    : panel

                if (!interactionTarget) return

                const id = interactionTarget.dataset.panelId || `${window.location.pathname}:panel-${index}`
                interactionTarget.dataset.panelId = id

                const dragSurface = isErrorBoundary
                    ? interactionTarget.querySelector(".error-boundary__header, .error_boundary__header")
                    : panel.querySelector(".panel-header")

                const resizeContainer = isErrorBoundary
                    ? interactionTarget.querySelector(".error-boundary__body, .error_boundary__body") || interactionTarget
                    : interactionTarget

                if (!dragSurface) return

                interactionTarget.classList.add("panel--has-interactions")

                const resizeHandle = document.createElement("span")
                resizeHandle.className = "panel-resize-handle"
                resizeHandle.setAttribute("aria-hidden", "true")
                resizeContainer.append(resizeHandle)

                let action = null
                let start = null

                function move(event) {
                    if (!action || !start) return

                    if (action === "drag") {
                        const x = start.x + event.clientX - start.clientX
                        const y = start.y + event.clientY - start.clientY

                        interactionTarget.dataset.panelX = String(x)
                        interactionTarget.dataset.panelY = String(y)
                        interactionTarget.style.transform = `translate(${x}px, ${y}px)`
                    } else {
                        interactionTarget.style.width = `${Math.max(320, start.width + event.clientX - start.clientX)}px`
                        interactionTarget.style.height = `${Math.max(180, start.height + event.clientY - start.clientY)}px`
                    }
                }

                function stop() {
                    if (!action) return

                    action = null
                    start = null
                    interactionTarget.classList.remove("panel--is-moving", "panel--is-resizing")
                    window.removeEventListener("pointermove", move)
                    window.removeEventListener("pointerup", stop)
                }

                function beginDrag(event) {
                    if (mobileQuery.matches || event.target.closest("button, a, input, textarea, select")) return

                    action = "drag"
                    start = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                        x: Number.parseFloat(interactionTarget.dataset.panelX || "0"),
                        y: Number.parseFloat(interactionTarget.dataset.panelY || "0")
                    }

                    interactionTarget.style.setProperty("z-index", String(nextPanelZIndex++), "important")
                    interactionTarget.classList.add("panel--is-moving")
                    window.addEventListener("pointermove", move)
                    window.addEventListener("pointerup", stop)
                    event.preventDefault()
                }

                function beginResize(event) {
                    if (mobileQuery.matches) return

                    action = "resize"
                    start = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                        width: interactionTarget.offsetWidth,
                        height: interactionTarget.offsetHeight
                    }

                    interactionTarget.style.setProperty("z-index", String(nextPanelZIndex++), "important")
                    interactionTarget.classList.add("panel--is-resizing")
                    window.addEventListener("pointermove", move)
                    window.addEventListener("pointerup", stop)
                    event.preventDefault()
                    event.stopPropagation()
                }

                dragSurface.addEventListener("pointerdown", beginDrag)
                resizeHandle.addEventListener("pointerdown", beginResize)

                cleanups.push(() => {
                    stop()
                    dragSurface.removeEventListener("pointerdown", beginDrag)
                    resizeHandle.removeEventListener("pointerdown", beginResize)
                    resizeHandle.remove()
                    interactionTarget.classList.remove("panel--has-interactions")
                })
            })

            return () => cleanups.forEach(cleanup => cleanup())
        }

        function refreshInteractions() {
            cleanupPanels()
            cleanupPanels = attachInteractions()
        }

        refreshInteractions()
        mobileQuery.addEventListener("change", refreshInteractions)

        return () => {
            mobileQuery.removeEventListener("change", refreshInteractions)
            cleanupPanels()
        }
    }, [pathname])

    return null
}

export default PanelInteractions
