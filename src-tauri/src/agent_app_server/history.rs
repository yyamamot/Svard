use super::*;

pub(super) fn history_turn_id(client_session_id: &str, provider_turn_id: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(client_session_id.as_bytes());
    digest.update(b"\0");
    digest.update(provider_turn_id.as_bytes());
    let encoded = format!("{:x}", digest.finalize());
    format!("history-{}", &encoded[..24])
}

pub(super) fn history_item_status(item: &Value) -> String {
    match item.get("status").and_then(Value::as_str) {
        Some("completed" | "success") => "completed",
        Some("failed" | "error") => "failed",
        Some("declined" | "denied") => "denied",
        Some("inProgress" | "running") => "failed",
        None => "completed",
        _ => "failed",
    }
    .to_string()
}

pub(super) fn history_activity(item: &Value) -> Option<AgentSessionHistoryActivity> {
    let item_type = item.get("type").and_then(Value::as_str)?;
    let (category, title, summary) = match item_type {
        "commandExecution" => (
            "command",
            "Workspace command",
            Some("A workspace command was run.".to_string()),
        ),
        "fileChange" => (
            "fileChange",
            "Workspace files",
            Some("Workspace files were updated.".to_string()),
        ),
        "webSearch" => (
            "webSearch",
            "Web search",
            Some("The web was searched.".to_string()),
        ),
        "mcpToolCall" | "dynamicToolCall" => (
            "mcp",
            "External tool",
            Some("An external tool was used.".to_string()),
        ),
        "collabAgentToolCall" => (
            "other",
            "Agent task",
            Some("A delegated agent task was run.".to_string()),
        ),
        _ => return None,
    };
    Some(AgentSessionHistoryActivity {
        category: category.to_string(),
        title: title.to_string(),
        status: history_item_status(item),
        summary,
        duration_ms: item.get("durationMs").and_then(Value::as_u64),
    })
}

struct HistoryQuestionProjection {
    question: String,
    response_mode: AgentResponseMode,
    svard_envelope: bool,
}

fn history_display_question(question: &str, display_kind: &str) -> Option<String> {
    if !question.trim().is_empty() {
        return Some(question.trim().to_string());
    }
    match display_kind {
        "image" => Some("Image discussion".to_string()),
        "selected-content" => Some("Selected content review".to_string()),
        "question" => Some("Previous question unavailable".to_string()),
        _ => None,
    }
}

fn v1_history_question(text: &str, envelope: &str) -> Option<HistoryQuestionProjection> {
    if !text.starts_with(envelope) {
        return None;
    }
    let invalid = || HistoryQuestionProjection {
        question: "Previous question unavailable".to_string(),
        response_mode: AgentResponseMode::Auto,
        svard_envelope: true,
    };
    let Some((header, _)) = text.split_once("\n\n") else {
        return Some(invalid());
    };
    let mut lines = header.lines();
    if lines.next() != Some(envelope) {
        return Some(invalid());
    }
    let Some(mode) = lines
        .next()
        .and_then(|line| line.strip_prefix("response-mode: "))
        .and_then(|mode| match mode {
            "auto" => Some(AgentResponseMode::Auto),
            "visualize" => Some(AgentResponseMode::Visualize),
            _ => None,
        })
    else {
        return Some(invalid());
    };
    let Some(question_bytes) = lines
        .next()
        .and_then(|line| line.strip_prefix("display-question-bytes: "))
        .and_then(|value| value.parse::<usize>().ok())
    else {
        return Some(invalid());
    };
    let Some(display_kind) = lines
        .next()
        .and_then(|line| line.strip_prefix("display-kind: "))
    else {
        return Some(invalid());
    };
    if lines.next().is_some() || question_bytes > text.len() {
        return Some(invalid());
    }
    let question_start = text.len() - question_bytes;
    let question_marker = if envelope == SVARD_STEER_ENVELOPE_V1 {
        "\nSTEERING UPDATE\n"
    } else {
        "\nQUESTION\n"
    };
    if !text.is_char_boundary(question_start) || !text[..question_start].ends_with(question_marker)
    {
        return Some(invalid());
    }
    let Some(question) = history_display_question(&text[question_start..], display_kind) else {
        return Some(invalid());
    };
    Some(HistoryQuestionProjection {
        question,
        response_mode: mode,
        svard_envelope: true,
    })
}

fn strip_legacy_context_preamble(mut text: &str) -> &str {
    if text.starts_with("The user is currently viewing ") {
        if let Some((_, remaining)) = text.split_once("\n\n") {
            text = remaining;
        }
    }
    if text.starts_with("For this question, pay particular attention to these workspace files:\n- ")
    {
        if let Some((_, remaining)) = text.split_once("\n\n") {
            text = remaining;
        }
    }
    text
}

