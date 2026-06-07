use super::*;

#[test]
fn production_runtime_does_not_spawn_git_cli() {
    let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut offenders = Vec::new();
    collect_git_cli_offenders(&src_dir, &mut offenders);

    assert!(
        offenders.is_empty(),
        "production runtime must not invoke Git CLI:\n{}",
        offenders.join("\n")
    );
}

fn collect_git_cli_offenders(path: &Path, offenders: &mut Vec<String>) {
    let entries = fs::read_dir(path).expect("read source directory");
    for entry in entries {
        let entry = entry.expect("read source entry");
        let path = entry.path();
        if should_skip_git_cli_guard_path(&path) {
            continue;
        }
        if path.is_dir() {
            collect_git_cli_offenders(&path, offenders);
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) != Some("rs") {
            continue;
        }
        let source = fs::read_to_string(&path).expect("read Rust source");
        for pattern in [
            "Command::new(\"git\")",
            "std::process::Command::new(\"git\")",
            "hidden_command(\"git\")",
        ] {
            if source.contains(pattern) {
                offenders.push(format!("{} contains {pattern}", path.display()));
            }
        }
    }
}

fn should_skip_git_cli_guard_path(path: &Path) -> bool {
    path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy();
        value == "backend_tests" || value == "bin"
    }) || path.ends_with(Path::new("git_diff").join("tests.rs"))
        || path.ends_with(Path::new("git_diff").join("tests_history.rs"))
        || path.ends_with(Path::new("git_diff").join("tests_support.rs"))
}
