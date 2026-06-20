use super::*;
use crate::plantuml_external::{render_external_plantuml_with_cache_dir, test_external_plantuml};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[cfg(unix)]
fn write_executable(dir: &Path, name: &str, body: &str) -> PathBuf {
    let path = dir.join(name);
    fs::write(&path, body).expect("write executable");
    let mut permissions = fs::metadata(&path).expect("metadata").permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).expect("permissions");
    path
}

#[cfg(unix)]
#[test]
fn external_plantuml_renders_svg_and_uses_cache() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-ok.sh",
        "#!/bin/sh\ncat >/dev/null\nprintf '<svg xmlns=\"http://www.w3.org/2000/svg\"><text>ok</text></svg>'\n",
    );
    let cache_dir = temp.path().join("cache");
    let input = ExternalPlantUmlRenderInput {
        source: "@startuml\nA -> B\n@enduml\n".to_string(),
        theme: "light".to_string(),
        timeout_ms: 5_000,
        binary_path: Some(binary.to_string_lossy().to_string()),
        dot_path: None,
    };

    let first =
        render_external_plantuml_with_cache_dir(input.clone(), &cache_dir).expect("first render");
    assert_eq!(first.status, "rendered");
    assert_eq!(
        first
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("miss")
    );

    let second = render_external_plantuml_with_cache_dir(input, &cache_dir).expect("cache render");
    assert_eq!(second.status, "rendered");
    assert_eq!(
        second
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("hit")
    );
}

#[cfg(unix)]
#[test]
fn external_plantuml_rejects_non_svg_without_exposing_source_or_path() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-text.sh",
        "#!/bin/sh\ncat >/dev/null\nprintf 'not svg'\n",
    );
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\nsecret-token -> Bob\n@enduml\n".to_string(),
            theme: "dark".to_string(),
            timeout_ms: 1_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "error");
    let diagnostics = result.diagnostics.join("\n");
    assert!(diagnostics.contains("did not return SVG"));
    assert!(!diagnostics.contains("secret-token"));
    assert!(!diagnostics.contains(temp.path().to_string_lossy().as_ref()));
}

#[cfg(unix)]
#[test]
fn external_plantuml_rejects_oversized_stdout() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-large.sh",
        "#!/bin/sh\ncat >/dev/null\nprintf '<svg>'\nhead -c 2097153 /dev/zero | tr '\\0' 'a'\nprintf '</svg>'\n",
    );
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\nA -> B\n@enduml\n".to_string(),
            theme: "light".to_string(),
            timeout_ms: 5_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "error");
    assert!(result
        .diagnostics
        .join("\n")
        .contains("exceeded the size limit"));
}

#[cfg(unix)]
#[test]
fn external_plantuml_test_reports_missing_binary_safely() {
    let result = test_external_plantuml(ExternalPlantUmlTestInput {
        timeout_ms: 1_000,
        binary_path: Some("/path/that/does/not/exist".to_string()),
        dot_path: None,
    });
    assert_eq!(
        result.expect_err("missing binary should fail"),
        "External PlantUML binary was not found."
    );
}

#[test]
fn external_plantuml_render_reports_missing_binary_as_diagnostic() {
    let temp = tempdir().expect("tempdir");
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\nA -> B\n@enduml\n".to_string(),
            theme: "light".to_string(),
            timeout_ms: 1_000,
            binary_path: Some("/path/that/does/not/exist".to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render result");

    assert_eq!(result.status, "error");
    assert_eq!(
        result.diagnostics,
        vec!["External PlantUML binary was not found.".to_string()]
    );
}

#[test]
fn external_plantuml_renders_with_real_binary_when_configured() {
    let Some(binary_path) = real_plantuml_binary_path() else {
        eprintln!(
            "set SVARD_REAL_PLANTUML_BINARY or place binary at .local-tools/plantuml/plantuml-headless to run real external PlantUML test"
        );
        return;
    };
    let temp = tempdir().expect("tempdir");
    let probe = test_external_plantuml(ExternalPlantUmlTestInput {
        timeout_ms: 5_000,
        binary_path: Some(binary_path.to_string_lossy().to_string()),
        dot_path: None,
    })
    .expect("real binary probe");
    assert_eq!(probe.status, "rendered");
    assert!(probe.svg.as_deref().unwrap_or("").contains("<svg"));

    let input = ExternalPlantUmlRenderInput {
        source: "@startuml\nAlice -> Bob: real binary\n@enduml\n".to_string(),
        theme: "light".to_string(),
        timeout_ms: 5_000,
        binary_path: Some(binary_path.to_string_lossy().to_string()),
        dot_path: None,
    };

    let first = render_external_plantuml_with_cache_dir(input.clone(), &temp.path().join("cache"))
        .expect("real binary render");
    assert_eq!(first.status, "rendered");
    assert!(first.svg.as_deref().unwrap_or("").contains("<svg"));
    assert_eq!(
        first
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("miss")
    );

    let second = render_external_plantuml_with_cache_dir(input, &temp.path().join("cache"))
        .expect("real binary cache render");
    assert_eq!(second.status, "rendered");
    assert_eq!(
        second
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("hit")
    );
}

fn real_plantuml_binary_path() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("SVARD_REAL_PLANTUML_BINARY") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Some(path);
        }
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let default_path = manifest_dir
        .parent()
        .unwrap_or(&manifest_dir)
        .join(".local-tools")
        .join("plantuml")
        .join("plantuml-headless");
    default_path.is_file().then_some(default_path)
}
