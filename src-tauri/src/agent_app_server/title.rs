use super::*;

const TITLE_TIMEOUT: Duration = Duration::from_secs(30);
const TITLE_MAX_CHARS: usize = 80;
const TITLE_DEVELOPER_INSTRUCTIONS: &str = r#"Create a concise title for the user's first chat message.
Use the same language as the user. For English, use 3 to 6 words. For Japanese, use about 12 to 30 characters.
Use sentence case. Preserve proper nouns, product names, and code symbols.
Return only the title: one line, no quotation marks, Markdown, or trailing punctuation.
Do not use tools."#;

pub(super) fn fallback_session_title(
    question: &str,
    has_images: bool,
    has_selected_content: bool,
) -> String {
    let normalized = question
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let normalized = normalized
        .trim_start_matches(|character: char| {
            character.is_whitespace() || matches!(character, '#' | '>' | '*' | '-' | '+' | '`')
        })
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let title = if !normalized.is_empty() {
        normalized
    } else if has_images {
        "Image discussion".to_string()
    } else if has_selected_content {
        "Selected content review".to_string()
    } else {
        "New chat".to_string()
    };
    truncate_title(&title)
}

fn truncate_title(title: &str) -> String {
    let mut result = title.chars().take(TITLE_MAX_CHARS).collect::<String>();
    if title.chars().count() > TITLE_MAX_CHARS {
        result = result.trim_end().to_string();
    }
    result
}

pub(super) fn normalized_generated_title(value: &str) -> Result<String, String> {
    if value
        .chars()
        .any(|character| character.is_control() && !matches!(character, '\r' | '\n' | '\t'))
    {
        return Err("The generated chat title contained control characters.".to_string());
    }
    let single_line = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let title = single_line
        .trim()
        .trim_matches(|character| matches!(character, '"' | '\'' | '“' | '”' | '‘' | '’'))
        .trim()
        .to_string();
    if title.is_empty() || title.chars().count() > TITLE_MAX_CHARS {
        return Err("The generated chat title was invalid.".to_string());
    }
    Ok(title)
}

pub(super) fn apply_fallback_title(
    app: &tauri::AppHandle,
    state: &AgentAppServerState,
    session: &Arc<AgentSession>,
    question: &str,
    has_images: bool,
    has_selected_content: bool,
) {
    let _guard = session
        .title_update_lock
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let mut automatic_title = session
        .automatic_title
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if !matches!(*automatic_title, AutomaticTitleState::Pending) {
        return;
    }
    let Ok(registry_path) = AgentSessionRegistry::path(app) else {
        *automatic_title = AutomaticTitleState::Finished;
        return;
    };
    let Ok(record) = state
        .session_registry
        .get(&registry_path, &session.client_session_id)
    else {
        *automatic_title = AutomaticTitleState::Finished;
        return;
    };
    let fallback = fallback_session_title(question, has_images, has_selected_content);
    let provider_updated = session
        .request(
            "thread/name/set",
            json!({
                "threadId": record.provider_thread_id,
                "name": fallback,
            }),
            REQUEST_TIMEOUT,
        )
        .is_ok();
    if provider_updated
        && state
            .session_registry
            .rename(&registry_path, &session.client_session_id, fallback.clone())
            .is_ok()
    {
        session.emit(AgentEvent::SessionTitleUpdated {
            client_session_id: session.client_session_id.clone(),
            title: fallback.clone(),
        });
        *automatic_title = AutomaticTitleState::FallbackApplied {
            expected_title: fallback,
        };
        return;
    }
    if provider_updated {
        let _ = session.request(
            "thread/name/set",
            json!({
                "threadId": record.provider_thread_id,
                "name": record.title,
            }),
            REQUEST_TIMEOUT,
        );
    }
    *automatic_title = AutomaticTitleState::FallbackApplied {
        expected_title: record.title,
    };
}

pub(super) fn schedule_title_refinement(
    app: tauri::AppHandle,
    session: Arc<AgentSession>,
    question: String,
) {
    let expected_title = {
        let mut automatic_title = session
            .automatic_title
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let state = std::mem::replace(&mut *automatic_title, AutomaticTitleState::Finished);
        match state {
            AutomaticTitleState::FallbackApplied { expected_title }
                if !question.trim().is_empty() =>
            {
                expected_title
            }
            AutomaticTitleState::FallbackApplied { .. } => return,
            other => {
                *automatic_title = other;
                return;
            }
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(title) = generate_session_title(&session, question.trim()) else {
            return;
        };
        commit_generated_title(&app, &session, &expected_title, title);
    });
}

