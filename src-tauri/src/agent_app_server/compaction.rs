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

pub(super) fn notification_matches_session_thread(session: &AgentSession, params: &Value) -> bool {
    let Some(notification_thread_id) = params.get("threadId").and_then(Value::as_str) else {
        return false;
    };
    session
        .thread_id
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_deref()
        == Some(notification_thread_id)
}

pub(super) fn normalize_token_usage_breakdown(value: &Value) -> Option<AgentTokenUsageBreakdown> {
    let usage = AgentTokenUsageBreakdown {
        input_tokens: value.get("inputTokens")?.as_u64()?,
        cached_input_tokens: value.get("cachedInputTokens")?.as_u64()?,
        output_tokens: value.get("outputTokens")?.as_u64()?,
        reasoning_output_tokens: value.get("reasoningOutputTokens")?.as_u64()?,
        total_tokens: value.get("totalTokens")?.as_u64()?,
    };
    if usage.cached_input_tokens > usage.input_tokens
        || usage.reasoning_output_tokens > usage.output_tokens
    {
        return None;
    }
    Some(usage)
}

fn checked_add_token_usage(
    left: AgentTokenUsageBreakdown,
    right: AgentTokenUsageBreakdown,
) -> Option<AgentTokenUsageBreakdown> {
    Some(AgentTokenUsageBreakdown {
        input_tokens: left.input_tokens.checked_add(right.input_tokens)?,
        cached_input_tokens: left
            .cached_input_tokens
            .checked_add(right.cached_input_tokens)?,
        output_tokens: left.output_tokens.checked_add(right.output_tokens)?,
        reasoning_output_tokens: left
            .reasoning_output_tokens
            .checked_add(right.reasoning_output_tokens)?,
        total_tokens: left.total_tokens.checked_add(right.total_tokens)?,
    })
}

fn token_usage_is_monotonic(
    previous: AgentTokenUsageBreakdown,
    next: AgentTokenUsageBreakdown,
) -> bool {
    previous.input_tokens <= next.input_tokens
        && previous.cached_input_tokens <= next.cached_input_tokens
        && previous.output_tokens <= next.output_tokens
        && previous.reasoning_output_tokens <= next.reasoning_output_tokens
        && previous.total_tokens <= next.total_tokens
}

fn token_usage_diagnostics(
    tracking: &AgentTokenUsageTracking,
    turn: Option<AgentTokenUsageBreakdown>,
) -> Option<AgentTokenUsageDiagnostics> {
    Some(AgentTokenUsageDiagnostics {
        latest_request: AgentTokenUsageSeries {
            provenance: AgentTokenUsageProvenance::ProviderReported,
            usage: tracking.latest_request?,
        },
        turn: turn.map(|usage| AgentTokenUsageSeries {
            provenance: AgentTokenUsageProvenance::AggregatedProviderReports,
            usage,
        }),
        conversation: AgentTokenUsageSeries {
            provenance: AgentTokenUsageProvenance::ProviderReported,
            usage: tracking.last_conversation_total?,
        },
    })
}

pub(super) fn begin_token_usage_turn(session: &AgentSession) {
    let mut tracking = session
        .token_usage_tracking
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    tracking.active_turn = None;
    tracking.active_turn_overflowed = false;
}

pub(super) fn finalize_token_usage_turn(
    session: &AgentSession,
) -> Option<AgentTokenUsageDiagnostics> {
    let mut tracking = session
        .token_usage_tracking
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if !tracking.active_turn_overflowed {
        if let Some(turn) = tracking.active_turn.take() {
            tracking.latest_turn = Some(turn);
        }
    } else {
        tracking.active_turn = None;
    }
    tracking.active_turn_overflowed = false;
    token_usage_diagnostics(&tracking, tracking.latest_turn)
}

pub(super) fn normalize_token_usage_diagnostics(
    session: &AgentSession,
    params: &Value,
) -> Option<AgentTokenUsageDiagnostics> {
    if !notification_matches_session_thread(session, params) {
        return None;
    }
    let last = normalize_token_usage_breakdown(params.pointer("/tokenUsage/last")?)?;
    let total = normalize_token_usage_breakdown(params.pointer("/tokenUsage/total")?)?;
    let notification_turn_id = params.get("turnId").and_then(Value::as_str);
    let (has_active_turn, matches_active_turn) = session
        .active_turn
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_ref()
        .map(|turn| {
            (
                true,
                turn.provider_turn_id.as_deref() == notification_turn_id,
            )
        })
        .unwrap_or((false, false));

    let mut tracking = session
        .token_usage_tracking
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let previous_total = tracking.last_conversation_total;
    let duplicate = previous_total == Some(total);
    tracking.latest_request = Some(last);
    tracking.last_conversation_total = Some(total);

    if matches_active_turn && !duplicate && !tracking.active_turn_overflowed {
        if previous_total.is_some_and(|previous| !token_usage_is_monotonic(previous, total)) {
            tracking.active_turn = None;
            tracking.active_turn_overflowed = true;
        } else {
            match checked_add_token_usage(tracking.active_turn.unwrap_or_default(), last) {
                Some(next) => tracking.active_turn = Some(next),
                None => {
                    tracking.active_turn = None;
                    tracking.active_turn_overflowed = true;
                }
            }
        }
    }

    let turn = if has_active_turn {
        (!tracking.active_turn_overflowed)
            .then_some(tracking.active_turn)
            .flatten()
    } else {
        tracking.latest_turn
    };
    token_usage_diagnostics(&tracking, turn)
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
