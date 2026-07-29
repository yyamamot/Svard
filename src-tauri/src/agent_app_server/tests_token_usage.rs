fn token_usage_params(thread_id: &str, turn_id: &str, last: [u64; 5], total: [u64; 5]) -> Value {
    json!({
        "threadId": thread_id,
        "turnId": turn_id,
        "tokenUsage": {
            "last": {
                "inputTokens": last[0],
                "cachedInputTokens": last[1],
                "outputTokens": last[2],
                "reasoningOutputTokens": last[3],
                "totalTokens": last[4],
                "cacheWriteInputTokens": 999
            },
            "total": {
                "inputTokens": total[0],
                "cachedInputTokens": total[1],
                "outputTokens": total[2],
                "reasoningOutputTokens": total[3],
                "totalTokens": total[4]
            },
            "modelContextWindow": 250000
        }
    })
}

#[test]
fn detailed_schema_capability_is_independent_from_context_usage() {
    let directory = tempfile::tempdir().unwrap();
    std::fs::write(
        directory
            .path()
            .join("ThreadTokenUsageUpdatedNotification.json"),
        r#"{"last":{"totalTokens":1},"total":{"totalTokens":1}}"#,
    )
    .unwrap();
    assert!(!schema_supports_token_usage_diagnostics(directory.path()));
    assert!(schema_directory_contains(
        directory.path(),
        "\"totalTokens\""
    ));
}

#[test]
fn token_usage_breakdown_rejects_invalid_fields_without_disabling_context_usage() {
    let valid = token_usage_params(
        "thread",
        "turn",
        [100, 80, 20, 10, 120],
        [200, 160, 40, 20, 240],
    );
    assert_eq!(
        normalize_token_usage_breakdown(valid.pointer("/tokenUsage/last").unwrap()),
        Some(AgentTokenUsageBreakdown {
            input_tokens: 100,
            cached_input_tokens: 80,
            output_tokens: 20,
            reasoning_output_tokens: 10,
            total_tokens: 120,
        })
    );

    for invalid in [
        json!({"inputTokens": 1, "cachedInputTokens": 2, "outputTokens": 1, "reasoningOutputTokens": 0, "totalTokens": 2}),
        json!({"inputTokens": 1, "cachedInputTokens": 0, "outputTokens": 1, "reasoningOutputTokens": 2, "totalTokens": 2}),
        json!({"inputTokens": -1, "cachedInputTokens": 0, "outputTokens": 1, "reasoningOutputTokens": 0, "totalTokens": 1}),
        json!({"inputTokens": 1, "cachedInputTokens": 0, "outputTokens": null, "reasoningOutputTokens": 0, "totalTokens": 1}),
    ] {
        assert!(normalize_token_usage_breakdown(&invalid).is_none());
    }

    let invalid_details = json!({
        "tokenUsage": {
            "last": {
                "inputTokens": 1,
                "cachedInputTokens": 2,
                "outputTokens": 0,
                "reasoningOutputTokens": 0,
                "totalTokens": 75
            },
            "total": {},
            "modelContextWindow": 100
        }
    });
    assert_eq!(
        normalize_context_usage(&invalid_details)
            .unwrap()
            .remaining_percent,
        25
    );
}

#[test]
fn token_usage_tracks_unique_active_turn_reports_and_preserves_latest_turn() {
    let session = token_usage_test_session();
    let (completion, _receiver) = mpsc::channel();
    *session.active_turn.lock().unwrap() = Some(ActiveTurn {
        client_turn_id: "client-turn".to_string(),
        provider_turn_id: None,
        response_mode: AgentResponseMode::Auto,
        completion,
    });
    begin_token_usage_turn(&session);
    normalize_notification(
        &session,
        &json!({
            "method": "turn/started",
            "params": {"turn": {"id": "provider-turn"}}
        }),
    );

    let first = token_usage_params(
        "provider-thread",
        "provider-turn",
        [100, 80, 20, 10, 120],
        [100, 80, 20, 10, 120],
    );
    let diagnostics = normalize_token_usage_diagnostics(&session, &first).unwrap();
    assert_eq!(diagnostics.turn.unwrap().usage.total_tokens, 120);

    let duplicate = normalize_token_usage_diagnostics(&session, &first).unwrap();
    assert_eq!(duplicate.turn.unwrap().usage.total_tokens, 120);

    let second = token_usage_params(
        "provider-thread",
        "provider-turn",
        [50, 40, 10, 5, 60],
        [150, 120, 30, 15, 180],
    );
    let diagnostics = normalize_token_usage_diagnostics(&session, &second).unwrap();
    assert_eq!(diagnostics.latest_request.usage.total_tokens, 60);
    assert_eq!(diagnostics.turn.unwrap().usage.total_tokens, 180);
    assert_eq!(diagnostics.conversation.usage.total_tokens, 180);

    let other_turn = token_usage_params(
        "provider-thread",
        "other-turn",
        [500, 400, 100, 50, 600],
        [650, 520, 130, 65, 780],
    );
    let diagnostics = normalize_token_usage_diagnostics(&session, &other_turn).unwrap();
    assert_eq!(diagnostics.turn.unwrap().usage.total_tokens, 180);
    normalize_notification(
        &session,
        &json!({
            "method": "turn/completed",
            "params": {"turn": {"id": "stale-turn", "status": "completed"}}
        }),
    );
    assert!(session.active_turn.lock().unwrap().is_some());

    let finalized = finalize_token_usage_turn(&session).unwrap();
    assert_eq!(finalized.turn.unwrap().usage.total_tokens, 180);
    *session.active_turn.lock().unwrap() = None;

    let compaction = token_usage_params(
        "provider-thread",
        "compaction-turn",
        [30, 20, 10, 5, 40],
        [680, 540, 140, 70, 820],
    );
    let diagnostics = normalize_token_usage_diagnostics(&session, &compaction).unwrap();
    assert_eq!(diagnostics.latest_request.usage.total_tokens, 40);
    assert_eq!(diagnostics.conversation.usage.total_tokens, 820);
    assert_eq!(diagnostics.turn.unwrap().usage.total_tokens, 180);
    assert!(normalize_token_usage_diagnostics(
        &session,
        &token_usage_params(
            "other-thread",
            "provider-turn",
            [1, 0, 0, 0, 1],
            [681, 540, 140, 70, 821]
        )
    )
    .is_none());
}

