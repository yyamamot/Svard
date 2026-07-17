use std::{collections::BTreeSet, env, fs, hint::black_box, path::Path, time::Instant};

use serde::Serialize;
use tempfile::tempdir;

use super::tests_support::git;
use super::*;

const DOCUMENT_COUNT: usize = 14;
const CHANGE_COUNT: usize = 12;
const BATCH_SIZE: usize = 2;
const FIXTURE_ID: &str = "working-tree-14x12-mixed";
const VARIANT: &str = "single-vs-batch-two-preview-release";
const WARMUP_COUNT: usize = 1;
const MEASUREMENT_COUNT: usize = 15;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSample {
    batch_first: bool,
    batch_preview_ms: f64,
    document_count: usize,
    paired_delta_ms: f64,
    sample_index: usize,
    single_preview_ms: f64,
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
    mad: f64,
    p50: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSummary {
    batch_preview_ms: DurationSummary,
    improvement_ratio: f64,
    paired_delta_ms: PairedDeltaSummary,
    passed: bool,
    required_delta_ms: f64,
    single_preview_ms: DurationSummary,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeReport {
    batch_size: usize,
    document_count: usize,
    fixture_id: &'static str,
    measurement_count: usize,
    run_mode: String,
    samples: Vec<ProbeSample>,
    schema_version: u32,
    summary: ProbeSummary,
    variant: &'static str,
    verdict: &'static str,
    warmup_count: usize,
}

struct ProbeFixture {
    directory: tempfile::TempDir,
    relative_paths: Vec<String>,
}

fn document_source(document_index: usize, changed: bool) -> String {
    let mut source = format!("# Benchmark document {document_index}\n\n");
    for change_index in 0..CHANGE_COUNT {
        let state = if changed { "after" } else { "before" };
        source.push_str(&format!(
            "## Section {change_index}\n\nParagraph {document_index}-{change_index} {state}.\n\n- Item A\n- Item {state}\n\n| Name | State |\n| --- | --- |\n| Entry | {state} |\n\n"
        ));
    }
    source
}

fn create_probe_fixture() -> ProbeFixture {
    let directory = tempdir().expect("create Git preview probe directory");
    let docs = directory.path().join("docs");
    fs::create_dir_all(&docs).expect("create Git preview probe docs");
    let relative_paths = (0..DOCUMENT_COUNT)
        .map(|document_index| {
            let relative_path = format!("docs/fixture-{document_index:02}.md");
            fs::write(
                directory.path().join(&relative_path),
                document_source(document_index, false),
            )
            .expect("write Git preview baseline document");
            relative_path
        })
        .collect::<Vec<_>>();
    git(directory.path(), &["init"]);
    git(
        directory.path(),
        &["config", "user.email", "fixture@example.com"],
    );
    git(directory.path(), &["config", "user.name", "Fixture"]);
    git(directory.path(), &["add", "."]);
    git(directory.path(), &["commit", "-m", "initial"]);
    for (document_index, relative_path) in relative_paths.iter().enumerate() {
        fs::write(
            directory.path().join(relative_path),
            document_source(document_index, true),
        )
        .expect("write Git preview working tree document");
    }
    ProbeFixture {
        directory,
        relative_paths,
    }
}

fn measure_single_preview(fixture: &ProbeFixture) -> f64 {
    let started_at = Instant::now();
    for relative_path in &fixture.relative_paths {
        let document = fixture.directory.path().join(relative_path);
        let preview = git_diff_preview_for_path(&document.to_string_lossy())
            .expect("measure single Git diff preview");
        assert_eq!(preview.status, GitDiffStatus::Modified);
        black_box(preview);
    }
    started_at.elapsed().as_secs_f64() * 1_000.0
}

fn measure_batch_preview(fixture: &ProbeFixture) -> f64 {
    let started_at = Instant::now();
    for relative_paths in fixture.relative_paths.chunks(BATCH_SIZE) {
        let entries = git_diff_previews_for_paths(
            &fixture.directory.path().to_string_lossy(),
            relative_paths.to_vec(),
        )
        .expect("measure batched Git diff previews");
        assert_eq!(entries.len(), relative_paths.len());
        for entry in entries {
            match entry {
                GitDiffPreviewBatchEntry::Ready { preview } => {
                    assert_eq!(preview.status, GitDiffStatus::Modified);
                    black_box(preview);
                }
                GitDiffPreviewBatchEntry::Error { .. } => {
                    panic!("fixed Git preview batch fixture must be ready")
                }
            }
        }
    }
    started_at.elapsed().as_secs_f64() * 1_000.0
}

fn measure_sample(fixture: &ProbeFixture, sample_index: usize, batch_first: bool) -> ProbeSample {
    let (single_preview_ms, batch_preview_ms) = if batch_first {
        let batch = measure_batch_preview(fixture);
        let single = measure_single_preview(fixture);
        (single, batch)
    } else {
        let single = measure_single_preview(fixture);
        let batch = measure_batch_preview(fixture);
        (single, batch)
    };
    ProbeSample {
        batch_first,
        batch_preview_ms,
        document_count: DOCUMENT_COUNT,
        paired_delta_ms: single_preview_ms - batch_preview_ms,
        sample_index,
        single_preview_ms,
    }
}

fn percentile(values: &[f64], fraction: f64) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let rank = (fraction * sorted.len() as f64).ceil() as usize;
    sorted[rank.saturating_sub(1).min(sorted.len() - 1)]
}

fn duration_summary(
    samples: &[ProbeSample],
    metric: impl Fn(&ProbeSample) -> f64,
) -> DurationSummary {
    let values = samples.iter().map(metric).collect::<Vec<_>>();
    DurationSummary {
        p50: percentile(&values, 0.50),
        p95: percentile(&values, 0.95),
    }
}

fn paired_delta_summary(samples: &[ProbeSample]) -> PairedDeltaSummary {
    let deltas = samples
        .iter()
        .map(|sample| sample.paired_delta_ms)
        .collect::<Vec<_>>();
    let p50 = percentile(&deltas, 0.50);
    let absolute_deviations = deltas
        .iter()
        .map(|delta| (delta - p50).abs())
        .collect::<Vec<_>>();
    PairedDeltaSummary {
        mad: percentile(&absolute_deviations, 0.50),
        p50,
    }
}

fn summarize(samples: &[ProbeSample]) -> ProbeSummary {
    let single_preview_ms = duration_summary(samples, |sample| sample.single_preview_ms);
    let batch_preview_ms = duration_summary(samples, |sample| sample.batch_preview_ms);
    let paired_delta_ms = paired_delta_summary(samples);
    let required_delta_ms = (single_preview_ms.p50 * 0.15)
        .max(2.0)
        .max(paired_delta_ms.mad * 2.0);
    let improvement_ratio = if single_preview_ms.p50 > 0.0 {
        paired_delta_ms.p50 / single_preview_ms.p50
    } else {
        0.0
    };
    ProbeSummary {
        batch_preview_ms,
        improvement_ratio,
        passed: paired_delta_ms.p50 >= required_delta_ms,
        paired_delta_ms,
        required_delta_ms,
        single_preview_ms,
    }
}

fn build_report(run_mode: String) -> ProbeReport {
    assert!(matches!(run_mode.as_str(), "formal" | "confirmation"));
    let fixture = create_probe_fixture();
    for warmup_index in 0..WARMUP_COUNT {
        black_box(measure_sample(
            &fixture,
            warmup_index,
            warmup_index % 2 == 1,
        ));
    }
    let samples = (0..MEASUREMENT_COUNT)
        .map(|sample_index| measure_sample(&fixture, sample_index, sample_index % 2 == 1))
        .collect::<Vec<_>>();
    let summary = summarize(&samples);
    ProbeReport {
        batch_size: BATCH_SIZE,
        document_count: DOCUMENT_COUNT,
        fixture_id: FIXTURE_ID,
        measurement_count: MEASUREMENT_COUNT,
        run_mode,
        samples,
        schema_version: 2,
        verdict: if summary.passed { "go" } else { "no-go" },
        summary,
        variant: VARIANT,
        warmup_count: WARMUP_COUNT,
    }
}

fn assert_report_is_privacy_safe(report: &ProbeReport) {
    let value = serde_json::to_value(report).expect("serialize Git preview release probe");
    let mut string_values = BTreeSet::new();
    fn collect_strings(value: &serde_json::Value, output: &mut BTreeSet<String>) {
        match value {
            serde_json::Value::Array(values) => {
                for value in values {
                    collect_strings(value, output);
                }
            }
            serde_json::Value::Object(values) => {
                for value in values.values() {
                    collect_strings(value, output);
                }
            }
            serde_json::Value::String(value) => {
                output.insert(value.clone());
            }
            _ => {}
        }
    }
    collect_strings(&value, &mut string_values);
    let allowed = BTreeSet::from([
        FIXTURE_ID.to_string(),
        VARIANT.to_string(),
        "formal".to_string(),
        "confirmation".to_string(),
        "go".to_string(),
        "no-go".to_string(),
    ]);
    assert!(
        string_values.is_subset(&allowed),
        "Git preview release probe contains an unexpected string value"
    );
    assert_eq!(report.samples.len(), report.measurement_count);
    assert!(report.samples.iter().all(|sample| {
        sample.document_count == DOCUMENT_COUNT
            && sample.single_preview_ms.is_finite()
            && sample.single_preview_ms >= 0.0
            && sample.batch_preview_ms.is_finite()
            && sample.batch_preview_ms >= 0.0
            && sample.paired_delta_ms.is_finite()
    }));
    assert!(report.summary.single_preview_ms.p50.is_finite());
    assert!(report.summary.batch_preview_ms.p50.is_finite());
    assert!(report.summary.paired_delta_ms.p50.is_finite());
    assert!(report.summary.paired_delta_ms.mad.is_finite());
    assert!(report.summary.required_delta_ms.is_finite());
    assert!(report.summary.improvement_ratio.is_finite());
}

#[test]
fn git_preview_release_probe_schema_is_minimal_and_privacy_safe() {
    let samples = (0..3)
        .map(|sample_index| ProbeSample {
            batch_first: sample_index % 2 == 1,
            batch_preview_ms: 7.0,
            document_count: DOCUMENT_COUNT,
            paired_delta_ms: 3.0,
            sample_index,
            single_preview_ms: 10.0,
        })
        .collect::<Vec<_>>();
    let summary = summarize(&samples);
    assert_eq!(summary.paired_delta_ms.p50, 3.0);
    assert_eq!(summary.paired_delta_ms.mad, 0.0);
    assert_eq!(summary.required_delta_ms, 2.0);
    assert!(summary.passed);
    let report = ProbeReport {
        batch_size: BATCH_SIZE,
        document_count: DOCUMENT_COUNT,
        fixture_id: FIXTURE_ID,
        measurement_count: samples.len(),
        run_mode: "formal".to_string(),
        samples,
        schema_version: 2,
        summary,
        variant: VARIANT,
        verdict: "go",
        warmup_count: WARMUP_COUNT,
    };
    assert_report_is_privacy_safe(&report);

    let value = serde_json::to_value(report).expect("serialize probe schema");
    assert_eq!(value.as_object().expect("report object").len(), 11);
    assert!(value.get("path").is_none());
    assert!(value.get("revision").is_none());
    assert!(value.get("source").is_none());
}

#[test]
#[ignore = "writes the release Git preview performance artifact"]
fn git_preview_release_probe_writes_report() {
    let output = env::var("SVARD_GIT_PREVIEW_RELEASE_PROBE_OUT")
        .expect("SVARD_GIT_PREVIEW_RELEASE_PROBE_OUT must name a JSON artifact");
    let run_mode = env::var("SVARD_GIT_PREVIEW_RELEASE_PROBE_RUN")
        .expect("SVARD_GIT_PREVIEW_RELEASE_PROBE_RUN must be formal or confirmation");
    let report = build_report(run_mode);
    assert_report_is_privacy_safe(&report);
    let output_path = Path::new(&output);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).expect("create Git preview probe artifact directory");
    }
    fs::write(
        output_path,
        serde_json::to_string_pretty(&report).expect("serialize Git preview release probe") + "\n",
    )
    .expect("write Git preview release probe");
}
