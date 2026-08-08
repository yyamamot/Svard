use super::*;

pub(super) struct PendingViewerWindowOpenRequests(
    pub(super) Mutex<BTreeMap<String, ViewerWindowOpenRequest>>,
);

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentChatHandoffSnapshot {
    version: u8,
    client_session_id: String,
    workspace_root: String,
    last_event_sequence: u64,
    last_main_placement: String,
    payload: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentChatWindowOpenRequest {
    #[serde(default)]
    handoff_id: Option<String>,
    #[serde(default)]
    origin_window_label: Option<String>,
    snapshot: AgentChatHandoffSnapshot,
}

#[derive(Default)]
pub(crate) struct PendingAgentChatWindows {
    pub(super) requests: Mutex<BTreeMap<String, AgentChatWindowOpenRequest>>,
    pub(super) labels_by_origin: Mutex<BTreeMap<String, String>>,
    pub(super) session_by_origin: Mutex<BTreeMap<String, String>>,
    pub(super) closed_windows: Mutex<BTreeSet<String>>,
}

pub(crate) fn record_agent_chat_session_for_window(
    pending: &PendingAgentChatWindows,
    window_label: &str,
    client_session_id: &str,
) -> bool {
    if pending
        .closed_windows
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .contains(window_label)
    {
        return false;
    }
    let origin_label = pending
        .labels_by_origin
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .iter()
        .find_map(|(origin, detached)| (detached == window_label).then_some(origin.clone()));
    if let Some(origin_label) = origin_label {
        pending
            .session_by_origin
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(origin_label, client_session_id.to_string());
    }
    true
}

#[tauri::command]
pub(super) fn open_agent_chat_window(
    mut request: AgentChatWindowOpenRequest,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<String, AppError> {
    let origin_label = window.label().to_string();
    if origin_label.starts_with("agent-") {
        return Err(AppError::from(
            "A detached AI Chat window cannot detach another chat.",
        ));
    }
    if let Some(existing_label) = pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .get(&origin_label)
        .cloned()
    {
        if let Some(existing) = app.get_webview_window(&existing_label) {
            let _ = existing.show();
            let _ = existing.set_focus();
            let handoff_id = existing_label
                .strip_prefix("agent-")
                .unwrap_or(&existing_label)
                .to_string();
            let _ = window.emit("agent-chat-ready", handoff_id.clone());
            return Ok(handoff_id);
        }
    }
    let handoff_id = next_viewer_window_request_id();
    let label = format!("agent-{handoff_id}");
    request.handoff_id = Some(handoff_id.clone());
    request.origin_window_label = Some(origin_label.clone());
    let client_session_id = request.snapshot.client_session_id.clone();
    pending
        .requests
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat requests"))?
        .insert(handoff_id.clone(), request);
    pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .insert(origin_label, label.clone());
    pending
        .session_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat sessions"))?
        .insert(window.label().to_string(), client_session_id);
    let builder =
        WebviewWindowBuilder::new(&app, label.clone(), WebviewUrl::App("index.html".into()))
            .title("Svard AI Chat")
            .inner_size(720.0, 840.0)
            .min_inner_size(480.0, 560.0);
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(TitleBarStyle::Transparent)
        .hidden_title(true);
    let detached = match builder.build() {
        Ok(detached) => detached,
        Err(error) => {
            pending
                .requests
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .remove(&handoff_id);
            pending
                .labels_by_origin
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .remove(window.label());
            pending
                .session_by_origin
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .remove(window.label());
            return Err(AppError::from(format!(
                "failed to create AI Chat window: {error}"
            )));
        }
    };
    if let Ok(config_path) = config_file_path(&app) {
        if let Ok(config) = load_config_from_path(&config_path) {
            let _ = detached.set_background_color(Some(window_background_from_config(&config)));
        }
    }
    let _ = detached.set_focus();
    Ok(handoff_id)
}

#[tauri::command]
pub(super) fn take_current_agent_chat_window_request(
    window: tauri::WebviewWindow,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<Option<AgentChatWindowOpenRequest>, AppError> {
    let Some(handoff_id) = window.label().strip_prefix("agent-") else {
        return Ok(None);
    };
    pending
        .requests
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat requests"))
        .map(|mut requests| requests.remove(handoff_id))
}

#[tauri::command]
pub(super) fn focus_agent_chat_window(
    origin_window_label: Option<String>,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<bool, AppError> {
    let origin_label = origin_window_label.unwrap_or_else(|| window.label().to_string());
    let detached_label = pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .get(&origin_label)
        .cloned();
    let Some(detached) = detached_label.and_then(|label| app.get_webview_window(&label)) else {
        return Ok(false);
    };
    let _ = detached.show();
    let _ = detached.set_focus();
    Ok(true)
}

#[tauri::command]
pub(super) fn close_agent_chat_window(
    origin_window_label: Option<String>,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<(), AppError> {
    let origin_label = origin_window_label.unwrap_or_else(|| window.label().to_string());
    let detached_label = pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .remove(&origin_label);
    if let Some(detached) = detached_label.and_then(|label| app.get_webview_window(&label)) {
        let _ = detached.destroy();
    }
    let _ = pending
        .session_by_origin
        .lock()
        .map(|mut sessions| sessions.remove(&origin_label));
    Ok(())
}

#[tauri::command]
pub(super) fn route_agent_chat_owner_sync(
    sync: serde_json::Value,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<(), AppError> {
    let detached_label = pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .get(window.label())
        .cloned()
        .ok_or_else(|| AppError::from("Detached AI Chat is unavailable."))?;
    let detached = app
        .get_webview_window(&detached_label)
        .ok_or_else(|| AppError::from("Detached AI Chat is unavailable."))?;
    detached
        .emit("agent-chat-owner-sync", sync)
        .map_err(|_| AppError::from("AI Chat state could not be delivered."))
}

#[tauri::command]
pub(super) fn route_agent_chat_origin_action(
    action: serde_json::Value,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<(), AppError> {
    let origin_label = pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .iter()
        .find_map(|(origin, detached)| (detached == window.label()).then_some(origin.clone()))
        .ok_or_else(|| AppError::from("The Main window is unavailable."))?;
    let origin = app
        .get_webview_window(&origin_label)
        .ok_or_else(|| AppError::from("The Main window is unavailable."))?;
    origin
        .emit("agent-chat-origin-action", action)
        .map_err(|_| AppError::from("The Main window action could not be delivered."))?;
    let _ = origin.show();
    let _ = origin.set_focus();
    Ok(())
}

pub(super) fn detached_agent_chat_label_for_origin(
    pending: &PendingAgentChatWindows,
    origin_label: &str,
) -> Result<String, AppError> {
    pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .get(origin_label)
        .cloned()
        .ok_or_else(|| AppError::from("Detached AI Chat is unavailable."))
}

#[tauri::command]
pub(super) fn request_agent_chat_reattach(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<(), AppError> {
    let detached_label = detached_agent_chat_label_for_origin(&pending, window.label())?;
    let detached = app
        .get_webview_window(&detached_label)
        .ok_or_else(|| AppError::from("Detached AI Chat is unavailable."))?;
    detached
        .emit("agent-chat-reattach-request", ())
        .map_err(|_| AppError::from("AI Chat reattach request could not be delivered."))
}

#[tauri::command]
pub(super) fn acknowledge_agent_chat_reattach(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    pending: tauri::State<PendingAgentChatWindows>,
) -> Result<(), AppError> {
    let detached_label = pending
        .labels_by_origin
        .lock()
        .map_err(|_| AppError::from("failed to lock detached AI Chat windows"))?
        .get(window.label())
        .cloned()
        .ok_or_else(|| AppError::from("Detached AI Chat is unavailable."))?;
    let detached = app
        .get_webview_window(&detached_label)
        .ok_or_else(|| AppError::from("Detached AI Chat is unavailable."))?;
    detached
        .emit("agent-chat-reattach-ready", ())
        .map_err(|_| AppError::from("AI Chat reattach could not be acknowledged."))
}
