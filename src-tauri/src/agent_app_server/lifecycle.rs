use super::*;

pub(super) fn canonical_workspace(path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "The open workspace is unavailable.".to_string())?;
    if !root.is_dir() {
        return Err("The open workspace is not a directory.".to_string());
    }
    Ok(root)
}

pub(super) fn create_scratch_directory() -> Result<PathBuf, String> {
    static SCRATCH_COUNTER: AtomicU64 = AtomicU64::new(0);
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    for attempt in 0..16_u64 {
        let path = env::temp_dir().join(format!(
            "svard-agent-{}-{nonce}-{}",
            std::process::id(),
            SCRATCH_COUNTER.fetch_add(1, Ordering::SeqCst) + attempt
        ));
        let mut builder = fs::DirBuilder::new();
        #[cfg(unix)]
        builder.mode(0o700);
        match builder.create(&path) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => break,
        }
    }
    Err("Could not create the attachment workspace.".to_string())
}

pub(super) enum AgentSessionLaunch {
    Start,
    Resume { provider_thread_id: String },
}

pub(super) fn spawn_session_with_executable(
    input: &AgentSessionStartInput,
    event_channel: Channel<AgentEvent>,
    executable: CodexExecutable,
    image_input: bool,
    turn_steering: bool,
    launch: AgentSessionLaunch,
) -> Result<Arc<AgentSession>, String> {
    let automatic_title = match &launch {
        AgentSessionLaunch::Start => AutomaticTitleState::Pending,
        AgentSessionLaunch::Resume { .. } => AutomaticTitleState::Finished,
    };
    let workspace_root = canonical_workspace(&input.workspace_root)?;
    let scratch_directory = create_scratch_directory()?;
    let mut command = executable.command();
    command
        .args(["app-server", "--stdio"])
        .current_dir(&workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(_) => {
            let _ = fs::remove_dir_all(&scratch_directory);
            return Err("Codex app-server could not start.".to_string());
        }
    };
    let Some(stdin) = child.stdin.take() else {
        let _ = child.kill();
        let _ = child.wait();
        let _ = fs::remove_dir_all(&scratch_directory);
        return Err("Codex app-server stdin is unavailable.".to_string());
    };
    let Some(stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        let _ = fs::remove_dir_all(&scratch_directory);
        return Err("Codex app-server stdout is unavailable.".to_string());
    };
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            let mut buffer = Vec::new();
            let _ = reader.take(64 * 1024).read_to_end(&mut buffer);
        });
    }
    let session = Arc::new(AgentSession {
        client_session_id: input.client_session_id.clone(),
        workspace_root: workspace_root.clone(),
        scratch_directory,
        permission_mode: input.permission_mode,
        network_access: input.network_access,
        model: input
            .model
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        reasoning_effort: input
            .reasoning_effort
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.chars().take(64).collect()),
        personality: input
            .personality
            .as_deref()
            .filter(|value| matches!(*value, "friendly" | "pragmatic" | "none"))
            .map(str::to_string),
        executable: executable.clone(),
        child: Mutex::new(Some(child)),
        title_child: Mutex::new(None),
        title_scratch_directory: Mutex::new(None),
        stdin: Mutex::new(stdin),
        event_channel,
        request_counter: AtomicU64::new(0),
        approval_counter: AtomicU64::new(0),
        pending_requests: Mutex::new(HashMap::new()),
        pending_approvals: Mutex::new(HashMap::new()),
        item_phases: Mutex::new(HashMap::new()),
        thread_id: Mutex::new(None),
        active_turn: Mutex::new(None),
        staged_images: Mutex::new(HashMap::new()),
        image_counter: AtomicU64::new(0),
        image_input: AtomicBool::new(image_input),
        turn_steering: AtomicBool::new(turn_steering),
        automatic_title: Mutex::new(automatic_title),
        title_update_lock: Mutex::new(()),
        closed: AtomicBool::new(false),
    });
    let reader_session = Arc::clone(&session);
    thread::spawn(move || reader_loop(reader_session, stdout));

    let setup = (|| -> Result<String, String> {
        session.request(
            "initialize",
            json!({
                "clientInfo": {
                    "name": "svard",
                    "title": "Svard",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                    "requestAttestation": false,
                },
            }),
            REQUEST_TIMEOUT,
        )?;
        session.notify("initialized")?;
        let common = json!({
            "cwd": workspace_root.to_string_lossy(),
            "runtimeWorkspaceRoots": [workspace_root.to_string_lossy()],
            "developerInstructions": SVARD_AGENT_DEVELOPER_INSTRUCTIONS,
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
            "sandbox": match input.permission_mode {
                AgentPermissionMode::Observe => "read-only",
                AgentPermissionMode::Agent => "workspace-write",
                AgentPermissionMode::FullAccess => "danger-full-access",
            },
            "config": {
                "web_search": if input.web_search { "live" } else { "disabled" },
            },
        });
        let thread_result = match launch {
            AgentSessionLaunch::Start => {
                let mut params = common;
                params["ephemeral"] = json!(false);
                params["experimentalRawEvents"] = json!(false);
                session.request("thread/start", params, REQUEST_TIMEOUT)?
            }
            AgentSessionLaunch::Resume { provider_thread_id } => {
                let mut params = common;
                params["threadId"] = json!(provider_thread_id);
                params["excludeTurns"] = json!(true);
                if let Some(model) = session.model.as_deref() {
                    params["model"] = json!(model);
                }
                if let Some(personality) = session.personality.as_deref() {
                    params["personality"] = json!(personality);
                }
                session.request("thread/resume", params, REQUEST_TIMEOUT)?
            }
        };
        thread_result
            .pointer("/thread/id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "Codex did not return a thread.".to_string())
    })();
    let thread_id = match setup {
        Ok(thread_id) => thread_id,
        Err(error) => {
            session.shutdown();
            return Err(error);
        }
    };
    *session
        .thread_id
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(thread_id);
    Ok(session)
}

