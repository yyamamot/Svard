fn saved_session_record(workspace_root: &Path, permission_mode: &str) -> AgentSessionRecord {
    AgentSessionRecord {
        client_session_id: "session-1".to_string(),
        provider_id: "codex-app-server".to_string(),
        provider_thread_id: "provider-private".to_string(),
        workspace_root: workspace_root.to_path_buf(),
        title: "Saved chat".to_string(),
        created_at: 1,
        updated_at: 2,
        archived: false,
        available: true,
        snapshot: AgentSessionSnapshot {
            permission_mode: permission_mode.to_string(),
            network_access: true,
            web_search: true,
            context_profile: "providerDefaults".to_string(),
            model: Some("saved-model".to_string()),
            reasoning_effort: Some("medium".to_string()),
            personality: Some("pragmatic".to_string()),
        },
    }
}

#[test]
fn full_access_resume_requires_explicit_confirmation() {
    let workspace = tempfile::tempdir().unwrap();
    let record = saved_session_record(workspace.path(), "fullAccess");
    let mut input = AgentSessionResumeInput {
        client_session_id: record.client_session_id.clone(),
        workspace_root: workspace.path().to_string_lossy().into_owned(),
        executable_preference: CodexExecutablePreference::default(),
        context_profile: Some(AgentContextProfile::ProviderDefaults),
        full_access_confirmed: false,
    };
    assert!(resume_start_input(&input, &record)
        .unwrap_err()
        .contains("must be confirmed"));
    input.full_access_confirmed = true;
    let resumed = resume_start_input(&input, &record).unwrap();
    assert_eq!(resumed.permission_mode, AgentPermissionMode::FullAccess);
    assert!(resumed.network_access);
    assert!(resumed.web_search);
    assert_eq!(resumed.model.as_deref(), Some("saved-model"));
}

#[test]
fn resume_rejects_a_context_profile_change() {
    let workspace = tempfile::tempdir().unwrap();
    let record = saved_session_record(workspace.path(), "observe");
    let input = AgentSessionResumeInput {
        client_session_id: record.client_session_id.clone(),
        workspace_root: workspace.path().to_string_lossy().into_owned(),
        executable_preference: CodexExecutablePreference::default(),
        context_profile: Some(AgentContextProfile::Focused),
        full_access_confirmed: false,
    };
    assert!(resume_start_input(&input, &record)
        .unwrap_err()
        .contains("does not match"));
}

#[test]
fn management_inputs_accept_current_executable_without_persisting_it() {
    let rename: AgentSessionRenameInput = serde_json::from_value(json!({
        "clientSessionId": "session-1",
        "title": "Renamed",
        "executablePreference": {
            "mode": "custom",
            "path": "/private/current/codex"
        }
    }))
    .unwrap();
    assert_eq!(
        rename.executable_preference.mode,
        CodexExecutableMode::Custom
    );
    assert_eq!(
        rename.executable_preference.path.as_deref(),
        Some("/private/current/codex")
    );
    let record = saved_session_record(Path::new("/private/workspace"), "agent");
    let serialized = serde_json::to_string(&record).unwrap();
    assert!(!serialized.contains("/private/current/codex"));
    assert!(!serialized.contains("executable"));
}

#[test]
fn history_normalization_omits_private_provider_payloads() {
    let turn = json!({
        "id": "provider-turn-private",
        "status": "completed",
        "startedAt": 42,
        "items": [
            {
                "id": "user-1",
                "type": "userMessage",
                "content": [
                    {"type": "text", "text": "Review this selection"},
                    {"type": "localImage", "path": "/private/workspace/image.png"}
                ]
            },
            {
                "id": "reasoning-1",
                "type": "reasoning",
                "summary": ["private reasoning"]
            },
            {
                "id": "command-1",
                "type": "commandExecution",
                "command": "cat /private/workspace/secret",
                "cwd": "/private/workspace",
                "aggregatedOutput": "secret",
                "status": "completed",
                "durationMs": 7
            },
            {
                "id": "answer-1",
                "type": "agentMessage",
                "phase": "final_answer",
                "text": "Static answer"
            }
        ]
    });
    let normalized = normalize_history_turn("session-1", Path::new("."), &turn).unwrap();
    assert_ne!(normalized.id, "provider-turn-private");
    assert_eq!(normalized.question, "Review this selection");
    assert_eq!(normalized.answer, "Static answer");
    assert_eq!(normalized.created_at, 42);
    assert!(normalized.context_omitted);
    assert_eq!(normalized.activities.len(), 1);
    let serialized = serde_json::to_string(&normalized).unwrap();
    assert!(!serialized.contains("provider-turn-private"));
    assert!(!serialized.contains("/private/workspace"));
    assert!(!serialized.contains("private reasoning"));
    assert!(!serialized.contains("secret"));
}

