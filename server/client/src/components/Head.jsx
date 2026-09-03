import { Helmet } from 'react-helmet-async'

function Head({ title = "Dashboard", description = "Slackzilla server dashboard", state = {}, csrfToken = ''}) {
    return (
        <Helmet>
            <meta name="description" content={description} />
            <meta name="csrf-token" content={csrfToken} />
            <title>Slackzilla | {title}</title>

            <script> {`window.__SLACKZILLA__ = ${JSON.stringify(state)}`} </script>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        </Helmet>
    )
}

export default Head