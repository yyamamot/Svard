use super::*;
use std::io::Read;
use std::net::TcpListener;
use std::thread;

fn set_old_mtime(path: &Path, seconds: i64) {
    filetime::set_file_mtime(path, filetime::FileTime::from_unix_time(seconds, 0))
        .expect("set mtime");
}

fn spawn_fake_kroki_server(status: &str, body: Vec<u8>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind fake Kroki server");
    let endpoint = format!("http://{}", listener.local_addr().expect("local addr"));
    let status = status.to_string();
    thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            let headers = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(headers.as_bytes());
            let _ = stream.write_all(&body);
        }
    });
    endpoint
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
fn public_kroki_requires_confirmation_even_when_config_disables_remote_confirmation() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Public;
    config.endpoint_url = Some(PUBLIC_KROKI_ENDPOINT.to_string());
    config.require_remote_confirmation = false;

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
fn remote_kroki_requires_confirmation_by_default() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some("http://127.0.0.1:8000".to_string());
    let source = "@startuml\nAlice -> Bob: private\n@enduml".to_string();

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: source.clone(),
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "error");
    let message = result.message.unwrap();
    assert!(message.contains("confirmation"));
    assert!(!message.contains("127.0.0.1"));
    assert!(!message.contains(&source));
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
    config.require_remote_confirmation = false;
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
fn kroki_endpoint_errors_are_redacted() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some("http://user:pass@127.0.0.1:8000/private".to_string());
    config.require_remote_confirmation = false;
    let source = "@startuml\nAlice -> Bob: private\n@enduml".to_string();

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: source.clone(),
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "error");
    let message = result.message.unwrap();
    assert!(!message.contains("user:pass"));
    assert!(!message.contains("127.0.0.1"));
    assert!(!message.contains(&source));
}

#[test]
fn kroki_http_error_does_not_expose_endpoint_or_source() {
    let cache_dir = tempdir().expect("temp dir");
    let endpoint = spawn_fake_kroki_server("500 Internal Server Error", b"private error".to_vec());
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some(endpoint.clone());
    config.require_remote_confirmation = false;
    let source = "@startuml\nAlice -> Bob: private\n@enduml".to_string();

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: source.clone(),
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "error");
    let message = result.message.unwrap();
    assert!(message.contains("HTTP 500"));
    assert!(!message.contains(&endpoint));
    assert!(!message.contains(&source));
    assert!(!message.contains("private error"));
}

#[test]
fn kroki_rejects_non_utf8_svg_response_without_source_or_endpoint() {
    let cache_dir = tempdir().expect("temp dir");
    let endpoint = spawn_fake_kroki_server("200 OK", vec![0xff, 0xfe, 0xfd]);
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some(endpoint.clone());
    config.require_remote_confirmation = false;
    config.output_format = KrokiOutputFormat::Svg;
    let source = "@startuml\nAlice -> Bob: private\n@enduml".to_string();

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: source.clone(),
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "error");
    let message = result.message.unwrap();
    assert!(message.contains("not valid UTF-8"));
    assert!(!message.contains(&endpoint));
    assert!(!message.contains(&source));
}

#[test]
fn kroki_rejects_oversized_response_without_cache_write() {
    let cache_dir = tempdir().expect("temp dir");
    let endpoint = spawn_fake_kroki_server("200 OK", vec![b'a'; 2 * 1024 * 1024 + 1]);
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some(endpoint.clone());
    config.require_remote_confirmation = false;
    config.output_format = KrokiOutputFormat::Svg;
    let source = "@startuml\nAlice -> Bob: private\n@enduml".to_string();

    let result = render_diagram_with_cache_dir(
        KrokiRequest {
            diagram_type: "plantuml".to_string(),
            source: source.clone(),
            config,
            confirmed_remote_send: None,
        },
        cache_dir.path(),
    )
    .expect("result");

    assert_eq!(result.status, "error");
    assert_eq!(result.cache_status.as_deref(), Some("not-written"));
    let message = result.message.unwrap();
    assert!(message.contains("response exceeds"));
    assert!(!message.contains(&endpoint));
    assert!(!message.contains(&source));
    assert_eq!(
        fs::read_dir(cache_dir.path()).expect("cache dir").count(),
        0
    );
}

#[test]
fn kroki_cache_hit_updates_lru_timestamp() {
    let cache_dir = tempdir().expect("temp dir");
    let mut config = default_config().kroki;
    config.mode = KrokiMode::Remote;
    config.endpoint_url = Some("http://127.0.0.1:8000".to_string());
    config.require_remote_confirmation = false;
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
    config.require_remote_confirmation = false;
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
