import Head from "./Head"
import Header from "./Header"
import MainSidebar from "./MainSidebar"
import InternalSidebar from "./InternalSidebar"



function PageShell({ title, description, active, state = {}, csrfToken='', links = [], children }) {
    return (
        <>
            <Head title={title} description={description} state={state} csrfToken={csrfToken} />
            <Header />
            <MainSidebar active={active} state={state} />
            <main className="main-content">
                {links.length > 0 && <InternalSidebar links={links} />}
                <div className="content">{children}</div>
            </main>
        </>
    )
}

export default PageShell