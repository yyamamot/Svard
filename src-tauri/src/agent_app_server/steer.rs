use super::turn::{
    active_file_label, active_file_prompt, focus_file_labels, focus_prompt,
    mark_turn_images_consumed, resolve_turn_images, stage_attachments, turn_input_items,
};
use super::*;

pub(super) fn steer_prompt(
    active_file: &str,
    focus: &str,
    question: &str,
    response_mode: AgentResponseMode,
    display_kind: &str,
) -> String {
    let question = question.trim();
    let mode = match response_mode {
        AgentResponseMode::Auto => "auto",
        AgentResponseMode::Visualize => "visualize",
    };
    format!(
        "{SVARD_STEER_ENVELOPE_V1}\n\
         response-mode: {mode}\n\
         display-question-bytes: {}\n\
         display-kind: {display_kind}\n\n\
         {active_file}{focus}Apply this update to the response currently in progress.\n\n\
         STEERING UPDATE\n\
         {question}",
        question.len(),
    )
}

#[tauri::command]
pub fn steer_agent_turn(
    input: AgentSteerInput,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentSteerOutcome, String> {
    if input.question.as_bytes().len() > QUESTION_LIMIT {
        return Ok(AgentSteerOutcome::Failed {
            code: "steer-input-too-large".to_string(),
            message: "The steering message is too large.".to_string(),
        });
    }
    if input.client_steer_id.is_empty()
        || input.client_steer_id.len() > 128
        || input.client_steer_id.chars().any(char::is_control)
    {
        return Ok(AgentSteerOutcome::Failed {
            code: "invalid-steer-id".to_string(),
            message: "The steering message could not be identified.".to_string(),
        });
    }
    let session = session_for(&state, &input.client_session_id)?;
    if !session.turn_steering.load(Ordering::SeqCst) {
        return Ok(AgentSteerOutcome::Failed {
            code: "steer-unsupported".to_string(),
            message: "This Codex app-server does not support steering.".to_string(),
        });
    }
    let (provider_turn_id, active_mode) = {
        let active = session
            .active_turn
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let Some(active) = active
            .as_ref()
            .filter(|active| active.client_turn_id == input.client_turn_id)
        else {
            return Ok(AgentSteerOutcome::Failed {
                code: "steer-turn-mismatch".to_string(),
                message: "The active response changed before steering was applied.".to_string(),
            });
        };
        let Some(provider_turn_id) = active.provider_turn_id.clone() else {
            return Ok(AgentSteerOutcome::Failed {
                code: "steer-not-ready".to_string(),
                message: "Wait for Codex to accept the current input before steering.".to_string(),
            });
        };
        (provider_turn_id, active.response_mode)
    };
    if active_mode != input.response_mode {
        return Ok(AgentSteerOutcome::Failed {
            code: "steer-mode-mismatch".to_string(),
            message: "Steering cannot change the response mode. Queue this input instead."
                .to_string(),
        });
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
    let has_images = !input.image_attachment_ids.is_empty()
        || input
            .content_parts
            .iter()
            .any(|part| matches!(part, AgentTurnContentPart::Image { .. }));
    let has_selected_content = !input.attachments.is_empty()
        || input.content_parts.iter().any(|part| {
            matches!(
                part,
                AgentTurnContentPart::Text { text } if !text.trim().is_empty()
            )
        });
    let display_kind = if !input.question.trim().is_empty() {
        "question"
    } else if has_images {
        "image"
    } else if has_selected_content {
        "selected-content"
    } else {
        "question"
    };
    let prompt = steer_prompt(
        &active_file_prompt,
        &focus,
        input.question.trim(),
        input.response_mode,
        display_kind,
    );
    let steer_input = turn_input_items(&prompt, &input.content_parts, &turn_images)?;
    if steer_input.is_empty() {
        return Ok(AgentSteerOutcome::Failed {
            code: "empty-steer-input".to_string(),
            message: "Enter a steering message or attach an image.".to_string(),
        });
    }
    let result = match session.request(
        "turn/steer",
        json!({
            "threadId": thread_id,
            "expectedTurnId": provider_turn_id,
            "clientUserMessageId": input.client_steer_id,
            "input": steer_input,
            "additionalContext": additional_context,
        }),
        REQUEST_TIMEOUT,
    ) {
        Ok(result) => result,
        Err(error) => {
            let (code, message) = if error.to_ascii_lowercase().contains("not steerable") {
                (
                    "active-turn-not-steerable",
                    "The current Codex response cannot be steered. Queue this input instead.",
                )
            } else {
                (
                    "steer-failed",
                    "Codex could not accept the steering message. The input was kept.",
                )
            };
            return Ok(AgentSteerOutcome::Failed {
                code: code.to_string(),
                message: message.to_string(),
            });
        }
    };
    if result.get("turnId").and_then(Value::as_str) != Some(provider_turn_id.as_str()) {
        return Ok(AgentSteerOutcome::Failed {
            code: "steer-turn-mismatch".to_string(),
            message: "The active response changed before steering was applied.".to_string(),
        });
    }
    mark_turn_images_consumed(&session, &input.client_turn_id, &input.image_attachment_ids);
    Ok(AgentSteerOutcome::Accepted {
        image_attachment_ids: input.image_attachment_ids,
    })
}