fn provider_history_turn(prompt: &str) -> Value {
    json!({
        "id": "provider-turn",
        "status": "completed",
        "startedAt": 42,
        "items": [
            {
                "type": "userMessage",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "text", "text": "private selected content"}
                ]
            },
            {
                "type": "agentMessage",
                "phase": "final_answer",
                "text": "Static answer"
            }
        ]
    })
}

#[test]
fn history_envelope_restores_only_the_utf8_display_question_and_mode() {
    let question = "構成を説明してください。\nSVARD_TURN_V1 を含む質問";
    let prompt = turn_prompt(
        "The user is currently viewing docs/guide.md.\n\n",
        "For this question, pay particular attention to these workspace files:\n- src/main.rs\n\n",
        question,
        AgentResponseMode::Visualize,
        "question",
        "OPENUI COMPONENTS",
    );
    let normalized =
        normalize_history_turn("session-1", Path::new("."), &provider_history_turn(&prompt))
            .unwrap();

    assert_eq!(normalized.question, question);
    assert!(matches!(
        normalized.response_mode,
        AgentResponseMode::Visualize
    ));
    assert!(normalized.context_omitted);
    let serialized = serde_json::to_string(&normalized).unwrap();
    assert!(!serialized.contains("OPENUI COMPONENTS"));
    assert!(!serialized.contains("docs/guide.md"));
    assert!(!serialized.contains("private selected content"));
}

#[test]
fn history_envelope_restores_steering_messages_without_internal_context() {
    let initial = turn_prompt(
        "",
        "",
        "Initial question",
        AgentResponseMode::Auto,
        "question",
        "",
    );
    let steering = steer_prompt(
        "The user is currently viewing private.md.\n\n",
        "",
        "Focus on the failure path",
        AgentResponseMode::Auto,
        "question",
    );
    let turn = json!({
        "id": "provider-turn",
        "status": "completed",
        "startedAt": 42,
        "items": [
            {
                "type": "userMessage",
                "content": [{"type": "text", "text": initial}]
            },
            {
                "type": "userMessage",
                "content": [{"type": "text", "text": steering}]
            },
            {
                "type": "agentMessage",
                "phase": "final_answer",
                "text": "Static answer"
            }
        ]
    });
    let normalized = normalize_history_turn("session-1", Path::new("."), &turn).unwrap();

    assert_eq!(normalized.question, "Initial question");
    assert_eq!(
        normalized.steering_messages,
        vec!["Focus on the failure path"]
    );
    let serialized = serde_json::to_string(&normalized).unwrap();
    assert!(!serialized.contains("private.md"));
    assert!(!serialized.contains(SVARD_STEER_ENVELOPE_V1));
}

#[test]
fn history_file_changes_are_workspace_relative_and_deduplicated() {
    let workspace = tempfile::tempdir().unwrap();
    let changed = workspace.path().join("src/main.rs");
    let turn = json!({
        "id": "provider-turn",
        "status": "completed",
        "startedAt": 42,
        "items": [
            {
                "type": "userMessage",
                "content": [{"type": "text", "text": "Update it"}]
            },
            {
                "type": "fileChange",
                "changes": [
                    {"path": changed},
                    {"path": "src/main.rs"},
                    {"path": "/private/outside.rs"}
                ],
                "status": "completed"
            }
        ]
    });
    let normalized = normalize_history_turn("session-1", workspace.path(), &turn).unwrap();

    assert_eq!(normalized.changed_paths, vec!["src/main.rs"]);
    let serialized = serde_json::to_string(&normalized).unwrap();
    assert!(!serialized.contains("/private/outside.rs"));
    assert!(!serialized.contains(workspace.path().to_string_lossy().as_ref()));
}

#[test]
fn history_envelope_uses_safe_labels_for_context_only_turns() {
    let image = turn_prompt("", "", "", AgentResponseMode::Auto, "image", "ignored");
    let selection = turn_prompt(
        "",
        "",
        "",
        AgentResponseMode::Auto,
        "selected-content",
        "ignored",
    );
    assert_eq!(
        normalize_history_turn("session-1", Path::new("."), &provider_history_turn(&image))
            .unwrap()
            .question,
        "Image discussion"
    );
    assert_eq!(
        normalize_history_turn(
            "session-1",
            Path::new("."),
            &provider_history_turn(&selection),
        )
        .unwrap()
        .question,
        "Selected content review"
    );
}

#[test]
fn history_envelope_failure_hides_internal_prompt() {
    let malformed = format!(
        "{SVARD_TURN_ENVELOPE_V1}\nresponse-mode: auto\n\
         display-question-bytes: 999\ndisplay-kind: question\n\n\
         {AUTO_RESPONSE_INSTRUCTION}\n\nQUESTION\nPrivate prompt"
    );
    let normalized = normalize_history_turn(
        "session-1",
        Path::new("."),
        &provider_history_turn(&malformed),
    )
    .unwrap();
    assert_eq!(normalized.question, "Previous question unavailable");
    assert!(!serde_json::to_string(&normalized)
        .unwrap()
        .contains("Private prompt"));
}

