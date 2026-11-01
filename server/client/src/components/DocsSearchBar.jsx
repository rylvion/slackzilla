import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { searchDocuments } from "./utils/docs"
import { createPortal } from "react-dom"

function DocsSearchBar({ initialQuery = "", onSubmit }) {
    const navigate = useNavigate()
    const inputRef = useRef(null)
    const containerRef = useRef(null)
    const [query, setQuery] = useState(initialQuery)
    const [suggestions, setSuggestions] = useState([])
    const [activeSuggestion, setActiveSuggestion] = useState(-1)
    const [searchActive, setSearchActive] = useState(false)
    const [dropdownRect, setDropdownRect] = useState(null)
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

    useEffect(() => {
        function closeOnOutsideClick(event) {
            if (!containerRef.current?.contains(event.target) && !event.target.closest(".docs-search-suggestions")) setSuggestions([])
        }

        function focusSearch(event) {
            const target = event.target
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !target.matches("input, textarea, select, [contenteditable='true']")) {
                event.preventDefault()
                inputRef.current?.focus()
                inputRef.current?.select()
            }
        }

        document.addEventListener("mousedown", closeOnOutsideClick)
        document.addEventListener("keydown", focusSearch)
        return () => {
            document.removeEventListener("mousedown", closeOnOutsideClick)
            document.removeEventListener("keydown", focusSearch)
        }
    }, [])

    useEffect(() => {
        function updatePosition() {
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) setDropdownRect({top: rect.bottom + 7, left: rect.left, width: rect.width })
        }

        updatePosition()

        window.addEventListener("resize", updatePosition)
        window.addEventListener("scroll", updatePosition, true)

        return () => {
            window.removeEventListener("resize", updatePosition)
            window.removeEventListener("scroll", updatePosition, true)
        }
    }, [])

    function updateQuery(value) {
        setQuery(value)
        setActiveSuggestion(-1)
        setSuggestions(value.trim() ? searchDocuments(value, 6) : [])
    }

    function submit(value = query) {
        const cleanQuery = String(value || "").trim()
        setSuggestions([])
        if (onSubmit) onSubmit(cleanQuery)
        else navigate(cleanQuery ? `/docs/search?q=${encodeURIComponent(cleanQuery)}` : "/docs/search")
    }

    function handleKeyDown(event) {
        if (event.key === "Escape") {
            setSuggestions([])
            return
        }

        if (event.key === "ArrowDown" && suggestions.length) {
            event.preventDefault()
            setActiveSuggestion(current => (current + 1) % suggestions.length)
        }

        if (event.key === "ArrowUp" && suggestions.length) {
            event.preventDefault()
            setActiveSuggestion(current => (current <= 0 ? suggestions.length - 1 : current - 1))
        }

        if (event.key === "Enter") {
            event.preventDefault()
            const selected = suggestions[activeSuggestion]
            if (selected) navigate(selected.document.route)
            else submit()
        }
    }

    return (
        <div className={`docs-search${searchActive || query.trim() ? " is-active" : ""}`} ref={containerRef} >
            <span className="docs-search-icon" aria-hidden="true">/</span>
            <input
                ref={inputRef}
                value={query}
                type="search"
                aria-label="Search documentation"
                placeholder="Search documentation"
                onChange={event => updateQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    setSearchActive(true)
                    if (query.trim()) setSuggestions(searchDocuments(query, 6))
                }}
                onBlur={() => setSearchActive(false)}
            />
            {query && <button className="docs-search-clear" type="button" aria-label="Clear search" onClick={() => { updateQuery(""); inputRef.current?.focus() }}>x</button>}
            {!searchActive && !query.trim() && (<kbd>{isMac ? "⌘ K" : "Ctrl K"}</kbd>)}
            {suggestions.length > 0 && dropdownRect && createPortal(
                <div className="docs-search-suggestions" role="listbox" style={{
                    position: "fixed",
                    top: dropdownRect.top,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                    zIndex: 99999
                }}>
                    {suggestions.map((suggestion, index) => (
                        <button className={index === activeSuggestion ? "active" : ""} key={suggestion.document.id} type="button" role="option" 
                            aria-selected={index === activeSuggestion} 
                            onMouseDown={event => event.preventDefault()} 
                            onClick={() => {
                                setSuggestions([])
                                setActiveSuggestion(-1)
                                navigate(suggestion.document.route)
                            }}
                        >
                            <strong>{suggestion.document.title}</strong>
                            <span>{suggestion.heading || suggestion.text}</span>
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}

export default DocsSearchBar
