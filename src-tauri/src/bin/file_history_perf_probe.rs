use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Command, ExitCode},
    time::{SystemTime, UNIX_EPOCH},
};
use svard_lib::{
    git_file_history_for_path_with_cache, GitFileHistoryCacheState, GitFileHistoryMetrics,
};

const DOCUMENT_HISTORY: &str = "history.md";
const DOCUMENT_UNTRACKED: &str = "untracked.md";
const PHASE_COLD_FULL_SCAN: &str = "coldFullScan";
const PHASE_INITIAL_LIMIT: &str = "initialLimit";
const PHASE_SAME_HEAD_CACHE_HIT: &str = "sameHeadCacheHit";
const PHASE_HEAD_PLUS_ONE_INCREMENTAL: &str = "headPlusOneIncremental";
const PHASE_REWRITE_FALLBACK: &str = "rewriteFallback";
const PHASE_UNTRACKED_NO_CACHE_FIRST: &str = "untrackedNoCacheFirst";
const PHASE_UNTRACKED_NO_CACHE_SECOND: &str = "untrackedNoCacheSecond";
const TRACKED_RELATIVE_PATH: &str = "docs/history.md";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeReport {
    phases: Vec<ProbePhase>,
    summary: ProbeSummary,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbePhase {
    phase: &'static str,
    document: &'static str,
    status: String,
    item_count: usize,
    metrics: Option<GitFileHistoryMetrics>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSummary {
    initial_item_count: usize,
    initial_returned_commits: Option<usize>,
    cold_full_scan_walked_commits: Option<usize>,
    same_head_cache_status: Option<String>,
    same_head_walked_commits: Option<usize>,
    head_plus_one_cache_status: Option<String>,
    head_plus_one_walked_commits: Option<usize>,
    rewrite_fallback_cache_status: Option<String>,
    rewrite_fallback_item_count: usize,
    untracked_first_cache_status: Option<String>,
    untracked_second_cache_status: Option<String>,
}

fn main() -> ExitCode {
    match run() {
        Ok(report) => match serde_json::to_string_pretty(&report) {
            Ok(json) => {
                println!("{json}");
                ExitCode::SUCCESS
            }
            Err(error) => {
                eprintln!("failed to serialize probe report: {error}");
                ExitCode::FAILURE
            }
        },
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<ProbeReport, String> {
    let repo = create_probe_repo()?;
    let initial_cache = GitFileHistoryCacheState::default();
    let cache = GitFileHistoryCacheState::default();
    let tracked = repo.join(TRACKED_RELATIVE_PATH);
    let untracked = repo.join("docs").join(DOCUMENT_UNTRACKED);
    let mut phases = Vec::new();

    push_phase(
        &mut phases,
        PHASE_INITIAL_LIMIT,
        DOCUMENT_HISTORY,
        &tracked,
        &initial_cache,
        Some(20),
    )?;
    push_phase(
        &mut phases,
        PHASE_COLD_FULL_SCAN,
        DOCUMENT_HISTORY,
        &tracked,
        &cache,
        None,
    )?;
    push_phase(
        &mut phases,
        PHASE_SAME_HEAD_CACHE_HIT,
        DOCUMENT_HISTORY,
        &tracked,
        &cache,
        None,
    )?;

    commit_tracked_update(&repo, &tracked, "incremental", "history incremental")?;
    push_phase(
        &mut phases,
        PHASE_HEAD_PLUS_ONE_INCREMENTAL,
        DOCUMENT_HISTORY,
        &tracked,
        &cache,
        None,
    )?;

    rewrite_tracked_history(&repo, &tracked)?;
    push_phase(
        &mut phases,
        PHASE_REWRITE_FALLBACK,
        DOCUMENT_HISTORY,
        &tracked,
        &cache,
        None,
    )?;

    write_untracked_document(&untracked)?;
    for phase in [
        PHASE_UNTRACKED_NO_CACHE_FIRST,
        PHASE_UNTRACKED_NO_CACHE_SECOND,
    ] {
        push_phase(
            &mut phases,
            phase,
            DOCUMENT_UNTRACKED,
            &untracked,
            &cache,
            None,
        )?;
    }

    let summary = summarize(&phases);
    let _ = fs::remove_dir_all(&repo);
    Ok(ProbeReport { phases, summary })
}

fn create_probe_repo() -> Result<PathBuf, String> {
    let repo = env::temp_dir().join(format!(
        "svard-file-history-perf-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("failed to read clock: {error}"))?
            .as_nanos()
    ));
    fs::create_dir_all(repo.join("docs")).map_err(write_error)?;
    git(&repo, &["init"])?;
    git(&repo, &["config", "user.email", "perf@example.invalid"])?;
    git(&repo, &["config", "user.name", "Perf Probe"])?;
    let tracked = repo.join(TRACKED_RELATIVE_PATH);
    for index in 0..60 {
        fs::write(&tracked, format!("# History\n\nrevision {index}\n")).map_err(write_error)?;
        git(&repo, &["add", TRACKED_RELATIVE_PATH])?;
        git(&repo, &["commit", "-m", &format!("history update {index}")])?;
    }
    Ok(repo)
}

fn push_phase(
    phases: &mut Vec<ProbePhase>,
    phase: &'static str,
    document: &'static str,
    path: &Path,
    cache: &GitFileHistoryCacheState,
    limit: Option<usize>,
) -> Result<(), String> {
    phases.push(capture_phase(phase, document, path, cache, limit)?);
    Ok(())
}

fn commit_tracked_update(
    repo: &Path,
    tracked: &Path,
    body: &str,
    message: &str,
) -> Result<(), String> {
    fs::write(tracked, format!("# History\n\n{body}\n")).map_err(write_error)?;
    git(repo, &["add", TRACKED_RELATIVE_PATH])?;
    git(repo, &["commit", "-m", message])
}

fn rewrite_tracked_history(repo: &Path, tracked: &Path) -> Result<(), String> {
    git(repo, &["checkout", "--orphan", "rewritten"])?;
    git(repo, &["rm", "-rf", "."])?;
    fs::create_dir_all(repo.join("docs")).map_err(write_error)?;
    fs::write(tracked, "# History\n\nrewritten\n").map_err(write_error)?;
    git(repo, &["add", "."])?;
    git(repo, &["commit", "-m", "history rewritten"])
}

fn write_untracked_document(untracked: &Path) -> Result<(), String> {
    fs::write(untracked, "# Untracked\n").map_err(write_error)
}

fn capture_phase(
    phase: &'static str,
    document: &'static str,
    path: &Path,
    cache: &GitFileHistoryCacheState,
    limit: Option<usize>,
) -> Result<ProbePhase, String> {
    let history =
        git_file_history_for_path_with_cache(&path.to_string_lossy(), cache, limit, None)?;
    Ok(ProbePhase {
        phase,
        document,
        status: serialize_kebab_case(&history.status),
        item_count: history.items.len(),
        metrics: history.metrics,
    })
}

fn summarize(phases: &[ProbePhase]) -> ProbeSummary {
    ProbeSummary {
        initial_item_count: phases
            .iter()
            .find(|phase| phase.phase == PHASE_INITIAL_LIMIT)
            .map(|phase| phase.item_count)
            .unwrap_or_default(),
        initial_returned_commits: metrics_for(phases, PHASE_INITIAL_LIMIT)
            .and_then(|metrics| metrics.returned_commits),
        cold_full_scan_walked_commits: metrics_for(phases, PHASE_COLD_FULL_SCAN)
            .map(|metrics| metrics.walked_commits),
        same_head_cache_status: cache_status_for(phases, PHASE_SAME_HEAD_CACHE_HIT),
        same_head_walked_commits: metrics_for(phases, PHASE_SAME_HEAD_CACHE_HIT)
            .map(|metrics| metrics.walked_commits),
        head_plus_one_cache_status: cache_status_for(phases, PHASE_HEAD_PLUS_ONE_INCREMENTAL),
        head_plus_one_walked_commits: metrics_for(phases, PHASE_HEAD_PLUS_ONE_INCREMENTAL)
            .map(|metrics| metrics.walked_commits),
        rewrite_fallback_cache_status: cache_status_for(phases, PHASE_REWRITE_FALLBACK),
        rewrite_fallback_item_count: phases
            .iter()
            .find(|phase| phase.phase == PHASE_REWRITE_FALLBACK)
            .map(|phase| phase.item_count)
            .unwrap_or_default(),
        untracked_first_cache_status: cache_status_for(phases, PHASE_UNTRACKED_NO_CACHE_FIRST),
        untracked_second_cache_status: cache_status_for(phases, PHASE_UNTRACKED_NO_CACHE_SECOND),
    }
}

fn metrics_for<'a>(
    phases: &'a [ProbePhase],
    phase_name: &str,
) -> Option<&'a GitFileHistoryMetrics> {
    phases
        .iter()
        .find(|phase| phase.phase == phase_name)
        .and_then(|phase| phase.metrics.as_ref())
}

fn cache_status_for(phases: &[ProbePhase], phase_name: &str) -> Option<String> {
    metrics_for(phases, phase_name).map(|metrics| serialize_kebab_case(&metrics.cache_status))
}

fn serialize_kebab_case<T: Serialize>(value: &T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(ToString::to_string))
        .unwrap_or_else(|| "unknown".to_string())
}

fn git(repo: &Path, args: &[&str]) -> Result<(), String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo)
        .output()
        .map_err(|error| format!("failed to run git: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "git command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn write_error(error: std::io::Error) -> String {
    format!("failed to write probe fixture: {error}")
}