pub(super) fn finish_automatic_title(session: &AgentSession) {
    let mut automatic_title = session
        .automatic_title
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if matches!(
        *automatic_title,
        AutomaticTitleState::FallbackApplied { .. }
    ) {
        *automatic_title = AutomaticTitleState::Finished;
    }
}

fn commit_generated_title(
    app: &tauri::AppHandle,
    session: &AgentSession,
    expected_title: &str,
    title: String,
) {
    let _guard = session
        .title_update_lock
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if session.closed.load(Ordering::SeqCst) {
        return;
    }
    let Ok(registry_path) = AgentSessionRegistry::path(app) else {
        return;
    };
    let state = app.state::<AgentAppServerState>();
    let Ok(record) = state
        .session_registry
        .get(&registry_path, &session.client_session_id)
    else {
        return;
    };
    if record.title != expected_title || record.archived || !record.available {
        return;
    }
    if session
        .request(
            "thread/name/set",
            json!({
                "threadId": record.provider_thread_id,
                "name": title,
            }),
            REQUEST_TIMEOUT,
        )
        .is_err()
    {
        return;
    }
    if state
        .session_registry
        .rename(&registry_path, &session.client_session_id, title.clone())
        .is_err()
    {
        let _ = session.request(
            "thread/name/set",
            json!({
                "threadId": record.provider_thread_id,
                "name": record.title,
            }),
            REQUEST_TIMEOUT,
        );
        return;
    }
    session.emit(AgentEvent::SessionTitleUpdated {
        client_session_id: session.client_session_id.clone(),
        title,
    });
}

pub(super) fn generate_session_title(
    session: &AgentSession,
    question: &str,
) -> Result<String, String> {
    generate_session_title_with_timeout(session, question, TITLE_TIMEOUT)
}

fn generate_session_title_with_timeout(
    session: &AgentSession,
    question: &str,
    timeout: Duration,
) -> Result<String, String> {
    let scratch = create_scratch_directory()?;
    *session
        .title_scratch_directory
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(scratch.clone());
    let mut command = session.executable.command();
    command
        .args(["app-server", "--stdio"])
        .current_dir(&scratch)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = spawn_owned_process(&mut command)
        .map_err(|_| "Codex title generation could not start.".to_string())?;
    let Some(mut stdin) = child.stdin.take() else {
        let _ = terminate_owned_process(&mut child);
        let _ = fs::remove_dir_all(&scratch);
        return Err("Codex title generation stdin is unavailable.".to_string());
    };
    let Some(stdout) = child.stdout.take() else {
        let _ = terminate_owned_process(&mut child);
        let _ = fs::remove_dir_all(&scratch);
        return Err("Codex title generation stdout is unavailable.".to_string());
    };
    *session
        .title_child
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(child);
    if session.closed.load(Ordering::SeqCst) {
        cleanup_title_process(session);
        return Err("Codex title generation was cancelled.".to_string());
    }
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if sender.send(line).is_err() {
                break;
            }
        }
    });
    let deadline = std::time::Instant::now() + timeout;
    let result = (|| {
        title_request(
            session,
            &mut stdin,
            &receiver,
            deadline,
            1,
            "initialize",
            json!({
                "clientInfo": {
                    "name": "svard-title",
                    "title": "Svard title generator",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                    "requestAttestation": false,
                },
            }),
        )?;
        write_title_message(&mut stdin, &json!({ "method": "initialized" }))?;
        let mut thread_params = json!({
            "cwd": scratch.to_string_lossy(),
            "runtimeWorkspaceRoots": [scratch.to_string_lossy()],
            "developerInstructions": TITLE_DEVELOPER_INSTRUCTIONS,
            "approvalPolicy": "never",
            "sandbox": "read-only",
            "config": { "web_search": "disabled" },
            "environments": [],
            "ephemeral": true,
            "experimentalRawEvents": false,
        });
        if let Some(model) = session.model.as_deref() {
            thread_params["model"] = json!(model);
        }
        let thread = title_request(
            session,
            &mut stdin,
            &receiver,
            deadline,
            2,
            "thread/start",
            thread_params,
        )?;
        let thread_id = thread
            .pointer("/thread/id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Codex title generation did not return a thread.".to_string())?;
        let turn = title_request(
            session,
            &mut stdin,
            &receiver,
            deadline,
            3,
            "turn/start",
            json!({
                "threadId": thread_id,
                "input": [{ "type": "text", "text": question }],
                "approvalPolicy": "never",
                "sandboxPolicy": { "type": "readOnly", "networkAccess": false },
            }),
        )?;
        let turn_id = turn
            .pointer("/turn/id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Codex title generation did not start a turn.".to_string())?;
        receive_generated_title(session, &receiver, deadline, turn_id)
    })();
    cleanup_title_process(session);
    result
}

