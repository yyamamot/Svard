use super::*;

pub(super) fn workspace_relative_file_label(
    canonical_root: &Path,
    raw_path: &str,
) -> Result<Option<String>, String> {
    let path = PathBuf::from(raw_path);
    let Ok(canonical) = path.canonicalize() else {
        return Ok(None);
    };
    if !canonical.is_file() || !canonical.starts_with(canonical_root) {
        return Ok(None);
    }
    let label = canonical
        .strip_prefix(canonical_root)
        .map_err(|_| "A workspace file could not be identified.".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    if label.is_empty() || label.chars().any(char::is_control) {
        return Ok(None);
    }
    Ok(Some(label))
}

pub(super) fn active_file_label(
    workspace_root: &Path,
    active_file: Option<&AgentActiveFile>,
) -> Result<Option<String>, String> {
    let Some(active_file) = active_file else {
        return Ok(None);
    };
    let canonical_root = workspace_root
        .canonicalize()
        .map_err(|_| "The open workspace is unavailable.".to_string())?;
    workspace_relative_file_label(&canonical_root, &active_file.path)
}

pub(super) fn focus_file_labels(
    workspace_root: &Path,
    focus_files: &[AgentFocusFile],
) -> Result<Vec<String>, String> {
    if focus_files.len() > MAX_FOCUS_FILES {
        return Err("Too many focus files were selected.".to_string());
    }
    let canonical_root = workspace_root
        .canonicalize()
        .map_err(|_| "The open workspace is unavailable.".to_string())?;
    let mut labels = Vec::new();
    for file in focus_files {
        let label =
            workspace_relative_file_label(&canonical_root, &file.path)?.ok_or_else(|| {
                "A focus file is unavailable or outside the open workspace.".to_string()
            })?;
        let _ = &file.display_label;
        if !labels.contains(&label) {
            labels.push(label);
        }
    }
    Ok(labels)
}

pub(super) fn active_file_prompt(active_file: Option<&str>, explicitly_focused: bool) -> String {
    match active_file {
        Some(label) if explicitly_focused => {
            format!("The user is currently viewing and has explicitly highlighted {label}.\n\n")
        }
        Some(label) => format!("The user is currently viewing {label}.\n\n"),
        None => String::new(),
    }
}

pub(super) fn focus_prompt(focus_files: &[String], active_file: Option<&str>) -> String {
    let labels = focus_files
        .iter()
        .filter(|label| Some(label.as_str()) != active_file)
        .cloned()
        .collect::<Vec<_>>();
    if labels.is_empty() {
        String::new()
    } else {
        format!(
            "For this question, pay particular attention to these workspace files:\n- {}\n\n",
            labels.join("\n- ")
        )
    }
}

pub(super) fn sandbox_policy(session: &AgentSession) -> Value {
    match session.permission_mode {
        AgentPermissionMode::Observe => {
            json!({ "type": "readOnly", "networkAccess": false })
        }
        AgentPermissionMode::Agent => json!({
            "type": "workspaceWrite",
            "writableRoots": [session.workspace_root.to_string_lossy()],
            "networkAccess": session.network_access,
            "excludeTmpdirEnvVar": true,
            "excludeSlashTmp": true,
        }),
        AgentPermissionMode::FullAccess => json!({ "type": "dangerFullAccess" }),
    }
}

pub(super) fn approval_policy(permission_mode: AgentPermissionMode) -> &'static str {
    match permission_mode {
        AgentPermissionMode::Observe | AgentPermissionMode::FullAccess => "never",
        AgentPermissionMode::Agent => "untrusted",
    }
}

pub(super) fn safe_attachment_label(label: &str, index: usize) -> String {
    let basename = Path::new(label)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("attachment.txt");
    let cleaned = basename
        .chars()
        .filter(|character| {
            character.is_alphanumeric() || matches!(character, '.' | '-' | '_' | ' ')
        })
        .take(96)
        .collect::<String>();
    if cleaned.trim().is_empty() {
        format!("attachment-{}.txt", index + 1)
    } else {
        cleaned
    }
}

