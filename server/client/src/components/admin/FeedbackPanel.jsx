
function FeedbackPanel({ state }) {
    return (
        <div className="panel-body">
            {state.feedback?.length ? (
                <div className="feedback-list">
                    {state.feedback.map((item, index) => (
                        <div className="feedback-item" key={item.id ?? index}>
                            <div className="feedback-meta">
                                <span> {item.user ?? "Unknown user"}</span>
                                <span>{item.time ?? ""}</span>
                            </div>
                            <p>{item.message ?? "No message available"}</p>
                        </div>
                    ))}
                </div>
            ) : ( <p className="muted">No feedback available.</p> )}    
        </div>
    )
}

export default FeedbackPanel