#[test]
fn legacy_openui_history_removes_known_prompt_and_context_preamble() {
    let openui_prompt = "\
root = SvardExperience(\"Example\", \"Example\", [])\n\
## Important Rules\n\
Return OpenUI Lang source only.\n\
## Final Verification";
    let auto_prompt = format!(
        "The user is currently viewing docs/guide.md.\n\n\
         For this question, pay particular attention to these workspace files:\n- src/main.rs\n\n\
         Explain the relationship.\n\n{LEGACY_AUTO_OPENUI_BRIDGE}\n{openui_prompt}"
    );
    let visualize_prompt =
        format!("Visualize the relationship.\n\n{LEGACY_VISUALIZE_OPENUI_BRIDGE}\n{openui_prompt}");
    let auto = normalize_history_turn(
        "session-1",
        Path::new("."),
        &provider_history_turn(&auto_prompt),
    )
    .unwrap();
    let visualize = normalize_history_turn(
        "session-1",
        Path::new("."),
        &provider_history_turn(&visualize_prompt),
    )
    .unwrap();

    assert_eq!(auto.question, "Explain the relationship.");
    assert!(matches!(auto.response_mode, AgentResponseMode::Auto));
    assert_eq!(visualize.question, "Visualize the relationship.");
    assert!(matches!(
        visualize.response_mode,
        AgentResponseMode::Visualize
    ));
    assert!(!serde_json::to_string(&auto)
        .unwrap()
        .contains("SvardExperience"));
}

#[test]
fn history_page_converts_provider_descending_order_to_chronological_order() {
    let provider_turns = vec![
        json!({
            "id": "newest",
            "status": "completed",
            "startedAt": 30,
            "items": []
        }),
        json!({
            "id": "middle",
            "status": "completed",
            "startedAt": 20,
            "items": []
        }),
        json!({
            "id": "oldest",
            "status": "completed",
            "startedAt": 10,
            "items": []
        }),
    ];
    let turns = normalize_history_turn_page("session-1", Path::new("."), &provider_turns);
    assert_eq!(
        turns.iter().map(|turn| turn.created_at).collect::<Vec<_>>(),
        vec![10, 20, 30]
    );
}

#[test]
fn developer_instructions_keep_markdown_as_the_default() {
    assert!(SVARD_AGENT_DEVELOPER_INSTRUCTIONS.contains("normal Markdown"));
    assert!(SVARD_AGENT_DEVELOPER_INSTRUCTIONS.contains("explicitly includes"));
    assert!(SVARD_AGENT_DEVELOPER_INSTRUCTIONS.contains("Mermaid"));
    assert!(SVARD_AGENT_DEVELOPER_INSTRUCTIONS.contains("HTML"));
    assert!(!SVARD_AGENT_DEVELOPER_INSTRUCTIONS.contains("SvardExperience"));
}

#[test]
fn observe_never_enables_network() {
    let workspace = tempfile::tempdir().unwrap();
    let (sender, _receiver) = std::sync::mpsc::channel();
    let session = AgentSession {
        client_session_id: "session-test".to_string(),
        workspace_root: workspace.path().to_path_buf(),
        scratch_directory: workspace.path().join("scratch"),
        permission_mode: AgentPermissionMode::Observe,
        network_access: true,
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
        thread_id: Mutex::new(None),
        active_turn: Mutex::new(None),
        manual_compaction: Mutex::new(None),
        staged_images: Mutex::new(HashMap::new()),
        image_counter: AtomicU64::new(0),
        image_input: AtomicBool::new(true),
        turn_steering: AtomicBool::new(true),
        context_usage: AtomicBool::new(true),
        manual_compaction_supported: AtomicBool::new(true),
        automatic_title: Mutex::new(AutomaticTitleState::Finished),
        title_update_lock: Mutex::new(()),
        closed: AtomicBool::new(false),
    };
    assert_eq!(
        sandbox_policy(&session),
        json!({ "type": "readOnly", "networkAccess": false })
    );
}

