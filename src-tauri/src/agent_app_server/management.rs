use super::*;

pub(super) fn request_saved_thread(
    record: &AgentSessionRecord,
    executable_preference: &CodexExecutablePreference,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let executable = executable_candidates(executable_preference)?
        .into_iter()
        .next()
        .ok_or_else(|| "The saved Codex executable is unavailable.".to_string())?;
    let mut command = executable.command();
    command
        .args(["app-server", "--stdio"])
        .current_dir(&record.workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = command
        .spawn()
        .map_err(|_| "Codex app-server could not start.".to_string())?;
    let result = (|| -> Result<Value, String> {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Codex app-server stdin is unavailable.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Codex app-server stdout is unavailable.".to_string())?;
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if sender.send(line).is_err() {
                    break;
                }
            }
        });
        transient_management_request(
            &mut stdin,
            &receiver,
            1,
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
        )?;
        serde_json::to_writer(&mut stdin, &json!({ "method": "initialized" }))
            .map_err(|_| "Could not encode the Codex request.".to_string())?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| "Codex app-server disconnected.".to_string())?;
        transient_management_request(&mut stdin, &receiver, 2, method, params)
    })();
    let _ = child.kill();
    let _ = child.wait();
    result
}

pub(super) fn request_record_thread(
    state: &AgentAppServerState,
    record: &AgentSessionRecord,
    executable_preference: &CodexExecutablePreference,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let active = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(&record.client_session_id)
        .cloned();
    if let Some(session) = active {
        session.request(method, params, REQUEST_TIMEOUT)
    } else {
        request_saved_thread(record, executable_preference, method, params)
    }
}

pub(super) fn ensure_session_idle(
    state: &AgentAppServerState,
    client_session_id: &str,
) -> Result<(), String> {
    let active = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(client_session_id)
        .cloned();
    if active.is_some_and(|session| {
        session
            .active_turn
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .is_some()
    }) {
        return Err("Wait for the current response or cancel it first.".to_string());
    }
    Ok(())
}

pub(super) fn normalized_session_title(title: &str) -> Result<String, String> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > 120 || title.chars().any(char::is_control) {
        return Err("The chat title is invalid.".to_string());
    }
    Ok(title.to_string())
}

#[tauri::command]
pub fn rename_agent_session(
    input: AgentSessionRenameInput,
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSessionSummary, String> {
    let title = normalized_session_title(&input.title)?;
    let active_session = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(&input.client_session_id)
        .cloned();
    if let Some(session) = active_session.as_ref() {
        session.ensure_owner(window.label())?;
    }
    let _title_guard = active_session.as_ref().map(|session| {
        session
            .title_update_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    });
    if let Some(session) = active_session.as_ref() {
        *session
            .automatic_title
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = AutomaticTitleState::Cancelled;
    }
    let registry_path = AgentSessionRegistry::path(&app)?;
    let record = state
        .session_registry
        .get(&registry_path, &input.client_session_id)?;
    request_record_thread(
        &state,
        &record,
        &input.executable_preference,
        "thread/name/set",
        json!({
            "threadId": record.provider_thread_id.clone(),
            "name": title,
        }),
    )
    .map_err(|_| "Codex could not rename the saved chat.".to_string())?;
    if let Err(error) =
        state
            .session_registry
            .rename(&registry_path, &input.client_session_id, title)
    {
        let _ = request_record_thread(
            &state,
            &record,
            &input.executable_preference,
            "thread/name/set",
            json!({
                "threadId": record.provider_thread_id.clone(),
                "name": record.title.clone(),
            }),
        );
        return Err(error);
    }
    let updated = state
        .session_registry
        .get(&registry_path, &input.client_session_id)?;
    let active = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .contains_key(&input.client_session_id);
    summary_from_record(updated, active)
}

#[tauri::command]
pub fn set_agent_session_archived(
    input: AgentSessionArchiveInput,
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSessionSummary, String> {
    ensure_session_idle(&state, &input.client_session_id)?;
    let active_session = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(&input.client_session_id)
        .cloned();
    if let Some(session) = active_session.as_ref() {
        session.ensure_owner(window.label())?;
    }
    let _title_guard = active_session.as_ref().map(|session| {
        session
            .title_update_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    });
    if let Some(session) = active_session.as_ref() {
        *session
            .automatic_title
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = AutomaticTitleState::Cancelled;
    }
    let registry_path = AgentSessionRegistry::path(&app)?;
    let record = state
        .session_registry
        .get(&registry_path, &input.client_session_id)?;
    let method = if input.archived {
        "thread/archive"
    } else {
        "thread/unarchive"
    };
    request_record_thread(
        &state,
        &record,
        &input.executable_preference,
        method,
        json!({ "threadId": record.provider_thread_id.clone() }),
    )
    .map_err(|_| "Codex could not update the saved chat.".to_string())?;
    if let Err(error) = state.session_registry.set_archived(
        &registry_path,
        &input.client_session_id,
        input.archived,
    ) {
        let rollback_method = if input.archived {
            "thread/unarchive"
        } else {
            "thread/archive"
        };
        let _ = request_record_thread(
            &state,
            &record,
            &input.executable_preference,
            rollback_method,
            json!({ "threadId": record.provider_thread_id.clone() }),
        );
        return Err(error);
    }
    drop(_title_guard);
    if input.archived {
        if let Some(session) = state
            .sessions
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&input.client_session_id)
        {
            let _ = session.shutdown();
        }
    }
    let updated = state
        .session_registry
        .get(&registry_path, &input.client_session_id)?;
    let active = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .contains_key(&input.client_session_id);
    summary_from_record(updated, active)
}

#[tauri::command]
pub fn delete_agent_session(
    input: AgentSessionDeleteInput,
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<(), String> {
    ensure_session_idle(&state, &input.client_session_id)?;
    let active_session = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(&input.client_session_id)
        .cloned();
    if let Some(session) = active_session.as_ref() {
        session.ensure_owner(window.label())?;
    }
    let _title_guard = active_session.as_ref().map(|session| {
        session
            .title_update_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    });
    if let Some(session) = active_session.as_ref() {
        *session
            .automatic_title
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = AutomaticTitleState::Cancelled;
    }
    let registry_path = AgentSessionRegistry::path(&app)?;
    let record = state
        .session_registry
        .get(&registry_path, &input.client_session_id)?;
    let provider_result = request_record_thread(
        &state,
        &record,
        &input.executable_preference,
        "thread/delete",
        json!({ "threadId": record.provider_thread_id }),
    );
    if let Err(error) = provider_result {
        if !provider_session_missing(&error) {
            return Err("Codex could not delete the saved chat.".to_string());
        }
    }
    drop(_title_guard);
    if let Some(session) = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .remove(&input.client_session_id)
    {
        let _ = session.shutdown();
    }
    state
        .session_registry
        .remove(&registry_path, &input.client_session_id)
}

#[tauri::command]
pub fn close_agent_session(
    client_session_id: String,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<(), String> {
    let session = state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(&client_session_id)
        .cloned();
    let Some(session) = session else {
        return Ok(());
    };
    session.ensure_owner(window.label())?;
    session.shutdown()?;
    state
        .sessions
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .remove(&client_session_id);
    Ok(())
}
