const links = document.querySelectorAll("main nav a")

function updateMainActive() {
    const hash = window.location.hash || "#"
    links.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === hash)
    });
}

updateMainActive()
window.addEventListener("hashchange", updateMainActive)