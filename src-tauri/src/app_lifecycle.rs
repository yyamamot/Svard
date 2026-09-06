use tauri::{AppHandle, Manager, RunEvent};

use crate::{agent_app_server::AgentAppServerState, codex_spike::CodexProcessState};

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
    on_app_exit(event, || {
        cleanup_app_runtime(
            &app.state::<CodexProcessState>(),
            &app.state::<AgentAppServerState>(),
        );
    });
}

fn on_app_exit(event: RunEvent, cleanup: impl FnOnce()) {
    if matches!(event, RunEvent::Exit) {
        cleanup();
    }
}

fn cleanup_app_runtime(codex: &CodexProcessState, agent: &AgentAppServerState) {
    // Window cleanup may already have run. Both states drain their owned resources.
    codex.cleanup_all();
    agent.cleanup_all();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleanup_is_dispatched_only_for_the_final_exit_event() {
        let calls = std::cell::Cell::new(0);
        on_app_exit(RunEvent::Ready, || calls.set(calls.get() + 1));
        assert_eq!(calls.get(), 0);
        on_app_exit(RunEvent::Exit, || calls.set(calls.get() + 1));
        assert_eq!(calls.get(), 1);
    }

    #[test]
    fn app_cleanup_accepts_empty_states_and_repeated_calls() {
        let codex = CodexProcessState::default();
        let agent = AgentAppServerState::default();
        cleanup_app_runtime(&codex, &agent);
        cleanup_app_runtime(&codex, &agent);
    }
}
