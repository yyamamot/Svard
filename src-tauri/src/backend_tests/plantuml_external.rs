use super::*;
use crate::plantuml_external::{
    render_external_plantuml_with_cache_dir, test_external_plantuml,
    trust_external_plantuml_binary_for_test,
};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[cfg(unix)]
fn write_executable(dir: &Path, name: &str, body: &str) -> PathBuf {
    let path = write_unvalidated_executable(dir, name, body);
    trust_external_plantuml_binary_for_test(&path);
    path
}

#[cfg(unix)]
fn write_unvalidated_executable(dir: &Path, name: &str, body: &str) -> PathBuf {
    let path = dir.join(name);
    fs::write(&path, body).expect("write executable");
    let mut permissions = fs::metadata(&path).expect("metadata").permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).expect("permissions");
    path
}

#[cfg(unix)]
fn sandbox_aware_script(version: &str, profile_marker: &str) -> String {
    format!(
        r#"#!/bin/sh
if [ "$1" = "-version" ]; then
  printf '%s\n' 'PlantUML version {version} / test'
  exit 0
fi
input=$(/bin/cat)
case "$input" in
  *SVARD_PROFILE_*)
    printf '<svg xmlns="http://www.w3.org/2000/svg"><text>{profile_marker}</text></svg>'
    ;;
  *)
    printf '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>'
    ;;
esac
"#
    )
}

#[cfg(unix)]
fn external_render_input(binary: &Path) -> ExternalPlantUmlRenderInput {
    ExternalPlantUmlRenderInput {
        source: "@startuml\nA -> B\n@enduml\n".to_string(),
        theme: "light".to_string(),
        timeout_ms: 5_000,
        binary_path: Some(binary.to_string_lossy().to_string()),
        dot_path: None,
    }
}

#[cfg(unix)]
#[test]
fn external_plantuml_clears_inherited_environment_and_forces_sandbox() {
    let temp = tempdir().expect("tempdir");
    let dot = temp.path().join("dot");
    fs::write(&dot, "synthetic dot").expect("write dot");
    let binary = write_unvalidated_executable(
        temp.path(),
        "plantuml-sandbox-env.sh",
        r#"#!/bin/sh
if [ "$1" = "-version" ]; then
  printf '%s\n' 'PlantUML version 1.2020.11 / test'
  exit 0
fi
input=$(/bin/cat)
case "$input" in
  *SVARD_PROFILE_*)
    if [ "$PLANTUML_SECURITY_PROFILE" = "SANDBOX" ] &&
       [ "$PLANTUML_LIMIT_SIZE" = "4096" ] &&
       [ -n "$GRAPHVIZ_DOT" ] &&
       [ -z "${HOME+x}" ] &&
       [ -z "${HTTPS_PROXY+x}" ] &&
       [ -z "${JAVA_TOOL_OPTIONS+x}" ] &&
       [ -z "${PLANTUML_CONFIG_FILE+x}" ]; then
      printf '<svg xmlns="http://www.w3.org/2000/svg"><text>SVARD_PROFILE_SANDBOX</text></svg>'
    else
      printf '<svg xmlns="http://www.w3.org/2000/svg"><text>SVARD_PROFILE_REJECTED</text></svg>'
    fi
    ;;
  *)
    printf '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>'
    ;;
esac
"#,
    );
    let mut input = external_render_input(&binary);
    input.dot_path = Some(dot.to_string_lossy().to_string());

    let result =
        render_external_plantuml_with_cache_dir(input, &temp.path().join("cache")).expect("render");

    assert_eq!(result.status, "rendered");
}

#[cfg(unix)]
#[test]
fn external_plantuml_rejects_old_malformed_and_unverified_profiles() {
    let temp = tempdir().expect("tempdir");
    let cases = [
        (
            "plantuml-old.sh",
            sandbox_aware_script("1.2020.10", "SVARD_PROFILE_SANDBOX"),
        ),
        (
            "plantuml-malformed.sh",
            "#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then printf 'unknown\\n'; exit 0; fi\nprintf '<svg></svg>'\n".to_string(),
        ),
        (
            "plantuml-wrong-profile.sh",
            sandbox_aware_script("1.2020.11", "SVARD_PROFILE_LEGACY"),
        ),
    ];

    for (name, script) in cases {
        let binary = write_unvalidated_executable(temp.path(), name, &script);
        let cache_dir = temp.path().join(format!("cache-{name}"));
        let result =
            render_external_plantuml_with_cache_dir(external_render_input(&binary), &cache_dir)
                .expect("render");
        assert_eq!(result.status, "error");
        assert_eq!(
            result.diagnostics,
            vec!["External PlantUML sandbox validation failed.".to_string()]
        );
        assert!(result.svg.is_none());
        assert!(!cache_dir.exists());
    }
}