fn title_request(
    session: &AgentSession,
    stdin: &mut ChildStdin,
    receiver: &mpsc::Receiver<String>,
    deadline: std::time::Instant,
    id: u64,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    write_title_message(
        stdin,
        &json!({ "id": id, "method": method, "params": params }),
    )?;
    loop {
        let value = receive_title_value(session, receiver, deadline)?;
        if value.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if value.get("error").is_some() {
            return Err(format!("Codex title generation failed during {method}."));
        }
        return Ok(value.get("result").cloned().unwrap_or(Value::Null));
    }
}

fn receive_generated_title(
    session: &AgentSession,
    receiver: &mpsc::Receiver<String>,
    deadline: std::time::Instant,
    turn_id: &str,
) -> Result<String, String> {
    let mut final_message = None;
    loop {
        let value = receive_title_value(session, receiver, deadline)?;
        if value.get("method").and_then(Value::as_str) == Some("item/completed") {
            let item = value.pointer("/params/item").unwrap_or(&Value::Null);
            if item.get("type").and_then(Value::as_str) == Some("agentMessage")
                && item.get("phase").and_then(Value::as_str) == Some("final_answer")
            {
                final_message = item.get("text").and_then(Value::as_str).map(str::to_string);
            }
        }
        if value.get("method").and_then(Value::as_str) == Some("turn/completed")
            && value.pointer("/params/turn/id").and_then(Value::as_str) == Some(turn_id)
        {
            if value.pointer("/params/turn/status").and_then(Value::as_str) != Some("completed") {
                return Err("Codex title generation did not complete.".to_string());
            }
            return normalized_generated_title(
                final_message
                    .as_deref()
                    .ok_or_else(|| "Codex title generation returned no final title.".to_string())?,
            );
        }
    }
}

fn receive_title_value(
    session: &AgentSession,
    receiver: &mpsc::Receiver<String>,
    deadline: std::time::Instant,
) -> Result<Value, String> {
    loop {
        if session.closed.load(Ordering::SeqCst) {
            return Err("Codex title generation was cancelled.".to_string());
        }
        let now = std::time::Instant::now();
        if now >= deadline {
            return Err("Codex title generation timed out.".to_string());
        }
        let wait = (deadline - now).min(Duration::from_millis(100));
        match receiver.recv_timeout(wait) {
            Ok(line) => {
                if line.len() > MAX_LINE_BYTES {
                    return Err("Codex title generation returned too much data.".to_string());
                }
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    return Ok(value);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err("Codex title generation disconnected.".to_string());
            }
        }
    }
}

fn write_title_message(stdin: &mut ChildStdin, value: &Value) -> Result<(), String> {
    serde_json::to_writer(&mut *stdin, value)
        .map_err(|_| "Could not encode the Codex title request.".to_string())?;
    stdin
        .write_all(b"\n")
        .and_then(|_| stdin.flush())
        .map_err(|_| "Codex title generation disconnected.".to_string())
}

