use super::*;

pub(super) fn normalize_context_usage(params: &Value) -> Option<AgentContextUsage> {
    let used_tokens = params
        .pointer("/tokenUsage/last/totalTokens")
        .and_then(Value::as_u64)?;
    let context_window_tokens = params
        .pointer("/tokenUsage/modelContextWindow")
        .and_then(Value::as_u64)
        .filter(|window| *window > 0)?;
    let used_tokens = used_tokens.min(context_window_tokens);
    let remaining = context_window_tokens.saturating_sub(used_tokens);
    let remaining_percent = (((remaining as u128) * 100 + (context_window_tokens as u128 / 2))
        / context_window_tokens as u128)
        .min(100) as u8;
    Some(AgentContextUsage {
        used_tokens,
        context_window_tokens,
        remaining_percent,
    })
}

#[tauri::command]
pub async fn compact_agent_session(
    client_session_id: String,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentCompactionOutcome, String> {
    let session = session_for(&state, &client_session_id)?;
    if !session.manual_compaction_supported.load(Ordering::SeqCst) {
        return Ok(AgentCompactionOutcome::Failed {
            code: "compaction-unsupported".to_string(),
            message: "Context compaction is unavailable for this Codex installation.".to_string(),
        });
    }
    if session
        .active_turn
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .is_some()
    {
        return Ok(AgentCompactionOutcome::Failed {
            code: "turn-active".to_string(),
            message: "Wait for the active response to finish before compacting context."
                .to_string(),
        });
    }
    let thread_id = session
        .thread_id
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
        .ok_or_else(|| "The Codex thread is unavailable.".to_string())?;
    let (completion, receiver) = mpsc::channel();
    {
        let mut manual = session
            .manual_compaction
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if manual.is_some() {
            return Ok(AgentCompactionOutcome::Failed {
                code: "compaction-active".to_string(),
                message: "Context compaction is already running.".to_string(),
            });
        }
        *manual = Some(ManualCompaction {
            item_started: false,
            item_completed: false,
            completion,
        });
    }
    if session
        .request(
            "thread/compact/start",
            json!({ "threadId": thread_id }),
            REQUEST_TIMEOUT,
        )
        .is_err()
    {
        session
            .manual_compaction
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        return Ok(AgentCompactionOutcome::Failed {
            code: "compaction-rejected".to_string(),
            message: "Codex could not start context compaction.".to_string(),
        });
    }
    let wait = tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(TURN_TIMEOUT))
        .await
        .map_err(|_| "Context compaction could not be monitored.".to_string())?;
    match wait {
        Ok(outcome) => Ok(outcome),
        Err(_) => {
            session
                .manual_compaction
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .take();
            Ok(AgentCompactionOutcome::Failed {
                code: "compaction-timeout".to_string(),
                message: "Codex did not complete context compaction in time.".to_string(),
            })
        }
    }
}