#[cfg(unix)]
#[test]
fn external_plantuml_bounds_sandbox_version_probe_output() {
    let temp = tempdir().expect("tempdir");
    let binary = write_unvalidated_executable(
        temp.path(),
        "plantuml-version-oversized.sh",
        r#"#!/bin/sh
if [ "$1" = "-version" ]; then
  /usr/bin/head -c 65537 /dev/zero
  exit 0
fi
printf '<svg></svg>'
"#,
    );

    let result = render_external_plantuml_with_cache_dir(
        external_render_input(&binary),
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "error");
    assert_eq!(
        result.diagnostics,
        vec!["External PlantUML sandbox validation failed.".to_string()]
    );
}

#[cfg(unix)]
#[test]
fn external_plantuml_bounds_sandbox_validation_with_the_request_deadline() {
    let temp = tempdir().expect("tempdir");
    let binary = write_unvalidated_executable(
        temp.path(),
        "plantuml-version-timeout.sh",
        "#!/bin/sh\n/bin/sleep 2\nprintf 'PlantUML version 1.2026.4 / test\\n'\n",
    );
    let mut input = external_render_input(&binary);
    input.timeout_ms = 1_000;
    let started = std::time::Instant::now();

    let result =
        render_external_plantuml_with_cache_dir(input, &temp.path().join("cache")).expect("render");

    assert_eq!(result.status, "error");
    assert_eq!(
        result.diagnostics,
        vec!["External PlantUML sandbox validation failed.".to_string()]
    );
    assert!(
        started.elapsed() < std::time::Duration::from_millis(1_500),
        "sandbox validation should share the configured request deadline"
    );
}

#[cfg(unix)]
#[test]
fn external_plantuml_rejects_profile_probe_timeout_and_oversized_output() {
    let temp = tempdir().expect("tempdir");
    let cases = [
        (
            "plantuml-profile-timeout.sh",
            r#"#!/bin/sh
if [ "$1" = "-version" ]; then
  printf '%s\n' 'PlantUML version 1.2026.4 / test'
  exit 0
fi
/bin/sleep 2
printf '<svg><text>SVARD_PROFILE_SANDBOX</text></svg>'
"#,
            1_000,
        ),
        (
            "plantuml-profile-oversized.sh",
            r#"#!/bin/sh
if [ "$1" = "-version" ]; then
  printf '%s\n' 'PlantUML version 1.2026.4 / test'
  exit 0
fi
printf '<svg><text>SVARD_PROFILE_SANDBOX</text>'
/usr/bin/head -c 2097153 /dev/zero
printf '</svg>'
"#,
            5_000,
        ),
    ];

    for (name, script, timeout_ms) in cases {
        let binary = write_unvalidated_executable(temp.path(), name, script);
        let mut input = external_render_input(&binary);
        input.timeout_ms = timeout_ms;
        let result = render_external_plantuml_with_cache_dir(
            input,
            &temp.path().join(format!("cache-{name}")),
        )
        .expect("render");

        assert_eq!(result.status, "error");
        assert_eq!(
            result.diagnostics,
            vec!["External PlantUML sandbox validation failed.".to_string()]
        );
        assert!(result.svg.is_none());
    }
}

#[cfg(unix)]
#[test]
fn external_plantuml_test_uses_the_same_sandbox_validation() {
    let temp = tempdir().expect("tempdir");
    let binary = write_unvalidated_executable(
        temp.path(),
        "plantuml-test-wrong-profile.sh",
        &sandbox_aware_script("1.2026.4", "SVARD_PROFILE_INTERNET"),
    );

    let error = test_external_plantuml(ExternalPlantUmlTestInput {
        timeout_ms: 5_000,
        binary_path: Some(binary.to_string_lossy().to_string()),
        dot_path: None,
    })
    .expect_err("profile mismatch should fail");

    assert_eq!(error, "External PlantUML sandbox validation failed.");
    assert!(!error.contains(temp.path().to_string_lossy().as_ref()));
}