#[test]
fn token_usage_overflow_invalidates_only_the_turn_aggregate_and_hides_protocol_ids() {
    let session = token_usage_test_session();
    let (completion, _receiver) = mpsc::channel();
    *session.active_turn.lock().unwrap() = Some(ActiveTurn {
        client_turn_id: "private-client-turn".to_string(),
        provider_turn_id: Some("private-provider-turn".to_string()),
        response_mode: AgentResponseMode::Auto,
        completion,
    });
    begin_token_usage_turn(&session);
    let first = token_usage_params(
        "provider-thread",
        "private-provider-turn",
        [u64::MAX, 0, 0, 0, u64::MAX],
        [u64::MAX - 1, 0, 0, 0, u64::MAX - 1],
    );
    assert!(normalize_token_usage_diagnostics(&session, &first)
        .unwrap()
        .turn
        .is_some());
    let overflow = token_usage_params(
        "provider-thread",
        "private-provider-turn",
        [1, 0, 0, 0, 1],
        [u64::MAX, 0, 0, 0, u64::MAX],
    );
    let diagnostics = normalize_token_usage_diagnostics(&session, &overflow).unwrap();
    assert!(diagnostics.turn.is_none());

    let serialized =
        serde_json::to_value(AgentEvent::TokenUsageDiagnosticsUpdated { diagnostics }).unwrap();
    let text = serialized.to_string();
    assert_eq!(serialized["type"], "tokenUsageDiagnosticsUpdated");
    assert!(!text.contains("threadId"));
    assert!(!text.contains("turnId"));
    assert!(!text.contains("private-provider-turn"));
    assert!(!text.contains("provider-thread"));
}

fn token_usage_test_session() -> AgentSession {
    let (sender, _receiver) = std::sync::mpsc::channel();
    AgentSession {
        client_session_id: "token-session".to_string(),
        workspace_root: std::env::temp_dir(),
        scratch_directory: std::env::temp_dir().join("svard-token-test"),
        permission_mode: AgentPermissionMode::Observe,
        network_access: false,
        model: None,
        reasoning_effort: None,
        personality: None,
        executable: CodexExecutable::custom_for_test(PathBuf::from("/bin/false")),
        child: Mutex::new(None),
        title_child: Mutex::new(None),
        title_scratch_directory: Mutex::new(None),
        stdin: Mutex::new(panic_stdin()),
        event_channel: test_channel(sender),
        request_counter: AtomicU64::new(0),
        approval_counter: AtomicU64::new(0),
        pending_requests: Mutex::new(HashMap::new()),
        pending_approvals: Mutex::new(HashMap::new()),
        item_phases: Mutex::new(HashMap::new()),
        thread_id: Mutex::new(Some("provider-thread".to_string())),
        active_turn: Mutex::new(None),
        manual_compaction: Mutex::new(None),
        staged_images: Mutex::new(HashMap::new()),
        image_counter: AtomicU64::new(0),
        image_input: AtomicBool::new(true),
        turn_steering: AtomicBool::new(true),
        context_usage: AtomicBool::new(true),
        token_usage_diagnostics: AtomicBool::new(true),
        token_usage_tracking: Mutex::new(AgentTokenUsageTracking::default()),
        manual_compaction_supported: AtomicBool::new(true),
        automatic_title: Mutex::new(AutomaticTitleState::Finished),
        title_update_lock: Mutex::new(()),
        closed: AtomicBool::new(false),
    }
}
