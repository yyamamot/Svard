fn test_runtime_snapshot(version: &str) -> AgentProviderRuntimeSnapshot {
    AgentProviderRuntimeSnapshot {
        provider_id: "codex-app-server",
        probe: AgentProbe {
            provider_id: "codex-app-server",
            state: "ready",
            source: Some("path"),
            version: Some(version.to_string()),
            capabilities: AgentCapabilities::with_protocol_features(
                true, true, true, true, true, true,
            ),
        },
        installation: Some(AgentInstallationDescriptor {
            source: "path",
            display_name: "PATH installation",
            version: version.to_string(),
        }),
        catalog: Some(AgentModelCatalog {
            provider_id: "codex-app-server",
            models: Vec::new(),
        }),
        issue: None,
    }
}

#[test]
fn context_usage_normalization_clamps_and_rejects_invalid_values() {
    let usage = normalize_context_usage(&json!({
        "tokenUsage": {
            "last": { "totalTokens": 75 },
            "modelContextWindow": 100
        }
    }))
    .unwrap();
    assert_eq!(usage.used_tokens, 75);
    assert_eq!(usage.context_window_tokens, 100);
    assert_eq!(usage.remaining_percent, 25);

    let clamped = normalize_context_usage(&json!({
        "tokenUsage": {
            "last": { "totalTokens": 150 },
            "modelContextWindow": 100
        }
    }))
    .unwrap();
    assert_eq!(clamped.used_tokens, 100);
    assert_eq!(clamped.remaining_percent, 0);

    for invalid in [
        json!({"tokenUsage":{"last":{"totalTokens":-1},"modelContextWindow":100}}),
        json!({"tokenUsage":{"last":{"totalTokens":1},"modelContextWindow":0}}),
        json!({"tokenUsage":{"last":{"totalTokens":1},"modelContextWindow":null}}),
    ] {
        assert!(normalize_context_usage(&invalid).is_none());
    }
}

#[test]
fn context_events_expose_only_provider_neutral_values() {
    let value = serde_json::to_value(AgentEvent::ContextUsageUpdated {
        usage: AgentContextUsage {
            used_tokens: 75,
            context_window_tokens: 100,
            remaining_percent: 25,
        },
    })
    .unwrap();
    assert_eq!(value["type"], "contextUsageUpdated");
    assert_eq!(value["usage"]["usedTokens"], 75);
    assert_eq!(value["usage"]["contextWindowTokens"], 100);
    assert_eq!(value["usage"]["remainingPercent"], 25);
    assert!(value.get("threadId").is_none());
    assert!(value.get("turnId").is_none());
}