#[derive(Debug)]
pub(super) struct NormalizedAgentImage {
    pub(super) bytes: Vec<u8>,
    pub(super) media_type: &'static str,
    pub(super) extension: &'static str,
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) thumbnail_data_url: String,
    pub(super) digest: String,
}

pub(super) fn normalize_agent_image(source: &[u8]) -> Result<NormalizedAgentImage, String> {
    if source.is_empty() || source.len() > MAX_IMAGE_SOURCE_BYTES {
        return Err("This image is too large.".to_string());
    }
    let source_format = image::guess_format(source)
        .map_err(|_| "This image format is not supported.".to_string())?;
    if !matches!(
        source_format,
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP
    ) {
        return Err("Use a PNG, JPEG, or WebP image.".to_string());
    }
    let (width, height) = image::ImageReader::with_format(Cursor::new(source), source_format)
        .into_dimensions()
        .map_err(|_| "This image could not be decoded.".to_string())?;
    if width == 0
        || height == 0
        || u64::from(width).saturating_mul(u64::from(height)) > MAX_IMAGE_PIXELS
    {
        return Err("This image has too many pixels.".to_string());
    }
    let decoded = image::load_from_memory_with_format(source, source_format)
        .map_err(|_| "This image could not be decoded.".to_string())?;

    let preserve_lossless = decoded.color().has_alpha() || source_format == ImageFormat::Png;
    let (bytes, media_type, extension) = if preserve_lossless {
        let mut cursor = Cursor::new(Vec::new());
        decoded
            .write_to(&mut cursor, ImageFormat::Png)
            .map_err(|_| "This image could not be prepared.".to_string())?;
        (cursor.into_inner(), "image/png", "png")
    } else {
        let mut bytes = Vec::new();
        JpegEncoder::new_with_quality(&mut bytes, 90)
            .encode_image(&decoded)
            .map_err(|_| "This image could not be prepared.".to_string())?;
        (bytes, "image/jpeg", "jpg")
    };
    if bytes.len() > MAX_IMAGE_TOTAL_BYTES {
        return Err("This image is too large after processing.".to_string());
    }

    let thumbnail: DynamicImage = decoded.thumbnail(256, 256);
    let mut thumbnail_cursor = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut thumbnail_cursor, ImageFormat::Png)
        .map_err(|_| "This image preview could not be prepared.".to_string())?;
    let thumbnail_data_url = format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(thumbnail_cursor.into_inner())
    );
    let digest = format!("{:x}", Sha256::digest(&bytes));
    Ok(NormalizedAgentImage {
        bytes,
        media_type,
        extension,
        width,
        height,
        thumbnail_data_url,
        digest,
    })
}

pub(super) fn safe_clipboard_image_label(label: &str) -> String {
    let basename = Path::new(label)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Pasted image");
    let cleaned = basename
        .chars()
        .filter(|character| !character.is_control())
        .take(96)
        .collect::<String>();
    if cleaned.trim().is_empty() {
        "Pasted image".to_string()
    } else {
        cleaned
    }
}

pub(super) fn safe_selected_image_label(label: String) -> String {
    let cleaned = label
        .chars()
        .filter(|character| !character.is_control())
        .take(240)
        .collect::<String>();
    if cleaned.trim().is_empty() {
        "image".to_string()
    } else {
        cleaned
    }
}

