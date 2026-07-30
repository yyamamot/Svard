use super::*;

#[test]
fn detached_agent_chat_reattach_lookup_uses_only_origin_mapping() {
    let pending = PendingAgentChatWindows::default();
    pending
        .labels_by_origin
        .lock()
        .expect("detached labels")
        .insert("main".to_string(), "agent-opaque".to_string());

    assert_eq!(
        detached_agent_chat_label_for_origin(&pending, "main").expect("mapped detached AI Chat"),
        "agent-opaque"
    );
    assert!(detached_agent_chat_label_for_origin(&pending, "other").is_err());
}