#[cfg(unix)]
#[test]
fn external_plantuml_revalidates_after_the_binary_changes() {
    let temp = tempdir().expect("tempdir");
    let binary = write_unvalidated_executable(
        temp.path(),
        "plantuml-updated.sh",
        &sandbox_aware_script("1.2020.10", "SVARD_PROFILE_SANDBOX"),
    );
    let first = render_external_plantuml_with_cache_dir(
        external_render_input(&binary),
        &temp.path().join("cache"),
    )
    .expect("first render");
    assert_eq!(first.status, "error");

    fs::write(
        &binary,
        format!(
            "{}\n# changed binary identity\n",
            sandbox_aware_script("1.2026.4", "SVARD_PROFILE_SANDBOX")
        ),
    )
    .expect("replace binary");
    let second = render_external_plantuml_with_cache_dir(
        external_render_input(&binary),
        &temp.path().join("cache"),
    )
    .expect("second render");

    assert_eq!(second.status, "rendered");
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
            timeout_ms: 5_000,
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
fn external_plantuml_test_rejects_oversized_stdout() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-test-large.sh",
        "#!/bin/sh\ncat >/dev/null\nprintf '<svg>'\nhead -c 2097153 /dev/zero | tr '\\0' 'a'\nprintf '</svg>'\n",
    );
    let result = test_external_plantuml(ExternalPlantUmlTestInput {
        timeout_ms: 5_000,
        binary_path: Some(binary.to_string_lossy().to_string()),
        dot_path: None,
    })
    .expect("test probe");

    assert_eq!(result.status, "error");
    assert!(result.svg.is_none());
    assert!(result
        .diagnostics
        .join("\n")
        .contains("exceeded the size limit"));
}

#[cfg(unix)]
#[test]
fn external_plantuml_error_does_not_expose_stderr_source_or_paths() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-stderr.sh",
        "#!/bin/sh\ncat >/dev/null\nprintf '%s\\n' 'stderr contained synthetic-secret and /synthetic/private/path' >&2\nexit 2\n",
    );
    let source = "@startuml\nsynthetic-secret -> Bob\n@enduml\n";
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: source.to_string(),
            theme: "light".to_string(),
            timeout_ms: 5_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "error");
    let diagnostics = result.diagnostics.join("\n");
    assert!(diagnostics.contains("returned an error"));
    assert!(!diagnostics.contains("synthetic-secret"));
    assert!(!diagnostics.contains("/synthetic/private/path"));
    assert!(!diagnostics.contains(temp.path().to_string_lossy().as_ref()));
}

#[cfg(unix)]
#[test]
fn external_plantuml_timeout_diagnostic_is_generic() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-timeout.sh",
        "#!/bin/sh\ncat >/dev/null\nsleep 2\nprintf '<svg></svg>'\n",
    );
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\nsynthetic-timeout-source -> Bob\n@enduml\n".to_string(),
            theme: "light".to_string(),
            timeout_ms: 1_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "timeout");
    let diagnostics = result.diagnostics.join("\n");
    assert!(diagnostics.contains("timed out"));
    assert!(!diagnostics.contains("synthetic-timeout-source"));
    assert!(!diagnostics.contains(temp.path().to_string_lossy().as_ref()));
}

#[cfg(unix)]
#[test]
fn external_plantuml_timeout_covers_blocked_stdin_writer() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-no-stdin-read.sh",
        "#!/bin/sh\nsleep 2\nprintf '<svg></svg>'\n",
    );
    let large_source = format!("@startuml\n{}\n@enduml\n", "A -> B: x\n".repeat(400_000));
    let started = std::time::Instant::now();
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: large_source,
            theme: "light".to_string(),
            timeout_ms: 1_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "timeout");
    assert!(
        started.elapsed() < std::time::Duration::from_millis(2_500),
        "blocked stdin writer should not bypass external PlantUML timeout"
    );
}

#[cfg(unix)]
#[test]
fn external_plantuml_terminates_descendants_that_inherit_output_pipes() {
    let temp = tempdir().expect("tempdir");
    let descendant_pid_file = temp.path().join("descendant.pid");
    let binary = write_executable(
        temp.path(),
        "plantuml-inherited-stdout.sh",
        &format!(
            "#!/bin/sh\n(/bin/sleep 30) &\nprintf '%s' \"$!\" > '{}'\nprintf '<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>'\n",
            descendant_pid_file.display()
        ),
    );
    let started = std::time::Instant::now();
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

    assert_eq!(result.status, "rendered");
    assert!(
        started.elapsed() < std::time::Duration::from_millis(2_500),
        "process-tree cleanup should close inherited pipes within the request deadline"
    );
    let descendant_pid: i32 = fs::read_to_string(&descendant_pid_file)
        .expect("read descendant pid")
        .parse()
        .expect("parse descendant pid");
    let exited = (0..50).any(|_| {
        let result = unsafe { libc::kill(descendant_pid, 0) };
        if result != 0 && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH) {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
        false
    });
    assert!(
        exited,
        "external PlantUML descendants must not outlive the request"
    );
}