#[test]
fn codex_quality_settings_use_supported_turn_start_fields() {
    let workspace = tempfile::tempdir().unwrap();
    let (sender, _receiver) = std::sync::mpsc::channel();
    let session = AgentSession {
        client_session_id: "session-test".to_string(),
        workspace_root: workspace.path().to_path_buf(),
        scratch_directory: workspace.path().join("scratch"),
        permission_mode: AgentPermissionMode::Observe,
        network_access: false,
        model: Some("gpt-5.6-sol".to_string()),
        reasoning_effort: Some("high".to_string()),
        personality: Some("pragmatic".to_string()),
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
        thread_id: Mutex::new(None),
        active_turn: Mutex::new(None),
        manual_compaction: Mutex::new(None),
        staged_images: Mutex::new(HashMap::new()),
        image_counter: AtomicU64::new(0),
        image_input: AtomicBool::new(true),
        turn_steering: AtomicBool::new(true),
        context_usage: AtomicBool::new(true),
        manual_compaction_supported: AtomicBool::new(true),
        automatic_title: Mutex::new(AutomaticTitleState::Finished),
        title_update_lock: Mutex::new(()),
        closed: AtomicBool::new(false),
    };
    let mut params = json!({ "threadId": "thread" });

    apply_session_quality_settings(&session, &mut params);

    assert_eq!(params["model"], "gpt-5.6-sol");
    assert_eq!(params["effort"], "high");
    assert_eq!(params["personality"], "pragmatic");
    assert!(params.get("reasoningEffort").is_none());
}

#[test]
fn focus_prompt_uses_workspace_relative_paths() {
    let workspace = tempfile::tempdir().unwrap();
    let file = workspace.path().join("docs").join("guide.md");
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(&file, "# Guide").unwrap();
    let labels = focus_file_labels(
        workspace.path(),
        &[AgentFocusFile {
            path: file.to_string_lossy().to_string(),
            display_label: "/private/path/docs/guide.md".to_string(),
        }],
    )
    .unwrap();
    let prompt = focus_prompt(&labels, None);
    assert!(prompt.contains("docs/guide.md"));
    assert!(!prompt.contains("/private/path"));
}

#[test]
fn active_file_prompt_uses_only_the_workspace_relative_path() {
    let workspace = tempfile::tempdir().unwrap();
    let file = workspace.path().join("docs").join("guide.md");
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(&file, "PRIVATE DOCUMENT CONTENT").unwrap();
    let label = active_file_label(
        workspace.path(),
        Some(&AgentActiveFile {
            path: file.to_string_lossy().to_string(),
        }),
    )
    .unwrap();
    let prompt = active_file_prompt(label.as_deref(), false);
    assert_eq!(prompt, "The user is currently viewing docs/guide.md.\n\n");
    assert!(!prompt.contains(workspace.path().to_string_lossy().as_ref()));
    assert!(!prompt.contains("PRIVATE DOCUMENT CONTENT"));
}

#[test]
fn unavailable_or_external_active_files_are_omitted() {
    let workspace = tempfile::tempdir().unwrap();
    let external = tempfile::NamedTempFile::new().unwrap();
    let missing = workspace.path().join("missing.md");
    for path in [external.path(), missing.as_path(), workspace.path()] {
        let label = active_file_label(
            workspace.path(),
            Some(&AgentActiveFile {
                path: path.to_string_lossy().to_string(),
            }),
        )
        .unwrap();
        assert_eq!(label, None);
    }
}

#[cfg(unix)]
#[test]
fn active_file_symlink_cannot_escape_the_workspace() {
    use std::os::unix::fs::symlink;

    let workspace = tempfile::tempdir().unwrap();
    let external = tempfile::NamedTempFile::new().unwrap();
    let link = workspace.path().join("outside.md");
    symlink(external.path(), &link).unwrap();
    let label = active_file_label(
        workspace.path(),
        Some(&AgentActiveFile {
            path: link.to_string_lossy().to_string(),
        }),
    )
    .unwrap();
    assert_eq!(label, None);
}

#[test]
fn active_file_and_explicit_focus_are_not_duplicated() {
    let active = "docs/guide.md".to_string();
    let focused = vec![active.clone(), "src/main.rs".to_string()];
    let active_prompt = active_file_prompt(Some(&active), true);
    let focus = focus_prompt(&focused, Some(&active));
    let prompt = turn_prompt(
        &active_prompt,
        &focus,
        "Explain the relationship.",
        AgentResponseMode::Auto,
        "question",
        "",
    );
    assert_eq!(prompt.matches("docs/guide.md").count(), 1);
    assert!(prompt.contains("currently viewing and has explicitly highlighted"));
    assert!(prompt.contains("src/main.rs"));
    assert!(prompt.find("docs/guide.md") < prompt.find("src/main.rs"));
    assert!(prompt.find("src/main.rs") < prompt.find("Explain the relationship."));
}

#[test]
fn absolute_paths_are_normalized_to_workspace_labels() {
    let workspace = tempfile::tempdir().unwrap();
    let file = workspace.path().join("src").join("main.rs");
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(&file, "fn main() {}").unwrap();
    assert_eq!(
        normalize_relative_path(workspace.path(), file.to_str().unwrap()),
        Some("src/main.rs".to_string())
    );
}

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
        event_channel: test_channel(sender),
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
