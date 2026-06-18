use super::*;

fn set_old_mtime(path: &Path, seconds: i64) {
    filetime::set_file_mtime(path, filetime::FileTime::from_unix_time(seconds, 0))
        .expect("set mtime");
}

#[test]
fn disabled_kroki_returns_diagnostic_result() {
    let cache_dir = tempdir().expect("temp dir");
    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: "@startuml\n@enduml".to_string(),
            config: default_config().kroki,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "disabled");
}

#[test]
fn public_kroki_mode_requires_confirmation() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Public;
    config.endpoint_url = Some(PUBLIC_KROKI_ENDPOINT.to_string());

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: "@startuml\n@enduml".to_string(),
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "error");
    assert!(result.message.unwrap().contains("confirmation"));
}

#[test]
fn clear_kroki_cache_removes_cache_directory() {
    let cache_dir = tempdir().expect("temp dir");
    let cache_file = cache_dir.path().join("sample.svg");
    fs::write(&cache_file, "<svg />").expect("write cache");

    clear_kroki_cache_dir(cache_dir.path()).expect("clear cache");

    assert!(!cache_file.exists());
}

#[test]
fn kroki_cache_prunes_oldest_entries() {
    let cache_dir = tempdir().expect("temp dir");
    let old_file = cache_dir.path().join("old.svg");
    let recent_file = cache_dir.path().join("recent.svg");
    let new_file = cache_dir.path().join("new.svg");
    fs::write(&old_file, "old-cache-entry").expect("write old");
    fs::write(&recent_file, "recent-cache-entry").expect("write recent");
    fs::write(&new_file, "new-cache-entry").expect("write new");
    set_old_mtime(&old_file, 1);
    set_old_mtime(&recent_file, 2);
    set_old_mtime(&new_file, 3);

    prune_cache_dir(cache_dir.path(), 34).expect("prune cache");

    assert!(!old_file.exists());
    assert!(recent_file.exists());
    assert!(new_file.exists());
}

#[test]
fn remote_kroki_allows_lan_endpoint_without_confirmation() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some("http://192.168.1.10:8000".to_string());
    config.cache_enabled = true;
    let source = "@startuml\n@enduml".to_string();
    let cache_file = cache_dir.path().join(cache_file_name(
        "plantuml",
        "svg",
        &source,
        "http://192.168.1.10:8000",
    ));
    fs::write(&cache_file, "<svg />").expect("write cache");

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source,
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "rendered");
    assert_eq!(result.cache_status.as_deref(), Some("hit"));
}

#[test]
fn kroki_cache_hit_updates_lru_timestamp() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some("http://127.0.0.1:8000".to_string());
    config.cache_enabled = true;
    let source = "@startuml\n@enduml".to_string();
    let cache_file = cache_dir.path().join(cache_file_name(
        "plantuml",
        "svg",
        &source,
        "http://127.0.0.1:8000",
    ));
    fs::write(&cache_file, "<svg />").expect("write cache");
    set_old_mtime(&cache_file, 1);

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source,
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.cache_status.as_deref(), Some("hit"));
    let modified = fs::metadata(&cache_file)
        .expect("metadata")
        .modified()
        .expect("modified");
    assert!(modified > std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1));
}

#[test]
fn kroki_validation_rejects_unsupported_inputs() {
    assert!(validate_kroki_mode("custom").is_err());
    assert!(validate_kroki_output_format("../svg").is_err());
    assert!(validate_kroki_diagram_type("../plantuml").is_err());
    assert!(validate_kroki_timeout(0).is_err());
    assert!(validate_kroki_body_limit(0).is_err());
}

#[test]
fn kroki_endpoint_validation_rejects_unsafe_urls() {
    assert!(validate_kroki_endpoint("file:///tmp/kroki").is_err());
    assert!(validate_kroki_endpoint("http://user:pass@127.0.0.1:8000").is_err());
    assert!(validate_kroki_endpoint("http://192.168.1.10:8000").is_ok());
    assert!(validate_kroki_endpoint("http://127.0.0.1:8000").is_ok());
    assert!(validate_kroki_endpoint("https://example.com").is_ok());
}

#[test]
fn kroki_cache_hit_does_not_expose_cache_path() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some("http://127.0.0.1:8000".to_string());
    config.output_format = KrokiOutputFormat::Svg;
    let source = "@startuml\n@enduml".to_string();
    let cache_file = cache_dir.path().join(cache_file_name(
        "plantuml",
        "svg",
        &source,
        "http://127.0.0.1:8000",
    ));
    fs::write(&cache_file, "<svg />").expect("write cache");

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source,
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "rendered");
    assert_eq!(result.cache_status.as_deref(), Some("hit"));
    assert_eq!(result.artifact_url, None);
}
