use std::{collections::BTreeSet, env, fs, hint::black_box, io::Cursor};

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgb, RgbImage};
use serde::Serialize;
use tempfile::tempdir;

use super::*;
use crate::path_policy::register_allowed_root;

const WARMUP_COUNT: usize = 1;
const MEASUREMENT_COUNT: usize = 20;
const STATUS_RESOLVED: &str = "resolved";
const CACHE_STATUS_NOT_APPLICABLE: &str = "notApplicable";
const SIZE_BUCKET_UNDER_64_KIB: &str = "under64KiB";
const SIZE_BUCKET_FOUR_TO_FIVE_MIB: &str = "fourToFiveMiB";

struct ProbeFixture {
    fixture_id: &'static str,
    media_kind: &'static str,
    media_type: &'static str,
    size_bucket: &'static str,
    source: &'static str,
}

struct ProbeWorkspace {
    _directory: tempfile::TempDir,
    document_path: String,
    fixtures: Vec<ProbeFixture>,
    roots: AllowedRoots,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSample {
    encode_ms: f64,
    file_read_ms: f64,
    metadata_ms: f64,
    path_policy_context_ms: f64,
    sample_index: usize,
    total_ms: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DurationSummary {
    mad: f64,
    p50: f64,
    p95: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PhaseSummaries {
    encode_ms: DurationSummary,
    file_read_ms: DurationSummary,
    metadata_ms: DurationSummary,
    path_policy_context_ms: DurationSummary,
    total_ms: DurationSummary,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FixtureReport {
    cache_status: &'static str,
    fixture_id: &'static str,
    media_kind: &'static str,
    sample_count: usize,
    samples: Vec<ProbeSample>,
    size_bucket: &'static str,
    status: &'static str,
    timings_ms: PhaseSummaries,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeReport {
    fixtures: Vec<FixtureReport>,
    measurement_count: usize,
    run_mode: String,
    schema_version: u32,
    warmup_count: usize,
}

fn deterministic_noise_image(width: u32, height: u32) -> RgbImage {
    ImageBuffer::from_fn(width, height, |x, y| {
        let pixel_index = u64::from(y) * u64::from(width) + u64::from(x);
        let mut value = pixel_index.wrapping_add(0x9e37_79b9_7f4a_7c15);
        value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        value ^= value >> 31;
        Rgb([value as u8, (value >> 8) as u8, (value >> 16) as u8])
    })
}

fn encoded_raster(width: u32, height: u32, format: ImageFormat) -> Vec<u8> {
    let image = DynamicImage::ImageRgb8(deterministic_noise_image(width, height));
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, format)
        .expect("encode fixed local-image performance fixture");
    output.into_inner()
}

fn create_probe_workspace() -> ProbeWorkspace {
    let directory = tempdir().expect("create local-image performance directory");
    let project = directory.path().join("project");
    let docs = project.join("docs");
    let images = project.join("images");
    fs::create_dir_all(&docs).expect("create local-image performance docs");
    fs::create_dir_all(&images).expect("create local-image performance images");
    let document = docs.join("fixture.md");
    fs::write(&document, "# Local image performance fixture\n")
        .expect("write local-image performance document");

    fs::write(
        images.join("small.svg"),
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32"/></svg>"#,
    )
    .expect("write SVG performance fixture");
    fs::write(
        images.join("small.png"),
        encoded_raster(64, 64, ImageFormat::Png),
    )
    .expect("write PNG performance fixture");
    fs::write(
        images.join("small.jpg"),
        encoded_raster(64, 64, ImageFormat::Jpeg),
    )
    .expect("write JPEG performance fixture");
    fs::write(
        images.join("small.webp"),
        encoded_raster(64, 64, ImageFormat::WebP),
    )
    .expect("write WebP performance fixture");
    let large_png = encoded_raster(1_280, 1_280, ImageFormat::Png);
    assert!(
        large_png.len() >= 4 * 1024 * 1024,
        "large fixture must exercise the four-to-five MiB bucket"
    );
    assert!(
        large_png.len() < LOCAL_IMAGE_MAX_BYTES as usize,
        "large fixture must remain below the product limit"
    );
    fs::write(images.join("near-limit.png"), large_png)
        .expect("write near-limit PNG performance fixture");

    let roots = AllowedRoots::default();
    register_allowed_root(
        &project.canonicalize().expect("canonical probe project"),
        &roots,
    )
    .expect("register local-image performance root");
    ProbeWorkspace {
        _directory: directory,
        document_path: document.to_string_lossy().into_owned(),
        fixtures: vec![
            ProbeFixture {
                fixture_id: "svg-small",
                media_kind: "svg",
                media_type: "image/svg+xml",
                size_bucket: SIZE_BUCKET_UNDER_64_KIB,
                source: "../images/small.svg",
            },
            ProbeFixture {
                fixture_id: "png-small",
                media_kind: "png",
                media_type: "image/png",
                size_bucket: SIZE_BUCKET_UNDER_64_KIB,
                source: "../images/small.png",
            },
            ProbeFixture {
                fixture_id: "jpeg-small",
                media_kind: "jpeg",
                media_type: "image/jpeg",
                size_bucket: SIZE_BUCKET_UNDER_64_KIB,
                source: "../images/small.jpg",
            },
            ProbeFixture {
                fixture_id: "webp-small",
                media_kind: "webp",
                media_type: "image/webp",
                size_bucket: SIZE_BUCKET_UNDER_64_KIB,
                source: "../images/small.webp",
            },
            ProbeFixture {
                fixture_id: "png-near-5mib",
                media_kind: "png",
                media_type: "image/png",
                size_bucket: SIZE_BUCKET_FOUR_TO_FIVE_MIB,
                source: "../images/near-limit.png",
            },
        ],
        roots,
    }
}

fn measure_fixture(
    workspace: &ProbeWorkspace,
    fixture: &ProbeFixture,
    sample_index: usize,
) -> ProbeSample {
    let (result, timings) = probe_local_image_resolve_phases(
        fixture.source,
        &workspace.document_path,
        &workspace.roots,
        None,
    );
    let result = result.expect("resolve fixed local-image performance fixture");
    assert_eq!(result.status, STATUS_RESOLVED);
    assert_eq!(result.media_type.as_deref(), Some(fixture.media_type));
    if fixture.media_kind == "svg" {
        assert_eq!(result.encoding.as_deref(), Some("utf8"));
    } else {
        assert_eq!(result.encoding.as_deref(), Some("base64"));
    }
    black_box(result.content.as_ref().map(String::len));
    black_box(result.resolved_path.as_ref().map(String::len));

    ProbeSample {
        encode_ms: timings.encode_ms,
        file_read_ms: timings.file_read_ms,
        metadata_ms: timings.metadata_ms,
        path_policy_context_ms: timings.path_policy_context_ms,
        sample_index,
        total_ms: timings.total_ms,
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
    let p50 = percentile(&values, 0.50);
    let absolute_deviations = values
        .iter()
        .map(|duration| (duration - p50).abs())
        .collect::<Vec<_>>();
    DurationSummary {
        mad: percentile(&absolute_deviations, 0.50),
        p50,
        p95: percentile(&values, 0.95),
    }
}

fn summarize(samples: &[ProbeSample]) -> PhaseSummaries {
    PhaseSummaries {
        encode_ms: duration_summary(samples, |sample| sample.encode_ms),
        file_read_ms: duration_summary(samples, |sample| sample.file_read_ms),
        metadata_ms: duration_summary(samples, |sample| sample.metadata_ms),
        path_policy_context_ms: duration_summary(samples, |sample| sample.path_policy_context_ms),
        total_ms: duration_summary(samples, |sample| sample.total_ms),
    }
}

fn build_report(run_mode: String) -> ProbeReport {
    assert!(matches!(run_mode.as_str(), "formal" | "confirmation"));
    let workspace = create_probe_workspace();
    let mut samples_by_fixture = vec![Vec::<ProbeSample>::new(); workspace.fixtures.len()];

    for iteration in 0..(WARMUP_COUNT + MEASUREMENT_COUNT) {
        for offset in 0..workspace.fixtures.len() {
            let fixture_index = (iteration + offset) % workspace.fixtures.len();
            let sample = measure_fixture(
                &workspace,
                &workspace.fixtures[fixture_index],
                iteration.saturating_sub(WARMUP_COUNT),
            );
            if iteration >= WARMUP_COUNT {
                samples_by_fixture[fixture_index].push(sample);
            }
        }
    }

    let fixtures = workspace
        .fixtures
        .iter()
        .zip(samples_by_fixture)
        .map(|(fixture, samples)| FixtureReport {
            cache_status: CACHE_STATUS_NOT_APPLICABLE,
            fixture_id: fixture.fixture_id,
            media_kind: fixture.media_kind,
            sample_count: samples.len(),
            size_bucket: fixture.size_bucket,
            status: STATUS_RESOLVED,
            timings_ms: summarize(&samples),
            samples,
        })
        .collect();
    ProbeReport {
        fixtures,
        measurement_count: MEASUREMENT_COUNT,
        run_mode,
        schema_version: 1,
        warmup_count: WARMUP_COUNT,
    }
}

fn assert_duration_summary_is_valid(summary: &DurationSummary) {
    assert!(summary.mad.is_finite() && summary.mad >= 0.0);
    assert!(summary.p50.is_finite() && summary.p50 >= 0.0);
    assert!(summary.p95.is_finite() && summary.p95 >= summary.p50);
}

fn assert_report_is_privacy_safe(report: &ProbeReport) {
    assert_eq!(report.measurement_count, MEASUREMENT_COUNT);
    assert_eq!(report.warmup_count, WARMUP_COUNT);
    assert!(matches!(
        report.run_mode.as_str(),
        "formal" | "confirmation"
    ));
    for fixture in &report.fixtures {
        assert_eq!(fixture.status, STATUS_RESOLVED);
        assert_eq!(fixture.cache_status, CACHE_STATUS_NOT_APPLICABLE);
        assert_eq!(fixture.sample_count, report.measurement_count);
        assert_eq!(fixture.samples.len(), report.measurement_count);
        assert_duration_summary_is_valid(&fixture.timings_ms.path_policy_context_ms);
        assert_duration_summary_is_valid(&fixture.timings_ms.metadata_ms);
        assert_duration_summary_is_valid(&fixture.timings_ms.file_read_ms);
        assert_duration_summary_is_valid(&fixture.timings_ms.encode_ms);
        assert_duration_summary_is_valid(&fixture.timings_ms.total_ms);
        assert!(fixture.samples.iter().all(|sample| {
            sample.path_policy_context_ms.is_finite()
                && sample.path_policy_context_ms >= 0.0
                && sample.metadata_ms.is_finite()
                && sample.metadata_ms >= 0.0
                && sample.file_read_ms.is_finite()
                && sample.file_read_ms >= 0.0
                && sample.encode_ms.is_finite()
                && sample.encode_ms >= 0.0
                && sample.total_ms.is_finite()
                && sample.total_ms >= 0.0
        }));
    }

    let value = serde_json::to_value(report).expect("serialize local-image phase probe");
    let mut string_values = BTreeSet::new();
    let mut field_names = BTreeSet::new();
    fn collect_strings_and_fields(
        value: &serde_json::Value,
        strings: &mut BTreeSet<String>,
        fields: &mut BTreeSet<String>,
    ) {
        match value {
            serde_json::Value::Array(values) => {
                for value in values {
                    collect_strings_and_fields(value, strings, fields);
                }
            }
            serde_json::Value::Object(values) => {
                for (field, value) in values {
                    fields.insert(field.clone());
                    collect_strings_and_fields(value, strings, fields);
                }
            }
            serde_json::Value::String(value) => {
                strings.insert(value.clone());
            }
            _ => {}
        }
    }
    collect_strings_and_fields(&value, &mut string_values, &mut field_names);
    let allowed_strings = BTreeSet::from([
        "formal".to_string(),
        "confirmation".to_string(),
        STATUS_RESOLVED.to_string(),
        CACHE_STATUS_NOT_APPLICABLE.to_string(),
        SIZE_BUCKET_UNDER_64_KIB.to_string(),
        SIZE_BUCKET_FOUR_TO_FIVE_MIB.to_string(),
        "svg-small".to_string(),
        "png-small".to_string(),
        "jpeg-small".to_string(),
        "webp-small".to_string(),
        "png-near-5mib".to_string(),
        "svg".to_string(),
        "png".to_string(),
        "jpeg".to_string(),
        "webp".to_string(),
    ]);
    assert!(
        string_values.is_subset(&allowed_strings),
        "local-image phase report contains an unexpected string value"
    );
    for private_field in [
        "source",
        "path",
        "url",
        "content",
        "base64",
        "resolvedPath",
        "placeholderText",
        "documentPath",
    ] {
        assert!(
            !field_names.contains(private_field),
            "local-image phase report contains a private field"
        );
    }
}

#[test]
fn local_image_phase_probe_uses_the_product_resolver_core() {
    let directory = tempdir().expect("create local-image phase unit fixture");
    let document = directory.path().join("fixture.md");
    let image = directory.path().join("fixture.svg");
    fs::write(&document, "# Fixture\n").expect("write phase unit document");
    fs::write(&image, "<svg xmlns=\"http://www.w3.org/2000/svg\"/>")
        .expect("write phase unit image");
    let roots = AllowedRoots::default();
    register_allowed_root(
        &directory
            .path()
            .canonicalize()
            .expect("canonical unit root"),
        &roots,
    )
    .expect("register phase unit root");

    let expected = resolve_local_image_from_path_with_local_context(
        "fixture.svg",
        &document.to_string_lossy(),
        &roots,
        None,
    )
    .expect("resolve phase unit fixture without recorder");
    let (actual, timings) =
        probe_local_image_resolve_phases("fixture.svg", &document.to_string_lossy(), &roots, None);
    let actual = actual.expect("resolve phase unit fixture with recorder");

    assert_eq!(actual, expected);
    assert!(timings.path_policy_context_ms.is_finite());
    assert!(timings.metadata_ms.is_finite());
    assert!(timings.file_read_ms.is_finite());
    assert!(timings.encode_ms.is_finite());
    assert!(timings.total_ms.is_finite());
    assert!(timings.total_ms >= timings.encode_ms);
}

#[test]
fn local_image_phase_probe_schema_is_minimal_and_privacy_safe() {
    let samples = (0..MEASUREMENT_COUNT)
        .map(|sample_index| ProbeSample {
            encode_ms: 0.4,
            file_read_ms: 0.3,
            metadata_ms: 0.2,
            path_policy_context_ms: 0.1,
            sample_index,
            total_ms: 1.0,
        })
        .collect::<Vec<_>>();
    let report = ProbeReport {
        fixtures: vec![FixtureReport {
            cache_status: CACHE_STATUS_NOT_APPLICABLE,
            fixture_id: "png-small",
            media_kind: "png",
            sample_count: samples.len(),
            size_bucket: SIZE_BUCKET_UNDER_64_KIB,
            status: STATUS_RESOLVED,
            timings_ms: summarize(&samples),
            samples,
        }],
        measurement_count: MEASUREMENT_COUNT,
        run_mode: "formal".to_string(),
        schema_version: 1,
        warmup_count: WARMUP_COUNT,
    };
    assert_report_is_privacy_safe(&report);

    let value = serde_json::to_value(report).expect("serialize local-image phase schema");
    let report_keys = value
        .as_object()
        .expect("local-image phase report object")
        .keys()
        .cloned()
        .collect::<BTreeSet<_>>();
    assert_eq!(
        report_keys,
        BTreeSet::from([
            "fixtures".to_string(),
            "measurementCount".to_string(),
            "runMode".to_string(),
            "schemaVersion".to_string(),
            "warmupCount".to_string(),
        ])
    );
}

#[test]
#[ignore = "prints the release-like local-image phase performance report"]
fn local_image_phase_release_probe_prints_report() {
    let run_mode = env::var("SVARD_LOCAL_IMAGE_PHASE_PROBE_RUN")
        .expect("SVARD_LOCAL_IMAGE_PHASE_PROBE_RUN must be formal or confirmation");
    let report = build_report(run_mode);
    assert_report_is_privacy_safe(&report);
    println!(
        "{}",
        serde_json::to_string(&report).expect("serialize local-image phase report")
    );
}
