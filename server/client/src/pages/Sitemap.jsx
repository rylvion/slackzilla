import { Link } from "react-router-dom"
import PageShell from "../components/PageShell"
import routes from "../components/utils/routes"
import "../css/sitemap.css"

function Sitemap() {
    return (
        <PageShell title="Sitemap" description="Slackzilla dashboard sitemap" active="sitemap">
            <section className="panel">
                <div className="panel-header"><h1>Sitemap</h1><span className="panel-subtitle">routes and machine surfaces</span></div>
                <div className="panel-body">
                    <div className="sitemap-list">
                        {routes.map(({ to, label, description, api, hidden, danger }) => {
                            const content = (
                                <>
                                    <code>{to}</code>
                                    <span>
                                        <strong>{label}</strong>
                                        <small>{description}</small>
                                    </span>
                                </> 
                            )

                            if (api && danger) {
                                return ( <a key={to} href={to}  className="sitemap-item dangerous-api"> {content}</a> )
                            }

                            if (api) {
                                return ( <a key={to} href={to}  className="sitemap-item api"> {content}</a> )
                            }

                            if (danger) {
                                return ( <a key={to} href={to}  className="sitemap-item danger"> {content}</a> )
                            }

                            if (hidden) {
                                return null
                            }

                            return (
                                <Link key={to} to={to} className="sitemap-item">{content}</Link>
                            )
                        })}
                    </div>
                </div>
            </section>
        </PageShell>
    )
}

export default Sitemap