pub(super) fn validate_session_runtime(
    input: &AgentSessionStartInput,
    runtime: &AgentProviderRuntimeSnapshot,
) -> Result<bool, String> {
    if runtime.probe.state != "ready" {
        return Err(
            "Codex is not ready. Refresh Codex in AI Providers after resolving the issue."
                .to_string(),
        );
    }
    let explicit_model = input
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let explicit_effort = input
        .reasoning_effort
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let explicit_personality = input
        .personality
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if runtime.catalog.is_none()
        && (explicit_model.is_some() || explicit_effort.is_some() || explicit_personality.is_some())
    {
        return Err(
            "Codex model settings could not be verified. Refresh Codex in AI Providers."
                .to_string(),
        );
    }
    let selected = runtime.catalog.as_ref().and_then(|catalog| {
        explicit_model
            .and_then(|model| {
                catalog
                    .models
                    .iter()
                    .find(|candidate| candidate.model == model)
            })
            .or_else(|| {
                if explicit_model.is_none() {
                    catalog.models.iter().find(|candidate| candidate.is_default)
                } else {
                    None
                }
            })
    });
    if explicit_model.is_some() && selected.is_none() {
        return Err(
            "The saved Codex model is unavailable. Choose another model in AI Providers."
                .to_string(),
        );
    }
    if let (Some(selected), Some(effort)) = (selected, explicit_effort) {
        if !selected
            .supported_reasoning_efforts
            .iter()
            .any(|candidate| candidate.value == effort)
        {
            return Err(
                "The selected reasoning effort is unavailable for this Codex model.".to_string(),
            );
        }
    }
    if let (Some(selected), Some(_)) = (selected, explicit_personality) {
        if !selected.supports_personality {
            return Err("Response styles are unavailable for this Codex model.".to_string());
        }
    }
    Ok(runtime.probe.capabilities.image_input
        && selected.is_none_or(|model| {
            model
                .input_modalities
                .iter()
                .any(|modality| modality == "image")
        }))
}

