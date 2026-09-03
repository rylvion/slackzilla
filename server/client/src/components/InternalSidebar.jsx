import { useState } from "react";

function InternalSidebar({ links }) {
    const [active, setActive] = useState(links[0]?.id)
    
    return (
        <aside className="internal-sidebar">
            <nav className="internal-links">
                {links.map((link) => (
                    <a
                        key={link.id}
                        className={active === link.id ? "active" : ""}
                        href={`#${link.id}`}
                        onClick={() => setActive(link.id)}
                    >
                        {link.label}
                    </a>
                ))}
            </nav>
        </aside>
    );
}

export default InternalSidebar;
