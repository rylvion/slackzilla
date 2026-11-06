import { useLayoutEffect, useRef } from "react"
import { useStatusStream } from "./utils/api"

function DeploymentBanner() {
    const { status } = useStatusStream(window.__SLACKZILLA__ || {})
    const bannerRef = useRef(null)
    const bannerStatus = status.deploymentBannerStatus
    const visible = ["updating", "success", "failed"].includes(bannerStatus)

    useLayoutEffect(() => {
        if (!visible || !bannerRef.current) {
            document.body.classList.remove("deployment-banner-visible")
            document.documentElement.style.removeProperty("--deployment-banner-height")
            return undefined
        }

        const updateHeight = () => {
            document.documentElement.style.setProperty(
                "--deployment-banner-height",
                `${bannerRef.current.getBoundingClientRect().height}px`
            )
        }

        document.body.classList.add("deployment-banner-visible")
        updateHeight()

        const observer = typeof ResizeObserver === "function"
            ? new ResizeObserver(updateHeight)
            : null
        observer?.observe(bannerRef.current)

        return () => {
            observer?.disconnect()
            document.body.classList.remove("deployment-banner-visible")
            document.documentElement.style.removeProperty("--deployment-banner-height")
        }
    }, [visible])

    const bannerContent = {
        updating: {
            indicator: "↻",
            title: "A new update is on its way",
            message: "The dashboard will refresh when the deployment is live."
        },
        success: {
            indicator: "✓",
            title: `Successfully updated: current version is ${status.deploymentBannerVersion}`,
            message: "The dashboard is now running the latest release."
        },
        failed: {
            indicator: "!",
            title: "Deployment failed",
            message: status.deploymentBannerError ||
                "The latest update could not be deployed. The previous version should remain available."
        }
    }

    const content = bannerContent[bannerStatus]

    if (!visible) return null

    return (
        <section ref={bannerRef} className={`deployment-banner deployment-banner--${bannerStatus}`} role="status" aria-live="polite">
            <span className="deployment-banner__indicator" aria-hidden="true">{content.indicator}</span>
            <div>
                <strong>{content.title}</strong>
                <span>{content.message}</span>
            </div>
        </section>
    )
}

export default DeploymentBanner