pub(super) fn permission_mode_id(mode: AgentPermissionMode) -> &'static str {
    match mode {
        AgentPermissionMode::Observe => "observe",
        AgentPermissionMode::Agent => "agent",
        AgentPermissionMode::FullAccess => "fullAccess",
    }
}

pub(super) fn permission_mode_from_id(value: &str) -> Result<AgentPermissionMode, String> {
    match value {
        "observe" => Ok(AgentPermissionMode::Observe),
        "agent" => Ok(AgentPermissionMode::Agent),
        "fullAccess" => Ok(AgentPermissionMode::FullAccess),
        _ => Err("The saved agent access mode is invalid.".to_string()),
    }
}

pub(super) fn session_snapshot(input: &AgentSessionStartInput) -> AgentSessionSnapshot {
    AgentSessionSnapshot {
        permission_mode: permission_mode_id(input.permission_mode).to_string(),
        network_access: input.network_access,
        web_search: input.web_search,
        model: input.model.clone(),
        reasoning_effort: input.reasoning_effort.clone(),
        personality: input.personality.clone(),
    }
}

pub(super) fn session_record(
    input: &AgentSessionStartInput,
    provider_thread_id: String,
    workspace_root: PathBuf,
) -> AgentSessionRecord {
    let timestamp = now_seconds();
    AgentSessionRecord {
        client_session_id: input.client_session_id.clone(),
        provider_id: input.provider_id.clone(),
        provider_thread_id,
        workspace_root,
        title: "New chat".to_string(),
        created_at: timestamp,
        updated_at: timestamp,
        archived: false,
        available: true,
        snapshot: session_snapshot(input),
    }
}