pub(super) fn selected_image_source(
    session: &AgentSession,
    path: &str,
) -> Result<(Vec<u8>, String), String> {
    let canonical = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| "This image is no longer available.".to_string())?;
    let metadata =
        fs::metadata(&canonical).map_err(|_| "This image is no longer available.".to_string())?;
    if !metadata.is_file() {
        return Err("Select an image file, not a folder.".to_string());
    }
    if metadata.len() > MAX_IMAGE_SOURCE_BYTES as u64 {
        return Err("This image is too large.".to_string());
    }
    let bytes = fs::read(&canonical).map_err(|_| "This image could not be read.".to_string())?;
    let canonical_root = session
        .workspace_root
        .canonicalize()
        .unwrap_or_else(|_| session.workspace_root.clone());
    let display_label = canonical
        .strip_prefix(&canonical_root)
        .ok()
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        .filter(|relative| !relative.is_empty())
        .unwrap_or_else(|| {
            canonical
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("image")
                .to_string()
        });
    Ok((bytes, safe_selected_image_label(display_label)))
}

pub(super) fn pending_image_usage(staged: &HashMap<String, StagedAgentImage>) -> (usize, usize) {
    staged
        .values()
        .filter(|image| image.consumed_by.is_none())
        .fold((0, 0), |(count, bytes), image| {
            (
                count + 1,
                bytes.saturating_add(image.attachment.byte_length),
            )
        })
}