fn cleanup_title_process(session: &AgentSession) {
    let _ = terminate_owned_process_slot(&session.title_child);
    if let Some(path) = session
        .title_scratch_directory
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .take()
    {
        let _ = fs::remove_dir_all(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[cfg(windows)]
    fn windows_title_session(
        workspace: &Path,
        executable: PathBuf,
    ) -> (AgentSession, std::process::Child) {
        let mut sink = Command::new("cmd")
            .args(["/C", "more >NUL"])
            .stdin(Stdio::piped())
            .spawn()
            .unwrap();
        let session = AgentSession {
            client_session_id: "title-session".to_string(),
            workspace_root: workspace.to_path_buf(),
            scratch_directory: workspace.join("main-scratch"),
            permission_mode: AgentPermissionMode::Observe,
            network_access: false,
            model: Some("gpt-5.6-sol".to_string()),
            reasoning_effort: Some("high".to_string()),
            personality: Some("pragmatic".to_string()),
            executable: CodexExecutable::custom_for_test(executable),
            child: Mutex::new(None),
            title_child: Mutex::new(None),
            title_scratch_directory: Mutex::new(None),
            stdin: Mutex::new(sink.stdin.take().unwrap()),
            event_router: Mutex::new(AgentEventRouter::new(
                "test-main".to_string(),
                Channel::new(|_| Ok(())),
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
            automatic_title: Mutex::new(AutomaticTitleState::Finished),
            title_update_lock: Mutex::new(()),
            closed: AtomicBool::new(false),
        };
        (session, sink)
    }

    #[test]
    fn fallback_normalizes_markdown_whitespace_and_length() {
        assert_eq!(
            fallback_session_title("  ##  Improve   AI chat\n titles ", false, false),
            "Improve AI chat titles"
        );
        assert_eq!(fallback_session_title("", true, false), "Image discussion");
        assert_eq!(
            fallback_session_title("", false, true),
            "Selected content review"
        );
        assert_eq!(
            fallback_session_title(&"a".repeat(100), false, false)
                .chars()
                .count(),
            80
        );
    }

    #[test]
    fn generated_title_is_single_line_and_unquoted() {
        assert_eq!(
            normalized_generated_title("\"AI Chatのタイトル改善\"\n").unwrap(),
            "AI Chatのタイトル改善"
        );
        assert!(normalized_generated_title("").is_err());
        assert!(normalized_generated_title(&"長".repeat(81)).is_err());
        assert!(normalized_generated_title("bad\u{0000}title").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn title_timeout_stops_the_child_and_removes_the_scratch_directory() {
        let workspace = tempfile::tempdir().unwrap();
        let script = workspace.path().join("fake-codex-title-timeout");
        fs::write(
            &script,
            r#"#!/bin/sh
IFS= read -r initialize
printf '{"id":1,"result":{}}\n'
IFS= read -r initialized
IFS= read -r thread_start
printf '{"id":2,"result":{"thread":{"id":"title-thread"}}}\n'
IFS= read -r turn_start
printf '{"id":3,"result":{"turn":{"id":"title-turn"}}}\n'
sleep 10
"#,
        )
        .unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
        let mut sink = Command::new("sh")
            .args(["-c", "cat >/dev/null"])
            .stdin(Stdio::piped())
            .spawn()
            .unwrap();
        let session = AgentSession {
            client_session_id: "timeout-session".to_string(),
            workspace_root: workspace.path().to_path_buf(),
            scratch_directory: workspace.path().join("main-scratch"),
            permission_mode: AgentPermissionMode::Observe,
            network_access: false,
            model: None,
            reasoning_effort: None,
            personality: None,
            executable: CodexExecutable::custom_for_test(script),
            child: Mutex::new(None),
            title_child: Mutex::new(None),
            title_scratch_directory: Mutex::new(None),
            stdin: Mutex::new(sink.stdin.take().unwrap()),
            event_router: Mutex::new(AgentEventRouter::new(
                "test-main".to_string(),
                Channel::new(|_| Ok(())),
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
            automatic_title: Mutex::new(AutomaticTitleState::Finished),
            title_update_lock: Mutex::new(()),
            closed: AtomicBool::new(false),
        };

        let result = generate_session_title_with_timeout(
            &session,
            "Improve titles",
            Duration::from_millis(100),
        );
        assert!(result.unwrap_err().contains("timed out"));
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
        let _ = sink.kill();
        let _ = sink.wait();
    }

    #[cfg(windows)]
    #[test]
    fn windows_title_fixture_is_private_and_uses_only_the_question() {
        let workspace = tempfile::tempdir().unwrap();
        let executable = windows_fixture_executable(workspace.path(), "fake-codex-title");
        let request_log = executable.with_extension("requests.jsonl");
        let cwd_log = executable.with_extension("cwd.txt");
        let (session, mut sink) = windows_title_session(workspace.path(), executable);

        let title = generate_session_title(&session, "Improve AI chat titles").unwrap();

        assert_eq!(title, "AI Chat title support");
        let requests = fs::read_to_string(request_log).unwrap();
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
            turn_start.pointer("/params/input/0/text"),
            Some(&json!("Improve AI chat titles"))
        );
        assert!(!requests.contains(workspace.path().to_string_lossy().as_ref()));
        assert_ne!(
            fs::read_to_string(cwd_log).unwrap().trim(),
            workspace.path().to_string_lossy()
        );
        assert!(session.title_child.lock().unwrap().is_none());
        assert!(session.title_scratch_directory.lock().unwrap().is_none());
        let _ = sink.kill();
        let _ = sink.wait();
    }

    #[cfg(windows)]
    #[test]
    fn windows_title_timeout_stops_the_job_and_removes_the_scratch_directory() {
        let workspace = tempfile::tempdir().unwrap();
        let executable = windows_fixture_executable(workspace.path(), "fake-codex-title-timeout");
        let (session, mut sink) = windows_title_session(workspace.path(), executable);

        let result = generate_session_title_with_timeout(
            &session,
            "Improve titles",
            Duration::from_millis(100),
        );

        assert!(result.unwrap_err().contains("timed out"));
        assert!(session.title_child.lock().unwrap().is_none());
        assert!(session.title_scratch_directory.lock().unwrap().is_none());
        let _ = sink.kill();
        let _ = sink.wait();
    }
}
