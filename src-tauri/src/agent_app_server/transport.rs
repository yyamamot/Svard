use super::*;

pub(super) fn reader_loop(session: Arc<AgentSession>, stdout: impl std::io::Read) {
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) if line.len() > MAX_LINE_BYTES => {
                session.emit(AgentEvent::ProviderDisconnected {
                    code: "protocol-line-too-large".to_string(),
                    message: "Codex sent a response that was too large.".to_string(),
                });
                break;
            }
            Ok(_) => {}
            Err(_) => break,
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            session.emit(AgentEvent::ProviderDisconnected {
                code: "malformed-protocol".to_string(),
                message: "Codex sent an unreadable protocol message.".to_string(),
            });
            break;
        };
        if value.get("method").is_some() && value.get("id").is_some() {
            handle_server_request(&session, &value);
        } else if let Some(id) = value.get("id").and_then(Value::as_u64) {
            let result = if let Some(error) = value.get("error") {
                Err(error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("Codex request failed.")
                    .to_string())
            } else {
                Ok(value.get("result").cloned().unwrap_or(Value::Null))
            };
            if let Some(sender) = session
                .pending_requests
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .remove(&id)
            {
                let _ = sender.send(result);
            }
        } else if value.get("method").is_some() {
            normalize_notification(&session, &value);
        }
    }
    if !session.closed.load(Ordering::SeqCst) {
        session.emit(AgentEvent::ProviderDisconnected {
            code: "provider-disconnected".to_string(),
            message: "Codex app-server disconnected.".to_string(),
        });
        if let Some(active) = session
            .active_turn
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        {
            if session.token_usage_diagnostics.load(Ordering::SeqCst) {
                if let Some(diagnostics) = finalize_token_usage_turn(&session) {
                    session.emit(AgentEvent::TokenUsageDiagnosticsUpdated { diagnostics });
                }
            }
            let _ = active.completion.send(AgentTurnOutcome::Failed {
                code: "provider-disconnected".to_string(),
                message: "Codex app-server disconnected.".to_string(),
            });
        }
        if let Some(compaction) = session
            .manual_compaction
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        {
            let _ = compaction.completion.send(AgentCompactionOutcome::Failed {
                code: "provider-disconnected".to_string(),
                message: "Codex app-server disconnected.".to_string(),
            });
        }
    }
    let _ = terminate_owned_process_slot(&session.child);
}

pub(super) fn current_client_turn(session: &AgentSession) -> Option<String> {
    session
        .active_turn
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_ref()
        .map(|turn| turn.client_turn_id.clone())
}

pub(super) fn normalize_relative_path(workspace_root: &Path, raw: &str) -> Option<String> {
    let canonical_root = workspace_root
        .canonicalize()
        .ok()
        .unwrap_or_else(|| workspace_root.to_path_buf());
    let path = PathBuf::from(raw);
    let absolute = if path.is_absolute() {
        path
    } else {
        canonical_root.join(path)
    };
    let normalized = absolute.canonicalize().ok().unwrap_or(absolute);
    normalized
        .strip_prefix(canonical_root)
        .ok()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .filter(|path| !path.is_empty())
}

pub(super) fn verified_workspace_relative_path(workspace_root: &Path, raw: &str) -> Option<String> {
    let canonical_root = workspace_root.canonicalize().ok()?;
    let path = PathBuf::from(raw);
    let absolute = if path.is_absolute() {
        path
    } else {
        canonical_root.join(path)
    };
    absolute
        .canonicalize()
        .ok()?
        .strip_prefix(canonical_root)
        .ok()
        .map(|path| {
            let relative = path.to_string_lossy().replace('\\', "/");
            if relative.is_empty() {
                ".".to_string()
            } else {
                relative
            }
        })
}

pub(super) struct ToolPresentation {
    pub(super) kind: &'static str,
    pub(super) category: &'static str,
    pub(super) title: String,
    pub(super) visibility: &'static str,
    pub(super) target: Option<String>,
}