#[tauri::command]
pub fn stage_agent_image(
    input: AgentImageStageInput,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentImageAttachment, String> {
    let session = session_for(&state, &input.client_session_id)?;
    session.ensure_owner(window.label())?;
    if !session.image_input.load(Ordering::SeqCst) {
        return Err("This Codex app-server does not support image input.".to_string());
    }
    let (source, display_label) = match input.source {
        AgentImageStageSource::ClipboardBytes {
            display_label,
            media_type,
            base64,
        } => {
            let _ = media_type;
            if base64.len() > (MAX_IMAGE_SOURCE_BYTES * 4 / 3) + 16 {
                return Err("This image is too large.".to_string());
            }
            let bytes = BASE64_STANDARD
                .decode(base64)
                .map_err(|_| "The pasted image is invalid.".to_string())?;
            (bytes, safe_clipboard_image_label(&display_label))
        }
        AgentImageStageSource::SelectedPath { path } => selected_image_source(&session, &path)?,
    };
    let normalized = normalize_agent_image(&source)?;
    let mut staged = session
        .staged_images
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let pending_images = staged
        .values()
        .filter(|image| image.consumed_by.is_none())
        .collect::<Vec<_>>();
    let (pending_count, current_total) = pending_image_usage(&staged);
    if pending_count >= MAX_IMAGES_PER_TURN {
        return Err("You can attach up to 4 images to one question.".to_string());
    }
    if pending_images
        .iter()
        .any(|image| image.digest == normalized.digest)
    {
        return Err("This image is already attached.".to_string());
    }
    if current_total.saturating_add(normalized.bytes.len()) > MAX_IMAGE_TOTAL_BYTES {
        return Err("The attached images are too large.".to_string());
    }
    let ordinal = session.image_counter.fetch_add(1, Ordering::SeqCst) + 1;
    let attachment_id = format!("image-{ordinal}");
    let snapshot_path = session
        .scratch_directory
        .join(format!("{attachment_id}.{}", normalized.extension));
    fs::write(&snapshot_path, &normalized.bytes)
        .map_err(|_| "This image could not be prepared.".to_string())?;
    let attachment = AgentImageAttachment {
        attachment_id: attachment_id.clone(),
        display_label,
        media_type: normalized.media_type,
        width: normalized.width,
        height: normalized.height,
        byte_length: normalized.bytes.len(),
        thumbnail_data_url: normalized.thumbnail_data_url,
    };
    staged.insert(
        attachment_id,
        StagedAgentImage {
            attachment: attachment.clone(),
            path: snapshot_path,
            digest: normalized.digest,
            consumed_by: None,
        },
    );
    Ok(attachment)
}

#[tauri::command]
pub fn discard_agent_image(
    input: AgentImageDiscardInput,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<(), String> {
    let session = session_for(&state, &input.client_session_id)?;
    session.ensure_owner(window.label())?;
    let mut staged = session
        .staged_images
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if let Some(image) = staged.get(&input.attachment_id) {
        if image.consumed_by.is_some() {
            return Err("This image is already being used by the current question.".to_string());
        }
    }
    if let Some(image) = staged.remove(&input.attachment_id) {
        let _ = fs::remove_file(image.path);
    }
    Ok(())
}

pub(super) fn resolve_turn_images(
    session: &AgentSession,
    attachment_ids: &[String],
) -> Result<Vec<(String, PathBuf)>, String> {
    if attachment_ids.len() > MAX_IMAGES_PER_TURN {
        return Err("You can attach up to 4 images to one question.".to_string());
    }
    if !attachment_ids.is_empty() && !session.image_input.load(Ordering::SeqCst) {
        return Err("This Codex app-server does not support image input.".to_string());
    }
    let staged = session
        .staged_images
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let mut resolved = Vec::new();
    let mut total = 0usize;
    for attachment_id in attachment_ids {
        if resolved
            .iter()
            .any(|(resolved_id, _)| resolved_id == attachment_id)
        {
            return Err("The same image cannot be attached twice.".to_string());
        }
        let image = staged
            .get(attachment_id)
            .filter(|image| image.consumed_by.is_none())
            .ok_or_else(|| "An attached image is no longer available.".to_string())?;
        total = total.saturating_add(image.attachment.byte_length);
        if total > MAX_IMAGE_TOTAL_BYTES {
            return Err("The attached images are too large.".to_string());
        }
        resolved.push((attachment_id.clone(), image.path.clone()));
    }
    Ok(resolved)
}

pub(super) fn mark_turn_images_consumed(
    session: &AgentSession,
    client_turn_id: &str,
    attachment_ids: &[String],
) {
    let mut staged = session
        .staged_images
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    for attachment_id in attachment_ids {
        if let Some(image) = staged.get_mut(attachment_id) {
            image.consumed_by = Some(client_turn_id.to_string());
        }
    }
}

pub(super) fn cleanup_turn_images(session: &AgentSession, client_turn_id: &str) {
    let mut staged = session
        .staged_images
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let consumed_ids = staged
        .iter()
        .filter_map(|(attachment_id, image)| {
            (image.consumed_by.as_deref() == Some(client_turn_id)).then_some(attachment_id.clone())
        })
        .collect::<Vec<_>>();
    for attachment_id in consumed_ids {
        if let Some(image) = staged.remove(&attachment_id) {
            let _ = fs::remove_file(image.path);
        }
    }
}

pub(super) fn text_input_item(text: &str) -> Value {
    json!({
        "type": "text",
        "text": text,
        "text_elements": [],
    })
}

pub(super) fn turn_input_items(
    prompt: &str,
    content_parts: &[AgentTurnContentPart],
    images: &[(String, PathBuf)],
) -> Result<Vec<Value>, String> {
    let mut input = Vec::new();
    if !prompt.is_empty() {
        input.push(text_input_item(prompt));
    }
    if content_parts.is_empty() {
        input.extend(images.iter().map(|(_, path)| {
            json!({
                "type": "localImage",
                "path": path.to_string_lossy(),
                "detail": "auto",
            })
        }));
        return Ok(input);
    }
    let image_paths = images.iter().cloned().collect::<HashMap<_, _>>();
    let mut text_bytes = 0usize;
    for part in content_parts {
        match part {
            AgentTurnContentPart::Text { text } => {
                text_bytes = text_bytes.saturating_add(text.as_bytes().len());
                if text_bytes > MAX_ATTACHMENT_TOTAL_BYTES {
                    return Err("The selected content is larger than 1 MiB.".to_string());
                }
                if !text.is_empty() {
                    input.push(text_input_item(text));
                }
            }
            AgentTurnContentPart::Image { attachment_id } => {
                let path = image_paths
                    .get(attachment_id)
                    .ok_or_else(|| "A selected image is unavailable.".to_string())?;
                input.push(json!({
                    "type": "localImage",
                    "path": path.to_string_lossy(),
                    "detail": "auto",
                }));
            }
        }
    }
    Ok(input)
}

pub(super) fn apply_session_quality_settings(session: &AgentSession, params: &mut Value) {
    if let Some(model) = session.model.as_deref() {
        params["model"] = json!(model);
    }
    if let Some(effort) = session.reasoning_effort.as_deref() {
        params["effort"] = json!(effort);
    }
    if let Some(personality) = session.personality.as_deref() {
        params["personality"] = json!(personality);
    }
}

pub(super) fn turn_prompt(
    active_file: &str,
    focus: &str,
    question: &str,
    response_mode: AgentResponseMode,
    display_kind: &str,
    visualization_instructions: &str,
) -> String {
    let question = question.trim();
    let (mode, response_instruction) = match response_mode {
        AgentResponseMode::Auto => ("auto", AUTO_RESPONSE_INSTRUCTION.to_string()),
        AgentResponseMode::Visualize => (
            "visualize",
            format!("{VISUALIZE_RESPONSE_INSTRUCTION}\n{visualization_instructions}"),
        ),
    };
    format!(
        "{SVARD_TURN_ENVELOPE_V1}\n\
         response-mode: {mode}\n\
         display-question-bytes: {}\n\
         display-kind: {display_kind}\n\n\
         {active_file}{focus}{response_instruction}\n\n\
         QUESTION\n\
         {question}",
        question.len(),
    )
}

pub(super) fn stage_attachments(
    session: &AgentSession,
    attachments: &[AgentAttachment],
) -> Result<Value, String> {
    if attachments.len() > MAX_ATTACHMENTS {
        return Err("Too many external files were attached.".to_string());
    }
    let mut total = 0usize;
    let mut context = serde_json::Map::new();
    for (index, attachment) in attachments.iter().enumerate() {
        let bytes = attachment.source.as_bytes();
        if bytes.len() > MAX_ATTACHMENT_BYTES {
            return Err("An attached file is too large.".to_string());
        }
        if attachment.source.contains('\0') {
            return Err("An attached file is not valid text.".to_string());
        }
        total = total.saturating_add(bytes.len());
        if total > MAX_ATTACHMENT_TOTAL_BYTES {
            return Err("The attached files are too large.".to_string());
        }
        let label = safe_attachment_label(&attachment.display_label, index);
        let snapshot_name = format!("{:02}-{}", index + 1, label);
        fs::write(session.scratch_directory.join(&snapshot_name), bytes)
            .map_err(|_| "Could not prepare an attached file.".to_string())?;
        let key = format!("attachment:{}:{}", index + 1, label);
        context.insert(
            key,
            json!({
                "value": format!("Attached file: {label}\n\n{}", attachment.source),
                "kind": "untrusted",
            }),
        );
        let _ = &attachment.attachment_id;
    }
    Ok(Value::Object(context))
}

#[tauri::command]
pub async fn send_agent_turn(
    input: AgentTurnInput,
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentTurnOutcome, String> {
    let title_question = input.question.clone();
    let title_has_images = !input.image_attachment_ids.is_empty()
        || input
            .content_parts
            .iter()
            .any(|part| matches!(part, AgentTurnContentPart::Image { .. }));
    let title_has_selected_content = !input.attachments.is_empty()
        || input.content_parts.iter().any(|part| {
            matches!(
                part,
                AgentTurnContentPart::Text { text } if !text.trim().is_empty()
            )
        });
    if input.question.as_bytes().len() > QUESTION_LIMIT {
        return Err("The question is too large.".to_string());
    }
    if matches!(input.response_mode, AgentResponseMode::Visualize)
        && input
            .visualization_instructions
            .as_ref()
            .is_some_and(|instructions| {
                instructions.as_bytes().len() > VISUALIZATION_INSTRUCTIONS_LIMIT
            })
    {
        return Err("The visualization instructions are too large.".to_string());
    }
    let session = session_for(&state, &input.client_session_id)?;
    session.ensure_owner(window.label())?;
    if session
        .active_turn
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .is_some()
    {
        return Err("This chat is already working on a question.".to_string());
    }
    if session
        .manual_compaction
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .is_some()
    {
        return Err("Wait for context compaction to finish before sending.".to_string());
    }
    let thread_id = session
        .thread_id
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
        .ok_or_else(|| "The Codex thread is unavailable.".to_string())?;
    let active_file = active_file_label(&session.workspace_root, input.active_file.as_ref())?;
    let focus_files = focus_file_labels(&session.workspace_root, &input.focus_files)?;
    let explicitly_focused = active_file
        .as_ref()
        .is_some_and(|active| focus_files.contains(active));
    let active_file_prompt = active_file_prompt(active_file.as_deref(), explicitly_focused);
    let focus = focus_prompt(&focus_files, active_file.as_deref());
    let additional_context = stage_attachments(&session, &input.attachments)?;
    let turn_images = resolve_turn_images(&session, &input.image_attachment_ids)?;
    let visualization_instructions = if matches!(input.response_mode, AgentResponseMode::Visualize)
    {
        input
            .visualization_instructions
            .as_deref()
            .filter(|instructions| !instructions.trim().is_empty())
            .ok_or_else(|| "Visualization instructions are unavailable.".to_string())?
    } else {
        ""
    };
    let display_kind = if !input.question.trim().is_empty() {
        "question"
    } else if title_has_images {
        "image"
    } else if title_has_selected_content {
        "selected-content"
    } else {
        "question"
    };
    let prompt = turn_prompt(
        &active_file_prompt,
        &focus,
        input.question.trim(),
        input.response_mode,
        display_kind,
        visualization_instructions,
    );
    let turn_input = turn_input_items(&prompt, &input.content_parts, &turn_images)?;
    if turn_input.is_empty() {
        return Err("Enter a question or attach an image.".to_string());
    }
    begin_token_usage_turn(&session);
    let (completion_sender, completion_receiver) = mpsc::channel();
    *session
        .active_turn
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(ActiveTurn {
        client_turn_id: input.client_turn_id.clone(),
        provider_turn_id: None,
        response_mode: input.response_mode,
        completion: completion_sender,
    });
    session.emit(AgentEvent::TurnStarted {
        client_turn_id: input.client_turn_id.clone(),
    });
    let mut turn_params = json!({
        "threadId": thread_id,
        "input": turn_input,
        "additionalContext": additional_context,
        "approvalPolicy": approval_policy(session.permission_mode),
        "approvalsReviewer": "user",
        "sandboxPolicy": sandbox_policy(&session),
        "summary": "concise",
    });
    apply_session_quality_settings(&session, &mut turn_params);
    let result = match session.request("turn/start", turn_params, REQUEST_TIMEOUT) {
        Ok(result) => result,
        Err(error) => {
            session
                .active_turn
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .take();
            return Err(error);
        }
    };
    let Some(provider_turn_id) = result
        .pointer("/turn/id")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        session
            .active_turn
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        return Err("Codex did not start the turn.".to_string());
    };
    if let Some(active) = session
        .active_turn
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_mut()
    {
        active.provider_turn_id = Some(provider_turn_id);
    }
    mark_turn_images_consumed(&session, &input.client_turn_id, &input.image_attachment_ids);
    session.emit(AgentEvent::TurnInputAccepted {
        client_turn_id: input.client_turn_id.clone(),
        image_attachment_ids: input.image_attachment_ids.clone(),
    });
    apply_fallback_title(
        &app,
        &state,
        &session,
        &title_question,
        title_has_images,
        title_has_selected_content,
    );
    if let Ok(registry_path) = AgentSessionRegistry::path(&app) {
        let _ = state
            .session_registry
            .touch(&registry_path, &input.client_session_id);
    }
    let wait_result = tauri::async_runtime::spawn_blocking(move || {
        completion_receiver.recv_timeout(TURN_TIMEOUT)
    })
    .await;
    let wait_result = match wait_result {
        Ok(result) => result,
        Err(_) => {
            cleanup_turn_images(&session, &input.client_turn_id);
            session
                .active_turn
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take();
            finish_automatic_title(&session);
            return Err("The agent turn could not be monitored.".to_string());
        }
    };
    let outcome = match wait_result {
        Ok(outcome) => outcome,
        Err(_) => {
            let _ = cancel_agent_turn_for_session(
                &session,
                current_client_turn(&session).unwrap_or_default(),
            );
            AgentTurnOutcome::Failed {
                code: "turn-timeout".to_string(),
                message: "Codex did not complete this turn in time.".to_string(),
            }
        }
    };
    cleanup_turn_images(&session, &input.client_turn_id);
    if matches!(outcome, AgentTurnOutcome::Completed) {
        schedule_title_refinement(app, Arc::clone(&session), title_question);
    } else {
        finish_automatic_title(&session);
    }
    Ok(outcome)
}

#[tauri::command]
pub fn respond_to_agent_approval(
    input: AgentApprovalResponseInput,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<(), String> {
    let session = session_for(&state, &input.client_session_id)?;
    session.ensure_owner(window.label())?;
    let approval = session
        .pending_approvals
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .remove(&input.request_id)
        .ok_or_else(|| "This approval request is no longer active.".to_string())?;
    let allow = matches!(input.decision, AgentApprovalDecision::AllowOnce);
    let result = match (approval.kind, approval.legacy) {
        (ApprovalKind::Command | ApprovalKind::FileChange, true) => json!({
            "decision": if allow {
                json!("approved")
            } else {
                json!({ "denied": { "rejection": "The user denied this action." } })
            }
        }),
        (ApprovalKind::Command | ApprovalKind::FileChange, false) => {
            json!({ "decision": if allow { "accept" } else { "decline" } })
        }
        (ApprovalKind::Permissions, _) if allow => {
            let requested = approval.requested_permissions.unwrap_or_else(|| json!({}));
            json!({
                "permissions": {
                    "network": requested.get("network").cloned().unwrap_or(Value::Null),
                    "fileSystem": requested.get("fileSystem").cloned().unwrap_or(Value::Null),
                },
                "scope": "turn",
                "strictAutoReview": false,
            })
        }
        (ApprovalKind::Permissions, _) => json!({
            "permissions": {},
            "scope": "turn",
            "strictAutoReview": true,
        }),
    };
    session.respond(approval.rpc_id, result)?;
    session.emit(AgentEvent::PermissionResolved {
        request_id: input.request_id,
        decision: input.decision,
    });
    Ok(())
}

#[tauri::command]
pub fn cancel_agent_turn(
    client_session_id: String,
    client_turn_id: String,
    window: tauri::WebviewWindow,
    state: State<'_, AgentAppServerState>,
) -> Result<(), String> {
    let session = session_for(&state, &client_session_id)?;
    session.ensure_owner(window.label())?;
    cancel_agent_turn_for_session(&session, client_turn_id)
}

fn cancel_agent_turn_for_session(
    session: &AgentSession,
    client_turn_id: String,
) -> Result<(), String> {
    let (thread_id, provider_turn_id) = {
        let active = session
            .active_turn
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let Some(active) = active.as_ref() else {
            return Ok(());
        };
        if active.client_turn_id != client_turn_id {
            return Ok(());
        }
        (
            session
                .thread_id
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone()
                .ok_or_else(|| "The Codex thread is unavailable.".to_string())?,
            active.provider_turn_id.clone(),
        )
    };
    let Some(provider_turn_id) = provider_turn_id else {
        return Ok(());
    };
    session.request(
        "turn/interrupt",
        json!({ "threadId": thread_id, "turnId": provider_turn_id }),
        Duration::from_secs(3),
    )?;
    Ok(())
}
