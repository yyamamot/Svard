use super::*;

fn key() -> String {
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
}

fn key_with_prefix(prefix: &str) -> String {
    format!("{prefix:0<64}")
}

fn set_old_mtime(path: &Path, seconds: i64) {
    filetime::set_file_mtime(path, filetime::FileTime::from_unix_time(seconds, 0))
        .expect("set mtime");
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
fn plantuml_cache_prunes_oldest_entries_after_write() {
    let cache_dir = tempdir().expect("temp dir");
    let old_key = key_with_prefix("a");
    let recent_key = key_with_prefix("b");
    let new_key = key_with_prefix("c");

    write_plantuml_svg_cache_dir(
        PlantUmlSvgCacheWriteInput {
            key: old_key.clone(),
            svg: "<svg>old</svg>".to_string(),
            metadata: None,
        },
        cache_dir.path(),
    )
    .expect("write old");
    write_plantuml_svg_cache_dir(
        PlantUmlSvgCacheWriteInput {
            key: recent_key.clone(),
            svg: "<svg>recent</svg>".to_string(),
            metadata: None,
        },
        cache_dir.path(),
    )
    .expect("write recent");
    set_old_mtime(&cache_dir.path().join(format!("{old_key}.svg")), 1);
    set_old_mtime(&cache_dir.path().join(format!("{recent_key}.svg")), 2);

    write_plantuml_svg_cache_dir_with_limit(
        PlantUmlSvgCacheWriteInput {
            key: new_key.clone(),
            svg: "<svg>new</svg>".to_string(),
            metadata: None,
        },
        cache_dir.path(),
        32,
    )
    .expect("write with prune");

    assert!(!cache_dir.path().join(format!("{old_key}.svg")).exists());
    assert!(cache_dir.path().join(format!("{new_key}.svg")).exists());
}

#[test]
fn plantuml_cache_hit_updates_lru_timestamp() {
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
    let cache_file = cache_dir.path().join(format!("{}.svg", key()));
    set_old_mtime(&cache_file, 1);

    read_plantuml_svg_cache_dir(PlantUmlSvgCacheReadInput { key: key() }, cache_dir.path())
        .expect("read cache");

    let modified = fs::metadata(&cache_file)
        .expect("metadata")
        .modified()
        .expect("modified");
    assert!(modified > std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1));
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
