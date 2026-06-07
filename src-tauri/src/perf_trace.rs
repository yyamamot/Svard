use std::{
    path::Path,
    sync::OnceLock,
    time::{Duration, Instant},
};

static ENABLED: OnceLock<bool> = OnceLock::new();

pub(crate) fn enabled() -> bool {
    *ENABLED.get_or_init(|| std::env::var("SVARD_PERF_TRACE").ok().as_deref() == Some("1"))
}

pub(crate) fn start() -> Instant {
    Instant::now()
}

pub(crate) fn duration_ms(started_at: Instant) -> f64 {
    duration_to_ms(started_at.elapsed())
}

pub(crate) fn duration_to_ms(duration: Duration) -> f64 {
    (duration.as_secs_f64() * 1000.0 * 100.0).round() / 100.0
}

pub(crate) fn basename(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown".to_string())
}

pub(crate) fn log(event: &str, fields: &[(&str, String)]) {
    if !enabled() {
        return;
    }
    let payload = fields
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join(" ");
    eprintln!("[perf] event={event} {payload}");
}