#[cfg(unix)]
#[test]
fn schema_probe_requires_usage_and_compaction_contracts() {
    use std::os::unix::fs::PermissionsExt;

    let workspace = tempfile::tempdir().unwrap();
    let script = workspace.path().join("fake-codex-schema");
    std::fs::write(
        &script,
        r#"#!/bin/sh
if [ "$1" = "app-server" ] && [ "$2" = "generate-json-schema" ]; then
  mkdir -p "$5/v2"
  printf '%s\n' '{"localImage":true,"turn/steer":true,"thread/tokenUsage/updated":true,"modelContextWindow":1,"totalTokens":1,"thread/compact/start":true,"contextCompaction":true,"thread/start":true,"thread/resume":true,"skills/list":true,"SkillsListResponse":true,"config":true}' > "$5/protocol.json"
  printf '%s\n' '{"config":{}}' > "$5/v2/ThreadStartParams.json"
  printf '%s\n' '{"config":{}}' > "$5/v2/ThreadResumeParams.json"
  printf '%s\n' '{"last":{"inputTokens":1,"cachedInputTokens":1,"outputTokens":1,"reasoningOutputTokens":1,"totalTokens":1},"total":{"inputTokens":1,"cachedInputTokens":1,"outputTokens":1,"reasoningOutputTokens":1,"totalTokens":1}}' > "$5/v2/ThreadTokenUsageUpdatedNotification.json"
  printf '%s\n' '{"cwds":[]}' > "$5/v2/SkillsListParams.json"
  printf '%s\n' '{"data":[]}' > "$5/v2/SkillsListResponse.json"
  exit 0
fi
exit 1
"#,
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(
        schema_capabilities(&CodexExecutable::custom_for_test(script)),
        ProtocolCapabilities {
            image_input: true,
            turn_steering: true,
            context_usage: true,
            token_usage_diagnostics: true,
            manual_compaction: true,
            focused_context: true,
        }
    );
}

#[test]
fn focused_config_disables_extensions_and_deduplicates_skill_names() {
    let names = focused_skill_names(&json!({
        "data": [
            {
                "cwd": "/private/workspace",
                "errors": [],
                "skills": [
                    {"name": "review", "path": "/private/one"},
                    {"name": "review", "path": "/private/two"},
                    {"name": "docs", "path": "/private/three"}
                ]
            }
        ]
    }))
    .unwrap();
    assert_eq!(names, vec!["docs".to_string(), "review".to_string()]);

    let config = focused_thread_config(&names, false);
    assert_eq!(config["features"]["memories"], false);
    assert_eq!(config["features"]["plugins"], false);
    assert_eq!(config["features"]["apps"], false);
    assert_eq!(config["memories"]["use_memories"], false);
    assert_eq!(config["memories"]["generate_memories"], false);
    assert_eq!(config["apps"]["_default"]["enabled"], false);
    assert_eq!(config["include_apps_instructions"], false);
    assert_eq!(config["web_search"], "disabled");
    assert_eq!(config["skills"]["config"].as_array().unwrap().len(), 2);
    let serialized = serde_json::to_string(&config).unwrap();
    assert!(!serialized.contains("/private/"));
}

#[test]
fn focused_skill_list_accepts_empty_and_rejects_errors_or_invalid_names() {
    assert_eq!(
        focused_skill_names(&json!({
            "data": [{"cwd": "/private/workspace", "errors": [], "skills": []}]
        }))
        .unwrap(),
        Vec::<String>::new()
    );
    for invalid in [
        json!({"data": [{"errors": [{}], "skills": []}]}),
        json!({"data": [{"errors": [], "skills": [{"name": ""}]}]}),
        json!({"data": [{"errors": [], "skills": [{"name": "bad\nname"}]}]}),
        json!({"unexpected": []}),
    ] {
        assert_eq!(
            focused_skill_names(&invalid).unwrap_err(),
            "Focused context is unavailable."
        );
    }
}

#[cfg(unix)]
#[test]
fn focused_runtime_probe_stops_before_resume_requires_a_rollout() {
    use std::os::unix::fs::PermissionsExt;

    let workspace = tempfile::tempdir().unwrap();
    let script = workspace.path().join("fake-focused-codex");
    std::fs::write(
        &script,
        r#"#!/bin/sh
while [ "$#" -gt 0 ] && [ "$1" != "app-server" ]; do shift; done
[ "$1" = "app-server" ] || exit 1
IFS= read -r initialize
printf '{"id":1,"result":{}}\n'
IFS= read -r initialized
IFS= read -r skills
printf '{"id":2,"result":{"data":[{"cwd":"/private","errors":[],"skills":[{"name":"docs"}]}]}}\n'
IFS= read -r start
printf '{"id":3,"result":{"thread":{"id":"ephemeral"}}}\n'
exit 0
"#,
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert!(probe_focused_context(&CodexExecutable::custom_for_test(
        script
    )));
}

#[test]
fn provider_runtime_cache_reuses_refreshes_and_joins_inflight_loads() {
    use std::sync::atomic::AtomicUsize;

    let state = Arc::new(AgentAppServerState::default());
    let loads = Arc::new(AtomicUsize::new(0));
    let first_state = Arc::clone(&state);
    let first_loads = Arc::clone(&loads);
    let first = thread::spawn(move || {
        agent_provider_runtime_with(&first_state, "auto", false, || {
            first_loads.fetch_add(1, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(40));
            Ok(CachedAgentProviderRuntime {
                snapshot: test_runtime_snapshot("first"),
                executable: None,
            })
        })
        .unwrap()
    });
    while loads.load(Ordering::SeqCst) == 0 {
        thread::yield_now();
    }
    let joined = agent_provider_runtime_with(&state, "auto", false, || {
        panic!("an in-flight runtime request must be shared")
    })
    .unwrap();
    let initial = first.join().unwrap();
    assert_eq!(initial.snapshot.probe.version.as_deref(), Some("first"));
    assert_eq!(joined.snapshot.probe.version.as_deref(), Some("first"));
    assert_eq!(loads.load(Ordering::SeqCst), 1);

    let cached = agent_provider_runtime_with(&state, "auto", false, || {
        panic!("a cached runtime must not be reloaded")
    })
    .unwrap();
    assert_eq!(cached.snapshot.probe.version.as_deref(), Some("first"));

    let refreshed = agent_provider_runtime_with(&state, "auto", true, || {
        loads.fetch_add(1, Ordering::SeqCst);
        Ok(CachedAgentProviderRuntime {
            snapshot: test_runtime_snapshot("refreshed"),
            executable: None,
        })
    })
    .unwrap();
    assert_eq!(
        refreshed.snapshot.probe.version.as_deref(),
        Some("refreshed")
    );
    assert_eq!(loads.load(Ordering::SeqCst), 2);

    let custom = agent_provider_runtime_with(&state, "custom:/mock/codex", false, || {
        loads.fetch_add(1, Ordering::SeqCst);
        Ok(CachedAgentProviderRuntime {
            snapshot: test_runtime_snapshot("custom"),
            executable: None,
        })
    })
    .unwrap();
    assert_eq!(custom.snapshot.probe.version.as_deref(), Some("custom"));
    assert_eq!(loads.load(Ordering::SeqCst), 3);
}

#[cfg(unix)]
#[test]
fn fake_app_server_initializes_and_cleans_up() {
    use std::os::unix::fs::PermissionsExt;

    let workspace = tempfile::tempdir().unwrap();
    let script = workspace.path().join("fake-codex");
    std::fs::write(
        &script,
        r#"#!/bin/sh
if [ "$1" = "app-server" ] && [ "$2" = "generate-json-schema" ]; then
  mkdir -p "$5"
  printf '{"type":"localImage"}\n' > "$5/protocol.json"
  exit 0
fi
IFS= read -r initialize
printf '{"id":1,"result":{}}\n'
IFS= read -r initialized
IFS= read -r thread_start
printf '{"id":2,"result":{"thread":{"id":"fake-thread"}}}\n'
while IFS= read -r line; do :; done
"#,
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
    let input = AgentSessionStartInput {
        provider_id: "codex-app-server".to_string(),
        executable_preference: CodexExecutablePreference::default(),
        client_session_id: "fake-session".to_string(),
        workspace_root: workspace.path().to_string_lossy().to_string(),
        permission_mode: AgentPermissionMode::Observe,
        network_access: false,
        web_search: false,
        context_profile: AgentContextProfile::ProviderDefaults,
        model: Some("gpt-5.6-sol".to_string()),
        reasoning_effort: Some("high".to_string()),
        personality: Some("pragmatic".to_string()),
    };
    let (sender, receiver) = std::sync::mpsc::channel();
    let session = spawn_session_with_executable(
        &input,
        test_channel(sender),
        "test-main".to_string(),
        CodexExecutable::custom_for_test(script),
        true,
        true,
        true,
        true,
        true,
        AgentSessionLaunch::Start,
    )
    .unwrap();
    assert_eq!(
        session
            .thread_id
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_deref(),
        Some("fake-thread")
    );
    let (completion, completion_receiver) = std::sync::mpsc::channel();
    *session
        .manual_compaction
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(ManualCompaction {
        item_started: false,
        item_completed: false,
        completion,
    });
    normalize_notification(
        &session,
        &json!({
            "method": "item/started",
            "params": {"item": {"id": "private-item", "type": "contextCompaction"}}
        }),
    );
    normalize_notification(
        &session,
        &json!({
            "method": "item/completed",
            "params": {"item": {"id": "private-item", "type": "contextCompaction"}}
        }),
    );
    normalize_notification(
        &session,
        &json!({
            "method": "turn/completed",
            "params": {"turn": {"id": "private-turn", "status": "completed"}}
        }),
    );
    let started = receiver.recv_timeout(Duration::from_secs(1)).unwrap();
    assert_eq!(started["type"], "contextCompactionStarted");
    assert_eq!(started["source"], "manual");
    let completed = receiver.recv_timeout(Duration::from_secs(1)).unwrap();
    assert_eq!(completed["type"], "contextCompactionCompleted");
    assert_eq!(completed["source"], "manual");
    assert!(matches!(
        completion_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap(),
        AgentCompactionOutcome::Completed
    ));
    let scratch = session.scratch_directory.clone();
    assert!(scratch.is_dir());
    std::fs::write(scratch.join("staged-image.png"), b"private snapshot").unwrap();
    session.shutdown().unwrap();
    assert!(!scratch.exists());
}

#[cfg(unix)]
#[test]
fn title_app_server_is_ephemeral_private_and_uses_only_the_question() {
    use std::os::unix::fs::PermissionsExt;

    let workspace = tempfile::tempdir().unwrap();
    let script = workspace.path().join("fake-codex-title");
    std::fs::write(
        &script,
        r#"#!/bin/sh
log="${0}.log"
pwd > "${log}.cwd"
IFS= read -r initialize
printf '{"id":1,"result":{}}\n'
IFS= read -r initialized
IFS= read -r thread_start
printf '%s\n' "$thread_start" >> "$log"
printf '{"id":2,"result":{"thread":{"id":"title-thread"}}}\n'
IFS= read -r turn_start
printf '%s\n' "$turn_start" >> "$log"
printf '{"id":3,"result":{"turn":{"id":"title-turn"}}}\n'
printf '{"method":"item/completed","params":{"item":{"type":"agentMessage","phase":"commentary","text":"ignore me"}}}\n'
printf '{"method":"item/completed","params":{"item":{"type":"agentMessage","phase":"final_answer","text":"AI Chat title support"}}}\n'
printf '{"method":"turn/completed","params":{"turn":{"id":"title-turn","status":"completed"}}}\n'
while IFS= read -r line; do :; done
"#,
    )
    .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
    let (sender, _receiver) = std::sync::mpsc::channel();
    let session = AgentSession {
        client_session_id: "title-session".to_string(),
        workspace_root: workspace.path().to_path_buf(),
        scratch_directory: workspace.path().join("main-scratch"),
        permission_mode: AgentPermissionMode::Observe,
        network_access: false,
        model: Some("gpt-5.6-sol".to_string()),
        reasoning_effort: Some("high".to_string()),
        personality: Some("pragmatic".to_string()),
        executable: CodexExecutable::custom_for_test(script.clone()),
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
        thread_id: Mutex::new(Some("main-thread".to_string())),
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
        automatic_title: Mutex::new(AutomaticTitleState::FallbackApplied {
            expected_title: "fallback".to_string(),
        }),
        title_update_lock: Mutex::new(()),
        closed: AtomicBool::new(false),
    };

    let title = generate_session_title(&session, "Improve AI chat titles").unwrap();
    assert_eq!(title, "AI Chat title support");
    let requests = std::fs::read_to_string(format!("{}.log", script.display())).unwrap();
    let mut lines = requests.lines();
    let thread_start: Value = serde_json::from_str(lines.next().unwrap()).unwrap();
    let turn_start: Value = serde_json::from_str(lines.next().unwrap()).unwrap();
    assert_eq!(
        thread_start.pointer("/params/ephemeral"),
        Some(&json!(true))
    );
    assert_eq!(
        thread_start.pointer("/params/approvalPolicy"),
        Some(&json!("never"))
    );
    assert_eq!(
        thread_start.pointer("/params/sandbox"),
        Some(&json!("read-only"))
    );
    assert_eq!(
        thread_start.pointer("/params/config/web_search"),
        Some(&json!("disabled"))
    );
    assert_eq!(
        thread_start.pointer("/params/model"),
        Some(&json!("gpt-5.6-sol"))
    );
    assert!(thread_start.pointer("/params/reasoningEffort").is_none());
    assert!(thread_start.pointer("/params/personality").is_none());
    assert_eq!(
        turn_start.pointer("/params/input"),
        Some(&json!([{
            "type": "text",
            "text": "Improve AI chat titles"
        }]))
    );
    assert!(!requests.contains(workspace.path().to_string_lossy().as_ref()));
    let title_cwd = std::fs::read_to_string(format!("{}.log.cwd", script.display())).unwrap();
    assert_ne!(title_cwd.trim(), workspace.path().to_string_lossy());
    assert!(session
        .title_child
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .is_none());
    assert!(session
        .title_scratch_directory
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .is_none());
}

#[cfg(unix)]
#[test]
fn transient_fake_app_server_lists_models_without_starting_a_thread() {
    use std::os::unix::fs::PermissionsExt;

    let workspace = tempfile::tempdir().unwrap();
    let script = workspace.path().join("fake-codex-models");
    std::fs::write(
            &script,
            r#"#!/bin/sh
IFS= read -r initialize
printf '{"id":1,"result":{}}\n'
IFS= read -r initialized
IFS= read -r model_list
printf '{"id":2,"result":{"data":[{"id":"available","model":"available","displayName":"Available","description":"Test model","hidden":false,"isDefault":true,"defaultReasoningEffort":"medium","supportedReasoningEfforts":[{"reasoningEffort":"medium"}],"supportsPersonality":false,"inputModalities":["text"]}],"nextCursor":null}}\n'
if IFS= read -r unexpected; then
  exit 9
fi
"#,
        )
        .unwrap();
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
    let catalog =
        list_agent_models_with_executable(CodexExecutable::custom_for_test(script)).unwrap();
    assert_eq!(catalog.models.len(), 1);
    assert_eq!(catalog.models[0].model, "available");
}

#[test]
fn model_catalog_paginates_deduplicates_and_ignores_hidden_models() {
    let mut calls = 0;
    let catalog = load_model_catalog_with(|params| {
        calls += 1;
        assert_eq!(params.get("includeHidden"), Some(&json!(false)));
        assert_eq!(params.get("limit"), Some(&json!(100)));
        Ok(if calls == 1 {
            json!({
                "data": [
                    {
                        "id": "visible",
                        "model": "visible",
                        "displayName": "Visible",
                        "description": "Available",
                        "hidden": false,
                        "isDefault": true,
                        "defaultReasoningEffort": "medium",
                        "supportedReasoningEfforts": [
                            {"reasoningEffort": "medium", "description": "Balanced"}
                        ],
                        "supportsPersonality": true,
                        "inputModalities": ["text", "image"]
                    },
                    {
                        "id": "hidden",
                        "model": "hidden",
                        "displayName": "Hidden",
                        "description": "",
                        "hidden": true,
                        "supportedReasoningEfforts": []
                    }
                ],
                "nextCursor": "next"
            })
        } else {
            assert_eq!(params.get("cursor"), Some(&json!("next")));
            json!({
                "data": [
                    {
                        "id": "duplicate",
                        "model": "visible",
                        "displayName": "Duplicate",
                        "description": "",
                        "hidden": false,
                        "supportedReasoningEfforts": []
                    }
                ],
                "nextCursor": null
            })
        })
    })
    .unwrap();
    assert_eq!(calls, 2);
    assert_eq!(catalog.models.len(), 1);
    assert_eq!(catalog.models[0].model, "visible");
    assert!(catalog.models[0]
        .input_modalities
        .iter()
        .any(|value| value == "image"));
}

#[test]
fn image_normalization_accepts_png_and_rejects_unsupported_or_forged_inputs() {
    let image = DynamicImage::new_rgba8(3, 2);
    let mut source = Cursor::new(Vec::new());
    image.write_to(&mut source, ImageFormat::Png).unwrap();
    let normalized = normalize_agent_image(&source.into_inner()).unwrap();
    assert_eq!(normalized.media_type, "image/png");
    assert_eq!((normalized.width, normalized.height), (3, 2));
    assert!(normalized
        .thumbnail_data_url
        .starts_with("data:image/png;base64,"));

    assert!(normalize_agent_image(b"<svg xmlns='http://www.w3.org/2000/svg'/>").is_err());
    assert!(normalize_agent_image(b"GIF89a forged image").is_err());
    assert!(normalize_agent_image(b"\x89PNG\r\n\x1a\nnot a decoded PNG").is_err());
    assert_eq!(
        normalize_agent_image(&vec![0; MAX_IMAGE_SOURCE_BYTES + 1]).unwrap_err(),
        "This image is too large."
    );
}

#[test]
fn image_normalization_accepts_jpeg_and_webp() {
    let image = DynamicImage::new_rgb8(4, 3);
    for format in [ImageFormat::Jpeg, ImageFormat::WebP] {
        let mut source = Cursor::new(Vec::new());
        image.write_to(&mut source, format).unwrap();
        let normalized = normalize_agent_image(&source.into_inner()).unwrap();
        assert_eq!(normalized.media_type, "image/jpeg");
        assert_eq!((normalized.width, normalized.height), (4, 3));
    }
}

#[test]
fn image_dimensions_are_limited_before_full_decode() {
    fn crc32(bytes: &[u8]) -> u32 {
        let mut crc = 0xffff_ffff_u32;
        for byte in bytes {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                crc = if crc & 1 == 1 {
                    (crc >> 1) ^ 0xedb8_8320
                } else {
                    crc >> 1
                };
            }
        }
        !crc
    }

    let image = DynamicImage::new_rgba8(1, 1);
    let mut source = Cursor::new(Vec::new());
    image.write_to(&mut source, ImageFormat::Png).unwrap();
    let mut bytes = source.into_inner();
    bytes[16..20].copy_from_slice(&7_000_u32.to_be_bytes());
    bytes[20..24].copy_from_slice(&6_000_u32.to_be_bytes());
    let crc = crc32(&bytes[12..29]);
    bytes[29..33].copy_from_slice(&crc.to_be_bytes());

    assert_eq!(
        normalize_agent_image(&bytes).unwrap_err(),
        "This image has too many pixels."
    );
}

#[test]
fn consumed_images_do_not_block_staging_for_the_next_question() {
    let staged_image =
        |attachment_id: &str, byte_length: usize, consumed_by: Option<&str>| StagedAgentImage {
            attachment: AgentImageAttachment {
                attachment_id: attachment_id.to_string(),
                display_label: format!("{attachment_id}.png"),
                media_type: "image/png",
                width: 1,
                height: 1,
                byte_length,
                thumbnail_data_url: "data:image/png;base64,preview".to_string(),
            },
            path: PathBuf::from(format!("/private/{attachment_id}.png")),
            digest: attachment_id.to_string(),
            consumed_by: consumed_by.map(str::to_string),
        };
    let staged = HashMap::from([
        (
            "current-turn".to_string(),
            staged_image("current-turn", 1024, Some("active-turn")),
        ),
        (
            "next-question".to_string(),
            staged_image("next-question", 2048, None),
        ),
    ]);

    assert_eq!(pending_image_usage(&staged), (1, 2048));
}

#[test]
fn clipboard_image_input_accepts_the_frontend_camel_case_payload() {
    let input: AgentImageStageInput = serde_json::from_value(json!({
        "clientSessionId": "session",
        "source": {
            "kind": "clipboardBytes",
            "displayLabel": "image.png",
            "mediaType": "image/png",
            "base64": "cG5n"
        }
    }))
    .unwrap();

    assert_eq!(input.client_session_id, "session");
    match input.source {
        AgentImageStageSource::ClipboardBytes {
            display_label,
            media_type,
            base64,
        } => {
            assert_eq!(display_label, "image.png");
            assert_eq!(media_type, "image/png");
            assert_eq!(base64, "cG5n");
        }
        AgentImageStageSource::SelectedPath { .. } => {
            panic!("clipboard payload selected the wrong source variant")
        }
    }
}

#[test]
fn mixed_turn_input_accepts_the_frontend_camel_case_payload() {
    let input: AgentTurnInput = serde_json::from_value(json!({
        "clientSessionId": "session",
        "clientTurnId": "turn",
        "question": "Inspect the selected content.",
        "responseMode": "auto",
        "focusFiles": [],
        "imageAttachmentIds": ["image-1"],
        "contentParts": [
            { "type": "text", "text": "Before image" },
            { "type": "image", "attachmentId": "image-1" },
            { "type": "text", "text": "After image" }
        ]
    }))
    .unwrap();

    assert_eq!(input.content_parts.len(), 3);
    assert!(matches!(
        &input.content_parts[1],
        AgentTurnContentPart::Image { attachment_id }
            if attachment_id == "image-1"
    ));
}

#[test]
fn agent_events_serialize_variant_fields_in_frontend_camel_case() {
    let accepted = serde_json::to_value(AgentEvent::TurnInputAccepted {
        client_turn_id: "turn-1".to_string(),
        image_attachment_ids: vec!["image-1".to_string()],
    })
    .unwrap();
    assert_eq!(accepted["type"], "turnInputAccepted");
    assert_eq!(accepted["clientTurnId"], "turn-1");
    assert_eq!(accepted["imageAttachmentIds"][0], "image-1");
    assert!(accepted.get("client_turn_id").is_none());
    assert!(accepted.get("image_attachment_ids").is_none());

    let title = serde_json::to_value(AgentEvent::SessionTitleUpdated {
        client_session_id: "session-1".to_string(),
        title: "AI Chat titles".to_string(),
    })
    .unwrap();
    assert_eq!(title["type"], "sessionTitleUpdated");
    assert_eq!(title["clientSessionId"], "session-1");
    assert_eq!(title["title"], "AI Chat titles");
    assert!(title.get("client_session_id").is_none());

    let tool = serde_json::to_value(AgentEvent::ToolStarted {
        tool_id: "tool-1".to_string(),
        kind: "read",
        category: "read",
        title: "Reading a file".to_string(),
        visibility: "user",
        target: Some("docs/guide.md".to_string()),
        detail: None,
    })
    .unwrap();
    assert_eq!(tool["toolId"], "tool-1");
    assert_eq!(tool["category"], "read");
    assert_eq!(tool["visibility"], "user");
    assert_eq!(tool["target"], "docs/guide.md");
    assert!(tool.get("tool_id").is_none());
}

#[test]
fn image_turn_input_follows_text_without_exposing_an_attachment_id() {
    let items = turn_input_items(
        "Inspect this image.",
        &[],
        &[(
            "opaque-image-id".to_string(),
            PathBuf::from("/private/session/image-1.png"),
        )],
    )
    .unwrap();
    assert_eq!(items[0]["type"], "text");
    assert_eq!(items[1]["type"], "localImage");
    assert_eq!(items[1]["detail"], "auto");
    assert!(!items[1].to_string().contains("opaque-image-id"));
}

#[test]
fn mixed_turn_input_preserves_text_image_text_order() {
    let items = turn_input_items(
        "Question",
        &[
            AgentTurnContentPart::Text {
                text: "Before image".to_string(),
            },
            AgentTurnContentPart::Image {
                attachment_id: "image-1".to_string(),
            },
            AgentTurnContentPart::Text {
                text: "After image".to_string(),
            },
        ],
        &[(
            "image-1".to_string(),
            PathBuf::from("/private/session/image-1.png"),
        )],
    )
    .unwrap();
    assert_eq!(items[0]["text"], "Question");
    assert_eq!(items[1]["text"], "Before image");
    assert_eq!(items[2]["type"], "localImage");
    assert_eq!(items[3]["text"], "After image");
}

#[test]
fn auto_and_visualize_turns_receive_distinct_guidance() {
    let auto = turn_prompt(
        "",
        "",
        "Explain the workspace.",
        AgentResponseMode::Auto,
        "question",
        "OPENUI COMPONENTS",
    );
    assert!(auto.contains(AUTO_RESPONSE_INSTRUCTION));
    assert!(!auto.contains("OPENUI COMPONENTS"));
    assert!(!auto.contains("SvardExperience"));

    let visualize = turn_prompt(
        "",
        "",
        "Visualize the workspace.",
        AgentResponseMode::Visualize,
        "question",
        "OPENUI COMPONENTS",
    );
    assert!(visualize.contains(VISUALIZE_RESPONSE_INSTRUCTION));
    assert!(visualize.contains("OPENUI COMPONENTS"));
    assert!(auto.ends_with("Explain the workspace."));
    assert!(visualize.ends_with("Visualize the workspace."));
}

#[cfg(unix)]
fn panic_stdin() -> ChildStdin {
    let mut child = Command::new("sh")
        .args(["-c", "cat >/dev/null"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap()
}

#[cfg(windows)]
fn panic_stdin() -> ChildStdin {
    let mut child = Command::new("cmd")
        .args(["/C", "more >NUL"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap()
}

fn test_channel(sender: mpsc::Sender<Value>) -> Channel<AgentEventEnvelope> {
    Channel::new(move |body| {
        if let tauri::ipc::InvokeResponseBody::Json(value) = body {
            if let Ok(envelope) = serde_json::from_str::<Value>(&value) {
                let _ = sender.send(envelope["event"].clone());
            }
        }
        Ok(())
    })
}