#[tauri::command]
pub fn start_agent_session(
    input: AgentSessionStartInput,
    on_event: Channel<AgentEvent>,
    app: tauri::AppHandle,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSessionInfo, String> {
    if input.provider_id != "codex-app-server" {
        return Err("This agent provider is not supported.".to_string());
    }
    if input.client_session_id.trim().is_empty() {
        return Err("The agent session identifier is invalid.".to_string());
    }
    if state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .contains_key(&input.client_session_id)
    {
        return Err("This agent session is already open.".to_string());
    }
    let runtime_key = provider_runtime_key(&input.provider_id, &input.executable_preference);
    let runtime = agent_provider_runtime(
        &state,
        &input.provider_id,
        &input.executable_preference,
        false,
    )?;
    let image_input = validate_session_runtime(&input, &runtime.snapshot)?;
    let turn_steering = runtime.snapshot.probe.capabilities.turn_steering;
    let executable = runtime.executable.ok_or_else(|| {
        "Codex is unavailable. Refresh Codex or choose another executable in AI Providers."
            .to_string()
    })?;
    let session = match spawn_session_with_executable(
        &input,
        on_event,
        executable,
        image_input,
        turn_steering,
        AgentSessionLaunch::Start,
    ) {
        Ok(session) => session,
        Err(error) => {
            state.invalidate_provider_runtime(&runtime_key);
            return Err(format!(
                "{error} Refresh Codex in AI Providers before starting a new chat."
            ));
        }
    };
    let capabilities = AgentCapabilities::with_protocol_features(
        session.image_input.load(Ordering::SeqCst),
        session.turn_steering.load(Ordering::SeqCst),
    );
    let provider_thread_id = session
        .thread_id
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
        .ok_or_else(|| "Codex did not return a thread.".to_string())?;
    let registry_path = match AgentSessionRegistry::path(&app) {
        Ok(path) => path,
        Err(error) => {
            let provider_thread_id = session
                .thread_id
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .clone();
            if let Some(provider_thread_id) = provider_thread_id {
                let _ = session.request(
                    "thread/delete",
                    json!({ "threadId": provider_thread_id }),
                    Duration::from_secs(3),
                );
            }
            session.shutdown();
            return Err(error);
        }
    };
    if let Err(error) = state.session_registry.insert(
        &registry_path,
        session_record(
            &input,
            provider_thread_id.clone(),
            session.workspace_root.clone(),
        ),
    ) {
        let _ = session.request(
            "thread/delete",
            json!({ "threadId": provider_thread_id }),
            Duration::from_secs(3),
        );
        session.shutdown();
        return Err(error);
    }
    session.emit(AgentEvent::SessionReady {
        client_session_id: input.client_session_id.clone(),
        capabilities: capabilities.clone(),
    });
    state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(input.client_session_id.clone(), session);
    Ok(AgentSessionInfo {
        client_session_id: input.client_session_id,
        provider_id: "codex-app-server",
        capabilities,
    })
}

pub(super) fn settings_from_record(
    record: &AgentSessionRecord,
) -> Result<AgentSessionSettingsSnapshot, String> {
    Ok(AgentSessionSettingsSnapshot {
        permission_mode: permission_mode_from_id(&record.snapshot.permission_mode)?,
        network_access: record.snapshot.network_access,
        web_search: record.snapshot.web_search,
        model: record.snapshot.model.clone(),
        reasoning_effort: record.snapshot.reasoning_effort.clone(),
        personality: record.snapshot.personality.clone(),
    })
}

pub(super) fn summary_from_record(
    record: AgentSessionRecord,
    active: bool,
) -> Result<AgentSessionSummary, String> {
    let settings = settings_from_record(&record)?;
    Ok(AgentSessionSummary {
        client_session_id: record.client_session_id,
        provider_id: record.provider_id,
        title: record.title,
        created_at: record.created_at,
        updated_at: record.updated_at,
        archived: record.archived,
        availability: if active {
            "active"
        } else if record.available {
            "available"
        } else {
            "unavailable"
        },
        settings,
    })
}

#[tauri::command]
pub fn list_agent_sessions(
    input: AgentSessionListInput,
    app: tauri::AppHandle,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSessionPage, String> {
    if input.provider_id != "codex-app-server" {
        return Err("This agent provider does not support saved sessions.".to_string());
    }
    let workspace_root = canonical_workspace(&input.workspace_root)?;
    let registry_path = AgentSessionRegistry::path(&app)?;
    let page = state.session_registry.list(
        &registry_path,
        &input.provider_id,
        &workspace_root,
        input.archived,
        input.cursor.as_deref(),
        input.limit.unwrap_or(50),
    )?;
    let active_ids = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .keys()
        .cloned()
        .collect::<std::collections::HashSet<_>>();
    let sessions = page
        .sessions
        .into_iter()
        .map(|record| {
            let active = active_ids.contains(&record.client_session_id);
            summary_from_record(record, active)
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(AgentSessionPage {
        sessions,
        next_cursor: page.next_cursor,
        management_capabilities: AgentSessionManagementCapabilities::default(),
    })
}

pub(super) fn resume_start_input(
    input: &AgentSessionResumeInput,
    record: &AgentSessionRecord,
) -> Result<AgentSessionStartInput, String> {
    let permission_mode = permission_mode_from_id(&record.snapshot.permission_mode)?;
    if permission_mode == AgentPermissionMode::FullAccess && !input.full_access_confirmed {
        return Err("Full Access must be confirmed before resuming this chat.".to_string());
    }
    Ok(AgentSessionStartInput {
        provider_id: record.provider_id.clone(),
        executable_preference: input.executable_preference.clone(),
        client_session_id: record.client_session_id.clone(),
        workspace_root: record.workspace_root.to_string_lossy().into_owned(),
        permission_mode,
        network_access: record.snapshot.network_access,
        web_search: record.snapshot.web_search,
        model: record.snapshot.model.clone(),
        reasoning_effort: record.snapshot.reasoning_effort.clone(),
        personality: record.snapshot.personality.clone(),
    })
}

pub(super) fn provider_session_missing(error: &str) -> bool {
    let message = error.to_ascii_lowercase();
    message.contains("not found")
        || message.contains("does not exist")
        || message.contains("no rollout")
        || message.contains("unknown thread")
}

#[tauri::command]
pub fn resume_agent_session(
    input: AgentSessionResumeInput,
    on_event: Channel<AgentEvent>,
    app: tauri::AppHandle,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSessionInfo, String> {
    if input.client_session_id.trim().is_empty() {
        return Err("The agent session identifier is invalid.".to_string());
    }
    if state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .contains_key(&input.client_session_id)
    {
        return Err("This agent session is already open.".to_string());
    }
    let workspace_root = canonical_workspace(&input.workspace_root)?;
    let registry_path = AgentSessionRegistry::path(&app)?;
    let record = state
        .session_registry
        .get(&registry_path, &input.client_session_id)?;
    if record.archived {
        return Err("Restore this chat before resuming it.".to_string());
    }
    if record.workspace_root != workspace_root {
        return Err("This chat belongs to another workspace.".to_string());
    }
    if !record.available {
        return Err("The saved Codex chat is unavailable.".to_string());
    }
    let start_input = resume_start_input(&input, &record)?;
    let runtime_key =
        provider_runtime_key(&start_input.provider_id, &start_input.executable_preference);
    let runtime = agent_provider_runtime(
        &state,
        &start_input.provider_id,
        &start_input.executable_preference,
        false,
    )?;
    let image_input = validate_session_runtime(&start_input, &runtime.snapshot)?;
    let turn_steering = runtime.snapshot.probe.capabilities.turn_steering;
    let executable = runtime.executable.ok_or_else(|| {
        "Codex is unavailable. Refresh Codex or choose another executable in AI Providers."
            .to_string()
    })?;
    let session = match spawn_session_with_executable(
        &start_input,
        on_event,
        executable,
        image_input,
        turn_steering,
        AgentSessionLaunch::Resume {
            provider_thread_id: record.provider_thread_id.clone(),
        },
    ) {
        Ok(session) => session,
        Err(error) => {
            state.invalidate_provider_runtime(&runtime_key);
            if provider_session_missing(&error) {
                let _ = state.session_registry.set_available(
                    &registry_path,
                    &input.client_session_id,
                    false,
                );
                return Err("The saved Codex chat is unavailable.".to_string());
            }
            return Err("Codex could not resume the saved chat.".to_string());
        }
    };
    let capabilities = AgentCapabilities::with_protocol_features(
        session.image_input.load(Ordering::SeqCst),
        session.turn_steering.load(Ordering::SeqCst),
    );
    session.emit(AgentEvent::SessionReady {
        client_session_id: input.client_session_id.clone(),
        capabilities: capabilities.clone(),
    });
    state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(input.client_session_id.clone(), session);
    if let Err(error) = state
        .session_registry
        .touch(&registry_path, &input.client_session_id)
    {
        if let Some(session) = state
            .sessions
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
            .remove(&input.client_session_id)
        {
            session.shutdown();
        }
        return Err(error);
    }
    Ok(AgentSessionInfo {
        client_session_id: input.client_session_id,
        provider_id: "codex-app-server",
        capabilities,
    })
}

pub(super) fn session_for(
    state: &State<'_, AgentAppServerState>,
    client_session_id: &str,
) -> Result<Arc<AgentSession>, String> {
    state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(client_session_id)
        .cloned()
        .ok_or_else(|| "The agent chat is not running.".to_string())
}

#[tauri::command]
pub fn read_agent_session_history(
    input: AgentSessionHistoryInput,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSessionHistoryPage, String> {
    let session = session_for(&state, &input.client_session_id)?;
    let thread_id = session
        .thread_id
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
        .ok_or_else(|| "The Codex thread is unavailable.".to_string())?;
    let result = session
        .request(
            "thread/turns/list",
            json!({
                "threadId": thread_id,
                "cursor": input.cursor,
                "limit": input.limit.unwrap_or(50).clamp(1, 50),
                "sortDirection": "desc",
                "itemsView": "full",
            }),
            REQUEST_TIMEOUT,
        )
        .map_err(|_| "Codex chat history is unavailable.".to_string())?;
    let provider_turns = result
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "Codex returned an invalid chat history.".to_string())?;
    let turns = normalize_history_turn_page(
        &input.client_session_id,
        &session.workspace_root,
        provider_turns,
    );
    Ok(AgentSessionHistoryPage {
        turns,
        next_cursor: result
            .get("nextCursor")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}
