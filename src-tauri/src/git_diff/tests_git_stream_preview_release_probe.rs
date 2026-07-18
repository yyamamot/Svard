use std::{collections::BTreeSet, env, fs, hint::black_box, time::Instant};

use serde::Serialize;
use tempfile::tempdir;

use super::preview::batch::{
    probe_branch_file_diffs_for_paths, probe_commit_file_diffs_for_paths,
    GitStreamPreviewProbeTimings,
};
use super::tests_support::{git, git_stdout};
use super::*;

const DOCUMENT_COUNT: usize = 14;
const CHANGE_COUNT: usize = 12;
const BATCH_SIZE: usize = 2;
const WARMUP_COUNT: usize = 1;
const MEASUREMENT_COUNT: usize = 15;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSample {
    sample_index: usize,
    batch_first: bool,
    single_preview_ms: f64,
    batch_preview_ms: f64,
    paired_delta_ms: f64,
    repository_setup_ms: f64,
    revision_setup_ms: f64,
    preview_build_ms: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DurationSummary {
    p50: f64,
    p95: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PairedDeltaSummary {
    p50: f64,
    mad: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RouteSummary {
    single_preview_ms: DurationSummary,
    batch_preview_ms: DurationSummary,
    paired_delta_ms: PairedDeltaSummary,
    repository_setup_ms: DurationSummary,
    revision_setup_ms: DurationSummary,
    preview_build_ms: DurationSummary,
    required_delta_ms: f64,
    improvement_ratio: f64,
    passed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RouteReport {
    route: &'static str,
    fixture_id: &'static str,
    variant: &'static str,
    samples: Vec<ProbeSample>,
    summary: RouteSummary,
    verdict: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeReport {
    schema_version: u32,
    run_mode: String,
    warmup_count: usize,
    measurement_count: usize,
    document_count: usize,
    batch_size: usize,
    routes: Vec<RouteReport>,
}

struct ProbeFixture {
    directory: tempfile::TempDir,
    base_revision: String,
    head_revision: String,
    relative_paths: Vec<String>,
}

fn document_source(document_index: usize, state: &str) -> String {
    let mut source = format!("# Benchmark document {document_index}\n\n");
    for change_index in 0..CHANGE_COUNT {
        source.push_str(&format!(
            "## Section {change_index}\n\nParagraph {document_index}-{change_index} {state}.\n\n- Item A\n- Item {state}\n\n| Name | State |\n| --- | --- |\n| Entry | {state} |\n\n"
        ));
    }
    source
}

fn create_fixture() -> ProbeFixture {
    let directory = tempdir().expect("stream preview probe directory");
    fs::create_dir_all(directory.path().join("docs")).expect("probe docs");
    let relative_paths = (0..DOCUMENT_COUNT)
        .map(|index| {
            let path = format!("docs/fixture-{index:02}.md");
            fs::write(
                directory.path().join(&path),
                document_source(index, "before"),
            )
            .expect("write base");
            path
        })
        .collect::<Vec<_>>();
    git(directory.path(), &["init"]);
    git(
        directory.path(),
        &["config", "user.email", "fixture@example.com"],
    );
    git(directory.path(), &["config", "user.name", "Fixture"]);
    git(directory.path(), &["add", "."]);
    git(directory.path(), &["commit", "-m", "base"]);
    let base_revision = git_stdout(directory.path(), &["rev-parse", "HEAD"]);
    for (index, path) in relative_paths.iter().enumerate() {
        fs::write(directory.path().join(path), document_source(index, "after"))
            .expect("write head");
    }
    git(directory.path(), &["add", "."]);
    git(directory.path(), &["commit", "-m", "head"]);
    let head_revision = git_stdout(directory.path(), &["rev-parse", "HEAD"]);
    ProbeFixture {
        directory,
        base_revision,
        head_revision,
        relative_paths,
    }
}

fn assert_ready(entries: Vec<GitDiffPreviewBatchEntry>) {
    for entry in entries {
        match entry {
            GitDiffPreviewBatchEntry::Ready { preview } => {
                assert_eq!(preview.status, GitDiffStatus::Modified);
                black_box(preview);
            }
            GitDiffPreviewBatchEntry::Error { message } => panic!("probe failed: {message}"),
        }
    }
}

fn measure_single(fixture: &ProbeFixture, route: &str) -> f64 {
    let started = Instant::now();
    for path in &fixture.relative_paths {
        let preview = if route == "branch" {
            git_branch_file_diff_for_path(
                &fixture.directory.path().to_string_lossy(),
                &fixture.base_revision,
                Some("HEAD"),
                path,
                None,
            )
        } else {
            git_file_commit_diff_for_path(
                &fixture.directory.path().join(path).to_string_lossy(),
                &fixture.head_revision,
            )
        }
        .expect("single stream preview");
        assert_eq!(preview.status, GitDiffStatus::Modified);
        black_box(preview);
    }
    started.elapsed().as_secs_f64() * 1_000.0
}

fn measure_batch(fixture: &ProbeFixture, route: &str) -> (f64, GitStreamPreviewProbeTimings) {
    let started = Instant::now();
    let mut timings = GitStreamPreviewProbeTimings {
        repository_setup_ms: 0.0,
        revision_setup_ms: 0.0,
        preview_build_ms: 0.0,
    };
    for paths in fixture.relative_paths.chunks(BATCH_SIZE) {
        let (entries, measured) = if route == "branch" {
            probe_branch_file_diffs_for_paths(
                &fixture.directory.path().to_string_lossy(),
                &fixture.base_revision,
                Some("HEAD"),
                paths
                    .iter()
                    .map(|path| GitBranchDiffPreviewBatchItem {
                        path: path.clone(),
                        old_path: None,
                    })
                    .collect(),
            )
        } else {
            probe_commit_file_diffs_for_paths(
                &fixture.directory.path().to_string_lossy(),
                &fixture.head_revision,
                paths.to_vec(),
            )
        }
        .expect("batch stream preview");
        timings.repository_setup_ms += measured.repository_setup_ms;
        timings.revision_setup_ms += measured.revision_setup_ms;
        timings.preview_build_ms += measured.preview_build_ms;
        assert_ready(entries);
    }
    (started.elapsed().as_secs_f64() * 1_000.0, timings)
}

fn sample(fixture: &ProbeFixture, route: &str, index: usize) -> ProbeSample {
    let batch_first = index % 2 == 1;
    let (single_preview_ms, batch_preview_ms, timings) = if batch_first {
        let (batch, timings) = measure_batch(fixture, route);
        (measure_single(fixture, route), batch, timings)
    } else {
        let single = measure_single(fixture, route);
        let (batch, timings) = measure_batch(fixture, route);
        (single, batch, timings)
    };
    ProbeSample {
        sample_index: index,
        batch_first,
        single_preview_ms,
        batch_preview_ms,
        paired_delta_ms: single_preview_ms - batch_preview_ms,
        repository_setup_ms: timings.repository_setup_ms,
        revision_setup_ms: timings.revision_setup_ms,
        preview_build_ms: timings.preview_build_ms,
    }
}

fn percentile(values: &[f64], fraction: f64) -> f64 {
    let mut values = values.to_vec();
    values.sort_by(f64::total_cmp);
    let rank = (values.len() as f64 * fraction).ceil() as usize;
    values[rank.saturating_sub(1).min(values.len() - 1)]
}

fn durations(samples: &[ProbeSample], metric: impl Fn(&ProbeSample) -> f64) -> DurationSummary {
    let values = samples.iter().map(metric).collect::<Vec<_>>();
    DurationSummary {
        p50: percentile(&values, 0.5),
        p95: percentile(&values, 0.95),
    }
}

fn route_report(fixture: &ProbeFixture, route: &'static str) -> RouteReport {
    for index in 0..WARMUP_COUNT {
        black_box(sample(fixture, route, index));
    }
    let samples = (0..MEASUREMENT_COUNT)
        .map(|index| sample(fixture, route, index))
        .collect::<Vec<_>>();
    let single_preview_ms = durations(&samples, |sample| sample.single_preview_ms);
    let batch_preview_ms = durations(&samples, |sample| sample.batch_preview_ms);
    let deltas = samples
        .iter()
        .map(|sample| sample.paired_delta_ms)
        .collect::<Vec<_>>();
    let delta_p50 = percentile(&deltas, 0.5);
    let mad = percentile(
        &deltas
            .iter()
            .map(|delta| (delta - delta_p50).abs())
            .collect::<Vec<_>>(),
        0.5,
    );
    let required_delta_ms = (single_preview_ms.p50 * 0.15).max(2.0).max(mad * 2.0);
    let passed = delta_p50 >= required_delta_ms;
    let summary = RouteSummary {
        improvement_ratio: delta_p50 / single_preview_ms.p50,
        required_delta_ms,
        passed,
        single_preview_ms,
        batch_preview_ms,
        paired_delta_ms: PairedDeltaSummary {
            p50: delta_p50,
            mad,
        },
        repository_setup_ms: durations(&samples, |sample| sample.repository_setup_ms),
        revision_setup_ms: durations(&samples, |sample| sample.revision_setup_ms),
        preview_build_ms: durations(&samples, |sample| sample.preview_build_ms),
    };
    RouteReport {
        route,
        fixture_id: if route == "branch" {
            "branch-14x12-mixed"
        } else {
            "commit-14x12-mixed"
        },
        variant: "single-vs-batch-two-release",
        verdict: if summary.passed { "go" } else { "no-go" },
        samples,
        summary,
    }
}

fn report(run_mode: String) -> ProbeReport {
    let fixture = create_fixture();
    ProbeReport {
        schema_version: 1,
        run_mode,
        warmup_count: WARMUP_COUNT,
        measurement_count: MEASUREMENT_COUNT,
        document_count: DOCUMENT_COUNT,
        batch_size: BATCH_SIZE,
        routes: vec![
            route_report(&fixture, "branch"),
            route_report(&fixture, "commit"),
        ],
    }
}

fn assert_safe(report: &ProbeReport) {
    let value = serde_json::to_value(report).expect("serialize stream probe");
    let mut strings = BTreeSet::new();
    fn collect(value: &serde_json::Value, strings: &mut BTreeSet<String>) {
        match value {
            serde_json::Value::String(value) => {
                strings.insert(value.clone());
            }
            serde_json::Value::Array(values) => {
                for value in values {
                    collect(value, strings);
                }
            }
            serde_json::Value::Object(values) => {
                for value in values.values() {
                    collect(value, strings);
                }
            }
            _ => {}
        }
    }
    collect(&value, &mut strings);
    let allowed = BTreeSet::from([
        "formal".to_string(),
        "confirmation".to_string(),
        "branch".to_string(),
        "commit".to_string(),
        "branch-14x12-mixed".to_string(),
        "commit-14x12-mixed".to_string(),
        "single-vs-batch-two-release".to_string(),
        "go".to_string(),
        "no-go".to_string(),
    ]);
    assert!(strings.is_subset(&allowed));
}

#[test]
fn git_stream_preview_release_probe_writes_report() {
    let Ok(path) = env::var("SVARD_GIT_STREAM_PREVIEW_REPORT") else {
        return;
    };
    let run_mode =
        env::var("SVARD_GIT_STREAM_PREVIEW_RUN_MODE").unwrap_or_else(|_| "formal".to_string());
    assert!(matches!(run_mode.as_str(), "formal" | "confirmation"));
    let report = report(run_mode);
    assert_safe(&report);
    fs::write(
        path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&report).expect("serialize report")
        ),
    )
    .expect("write stream preview report");
}

#[test]
fn git_stream_preview_release_probe_schema_is_privacy_safe() {
    let report = report("formal".to_string());
    assert_safe(&report);
    assert_eq!(report.routes.len(), 2);
    assert!(report.routes.iter().all(|route| route.samples.len() == 15));
}