pub(super) fn command_tool_presentation(workspace_root: &Path, item: &Value) -> ToolPresentation {
    let actions = item
        .get("commandActions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let category = ["search", "listFiles", "read"]
        .into_iter()
        .find(|candidate| {
            actions
                .iter()
                .any(|action| action.get("type").and_then(Value::as_str) == Some(*candidate))
        })
        .unwrap_or("command");
    let matching_actions = actions.iter().filter(|action| {
        action.get("type").and_then(Value::as_str)
            == Some(match category {
                "listFiles" => "listFiles",
                value => value,
            })
    });
    let has_path = matching_actions
        .clone()
        .any(|action| action.get("path").and_then(Value::as_str).is_some());
    let target = matching_actions
        .filter_map(|action| action.get("path").and_then(Value::as_str))
        .filter_map(|path| verified_workspace_relative_path(workspace_root, path))
        .next();
    let visibility = if has_path && target.is_none() {
        "internal"
    } else {
        "user"
    };
    let (kind, normalized_category, title) = match category {
        "read" => ("read", "read", "Inspecting files"),
        "listFiles" => ("read", "list", "Listing workspace files"),
        "search" => ("search", "search", "Searching the workspace"),
        _ => ("command", "command", "Running a workspace command"),
    };
    ToolPresentation {
        kind,
        category: normalized_category,
        title: if visibility == "internal" {
            "Running a provider operation".to_string()
        } else {
            title.to_string()
        },
        visibility,
        target,
    }
}

pub(super) fn item_tool(workspace_root: &Path, item: &Value) -> Option<ToolPresentation> {
    match item.get("type").and_then(Value::as_str)? {
        "commandExecution" => Some(command_tool_presentation(workspace_root, item)),
        "fileChange" => Some(ToolPresentation {
            kind: "fileChange",
            category: "fileChange",
            title: "Updating workspace files".to_string(),
            visibility: "user",
            target: None,
        }),
        "mcpToolCall" | "dynamicToolCall" => Some(ToolPresentation {
            kind: "mcp",
            category: "mcp",
            title: "Using an external tool".to_string(),
            visibility: "user",
            target: None,
        }),
        "webSearch" => Some(ToolPresentation {
            kind: "webSearch",
            category: "webSearch",
            title: "Searching the web".to_string(),
            visibility: "user",
            target: None,
        }),
        "imageView" => Some(ToolPresentation {
            kind: "read",
            category: "read",
            title: "Inspecting an image".to_string(),
            visibility: "user",
            target: None,
        }),
        _ => None,
    }
}

pub(super) fn safe_activity_text(
    workspace_root: &Path,
    value: &str,
    limit: usize,
) -> Option<String> {
    let root = workspace_root.to_string_lossy();
    let normalized_root = root.replace('\\', "/");
    let redacted = value
        .replace(root.as_ref(), ".")
        .replace(&normalized_root, ".");
    if contains_private_path(&redacted) {
        return None;
    }
    let safe = redacted
        .chars()
        .filter(|character| !character.is_control() || matches!(character, '\n' | '\r' | '\t'))
        .take(limit)
        .collect::<String>()
        .trim()
        .to_string();
    (!safe.is_empty()).then_some(safe)
}

fn contains_private_path(value: &str) -> bool {
    value
        .split_whitespace()
        .flat_map(|token| token.split('='))
        .any(looks_like_private_path)
}

fn looks_like_private_path(value: &str) -> bool {
    let candidate = value.trim_end_matches('.').trim_matches(|character: char| {
        matches!(
            character,
            '"' | '\'' | '`' | '(' | ')' | '[' | ']' | '{' | '}' | ',' | ';'
        )
    });
    if candidate.is_empty() {
        return false;
    }

    let lower = candidate.to_ascii_lowercase();
    if lower.starts_with("file://") {
        return true;
    }

    let bytes = candidate.as_bytes();
    candidate.starts_with('/')
        || candidate.starts_with('\\')
        || (bytes.len() > 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':')
}

pub(super) fn completed_tool_detail(workspace_root: &Path, item: &Value) -> Option<String> {
    let command = match item.get("command").and_then(Value::as_str) {
        Some(value) => Some(safe_activity_text(workspace_root, value, 480)?),
        None => None,
    };
    let output = match item.get("aggregatedOutput").and_then(Value::as_str) {
        Some(value) => Some(safe_activity_text(workspace_root, value, 1200)?),
        None => None,
    };
    match (command, output) {
        (Some(command), Some(output)) => Some(format!("Command\n{command}\n\nOutput\n{output}")),
        (Some(command), None) => Some(format!("Command\n{command}")),
        (None, Some(output)) => Some(format!("Output\n{output}")),
        (None, None) => None,
    }
}

pub(super) fn normalized_tool_status(value: Option<&str>) -> &'static str {
    match value {
        Some("completed") => "completed",
        Some("declined") => "denied",
        Some("failed") => "failed",
        _ => "completed",
    }
}

