#[test]
fn command_actions_become_natural_workspace_activity() {
    let workspace = tempfile::tempdir().unwrap();
    let file = workspace.path().join("docs").join("guide.md");
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(&file, "# Guide").unwrap();
    let item = json!({
        "type": "commandExecution",
        "commandActions": [{
            "type": "read",
            "command": "cat docs/guide.md",
            "name": "guide.md",
            "path": file
        }]
    });

    let presentation = item_tool(workspace.path(), &item).unwrap();
    assert_eq!(presentation.kind, "read");
    assert_eq!(presentation.category, "read");
    assert_eq!(presentation.title, "Inspecting files");
    assert_eq!(presentation.visibility, "user");
    assert_eq!(presentation.target.as_deref(), Some("docs/guide.md"));
}

#[test]
fn command_actions_with_unverified_paths_are_provider_internal() {
    let workspace = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let outside_file = outside.path().join("MEMORY.md");
    std::fs::write(&outside_file, "provider memory").unwrap();

    for path in [
        "MEMORY.md".to_string(),
        outside_file.to_string_lossy().to_string(),
    ] {
        let item = json!({
            "type": "commandExecution",
            "commandActions": [{ "type": "search", "path": path }]
        });
        let presentation = command_tool_presentation(workspace.path(), &item);
        assert_eq!(presentation.visibility, "internal");
        assert_eq!(presentation.target, None);
        assert_eq!(presentation.title, "Running a provider operation");
    }
}

#[test]
fn pathless_command_actions_remain_user_visible() {
    let workspace = tempfile::tempdir().unwrap();
    let item = json!({
        "type": "commandExecution",
        "commandActions": [{ "type": "search" }]
    });
    let presentation = command_tool_presentation(workspace.path(), &item);
    assert_eq!(presentation.visibility, "user");
    assert_eq!(presentation.target, None);
}

#[test]
fn unsafe_command_output_does_not_create_activity_detail() {
    let workspace = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let item = json!({
        "command": format!("cat {}/secret.txt", outside.path().display()),
        "aggregatedOutput": "/private/provider/MEMORY.md"
    });
    assert_eq!(completed_tool_detail(workspace.path(), &item), None);
}

#[test]
fn one_unsafe_activity_field_hides_the_entire_detail() {
    let workspace = tempfile::tempdir().unwrap();
    for item in [
        json!({
            "command": r"type C:\Users\person\secret.txt",
            "aggregatedOutput": "completed"
        }),
        json!({
            "command": "rg Agent src/main.rs",
            "aggregatedOutput": r"found \\server\share\secret.txt"
        }),
    ] {
        assert_eq!(completed_tool_detail(workspace.path(), &item), None);
    }
}

#[test]
fn internal_failures_keep_only_a_generic_summary() {
    let workspace = tempfile::tempdir().unwrap();
    let item = json!({
        "type": "commandExecution",
        "status": "failed",
        "exitCode": 7,
        "commandActions": [{ "type": "read", "path": "MEMORY.md" }]
    });
    let presentation = command_tool_presentation(workspace.path(), &item);
    assert_eq!(
        completed_tool_summary(&presentation, "failed", &item).as_deref(),
        Some("A provider operation failed")
    );
}

#[test]
fn search_is_the_primary_action_for_composed_commands() {
    let workspace = tempfile::tempdir().unwrap();
    let item = json!({
        "type": "commandExecution",
        "commandActions": [
            { "type": "read", "command": "cat README.md", "name": "README.md", "path": "README.md" },
            { "type": "search", "command": "rg Agent", "path": ".", "query": "Agent" }
        ]
    });

    let presentation = item_tool(workspace.path(), &item).unwrap();
    assert_eq!(presentation.category, "search");
    assert_eq!(presentation.title, "Searching the workspace");
}

#[test]
fn activity_detail_redacts_workspace_paths_and_rejects_external_paths() {
    let workspace = tempfile::tempdir().unwrap();
    let safe = safe_activity_text(
        workspace.path(),
        &format!("rg Agent {}/src", workspace.path().display()),
        480,
    )
    .unwrap();
    assert!(safe.contains("./src"));
    assert!(!safe.contains(workspace.path().to_string_lossy().as_ref()));
    assert!(safe_activity_text(workspace.path(), "cat /private/secret", 480).is_none());
}