#[cfg(unix)]
#[test]
fn external_plantuml_non_executable_diagnostic_is_generic() {
    let temp = tempdir().expect("tempdir");
    let binary = temp.path().join("plantuml-not-executable.sh");
    fs::write(&binary, "#!/bin/sh\nprintf '<svg></svg>'\n").expect("write file");
    let mut permissions = fs::metadata(&binary).expect("metadata").permissions();
    permissions.set_mode(0o644);
    fs::set_permissions(&binary, permissions).expect("permissions");
    trust_external_plantuml_binary_for_test(&binary);

    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\nsynthetic-non-exec-source -> Bob\n@enduml\n".to_string(),
            theme: "light".to_string(),
            timeout_ms: 1_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "error");
    let diagnostics = result.diagnostics.join("\n");
    assert!(diagnostics.contains("Failed to start external PlantUML binary"));
    assert!(!diagnostics.contains("synthetic-non-exec-source"));
    assert!(!diagnostics.contains(temp.path().to_string_lossy().as_ref()));
}

#[cfg(unix)]
#[test]
fn external_plantuml_invalid_dot_path_diagnostic_is_generic() {
    let temp = tempdir().expect("tempdir");
    let binary = write_executable(
        temp.path(),
        "plantuml-ok.sh",
        "#!/bin/sh\ncat >/dev/null\nprintf '<svg></svg>'\n",
    );
    let result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\nsynthetic-dot-source -> Bob\n@enduml\n".to_string(),
            theme: "light".to_string(),
            timeout_ms: 1_000,
            binary_path: Some(binary.to_string_lossy().to_string()),
            dot_path: Some(
                temp.path()
                    .join("missing-dot")
                    .to_string_lossy()
                    .to_string(),
            ),
        },
        &temp.path().join("cache"),
    )
    .expect("render");

    assert_eq!(result.status, "error");
    assert_eq!(
        result.diagnostics,
        vec!["External Graphviz dot path was not found.".to_string()]
    );
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
        timeout_ms: 10_000,
        binary_path: Some(binary_path.to_string_lossy().to_string()),
        dot_path: None,
    })
    .expect("real binary probe");
    assert_eq!(probe.status, "rendered");
    assert!(probe.svg.as_deref().unwrap_or("").contains("<svg"));

    let input = ExternalPlantUmlRenderInput {
        source: "@startuml\nAlice -> Bob: real binary\n@enduml\n".to_string(),
        theme: "light".to_string(),
        timeout_ms: 10_000,
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

#[test]
fn external_plantuml_real_binary_blocks_file_network_and_environment_access() {
    let Some(binary_path) = real_plantuml_binary_path() else {
        eprintln!(
            "set SVARD_REAL_PLANTUML_BINARY or place binary at .local-tools/plantuml/plantuml-headless to run real external PlantUML sandbox test"
        );
        return;
    };
    let temp = tempdir().expect("tempdir");
    let sentinel = temp.path().join("sandbox-sentinel.puml");
    fs::write(&sentinel, "Alice -> Bob : SYNTHETIC_SENTINEL\n").expect("write sentinel");
    let file_source = format!(
        "@startuml\n!include {}\nAlice -> Bob : after\n@enduml\n",
        sentinel.to_string_lossy()
    );
    let file_result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: file_source,
            theme: "light".to_string(),
            timeout_ms: 5_000,
            binary_path: Some(binary_path.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("file-cache"),
    )
    .expect("file probe");
    assert_eq!(file_result.status, "error");
    assert!(file_result.svg.is_none());
    assert!(!file_result
        .diagnostics
        .join("\n")
        .contains("SYNTHETIC_SENTINEL"));

    let home = std::env::var("HOME").unwrap_or_default();
    let environment_result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: "@startuml\ntitle ENV_%getenv(\"HOME\")\nAlice -> Bob\n@enduml\n".to_string(),
            theme: "light".to_string(),
            timeout_ms: 5_000,
            binary_path: Some(binary_path.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("environment-cache"),
    )
    .expect("environment probe");
    assert_eq!(environment_result.status, "rendered");
    if !home.is_empty() {
        assert!(!environment_result
            .svg
            .as_deref()
            .unwrap_or("")
            .contains(&home));
    }

    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind loopback probe");
    listener
        .set_nonblocking(true)
        .expect("set nonblocking listener");
    let address = listener.local_addr().expect("loopback address");
    let network_result = render_external_plantuml_with_cache_dir(
        ExternalPlantUmlRenderInput {
            source: format!(
                "@startuml\n!includeurl http://{address}/synthetic.puml\nAlice -> Bob\n@enduml\n"
            ),
            theme: "light".to_string(),
            timeout_ms: 2_000,
            binary_path: Some(binary_path.to_string_lossy().to_string()),
            dot_path: None,
        },
        &temp.path().join("network-cache"),
    )
    .expect("network probe");
    assert_eq!(network_result.status, "error");
    assert!(network_result.svg.is_none());
    assert!(matches!(
        listener.accept(),
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock
    ));
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
