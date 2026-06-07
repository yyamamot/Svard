use super::*;
use std::{path::Path, process::Command};
use tempfile::tempdir;

pub(super) fn create_fixture_repo() -> tempfile::TempDir {
    let dir = tempdir().expect("temp dir");
    let docs = dir.path().join("docs");
    fs::create_dir_all(&docs).expect("create docs");
    fs::write(docs.join("sample.md"), "# Title\n\noriginal\n").expect("write document");
    git(dir.path(), &["init"]);
    git(dir.path(), &["config", "user.email", "fixture@example.com"]);
    git(dir.path(), &["config", "user.name", "Fixture"]);
    git(dir.path(), &["add", "."]);
    git(dir.path(), &["commit", "-m", "initial"]);
    dir
}

pub(super) fn git(cwd: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .expect("run git");
    assert!(
        output.status.success(),
        "git {:?} failed: {}{}",
        args,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

pub(super) fn git_stdout(cwd: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .expect("run git");
    assert!(
        output.status.success(),
        "git {:?} failed: {}{}",
        args,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}
