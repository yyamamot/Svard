use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{hash_map::DefaultHasher, BTreeSet, HashMap, HashSet},
    env, fs,
    hash::{Hash, Hasher},
    io::{BufRead, BufReader, Read, Write},
    path::{Component, Path, PathBuf},
    process::{Child, Command, ExitStatus, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, State};

use crate::{
    backend_types::AllowedRoots,
    codex_executable::{executable_candidates, CodexExecutable, CodexExecutablePreference},
    path_policy::{
        ensure_path_allowed, path_to_ui_string, register_allowed_root_for_file,
        resolve_existing_directory_path, resolve_existing_file_path,
    },
};

mod context;
mod probe;
mod turn_support;

use context::*;
pub use context::{
    load_codex_context_file, resolve_dropped_codex_context_path, search_codex_context_files,
};
pub use probe::probe_codex;
use probe::*;
use turn_support::*;

#[cfg(test)]
mod tests;

const CONTEXT_FILE_LIMIT: usize = 256 * 1024;
const CONTEXT_COUNT_LIMIT: usize = 12;
const CONTEXT_TOTAL_LIMIT: usize = 1024 * 1024;
const CONTEXT_SEARCH_ENTRY_LIMIT: usize = 20_000;
const CONTEXT_SEARCH_RESULT_LIMIT: usize = 100;
const CONTEXT_LABEL_LIMIT: usize = 512;
const QUESTION_LIMIT: usize = 8 * 1024;
const OPENUI_PROMPT_LIMIT: usize = 256 * 1024;
const JSONL_LINE_LIMIT: usize = 1024 * 1024;
const STDOUT_LIMIT: usize = 4 * 1024 * 1024;
const STDERR_LIMIT: usize = 64 * 1024;
const TURN_TIMEOUT: Duration = Duration::from_secs(120);
const PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const CONTEXT_SEARCH_EXCLUDED_DIRS: &[&str] = &[
    ".artifacts",
    ".codegraph",
    ".git",
    "dist",
    "node_modules",
    "playwright-report",
    "target",
    "test-results",
];
const CONTEXT_ALLOWED_EXTENSIONS: &[&str] = &[
    "md",
    "markdown",
    "adoc",
    "asciidoc",
    "asc",
    "c",
    "cc",
    "cpp",
    "cxx",
    "h",
    "hh",
    "hpp",
    "rs",
    "go",
    "py",
    "pyi",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "java",
    "kt",
    "kts",
    "swift",
    "rb",
    "php",
    "cs",
    "sh",
    "bash",
    "zsh",
    "fish",
    "sql",
    "proto",
    "json",
    "jsonc",
    "yaml",
    "yml",
    "toml",
    "xml",
    "ini",
    "cfg",
    "conf",
    "properties",
    "txt",
    "css",
    "scss",
    "less",
    "html",
    "htm",
    "vue",
    "svelte",
];
const CONTEXT_ALLOWED_BASENAMES: &[&str] = &["dockerfile", "makefile", "cmakelists.txt"];
const CONTEXT_DENIED_BASENAMES: &[&str] = &[".npmrc", ".pypirc", ".netrc"];
const CONTEXT_DENIED_EXTENSIONS: &[&str] = &["pem", "key", "p12", "pfx"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCliProbe {
    state: &'static str,
    source: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexContextSnapshot {
    context_id: String,
    display_label: String,
    format: String,
    language: String,
    source: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexContextFileInput {
    path: String,
    #[serde(default)]
    workspace_root: Option<String>,
    context_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexContextFile {
    context_id: String,
    path: String,
    display_label: String,
    format: String,
    language: String,
    source: String,
    byte_length: usize,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexContextSearchInput {
    workspace_root: String,
    #[serde(default)]
    query: String,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexContextSearchItem {
    path: String,
    display_label: String,
    format: String,
    language: String,
    byte_length: usize,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecutionSettings {
    sandbox_mode: String,
    command_network_access: bool,
    web_search: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexTurnInput {
    client_session_id: String,
    run_id: String,
    question: String,
    response_mode: String,
    #[serde(default)]
    open_ui_prompt: Option<String>,
    #[serde(default)]
    context_additions: Vec<CodexContextSnapshot>,
    execution_settings: CodexExecutionSettings,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CodexTurnEvent {
    SessionStarted,
    TurnStarted,
    ContextAccepted {
        #[serde(rename = "contextIds")]
        context_ids: Vec<String>,
    },
    AssistantDelta {
        delta: String,
    },
    AssistantCompleted {
        text: String,
    },
    UnexpectedToolUse {
        category: &'static str,
    },
    Completed,
    Failed {
        code: &'static str,
        message: &'static str,
    },
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum CodexTurnOutcome {
    Completed,
    Cancelled,
    Failed {
        code: &'static str,
        message: &'static str,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCommandError {
    code: &'static str,
    message: &'static str,
}

impl CodexCommandError {
    fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
}

struct CodexSession {
    temporary_directory: PathBuf,
    thread_id: Option<String>,
    context_ids: HashSet<String>,
    context_bytes: usize,
    execution_settings: CodexExecutionSettings,
}

struct ActiveRun {
    client_session_id: String,
    run_id: String,
    child: Arc<Mutex<Option<Child>>>,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default)]
struct CodexStateInner {
    active: Option<ActiveRun>,
    sessions: HashMap<String, CodexSession>,
}

#[derive(Default)]
pub struct CodexProcessState {
    inner: Arc<Mutex<CodexStateInner>>,
}

impl CodexProcessState {
    pub fn cleanup_all(&self) {
        let (child, directories) = {
            let mut state = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            let child = state.active.take().map(|active| {
                active.cancelled.store(true, Ordering::SeqCst);
                active.child
            });
            let directories = state
                .sessions
                .drain()
                .map(|(_, session)| session.temporary_directory)
                .collect::<Vec<_>>();
            (child, directories)
        };
        if let Some(child) = child {
            kill_child(&child);
        }
        for directory in directories {
            let _ = fs::remove_dir_all(directory);
        }
    }
}

fn session_directory(client_session_id: &str) -> Result<PathBuf, CodexCommandError> {
    let mut hasher = DefaultHasher::new();
    client_session_id.hash(&mut hasher);
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = env::temp_dir().join(format!(
        "svard-codex-{}-{:x}-{nonce:x}",
        std::process::id(),
        hasher.finish()
    ));
    fs::create_dir(&path).map_err(|_| {
        CodexCommandError::new(
            "temporaryDirectory",
            "Failed to create a temporary Codex workspace.",
        )
    })?;
    if fs::create_dir(path.join("contexts")).is_err()
        || fs::create_dir(path.join("scratch")).is_err()
    {
        let _ = fs::remove_dir_all(&path);
        return Err(CodexCommandError::new(
            "temporaryDirectory",
            "Failed to prepare the temporary Codex workspace.",
        ));
    }
    Ok(path)
}

fn kill_child(child: &Arc<Mutex<Option<Child>>>) {
    let mut child = child.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(child) = child.as_mut() {
        let _ = child.kill();
    }
}

fn kill_and_wait_child(child: &Arc<Mutex<Option<Child>>>) {
    let mut child = child.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(mut child) = child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn clear_active_run(state: &Arc<Mutex<CodexStateInner>>, run_id: &str) {
    let mut current = state.lock().unwrap_or_else(|error| error.into_inner());
    if current
        .active
        .as_ref()
        .is_some_and(|active| active.run_id == run_id)
    {
        current.active = None;
    }
}

fn send_event(channel: &Channel<CodexTurnEvent>, event: CodexTurnEvent) {
    let _ = channel.send(event);
}

fn unexpected_category(value: &Value) -> Option<&'static str> {
    let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");
    let item_type = value
        .get("item")
        .and_then(|item| item.get("type"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let combined = format!("{event_type}:{item_type}").to_lowercase();
    if combined.contains("command") || combined.contains("shell") {
        Some("command")
    } else if combined.contains("mcp") {
        Some("mcp")
    } else if combined.contains("web_search") || combined.contains("websearch") {
        Some("webSearch")
    } else if combined.contains("file_change")
        || combined.contains("patch")
        || combined.contains("edit")
    {
        Some("fileChange")
    } else {
        None
    }
}

fn blocked_category(value: &Value, settings: &CodexExecutionSettings) -> Option<&'static str> {
    match unexpected_category(value) {
        Some("mcp") => Some("mcp"),
        Some("webSearch") if !settings.web_search => Some("webSearch"),
        Some("webSearch") => None,
        Some("command" | "fileChange") | None => None,
        category => category,
    }
}

fn event_text(value: &Value) -> Option<(&'static str, String)> {
    let event_type = value.get("type").and_then(Value::as_str)?;
    if event_type == "item.completed" {
        let item = value.get("item")?;
        if item.get("type").and_then(Value::as_str) == Some("agent_message") {
            return item
                .get("text")
                .and_then(Value::as_str)
                .map(|text| ("completed", text.to_string()));
        }
    }
    if event_type == "item.updated" || event_type == "item.delta" {
        let delta = value.get("delta").and_then(Value::as_str).or_else(|| {
            value
                .get("item")
                .and_then(|item| item.get("delta"))
                .and_then(Value::as_str)
        })?;
        return Some(("delta", delta.to_string()));
    }
    None
}

fn thread_id_from_event(value: &Value) -> Option<&str> {
    if value.get("type").and_then(Value::as_str) != Some("thread.started") {
        return None;
    }
    value.get("thread_id").and_then(Value::as_str)
}

fn validate_session_contexts(
    session: &CodexSession,
    additions: &[CodexContextSnapshot],
) -> Result<(), CodexCommandError> {
    if additions
        .iter()
        .any(|context| session.context_ids.contains(&context.context_id))
    {
        return Err(CodexCommandError::new(
            "duplicateContext",
            "A context file has already been shared in this Codex chat.",
        ));
    }
    let addition_bytes = additions
        .iter()
        .map(|context| context.source.len())
        .sum::<usize>();
    if session.context_ids.len() + additions.len() > CONTEXT_COUNT_LIMIT
        || session.context_bytes.saturating_add(addition_bytes) > CONTEXT_TOTAL_LIMIT
    {
        return Err(CodexCommandError::new(
            "contextLimit",
            "The Codex chat context exceeds its count or byte limit.",
        ));
    }
    Ok(())
}

fn execute_turn(
    state: Arc<Mutex<CodexStateInner>>,
    input: CodexTurnInput,
    on_event: Channel<CodexTurnEvent>,
) -> Result<CodexTurnOutcome, CodexCommandError> {
    validate_input(&input)?;
    let executable = resolve_executable().map_err(|probe| {
        CodexCommandError::new(
            probe.state,
            "Codex CLI is unavailable. Run the CLI diagnosis before retrying.",
        )
    })?;

    let addition_bytes = input
        .context_additions
        .iter()
        .map(|context| context.source.len())
        .sum::<usize>();
    let addition_ids = input
        .context_additions
        .iter()
        .map(|context| context.context_id.clone())
        .collect::<Vec<_>>();
    let (thread_id, directory, first_turn) = {
        let mut current = state.lock().unwrap_or_else(|error| error.into_inner());
        if current.active.is_some() {
            return Err(CodexCommandError::new(
                "busy",
                "Another Codex turn is already running.",
            ));
        }
        if !current.sessions.contains_key(&input.client_session_id) {
            let directory = session_directory(&input.client_session_id)?;
            current.sessions.insert(
                input.client_session_id.clone(),
                CodexSession {
                    temporary_directory: directory,
                    thread_id: None,
                    context_ids: HashSet::new(),
                    context_bytes: 0,
                    execution_settings: input.execution_settings.clone(),
                },
            );
        }
        let session = current.sessions.get(&input.client_session_id).unwrap();
        if session.execution_settings != input.execution_settings {
            return Err(CodexCommandError::new(
                "settingsChanged",
                "Codex execution settings changed. Start a new chat to apply them.",
            ));
        }
        validate_session_contexts(session, &input.context_additions)?;
        (
            session.thread_id.clone(),
            session.temporary_directory.clone(),
            session.thread_id.is_none(),
        )
    };
    if first_turn
        && (input.context_additions.is_empty()
            || input
                .open_ui_prompt
                .as_deref()
                .is_none_or(|prompt| prompt.trim().is_empty()))
    {
        return Err(CodexCommandError::new(
            "missingContext",
            "The first Codex turn requires context and an OpenUI component contract.",
        ));
    }

    let materialized_contexts = materialize_contexts(&directory, &input.context_additions)?;
    let prompt = turn_prompt(&input, first_turn);
    let mut command = build_command(
        &executable,
        thread_id.as_deref(),
        &directory,
        &input.execution_settings,
    );
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(_) => {
            remove_materialized_contexts(&materialized_contexts);
            return Err(CodexCommandError::new(
                "spawnFailed",
                "Codex CLI could not be started.",
            ));
        }
    };
    let Some(mut stdin) = child.stdin.take() else {
        let _ = child.kill();
        let _ = child.wait();
        remove_materialized_contexts(&materialized_contexts);
        return Err(CodexCommandError::new(
            "stdinFailed",
            "Codex stdin is unavailable.",
        ));
    };
    let Some(stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        remove_materialized_contexts(&materialized_contexts);
        return Err(CodexCommandError::new(
            "stdoutFailed",
            "Codex stdout is unavailable.",
        ));
    };
    let stderr = child.stderr.take();
    let child = Arc::new(Mutex::new(Some(child)));
    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut current = state.lock().unwrap_or_else(|error| error.into_inner());
        if current.active.is_some() {
            drop(current);
            kill_and_wait_child(&child);
            remove_materialized_contexts(&materialized_contexts);
            return Err(CodexCommandError::new(
                "busy",
                "Another Codex turn is already running.",
            ));
        }
        if !current.sessions.contains_key(&input.client_session_id) {
            drop(current);
            kill_and_wait_child(&child);
            remove_materialized_contexts(&materialized_contexts);
            return Err(CodexCommandError::new(
                "sessionClosed",
                "The Codex session was closed before the turn started.",
            ));
        }
        current.active = Some(ActiveRun {
            client_session_id: input.client_session_id.clone(),
            run_id: input.run_id.clone(),
            child: child.clone(),
            cancelled: cancelled.clone(),
        });
    }
    if stdin.write_all(prompt.as_bytes()).is_err() {
        kill_and_wait_child(&child);
        clear_active_run(&state, &input.run_id);
        remove_materialized_contexts(&materialized_contexts);
        return Err(CodexCommandError::new(
            "stdinFailed",
            "Failed to send the Codex prompt.",
        ));
    }
    drop(stdin);
    if !addition_ids.is_empty() {
        let accepted = {
            let mut current = state.lock().unwrap_or_else(|error| error.into_inner());
            if let Some(session) = current.sessions.get_mut(&input.client_session_id) {
                session.context_ids.extend(addition_ids.iter().cloned());
                session.context_bytes = session.context_bytes.saturating_add(addition_bytes);
                true
            } else {
                false
            }
        };
        if !accepted {
            kill_and_wait_child(&child);
            clear_active_run(&state, &input.run_id);
            remove_materialized_contexts(&materialized_contexts);
            return Err(CodexCommandError::new(
                "sessionClosed",
                "The Codex session was closed while sending context.",
            ));
        }
        send_event(
            &on_event,
            CodexTurnEvent::ContextAccepted {
                context_ids: addition_ids,
            },
        );
    }

    if first_turn {
        send_event(&on_event, CodexTurnEvent::SessionStarted);
    }
    send_event(&on_event, CodexTurnEvent::TurnStarted);

    let (line_tx, line_rx) = mpsc::channel::<Result<Vec<u8>, std::io::Error>>();
    let stdout_thread = thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let mut line = Vec::new();
            match reader.read_until(b'\n', &mut line) {
                Ok(0) => break,
                Ok(_) => {
                    if line_tx.send(Ok(line)).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = line_tx.send(Err(error));
                    break;
                }
            }
        }
    });
    let stderr_thread = thread::spawn(move || {
        let mut captured = Vec::new();
        if let Some(stderr) = stderr {
            let _ = stderr.take(STDERR_LIMIT as u64).read_to_end(&mut captured);
        }
        captured
    });

    let started = Instant::now();
    let mut total_stdout = 0usize;
    let mut completed = false;
    let mut failure: Option<(&'static str, &'static str)> = None;
    while started.elapsed() < TURN_TIMEOUT {
        if cancelled.load(Ordering::SeqCst) {
            break;
        }
        match line_rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Ok(line)) => {
                total_stdout = total_stdout.saturating_add(line.len());
                if line.len() > JSONL_LINE_LIMIT || total_stdout > STDOUT_LIMIT {
                    failure = Some(("outputLimit", "Codex output exceeded the safety limit."));
                    kill_child(&child);
                    break;
                }
                let value: Value = match serde_json::from_slice(&line) {
                    Ok(value) => value,
                    Err(_) => {
                        failure = Some(("invalidJsonl", "Codex returned invalid JSONL."));
                        kill_child(&child);
                        break;
                    }
                };
                if let Some(category) = blocked_category(&value, &input.execution_settings) {
                    send_event(&on_event, CodexTurnEvent::UnexpectedToolUse { category });
                    failure = Some((
                        "safetyBlocked",
                        "Codex attempted an operation outside the document-question boundary.",
                    ));
                    kill_child(&child);
                    break;
                }
                if let Some(thread_id) = thread_id_from_event(&value) {
                    let mut current = state.lock().unwrap_or_else(|error| error.into_inner());
                    if let Some(session) = current.sessions.get_mut(&input.client_session_id) {
                        session.thread_id = Some(thread_id.to_string());
                    }
                }
                if let Some((kind, text)) = event_text(&value) {
                    if kind == "delta" {
                        send_event(&on_event, CodexTurnEvent::AssistantDelta { delta: text });
                    } else {
                        send_event(&on_event, CodexTurnEvent::AssistantCompleted { text });
                    }
                }
                match value.get("type").and_then(Value::as_str) {
                    Some("turn.completed") => {
                        completed = true;
                    }
                    Some("turn.failed") | Some("error") => {
                        failure = Some(("codexFailed", "Codex could not complete the turn."));
                    }
                    _ => {}
                }
            }
            Ok(Err(_)) => {
                failure = Some(("stdoutFailed", "Failed to read Codex JSONL."));
                break;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
        }
    }
    if started.elapsed() >= TURN_TIMEOUT && !completed {
        failure = Some(("timeout", "Codex turn timed out."));
        kill_child(&child);
    }

    let status = {
        let mut child_guard = child.lock().unwrap_or_else(|error| error.into_inner());
        child_guard.take().and_then(|mut child| child.wait().ok())
    };
    let _ = stdout_thread.join();
    let stderr = stderr_thread.join().unwrap_or_default();
    clear_active_run(&state, &input.run_id);

    if cancelled.load(Ordering::SeqCst) {
        send_event(&on_event, CodexTurnEvent::Cancelled);
        return Ok(CodexTurnOutcome::Cancelled);
    }
    if let Some((code, message)) = failure {
        send_event(&on_event, CodexTurnEvent::Failed { code, message });
        return Ok(CodexTurnOutcome::Failed { code, message });
    }
    if !completed || status.is_some_and(|status| !status.success()) {
        let stderr_text = String::from_utf8_lossy(&stderr).to_lowercase();
        let (code, message) =
            if stderr_text.contains("login") || stderr_text.contains("authentication") {
                (
                    "authenticationRequired",
                    "Codex authentication is required.",
                )
            } else {
                ("codexFailed", "Codex exited before completing the turn.")
            };
        send_event(&on_event, CodexTurnEvent::Failed { code, message });
        return Ok(CodexTurnOutcome::Failed { code, message });
    }
    send_event(&on_event, CodexTurnEvent::Completed);
    Ok(CodexTurnOutcome::Completed)
}

#[tauri::command]
pub async fn run_codex_turn(
    state: State<'_, CodexProcessState>,
    input: CodexTurnInput,
    on_event: Channel<CodexTurnEvent>,
) -> Result<CodexTurnOutcome, CodexCommandError> {
    let inner = state.inner.clone();
    tauri::async_runtime::spawn_blocking(move || execute_turn(inner, input, on_event))
        .await
        .map_err(|_| {
            CodexCommandError::new("workerFailed", "The Codex worker stopped unexpectedly.")
        })?
}

#[tauri::command]
pub fn cancel_codex_turn(
    state: State<'_, CodexProcessState>,
    run_id: String,
) -> Result<(), CodexCommandError> {
    let child = {
        let current = state
            .inner
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        current.active.as_ref().and_then(|active| {
            if active.run_id == run_id {
                active.cancelled.store(true, Ordering::SeqCst);
                Some(active.child.clone())
            } else {
                None
            }
        })
    };
    if let Some(child) = child {
        kill_child(&child);
    }
    Ok(())
}

#[tauri::command]
pub fn close_codex_session(
    state: State<'_, CodexProcessState>,
    client_session_id: String,
) -> Result<(), CodexCommandError> {
    let (child, directory) = {
        let mut current = state
            .inner
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let child = current.active.as_ref().and_then(|active| {
            if active.client_session_id == client_session_id {
                active.cancelled.store(true, Ordering::SeqCst);
                Some(active.child.clone())
            } else {
                None
            }
        });
        let directory = current
            .sessions
            .remove(&client_session_id)
            .map(|session| session.temporary_directory);
        (child, directory)
    };
    if let Some(child) = child {
        kill_child(&child);
    }
    if let Some(directory) = directory {
        let _ = fs::remove_dir_all(directory);
    }
    Ok(())
}
