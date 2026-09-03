import { version } from './utils/package'

function Header() {
    return (
        <header className="header">
            <span className="header-title">SLACKZILLA</span>
            <span className="header-version">{version}</span>
        </header>
    )
}

export default Header