pub(super) fn completed_tool_summary(
    tool: &ToolPresentation,
    status: &'static str,
    item: &Value,
) -> Option<String> {
    match (tool.visibility, tool.category, status) {
        ("internal", _, "failed") => Some("A provider operation failed".to_string()),
        ("internal", _, "denied") => Some("A provider operation was denied".to_string()),
        ("internal", _, _) => None,
        (_, "command", "completed") => Some("Workspace command completed".to_string()),
        (_, _, "failed") => item
            .get("exitCode")
            .and_then(Value::as_i64)
            .map(|code| format!("Failed with exit code {code}"))
            .or_else(|| Some("The operation failed".to_string())),
        (_, _, "denied") => Some("The operation was denied".to_string()),
        _ => None,
    }
}

pub(super) fn normalize_notification(session: &AgentSession, value: &Value) {
    let method = value
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let params = value.get("params").unwrap_or(&Value::Null);
    match method {
        "thread/tokenUsage/updated" => {
            if !notification_matches_session_thread(session, params) {
                return;
            }
            if session.context_usage.load(Ordering::SeqCst) {
                if let Some(usage) = normalize_context_usage(params) {
                    session.emit(AgentEvent::ContextUsageUpdated { usage });
                }
            }
            if session.token_usage_diagnostics.load(Ordering::SeqCst) {
                if let Some(diagnostics) = normalize_token_usage_diagnostics(session, params) {
                    session.emit(AgentEvent::TokenUsageDiagnosticsUpdated { diagnostics });
                }
            }
        }
        "turn/started" => {
            if let Some(provider_turn_id) = params.pointer("/turn/id").and_then(Value::as_str) {
                if let Some(active) = session
                    .active_turn
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .as_mut()
                {
                    if active.provider_turn_id.is_none() {
                        active.provider_turn_id = Some(provider_turn_id.to_string());
                    }
                }
            }
            if let Some(client_turn_id) = current_client_turn(session) {
                session.emit(AgentEvent::TurnStarted { client_turn_id });
            }
        }
        "item/reasoning/summaryTextDelta" => {
            if let Some(delta) = params.get("delta").and_then(Value::as_str) {
                session.emit(AgentEvent::ReasoningSummaryDelta {
                    delta: delta.to_string(),
                });
            }
        }
        "item/agentMessage/delta" => {
            let Some(delta) = params.get("delta").and_then(Value::as_str) else {
                return;
            };
            let item_id = params
                .get("itemId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let phase = session
                .item_phases
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .get(item_id)
                .cloned();
            if phase.as_deref() == Some("commentary") {
                session.emit(AgentEvent::AssistantCommentaryDelta {
                    delta: delta.to_string(),
                });
            } else {
                session.emit(AgentEvent::FinalAnswerDelta {
                    delta: delta.to_string(),
                });
            }
        }
        "turn/plan/updated" => {
            let steps = params
                .get("plan")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .enumerate()
                .filter_map(|(index, step)| {
                    Some(AgentPlanStep {
                        id: format!("step-{}", index + 1),
                        title: step.get("step")?.as_str()?.to_string(),
                        status: step
                            .get("status")
                            .and_then(Value::as_str)
                            .unwrap_or("pending")
                            .to_string(),
                    })
                })
                .collect();
            session.emit(AgentEvent::PlanUpdated { steps });
        }
        "item/started" => {
            let item = params.get("item").unwrap_or(&Value::Null);
            let item_id = item
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if item.get("type").and_then(Value::as_str) == Some("contextCompaction") {
                let source = {
                    let mut manual = session
                        .manual_compaction
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    if let Some(compaction) = manual.as_mut() {
                        compaction.item_started = true;
                        AgentCompactionSource::Manual
                    } else {
                        AgentCompactionSource::Automatic
                    }
                };
                session.emit(AgentEvent::ContextCompactionStarted { source });
            } else if item.get("type").and_then(Value::as_str) == Some("agentMessage") {
                if let Some(phase) = item.get("phase").and_then(Value::as_str) {
                    session
                        .item_phases
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .insert(item_id, phase.to_string());
                }
            } else if let Some(tool) = item_tool(&session.workspace_root, item) {
                session.emit(AgentEvent::ToolStarted {
                    tool_id: item_id,
                    kind: tool.kind,
                    category: tool.category,
                    title: tool.title,
                    visibility: tool.visibility,
                    target: tool.target,
                    detail: None,
                });
            }
        }
        "item/completed" => {
            let item = params.get("item").unwrap_or(&Value::Null);
            let item_id = item
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if item.get("type").and_then(Value::as_str) == Some("contextCompaction") {
                let manual = {
                    let mut pending = session
                        .manual_compaction
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    if let Some(compaction) = pending.as_mut() {
                        compaction.item_completed = true;
                        true
                    } else {
                        false
                    }
                };
                if !manual {
                    session.emit(AgentEvent::ContextCompactionCompleted {
                        source: AgentCompactionSource::Automatic,
                    });
                }
            } else if let Some(tool) = item_tool(&session.workspace_root, item) {
                let status = normalized_tool_status(item.get("status").and_then(Value::as_str));
                let duration_ms = item.get("durationMs").and_then(Value::as_u64);
                let summary = completed_tool_summary(&tool, status, item);
                session.emit(AgentEvent::ToolCompleted {
                    tool_id: item_id,
                    status,
                    summary,
                    detail: (tool.visibility == "user")
                        .then(|| completed_tool_detail(&session.workspace_root, item))
                        .flatten(),
                    duration_ms,
                });
            }
            if item.get("type").and_then(Value::as_str) == Some("fileChange") {
                let paths = item
                    .get("changes")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|change| change.get("path").and_then(Value::as_str))
                    .filter_map(|path| normalize_relative_path(&session.workspace_root, path))
                    .collect::<Vec<_>>();
                if !paths.is_empty() {
                    session.emit(AgentEvent::FilesChanged { paths });
                }
            }
        }
        "item/commandExecution/outputDelta" | "item/fileChange/outputDelta" => {
            if let Some(tool_id) = params.get("itemId").and_then(Value::as_str) {
                session.emit(AgentEvent::ToolUpdated {
                    tool_id: tool_id.to_string(),
                    status: "running",
                    detail: None,
                });
            }
        }
        "turn/completed" => {
            let terminal_turn_id = params.pointer("/turn/id").and_then(Value::as_str);
            let active_matches_terminal = session
                .active_turn
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .as_ref()
                .is_some_and(|active| active.provider_turn_id.as_deref() == terminal_turn_id);
            if session
                .active_turn
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .is_some()
                && !active_matches_terminal
            {
                return;
            }
            let status = params
                .pointer("/turn/status")
                .and_then(Value::as_str)
                .unwrap_or("failed");
            let active = session
                .active_turn
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take();
            if let Some(active) = active {
                if session.token_usage_diagnostics.load(Ordering::SeqCst) {
                    if let Some(diagnostics) = finalize_token_usage_turn(session) {
                        session.emit(AgentEvent::TokenUsageDiagnosticsUpdated { diagnostics });
                    }
                }
                let outcome = match status {
                    "completed" => {
                        session.emit(AgentEvent::TurnCompleted {
                            client_turn_id: active.client_turn_id.clone(),
                        });
                        AgentTurnOutcome::Completed
                    }
                    "interrupted" => {
                        session.emit(AgentEvent::TurnCancelled {
                            client_turn_id: active.client_turn_id.clone(),
                        });
                        AgentTurnOutcome::Cancelled
                    }
                    _ => {
                        let message = params
                            .pointer("/turn/error/message")
                            .and_then(Value::as_str)
                            .unwrap_or("Codex could not complete this turn.")
                            .to_string();
                        session.emit(AgentEvent::TurnFailed {
                            client_turn_id: active.client_turn_id.clone(),
                            code: "turn-failed".to_string(),
                            message: message.clone(),
                        });
                        AgentTurnOutcome::Failed {
                            code: "turn-failed".to_string(),
                            message,
                        }
                    }
                };
                let _ = active.completion.send(outcome);
            } else if let Some(compaction) = session
                .manual_compaction
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take()
            {
                let outcome = if status == "completed"
                    && compaction.item_started
                    && compaction.item_completed
                {
                    session.emit(AgentEvent::ContextCompactionCompleted {
                        source: AgentCompactionSource::Manual,
                    });
                    AgentCompactionOutcome::Completed
                } else {
                    AgentCompactionOutcome::Failed {
                        code: "compaction-failed".to_string(),
                        message: "Codex could not complete context compaction.".to_string(),
                    }
                };
                let _ = compaction.completion.send(outcome);
            }
        }
        "error" => {
            let message = params
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Codex reported an error.")
                .to_string();
            if let Some(client_turn_id) = current_client_turn(session) {
                session.emit(AgentEvent::TurnFailed {
                    client_turn_id,
                    code: "provider-error".to_string(),
                    message,
                });
            }
        }
        _ => {}
    }
}

