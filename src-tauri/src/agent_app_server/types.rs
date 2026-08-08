use super::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

mod runtime;
pub use runtime::*;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentPermissionMode {
    Observe,
    Agent,
    FullAccess,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentContextProfile {
    Focused,
    ProviderDefaults,
}

fn default_agent_context_profile() -> AgentContextProfile {
    AgentContextProfile::Focused
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionStartInput {
    pub(super) provider_id: String,
    pub(super) executable_preference: CodexExecutablePreference,
    pub(super) client_session_id: String,
    pub(super) workspace_root: String,
    pub(super) permission_mode: AgentPermissionMode,
    pub(super) network_access: bool,
    pub(super) web_search: bool,
    #[serde(default = "default_agent_context_profile")]
    pub(super) context_profile: AgentContextProfile,
    #[serde(default)]
    pub(super) model: Option<String>,
    #[serde(default)]
    pub(super) reasoning_effort: Option<String>,
    #[serde(default)]
    pub(super) personality: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionInfo {
    pub(super) client_session_id: String,
    pub(super) provider_id: &'static str,
    pub(super) capabilities: AgentCapabilities,
    pub(super) context_profile: AgentContextProfile,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionSettingsSnapshot {
    pub(super) permission_mode: AgentPermissionMode,
    pub(super) network_access: bool,
    pub(super) web_search: bool,
    pub(super) context_profile: AgentContextProfile,
    pub(super) model: Option<String>,
    pub(super) reasoning_effort: Option<String>,
    pub(super) personality: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionSummary {
    pub(super) client_session_id: String,
    pub(super) provider_id: String,
    pub(super) title: String,
    pub(super) created_at: u64,
    pub(super) updated_at: u64,
    pub(super) archived: bool,
    pub(super) availability: &'static str,
    pub(super) settings: AgentSessionSettingsSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionPage {
    pub(super) sessions: Vec<AgentSessionSummary>,
    pub(super) next_cursor: Option<String>,
    pub(super) management_capabilities: AgentSessionManagementCapabilities,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionListInput {
    pub(super) provider_id: String,
    pub(super) workspace_root: String,
    pub(super) archived: bool,
    pub(super) query: Option<String>,
    pub(super) updated_at_from: Option<u64>,
    pub(super) updated_at_before: Option<u64>,
    pub(super) cursor: Option<String>,
    pub(super) limit: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionResumeInput {
    pub(super) client_session_id: String,
    pub(super) workspace_root: String,
    pub(super) executable_preference: CodexExecutablePreference,
    #[serde(default)]
    pub(super) context_profile: Option<AgentContextProfile>,
    #[serde(default)]
    pub(super) full_access_confirmed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionHistoryInput {
    pub(super) client_session_id: String,
    pub(super) cursor: Option<String>,
    pub(super) limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionHistoryActivity {
    pub(super) category: String,
    pub(super) title: String,
    pub(super) status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionHistoryTurn {
    pub(super) id: String,
    pub(super) question: String,
    pub(super) answer: String,
    pub(super) response_mode: AgentResponseMode,
    pub(super) steering_messages: Vec<String>,
    pub(super) changed_paths: Vec<String>,
    pub(super) activities: Vec<AgentSessionHistoryActivity>,
    pub(super) status: String,
    pub(super) created_at: u64,
    pub(super) context_omitted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionHistoryPage {
    pub(super) turns: Vec<AgentSessionHistoryTurn>,
    pub(super) next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionRenameInput {
    pub(super) client_session_id: String,
    pub(super) title: String,
    pub(super) executable_preference: CodexExecutablePreference,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionArchiveInput {
    pub(super) client_session_id: String,
    pub(super) archived: bool,
    pub(super) executable_preference: CodexExecutablePreference,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionDeleteInput {
    pub(super) client_session_id: String,
    pub(super) executable_preference: CodexExecutablePreference,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFocusFile {
    pub(super) path: String,
    pub(super) display_label: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentActiveFile {
    pub(super) path: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentResponseMode {
    Auto,
    Visualize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(super) enum AgentTurnContentPart {
    Text {
        text: String,
    },
    Image {
        #[serde(rename = "attachmentId")]
        attachment_id: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurnInput {
    pub(super) client_session_id: String,
    pub(super) client_turn_id: String,
    pub(super) question: String,
    pub(super) response_mode: AgentResponseMode,
    #[serde(default)]
    pub(super) active_file: Option<AgentActiveFile>,
    #[serde(default)]
    pub(super) focus_files: Vec<AgentFocusFile>,
    #[serde(default)]
    pub(super) attachments: Vec<AgentAttachment>,
    #[serde(default)]
    pub(super) image_attachment_ids: Vec<String>,
    #[serde(default)]
    pub(super) content_parts: Vec<AgentTurnContentPart>,
    #[serde(default)]
    pub(super) visualization_instructions: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSteerInput {
    pub(super) client_session_id: String,
    pub(super) client_turn_id: String,
    pub(super) client_steer_id: String,
    pub(super) question: String,
    pub(super) response_mode: AgentResponseMode,
    #[serde(default)]
    pub(super) active_file: Option<AgentActiveFile>,
    #[serde(default)]
    pub(super) focus_files: Vec<AgentFocusFile>,
    #[serde(default)]
    pub(super) attachments: Vec<AgentAttachment>,
    #[serde(default)]
    pub(super) image_attachment_ids: Vec<String>,
    #[serde(default)]
    pub(super) content_parts: Vec<AgentTurnContentPart>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum AgentSteerOutcome {
    Accepted { image_attachment_ids: Vec<String> },
    Failed { code: String, message: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAttachment {
    pub(super) attachment_id: String,
    pub(super) display_label: String,
    pub(super) source: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentImageStageInput {
    pub(super) client_session_id: String,
    pub(super) source: AgentImageStageSource,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AgentImageStageSource {
    ClipboardBytes {
        #[serde(rename = "displayLabel")]
        display_label: String,
        #[serde(rename = "mediaType")]
        media_type: String,
        base64: String,
    },
    SelectedPath {
        path: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentImageDiscardInput {
    pub(super) client_session_id: String,
    pub(super) attachment_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentImageAttachment {
    pub(super) attachment_id: String,
    pub(super) display_label: String,
    pub(super) media_type: &'static str,
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) byte_length: usize,
    pub(super) thumbnail_data_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum AgentTurnOutcome {
    Completed,
    Cancelled,
    Failed { code: String, message: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentApprovalResponseInput {
    pub(super) client_session_id: String,
    pub(super) request_id: String,
    pub(super) decision: AgentApprovalDecision,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentApprovalDecision {
    AllowOnce,
    Deny,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPlanStep {
    pub(super) id: String,
    pub(super) title: String,
    pub(super) status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentApprovalRequest {
    pub(super) request_id: String,
    pub(super) kind: &'static str,
    pub(super) title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) detail: Option<String>,
    pub(super) impact: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AgentEvent {
    SessionReady {
        client_session_id: String,
        capabilities: AgentCapabilities,
    },
    ProviderDisconnected {
        code: String,
        message: String,
    },
    TurnStarted {
        client_turn_id: String,
    },
    TurnInputAccepted {
        client_turn_id: String,
        image_attachment_ids: Vec<String>,
    },
    SessionTitleUpdated {
        client_session_id: String,
        title: String,
    },
    ContextUsageUpdated {
        usage: AgentContextUsage,
    },
    TokenUsageDiagnosticsUpdated {
        diagnostics: AgentTokenUsageDiagnostics,
    },
    ContextCompactionStarted {
        source: AgentCompactionSource,
    },
    ContextCompactionCompleted {
        source: AgentCompactionSource,
    },
    ReasoningSummaryDelta {
        delta: String,
    },
    AssistantCommentaryDelta {
        delta: String,
    },
    PlanUpdated {
        steps: Vec<AgentPlanStep>,
    },
    ToolStarted {
        tool_id: String,
        kind: &'static str,
        category: &'static str,
        title: String,
        visibility: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        target: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    ToolUpdated {
        tool_id: String,
        status: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    ToolCompleted {
        tool_id: String,
        status: &'static str,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
    },
    PermissionRequested {
        request: AgentApprovalRequest,
    },
    PermissionResolved {
        request_id: String,
        decision: AgentApprovalDecision,
    },
    FilesChanged {
        paths: Vec<String>,
    },
    FinalAnswerDelta {
        delta: String,
    },
    TurnCompleted {
        client_turn_id: String,
    },
    TurnFailed {
        client_turn_id: String,
        code: String,
        message: String,
    },
    TurnCancelled {
        client_turn_id: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEventEnvelope {
    pub sequence: u64,
    pub event: AgentEvent,
}

pub(super) const AGENT_EVENT_JOURNAL_LIMIT: usize = 4_096;
pub(super) const AGENT_EVENT_JOURNAL_BYTES_LIMIT: usize = 8 * 1024 * 1024;

pub(super) struct AgentEventRouter {
    pub(super) owner_window_label: String,
    channel: Channel<AgentEventEnvelope>,
    sequence: u64,
    journal: VecDeque<(usize, AgentEventEnvelope)>,
    journal_bytes: usize,
}

impl AgentEventRouter {
    pub(super) fn new(owner_window_label: String, channel: Channel<AgentEventEnvelope>) -> Self {
        Self {
            owner_window_label,
            channel,
            sequence: 0,
            journal: VecDeque::new(),
            journal_bytes: 0,
        }
    }

    pub(super) fn emit(&mut self, event: AgentEvent) {
        self.sequence = self.sequence.saturating_add(1);
        let envelope = AgentEventEnvelope {
            sequence: self.sequence,
            event,
        };
        let encoded_bytes = serde_json::to_vec(&envelope)
            .map(|value| value.len())
            .unwrap_or_default();
        self.journal_bytes = self.journal_bytes.saturating_add(encoded_bytes);
        self.journal.push_back((encoded_bytes, envelope.clone()));
        while self.journal.len() > AGENT_EVENT_JOURNAL_LIMIT
            || self.journal_bytes > AGENT_EVENT_JOURNAL_BYTES_LIMIT
        {
            if let Some((bytes, _)) = self.journal.pop_front() {
                self.journal_bytes = self.journal_bytes.saturating_sub(bytes);
            } else {
                break;
            }
        }
        let _ = self.channel.send(envelope);
    }

    pub(super) fn attach(
        &mut self,
        owner_window_label: String,
        channel: Channel<AgentEventEnvelope>,
        after_sequence: u64,
    ) -> Result<Vec<AgentEventEnvelope>, String> {
        if self.sequence > after_sequence
            && self
                .journal
                .front()
                .is_some_and(|(_, envelope)| envelope.sequence > after_sequence.saturating_add(1))
        {
            return Err(
                "AI Chat produced too many events while moving. It stayed in the current window."
                    .to_string(),
            );
        }
        self.owner_window_label = owner_window_label;
        self.channel = channel;
        Ok(self
            .journal
            .iter()
            .filter_map(|(_, envelope)| {
                (envelope.sequence > after_sequence).then_some(envelope.clone())
            })
            .collect())
    }

    pub(super) fn is_owner(&self, window_label: &str) -> bool {
        self.owner_window_label == window_label
    }
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentCompactionSource {
    Automatic,
    Manual,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum AgentCompactionOutcome {
    Completed,
    Failed { code: String, message: String },
}

#[derive(Debug)]
pub(super) struct ActiveTurn {
    pub(super) client_turn_id: String,
    pub(super) provider_turn_id: Option<String>,
    pub(super) response_mode: AgentResponseMode,
    pub(super) completion: mpsc::Sender<AgentTurnOutcome>,
}

#[derive(Debug)]
pub(super) struct ManualCompaction {
    pub(super) item_started: bool,
    pub(super) item_completed: bool,
    pub(super) completion: mpsc::Sender<AgentCompactionOutcome>,
}

#[derive(Debug, Clone)]
pub(super) struct StagedAgentImage {
    pub(super) attachment: AgentImageAttachment,
    pub(super) path: PathBuf,
    pub(super) digest: String,
    pub(super) consumed_by: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub(super) enum ApprovalKind {
    Command,
    FileChange,
    Permissions,
}

#[derive(Debug)]
pub(super) struct PendingApproval {
    pub(super) rpc_id: Value,
    pub(super) kind: ApprovalKind,
    pub(super) legacy: bool,
    pub(super) requested_permissions: Option<Value>,
}

#[derive(Debug)]
pub(super) enum AutomaticTitleState {
    Pending,
    FallbackApplied { expected_title: String },
    Finished,
    Cancelled,
}

pub(super) struct AgentSession {
    pub(super) client_session_id: String,
    pub(super) workspace_root: PathBuf,
    pub(super) scratch_directory: PathBuf,
    pub(super) permission_mode: AgentPermissionMode,
    pub(super) network_access: bool,
    pub(super) model: Option<String>,
    pub(super) reasoning_effort: Option<String>,
    pub(super) personality: Option<String>,
    pub(super) executable: CodexExecutable,
    pub(super) child: Mutex<Option<OwnedProcess>>,
    pub(super) title_child: Mutex<Option<OwnedProcess>>,
    pub(super) title_scratch_directory: Mutex<Option<PathBuf>>,
    pub(super) stdin: Mutex<ChildStdin>,
    pub(super) event_router: Mutex<AgentEventRouter>,
    pub(super) request_counter: AtomicU64,
    pub(super) approval_counter: AtomicU64,
    pub(super) pending_requests: Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>,
    pub(super) pending_approvals: Mutex<HashMap<String, PendingApproval>>,
    pub(super) item_phases: Mutex<HashMap<String, String>>,
    pub(super) thread_id: Mutex<Option<String>>,
    pub(super) active_turn: Mutex<Option<ActiveTurn>>,
    pub(super) manual_compaction: Mutex<Option<ManualCompaction>>,
    pub(super) staged_images: Mutex<HashMap<String, StagedAgentImage>>,
    pub(super) image_counter: AtomicU64,
    pub(super) image_input: AtomicBool,
    pub(super) turn_steering: AtomicBool,
    pub(super) context_usage: AtomicBool,
    pub(super) token_usage_diagnostics: AtomicBool,
    pub(super) token_usage_tracking: Mutex<AgentTokenUsageTracking>,
    pub(super) manual_compaction_supported: AtomicBool,
    pub(super) automatic_title: Mutex<AutomaticTitleState>,
    pub(super) title_update_lock: Mutex<()>,
    pub(super) closed: AtomicBool,
}

impl AgentSession {
    pub(super) fn emit(&self, event: AgentEvent) {
        self.event_router
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .emit(event);
    }

    pub(super) fn ensure_owner(&self, window_label: &str) -> Result<(), String> {
        if self
            .event_router
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .is_owner(window_label)
        {
            Ok(())
        } else {
            Err("AI Chat is active in another window.".to_string())
        }
    }

    pub(super) fn write_message(&self, value: &Value) -> Result<(), String> {
        let mut stdin = self.stdin.lock().unwrap_or_else(|error| error.into_inner());
        serde_json::to_writer(&mut *stdin, value)
            .map_err(|error| format!("Could not encode the Codex request: {error}"))?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| "Codex app-server disconnected.".to_string())
    }

    pub(super) fn notify(&self, method: &str) -> Result<(), String> {
        self.write_message(&json!({ "method": method }))
    }

    pub(super) fn request(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
    ) -> Result<Value, String> {
        let id = self.request_counter.fetch_add(1, Ordering::SeqCst) + 1;
        let (sender, receiver) = mpsc::channel();
        self.pending_requests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(id, sender);
        if let Err(error) = self.write_message(&json!({
            "id": id,
            "method": method,
            "params": params,
        })) {
            self.pending_requests
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .remove(&id);
            return Err(error);
        }
        receiver
            .recv_timeout(timeout)
            .map_err(|_| format!("Codex app-server did not respond to {method}."))?
    }

    pub(super) fn respond(&self, id: Value, result: Value) -> Result<(), String> {
        self.write_message(&json!({ "id": id, "result": result }))
    }

    pub(super) fn shutdown(&self) -> Result<(), String> {
        let _title_guard = self
            .title_update_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !self.closed.swap(true, Ordering::SeqCst) {
            if let Some(active) = self
                .active_turn
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take()
            {
                let thread_id = self
                    .thread_id
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .clone();
                if let Some(thread_id) = thread_id {
                    if let Some(provider_turn_id) = active.provider_turn_id {
                        let _ = self.request(
                            "turn/interrupt",
                            json!({
                                "threadId": thread_id,
                                "turnId": provider_turn_id,
                            }),
                            Duration::from_secs(2),
                        );
                    }
                }
                let _ = active.completion.send(AgentTurnOutcome::Cancelled);
            }
            if let Some(compaction) = self
                .manual_compaction
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take()
            {
                let _ = compaction.completion.send(AgentCompactionOutcome::Failed {
                    code: "session-closed".to_string(),
                    message: "The chat closed before context compaction completed.".to_string(),
                });
            }
            *self
                .automatic_title
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = AutomaticTitleState::Cancelled;
        }
        terminate_owned_process_slot(&self.title_child)?;
        if let Some(path) = self
            .title_scratch_directory
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        {
            let _ = fs::remove_dir_all(path);
        }
        terminate_owned_process_slot(&self.child)?;
        let _ = fs::remove_dir_all(&self.scratch_directory);
        Ok(())
    }
}

#[derive(Clone)]
pub(super) struct CachedAgentProviderRuntime {
    pub(super) snapshot: AgentProviderRuntimeSnapshot,
    pub(super) executable: Option<CodexExecutable>,
}

#[derive(Default)]
pub(super) struct AgentProviderRuntimeCache {
    pub(super) values: HashMap<String, CachedAgentProviderRuntime>,
    pub(super) loading: std::collections::HashSet<String>,
}

#[derive(Default)]
pub struct AgentAppServerState {
    pub(super) sessions: Mutex<HashMap<String, Arc<AgentSession>>>,
    pub(super) provider_runtime: Mutex<AgentProviderRuntimeCache>,
    pub(super) provider_runtime_ready: Condvar,
    pub(super) session_registry: AgentSessionRegistry,
}

impl AgentAppServerState {
    pub fn cleanup_all(&self) {
        let sessions = self
            .sessions
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .drain()
            .map(|(_, session)| session)
            .collect::<Vec<_>>();
        for session in sessions {
            let _ = session.shutdown();
        }
    }

    pub fn cleanup_session(&self, client_session_id: &str) {
        if let Some(session) = self
            .sessions
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(client_session_id)
        {
            let _ = session.shutdown();
        }
    }

    pub(super) fn invalidate_provider_runtime(&self, key: &str) {
        self.provider_runtime
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .values
            .remove(key);
    }
}
