use std::{collections::BTreeSet, env, fs, hint::black_box, path::Path, time::Instant};

use serde::Serialize;

use super::*;

const STRESS_LINE_COUNTS: [usize; 4] = [200, 1_000, 3_000, 5_000];
const WARMUP_COUNT: usize = 1;
const MEASUREMENT_COUNT: usize = 20;

#[derive(Clone, Copy)]
enum FixtureKind {
    SingleEdit,
    Disjoint,
}

struct ProbeFixture {
    fixture_id: String,
    input_bytes: usize,
    left: String,
    left_line_count: usize,
    peak_scratch_entries: u64,
    right: String,
    right_line_count: usize,
    work_units: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSample {
    duration_ms: f64,
    fixture_id: String,
    input_bytes: usize,
    left_line_count: usize,
    peak_scratch_entries: u64,
    right_line_count: usize,
    work_units: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FixtureSummary {
    duration_ms: DurationSummary,
    fixture_id: String,
    input_bytes: usize,
    left_line_count: usize,
    peak_scratch_entries: u64,
    right_line_count: usize,
    work_units: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DurationSummary {
    p50: f64,
    p95: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeReport {
    measurement_count: usize,
    samples: Vec<ProbeSample>,
    schema_version: u32,
    summaries: Vec<FixtureSummary>,
    warmup_count: usize,
}

fn numbered_lines(prefix: &str, count: usize) -> String {
    (0..count)
        .map(|index| format!("{prefix}-{index:05}"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}

fn complexity_metrics(left: &str, right: &str) -> (usize, usize, u64, u64) {
    let left_line_count = split_lines(left).len();
    let right_line_count = split_lines(right).len();
    if left == right {
        return (left_line_count, right_line_count, 0, 0);
    }
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let common_edges = line_diff_effective_common_edges(&left_lines, &right_lines);
    let left_middle_count = left_line_count - common_edges.prefix_lines - common_edges.suffix_lines;
    let right_middle_count =
        right_line_count - common_edges.prefix_lines - common_edges.suffix_lines;
    let work_units = u64::try_from(left_middle_count)
        .expect("left line count")
        .checked_mul(u64::try_from(right_middle_count).expect("right line count"))
        .expect("work units");
    let peak_scratch_entries = u64::try_from(left_middle_count + 1)
        .expect("left scratch dimension")
        .checked_mul(u64::try_from(right_middle_count + 1).expect("right scratch dimension"))
        .expect("scratch entries");
    (
        left_line_count,
        right_line_count,
        work_units,
        peak_scratch_entries,
    )
}

fn probe_fixture(kind: FixtureKind, line_count: usize) -> ProbeFixture {
    let left = numbered_lines("line", line_count);
    let right = match kind {
        FixtureKind::SingleEdit => {
            let mut lines = split_lines(&left)
                .into_iter()
                .map(str::to_string)
                .collect::<Vec<_>>();
            lines[line_count / 2] = format!("edit-{:05}", line_count / 2);
            lines.join("\n") + "\n"
        }
        FixtureKind::Disjoint => numbered_lines("other", line_count),
    };
    let fixture_id = match kind {
        FixtureKind::SingleEdit => format!("single-edit-{line_count}"),
        FixtureKind::Disjoint => format!("disjoint-{line_count}"),
    };
    let (left_line_count, right_line_count, work_units, peak_scratch_entries) =
        complexity_metrics(&left, &right);
    let input_bytes = left.len() + right.len();
    assert!(left.len() < MAX_TEXT_DIFF_BYTES);
    assert!(right.len() < MAX_TEXT_DIFF_BYTES);

    ProbeFixture {
        fixture_id,
        input_bytes,
        left,
        left_line_count,
        peak_scratch_entries,
        right,
        right_line_count,
        work_units,
    }
}

fn probe_fixtures() -> Vec<ProbeFixture> {
    STRESS_LINE_COUNTS
        .into_iter()
        .flat_map(|line_count| {
            [FixtureKind::SingleEdit, FixtureKind::Disjoint]
                .into_iter()
                .map(move |kind| probe_fixture(kind, line_count))
        })
        .collect()
}

fn measure_fixture(fixture: &ProbeFixture) -> ProbeSample {
    let started_at = Instant::now();
    let hunks = line_diff_hunks(black_box(&fixture.left), black_box(&fixture.right));
    black_box(&hunks);
    ProbeSample {
        duration_ms: started_at.elapsed().as_secs_f64() * 1_000.0,
        fixture_id: fixture.fixture_id.clone(),
        input_bytes: fixture.input_bytes,
        left_line_count: fixture.left_line_count,
        peak_scratch_entries: fixture.peak_scratch_entries,
        right_line_count: fixture.right_line_count,
        work_units: fixture.work_units,
    }
}

fn percentile(values: &[f64], percentile: f64) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let rank = (percentile * sorted.len() as f64).ceil() as usize;
    sorted[rank.saturating_sub(1).min(sorted.len() - 1)]
}

fn build_report() -> ProbeReport {
    let fixtures = probe_fixtures();
    let mut samples_by_fixture = vec![Vec::<ProbeSample>::new(); fixtures.len()];

    for iteration in 0..(WARMUP_COUNT + MEASUREMENT_COUNT) {
        for offset in 0..fixtures.len() {
            let fixture_index = (iteration + offset) % fixtures.len();
            let sample = measure_fixture(&fixtures[fixture_index]);
            if iteration >= WARMUP_COUNT {
                samples_by_fixture[fixture_index].push(sample);
            }
        }
    }

    let summaries = fixtures
        .iter()
        .enumerate()
        .map(|(index, fixture)| {
            let durations = samples_by_fixture[index]
                .iter()
                .map(|sample| sample.duration_ms)
                .collect::<Vec<_>>();
            FixtureSummary {
                duration_ms: DurationSummary {
                    p50: percentile(&durations, 0.50),
                    p95: percentile(&durations, 0.95),
                },
                fixture_id: fixture.fixture_id.clone(),
                input_bytes: fixture.input_bytes,
                left_line_count: fixture.left_line_count,
                peak_scratch_entries: fixture.peak_scratch_entries,
                right_line_count: fixture.right_line_count,
                work_units: fixture.work_units,
            }
        })
        .collect();
    let samples = samples_by_fixture.into_iter().flatten().collect();

    ProbeReport {
        measurement_count: MEASUREMENT_COUNT,
        samples,
        schema_version: 1,
        summaries,
        warmup_count: WARMUP_COUNT,
    }
}

fn assert_report_is_privacy_safe(report: &ProbeReport) {
    let value = serde_json::to_value(report).expect("serialize line diff probe report");
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

    let allowed = STRESS_LINE_COUNTS
        .into_iter()
        .flat_map(|line_count| {
            [
                format!("single-edit-{line_count}"),
                format!("disjoint-{line_count}"),
            ]
        })
        .collect::<BTreeSet<_>>();
    assert!(
        string_values.is_subset(&allowed),
        "line diff report contains an unexpected string value"
    );

    let serialized = serde_json::to_string(report).expect("serialize report");
    for private_field in [
        "source",
        "path",
        "basename",
        "hunk",
        "lineText",
        "repository",
        "url",
        "timestamp",
        "platform",
    ] {
        assert!(!serialized.contains(private_field), "private field leaked");
    }
}

#[test]
fn line_diff_probe_metrics_follow_the_current_common_edge_plan() {
    assert_eq!(complexity_metrics("same\n", "same\n"), (1, 1, 0, 0));
    assert_eq!(complexity_metrics("same", "same\n"), (1, 1, 1, 4));
    assert_eq!(complexity_metrics("A\nA\n", "X\nA\n"), (2, 2, 4, 9));

    let single_edit = probe_fixture(FixtureKind::SingleEdit, 200);
    assert_eq!(single_edit.work_units, 40_000);
    assert_eq!(single_edit.peak_scratch_entries, 40_401);
    assert_eq!(single_edit.left_line_count, 200);
    assert_eq!(single_edit.right_line_count, 200);

    let disjoint = probe_fixture(FixtureKind::Disjoint, 5_000);
    assert_eq!(disjoint.work_units, 25_000_000);
    assert_eq!(disjoint.peak_scratch_entries, 25_010_001);
    assert!(disjoint.left.len() < MAX_TEXT_DIFF_BYTES);
    assert!(disjoint.right.len() < MAX_TEXT_DIFF_BYTES);
}

#[test]
fn line_diff_probe_report_schema_is_minimal_and_privacy_safe() {
    let sample = ProbeSample {
        duration_ms: 1.25,
        fixture_id: "single-edit-200".to_string(),
        input_bytes: 4_000,
        left_line_count: 200,
        peak_scratch_entries: 40_401,
        right_line_count: 200,
        work_units: 40_000,
    };
    let report = ProbeReport {
        measurement_count: 1,
        samples: vec![sample],
        schema_version: 1,
        summaries: vec![FixtureSummary {
            duration_ms: DurationSummary {
                p50: 1.25,
                p95: 1.25,
            },
            fixture_id: "single-edit-200".to_string(),
            input_bytes: 4_000,
            left_line_count: 200,
            peak_scratch_entries: 40_401,
            right_line_count: 200,
            work_units: 40_000,
        }],
        warmup_count: 1,
    };
    assert_report_is_privacy_safe(&report);

    let value = serde_json::to_value(&report).expect("serialize report");
    let report_keys = value
        .as_object()
        .expect("report object")
        .keys()
        .cloned()
        .collect::<BTreeSet<_>>();
    assert_eq!(
        report_keys,
        BTreeSet::from([
            "measurementCount".to_string(),
            "samples".to_string(),
            "schemaVersion".to_string(),
            "summaries".to_string(),
            "warmupCount".to_string(),
        ])
    );
    let sample = &value["samples"][0];
    assert_eq!(sample.as_object().expect("sample object").len(), 7);
    assert!(sample.get("source").is_none());
    assert!(sample.get("path").is_none());
    assert!(sample.get("hunk").is_none());
}

#[test]
#[ignore = "writes the release-like IMP-415 performance artifact"]
fn line_diff_complexity_probe_writes_report() {
    let output = env::var("SVARD_LINE_DIFF_PROBE_OUT")
        .expect("SVARD_LINE_DIFF_PROBE_OUT must name summary.json");
    let report = build_report();
    assert_report_is_privacy_safe(&report);
    let output_path = Path::new(&output);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).expect("create line diff probe artifact directory");
    }
    fs::write(
        output_path,
        serde_json::to_string_pretty(&report).expect("serialize line diff probe report") + "\n",
    )
    .expect("write line diff probe report");
}