pub(super) fn handle_server_request(session: &AgentSession, value: &Value) {
    let method = value
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let params = value.get("params").cloned().unwrap_or(Value::Null);
    let Some(rpc_id) = value.get("id").cloned() else {
        return;
    };
    let (kind, title, impact, requested_permissions, legacy) = match method {
        "item/commandExecution/requestApproval" => (
            ApprovalKind::Command,
            "Run a workspace command",
            "The command may read or change data according to this chat's access mode.",
            None,
            false,
        ),
        "execCommandApproval" => (
            ApprovalKind::Command,
            "Run a workspace command",
            "The command may read or change data according to this chat's access mode.",
            None,
            true,
        ),
        "item/fileChange/requestApproval" => (
            ApprovalKind::FileChange,
            "Apply workspace file changes",
            "Files in the open workspace may be modified.",
            None,
            false,
        ),
        "applyPatchApproval" => (
            ApprovalKind::FileChange,
            "Apply workspace file changes",
            "Files in the open workspace may be modified.",
            None,
            true,
        ),
        "item/permissions/requestApproval" => (
            ApprovalKind::Permissions,
            "Grant additional access",
            "Codex is requesting access beyond the current sandbox.",
            params.get("permissions").cloned(),
            false,
        ),
        _ => {
            let _ = session.respond(rpc_id, json!({ "decision": "decline" }));
            return;
        }
    };
    let request_id = format!(
        "approval-{}",
        session.approval_counter.fetch_add(1, Ordering::SeqCst) + 1
    );
    let reason = params
        .get("reason")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|reason| !reason.is_empty())
        .map(|reason| reason.chars().take(240).collect::<String>());
    session
        .pending_approvals
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(
            request_id.clone(),
            PendingApproval {
                rpc_id,
                kind,
                legacy,
                requested_permissions,
            },
        );
    session.emit(AgentEvent::PermissionRequested {
        request: AgentApprovalRequest {
            request_id,
            kind: match kind {
                ApprovalKind::Command => "command",
                ApprovalKind::FileChange => "fileChange",
                ApprovalKind::Permissions => "permissions",
            },
            title: title.to_string(),
            detail: reason,
            impact: impact.to_string(),
        },
    });
}
