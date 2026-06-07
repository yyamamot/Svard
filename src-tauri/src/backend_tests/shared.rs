use super::*;

pub(super) fn create_git_fixture_repo() -> tempfile::TempDir {
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

pub(super) struct SecurityPathFixture {
    pub _dir: tempfile::TempDir,
    pub workspace: PathBuf,
    pub docs: PathBuf,
    pub document: PathBuf,
    pub outside_document: PathBuf,
}

pub(super) fn create_security_path_fixture() -> SecurityPathFixture {
    let dir = tempdir().expect("temp dir");
    let workspace = dir.path().join("workspace");
    let docs = workspace.join("docs");
    let outside = dir.path().join("outside");
    let document = docs.join("guide.adoc");
    let outside_document = outside.join("secret.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&outside).expect("create outside");
    fs::write(&document, "= Guide\n\nneedle inside\n").expect("write document");
    fs::write(&outside_document, "= Secret\n\nneedle outside\n").expect("write outside");
    SecurityPathFixture {
        _dir: dir,
        workspace,
        docs,
        document,
        outside_document,
    }
}
