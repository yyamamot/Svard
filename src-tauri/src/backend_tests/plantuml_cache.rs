use super::*;

fn key() -> String {
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
}

#[test]
fn plantuml_cache_reports_miss_for_empty_cache() {
    let cache_dir = tempdir().expect("temp dir");
    let result =
        read_plantuml_svg_cache_dir(PlantUmlSvgCacheReadInput { key: key() }, cache_dir.path())
            .expect("read cache");

    assert_eq!(result.status, "miss");
    assert_eq!(result.svg, None);
}

#[test]
fn plantuml_cache_writes_and_reads_svg() {
    let cache_dir = tempdir().expect("temp dir");
    let write = write_plantuml_svg_cache_dir(
        PlantUmlSvgCacheWriteInput {
            key: key(),
            svg: "<svg></svg>".to_string(),
            metadata: None,
        },
        cache_dir.path(),
    )
    .expect("write cache");

    assert_eq!(write.status, "written");

    let result =
        read_plantuml_svg_cache_dir(PlantUmlSvgCacheReadInput { key: key() }, cache_dir.path())
            .expect("read cache");

    assert_eq!(result.status, "hit");
    assert_eq!(result.svg.as_deref(), Some("<svg></svg>"));
}

#[test]
fn plantuml_cache_rejects_path_traversal_key() {
    let cache_dir = tempdir().expect("temp dir");
    let result = read_plantuml_svg_cache_dir(
        PlantUmlSvgCacheReadInput {
            key: "../private".to_string(),
        },
        cache_dir.path(),
    );

    assert!(result.is_err());
}

#[test]
fn plantuml_cache_skips_oversized_svg() {
    let cache_dir = tempdir().expect("temp dir");
    let write = write_plantuml_svg_cache_dir(
        PlantUmlSvgCacheWriteInput {
            key: key(),
            svg: "x".repeat(2 * 1024 * 1024 + 1),
            metadata: None,
        },
        cache_dir.path(),
    )
    .expect("write cache");

    assert_eq!(write.status, "skipped");
    assert!(!cache_dir.path().join(format!("{}.svg", key())).exists());
}

#[test]
fn clear_plantuml_cache_removes_directory() {
    let cache_dir = tempdir().expect("temp dir");
    write_plantuml_svg_cache_dir(
        PlantUmlSvgCacheWriteInput {
            key: key(),
            svg: "<svg></svg>".to_string(),
            metadata: None,
        },
        cache_dir.path(),
    )
    .expect("write cache");

    clear_plantuml_svg_cache_dir(cache_dir.path()).expect("clear cache");

    assert!(!cache_dir.path().join(format!("{}.svg", key())).exists());
}