fn legacy_history_question(text: &str) -> Option<HistoryQuestionProjection> {
    let bridges = [
        (LEGACY_AUTO_OPENUI_BRIDGE, AgentResponseMode::Auto),
        (LEGACY_VISUALIZE_OPENUI_BRIDGE, AgentResponseMode::Visualize),
    ];
    for (bridge, response_mode) in bridges {
        let marker = format!("\n\n{bridge}\n");
        if let Some(marker_start) = text.find(&marker) {
            let visualization = &text[marker_start + marker.len()..];
            let known_prompt = visualization.contains("root = SvardExperience(")
                && visualization.contains("Return OpenUI Lang source only.")
                && visualization.contains("## Final Verification");
            let question = strip_legacy_context_preamble(&text[..marker_start]).trim();
            return Some(HistoryQuestionProjection {
                question: if known_prompt && !question.is_empty() {
                    question.to_string()
                } else {
                    "Previous question unavailable".to_string()
                },
                response_mode,
                svard_envelope: true,
            });
        }
    }
    let internal_prompt_detected = text.contains(LEGACY_AUTO_OPENUI_BRIDGE)
        || text.contains(LEGACY_VISUALIZE_OPENUI_BRIDGE)
        || (text.contains("Return OpenUI Lang source only.")
            && text.contains("root = SvardExperience("));
    internal_prompt_detected.then(|| HistoryQuestionProjection {
        question: "Previous question unavailable".to_string(),
        response_mode: AgentResponseMode::Auto,
        svard_envelope: true,
    })
}

fn history_question_projection(text: &str) -> HistoryQuestionProjection {
    v1_history_question(text, SVARD_TURN_ENVELOPE_V1)
        .or_else(|| legacy_history_question(text))
        .unwrap_or_else(|| HistoryQuestionProjection {
            question: text.to_string(),
            response_mode: AgentResponseMode::Auto,
            svard_envelope: false,
        })
}

pub(super) fn normalize_history_turn(
    client_session_id: &str,
    workspace_root: &Path,
    turn: &Value,
) -> Option<AgentSessionHistoryTurn> {
    let provider_turn_id = turn.get("id").and_then(Value::as_str)?;
    let mut question_parts = Vec::new();
    let mut answer_parts = Vec::new();
    let mut steering_messages = Vec::new();
    let mut changed_paths = Vec::new();
    let mut activities = Vec::new();
    let mut context_omitted = false;
    let mut response_mode = AgentResponseMode::Auto;
    let mut saw_user_text = false;
    let mut svard_envelope = false;
    for item in turn
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        match item.get("type").and_then(Value::as_str) {
            Some("userMessage") => {
                for content in item
                    .get("content")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    if content.get("type").and_then(Value::as_str) == Some("text") {
                        if let Some(text) = content.get("text").and_then(Value::as_str) {
                            if !saw_user_text {
                                let projection = history_question_projection(text);
                                question_parts.push(projection.question);
                                response_mode = projection.response_mode;
                                svard_envelope = projection.svard_envelope;
                                saw_user_text = true;
                            } else if let Some(projection) =
                                v1_history_question(text, SVARD_STEER_ENVELOPE_V1)
                            {
                                steering_messages.push(projection.question);
                            } else if svard_envelope {
                                context_omitted = true;
                            } else {
                                question_parts.push(text.to_string());
                            }
                        }
                    } else {
                        context_omitted = true;
                    }
                }
            }
            Some("agentMessage") => {
                if item.get("phase").and_then(Value::as_str) == Some("commentary") {
                    context_omitted = true;
                } else if let Some(text) = item.get("text").and_then(Value::as_str) {
                    answer_parts.push(text.to_string());
                }
            }
            Some("reasoning" | "plan" | "hookPrompt") => {
                context_omitted = true;
            }
            Some(_) => {
                if let Some(activity) = history_activity(item) {
                    if item.get("type").and_then(Value::as_str) == Some("fileChange") {
                        for path in item
                            .get("changes")
                            .and_then(Value::as_array)
                            .into_iter()
                            .flatten()
                            .filter_map(|change| change.get("path").and_then(Value::as_str))
                            .filter_map(|path| normalize_relative_path(workspace_root, path))
                        {
                            if !changed_paths.contains(&path) {
                                changed_paths.push(path);
                            }
                        }
                    }
                    activities.push(activity);
                } else {
                    context_omitted = true;
                }
            }
            None => context_omitted = true,
        }
    }
    let status = match turn.get("status").and_then(Value::as_str) {
        Some("completed") => "completed",
        Some("interrupted") => "cancelled",
        Some("failed") => "failed",
        Some("inProgress") => "failed",
        _ => "failed",
    };
    Some(AgentSessionHistoryTurn {
        id: history_turn_id(client_session_id, provider_turn_id),
        question: question_parts.join("\n\n"),
        answer: answer_parts.join("\n\n"),
        response_mode,
        steering_messages,
        changed_paths,
        activities,
        status: status.to_string(),
        created_at: turn.get("startedAt").and_then(Value::as_u64).unwrap_or(0),
        context_omitted,
    })
}

pub(super) fn normalize_history_turn_page(
    client_session_id: &str,
    workspace_root: &Path,
    provider_turns: &[Value],
) -> Vec<AgentSessionHistoryTurn> {
    let mut turns = provider_turns
        .iter()
        .filter_map(|turn| normalize_history_turn(client_session_id, workspace_root, turn))
        .collect::<Vec<_>>();
    turns.reverse();
    turns
}