#[test]
fn activity_detail_rejects_windows_and_uri_paths_on_every_host_os() {
    let workspace = Path::new(r"C:\Users\person\workspace");
    let safe = safe_activity_text(
        workspace,
        r#"rg Agent "C:\Users\person\workspace\src""#,
        480,
    )
    .unwrap();
    assert_eq!(safe, r#"rg Agent ".\src""#);

    for unsafe_value in [
        r#"type "C:\Users\person\secret.txt""#,
        r"type C:relative\secret.txt",
        r"type \Windows\secret.txt",
        r"type \\server\share\secret.txt",
        r"type \\?\C:\secret.txt",
        r"type \\?\UNC\server\share\secret.txt",
        r"type \\.\PhysicalDrive0",
        r"open file:///C:/Users/person/secret.txt",
        r#"tool --path="C:\Users\person\secret.txt""#,
        r#"inspect ("C:\Users\person\secret.txt")."#,
        r"tool --path=/private/secret",
        r#"{"path":"C:\Users\person\secret.txt"}"#,
        r#"[details](C:\Users\person\secret.txt)"#,
        r"tool --path:C:\Users\person\secret.txt",
        r#"{"path":"/private/secret.txt"}"#,
        r#"[details](/private/secret.txt)"#,
        r"tool --path:/private/secret.txt",
    ] {
        assert!(
            safe_activity_text(workspace, unsafe_value, 480).is_none(),
            "unsafe activity detail was displayed: {unsafe_value}"
        );
    }
}

#[test]
fn activity_detail_allows_urls_and_relative_paths() {
    let workspace = Path::new(r"C:\Users\person\workspace");
    for safe_value in [
        "rg Agent src/main.rs",
        "open https://example.com/docs/path",
        "open https://example.com/C:/docs/path",
        r#"{"url":"https://example.com/docs/path"}"#,
        "[documentation](https://example.com/docs/path)",
        "tool --path=src/main.rs",
        "read ./README.md",
    ] {
        assert_eq!(
            safe_activity_text(workspace, safe_value, 480).as_deref(),
            Some(safe_value)
        );
    }
}

#[cfg(windows)]
#[test]
fn workspace_file_labels_handle_windows_canonical_paths_and_unicode() {
    let workspace = tempfile::tempdir().unwrap();
    let nested = workspace.path().join("資料");
    std::fs::create_dir_all(&nested).unwrap();
    let file = nested.join("概要.md");
    std::fs::write(&file, "# Windows\n").unwrap();

    let canonical_root = workspace.path().canonicalize().unwrap();
    let mixed_path = file.to_string_lossy().replace('\\', "/");
    assert_eq!(
        workspace_relative_file_label(&canonical_root, &mixed_path).unwrap(),
        Some("資料/概要.md".to_string())
    );
}

#[test]
fn external_attachment_uses_safe_label_and_untrusted_context() {
    let workspace = tempfile::tempdir().unwrap();
    let scratch = workspace.path().join("scratch");
    std::fs::create_dir(&scratch).unwrap();
    let (sender, _receiver) = std::sync::mpsc::channel();
    let session = AgentSession {
        client_session_id: "session-test".to_string(),
        workspace_root: workspace.path().to_path_buf(),
        scratch_directory: scratch.clone(),
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
        event_router: Mutex::new(AgentEventRouter::new(
            "test-main".to_string(),
            test_channel(sender),
        )),
        request_counter: AtomicU64::new(0),
        approval_counter: AtomicU64::new(0),
        pending_requests: Mutex::new(HashMap::new()),
        pending_approvals: Mutex::new(HashMap::new()),
        item_phases: Mutex::new(HashMap::new()),
        thread_id: Mutex::new(None),
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
    };
    let context = stage_attachments(
        &session,
        &[AgentAttachment {
            attachment_id: "attachment".to_string(),
            display_label: "/private/source/notes.md".to_string(),
            source: "# Notes".to_string(),
        }],
    )
    .unwrap();
    let serialized = context.to_string();
    assert!(serialized.contains("notes.md"));
    assert!(serialized.contains("\"kind\":\"untrusted\""));
    assert!(!serialized.contains("/private/source"));
    assert!(scratch.join("01-notes.md").is_file());
}

#[test]
fn agent_event_router_replays_ordered_events_and_moves_owner() {
    let mut router = AgentEventRouter::new("main".to_string(), Channel::new(|_| Ok(())));
    router.emit(AgentEvent::TurnStarted {
        client_turn_id: "turn-1".to_string(),
    });
    router.emit(AgentEvent::TurnStarted {
        client_turn_id: "turn-2".to_string(),
    });

    let replay = router
        .attach("agent-opaque".to_string(), Channel::new(|_| Ok(())), 0)
        .unwrap();

    assert_eq!(
        replay
            .iter()
            .map(|envelope| envelope.sequence)
            .collect::<Vec<_>>(),
        vec![1, 2]
    );
    assert!(router.is_owner("agent-opaque"));
    assert!(!router.is_owner("main"));
}

#[test]
fn agent_event_router_bounds_the_handoff_journal() {
    let mut router = AgentEventRouter::new("main".to_string(), Channel::new(|_| Ok(())));
    for index in 0..(AGENT_EVENT_JOURNAL_LIMIT + 4) {
        router.emit(AgentEvent::TurnStarted {
            client_turn_id: format!("turn-{index}"),
        });
    }

    let replay = router.attach("agent-opaque".to_string(), Channel::new(|_| Ok(())), 0);

    assert!(replay.is_err());
}
