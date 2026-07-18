use super::tests_support::*;
use super::*;
use tempfile::tempdir;

fn ready(entry: &GitDiffPreviewBatchEntry) -> &GitDiffPreview {
    match entry {
        GitDiffPreviewBatchEntry::Ready { preview } => preview,
        GitDiffPreviewBatchEntry::Error { message } => panic!("unexpected error: {message}"),
    }
}

fn create_range_fixture() -> (tempfile::TempDir, String) {
    let repo = create_fixture_repo();
    for name in ["modified.md", "deleted.md", "renamed.md"] {
        fs::write(
            repo.path().join("docs").join(name),
            format!("# {name}\n\nbase\n"),
        )
        .expect("write range base document");
    }
    git(repo.path(), &["add", "docs"]);
    git(repo.path(), &["commit", "-m", "range base"]);
    let base = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    fs::write(repo.path().join("docs/modified.md"), "# Modified\n\nhead\n")
        .expect("modify range document");
    fs::remove_file(repo.path().join("docs/deleted.md")).expect("delete range document");
    git(repo.path(), &["mv", "docs/renamed.md", "docs/moved.md"]);
    fs::write(repo.path().join("docs/added.md"), "# Added\n").expect("add range document");
    git(repo.path(), &["add", "docs"]);
    git(repo.path(), &["commit", "-m", "range head"]);
    (repo, base)
}

#[test]
fn branch_batch_preserves_order_and_matches_single_previews() {
    let (repo, base) = create_range_fixture();
    let items = vec![
        GitBranchDiffPreviewBatchItem {
            path: "docs/moved.md".to_string(),
            old_path: Some("docs/renamed.md".to_string()),
        },
        GitBranchDiffPreviewBatchItem {
            path: "docs/added.md".to_string(),
            old_path: None,
        },
        GitBranchDiffPreviewBatchItem {
            path: "docs/deleted.md".to_string(),
            old_path: None,
        },
        GitBranchDiffPreviewBatchItem {
            path: "docs/modified.md".to_string(),
            old_path: None,
        },
    ];
    let entries = git_branch_file_diffs_for_paths(
        &repo.path().to_string_lossy(),
        &base,
        Some("HEAD"),
        items.clone(),
    )
    .expect("branch batch");
    assert_eq!(entries.len(), items.len());
    for (entry, item) in entries.iter().zip(items) {
        let single = git_branch_file_diff_for_path(
            &repo.path().to_string_lossy(),
            &base,
            Some("HEAD"),
            &item.path,
            item.old_path.as_deref(),
        )
        .expect("branch single");
        assert_eq!(ready(entry), &single);
    }
    assert_eq!(ready(&entries[0]).status, GitDiffStatus::Clean);
    assert_eq!(ready(&entries[1]).status, GitDiffStatus::Added);
    assert_eq!(ready(&entries[2]).status, GitDiffStatus::Deleted);
}

#[test]
fn commit_batch_preserves_order_and_matches_single_previews() {
    let (repo, _base) = create_range_fixture();
    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    let paths = vec![
        "docs/added.md".to_string(),
        "docs/deleted.md".to_string(),
        "docs/modified.md".to_string(),
    ];
    let entries =
        git_file_commit_diffs_for_paths(&repo.path().to_string_lossy(), &revision, paths.clone())
            .expect("commit batch");
    for (entry, relative_path) in entries.iter().zip(paths) {
        let single = git_file_commit_diff_for_path(
            &repo.path().join(&relative_path).to_string_lossy(),
            &revision,
        )
        .expect("commit single");
        assert_eq!(ready(entry), &single);
    }
}

#[test]
fn stream_batches_keep_invalid_paths_as_partial_errors() {
    let (repo, base) = create_range_fixture();
    let branch = git_branch_file_diffs_for_paths(
        &repo.path().to_string_lossy(),
        &base,
        Some("HEAD"),
        vec![
            GitBranchDiffPreviewBatchItem {
                path: "../outside.md".to_string(),
                old_path: None,
            },
            GitBranchDiffPreviewBatchItem {
                path: "docs/modified.md".to_string(),
                old_path: None,
            },
        ],
    )
    .expect("branch partial batch");
    assert!(matches!(branch[0], GitDiffPreviewBatchEntry::Error { .. }));
    assert!(matches!(branch[1], GitDiffPreviewBatchEntry::Ready { .. }));

    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    let commit = git_file_commit_diffs_for_paths(
        &repo.path().to_string_lossy(),
        &revision,
        vec!["../outside.md".to_string(), "docs/modified.md".to_string()],
    )
    .expect("commit partial batch");
    assert!(matches!(commit[0], GitDiffPreviewBatchEntry::Error { .. }));
    assert!(matches!(commit[1], GitDiffPreviewBatchEntry::Ready { .. }));
}

#[test]
fn stream_batches_reject_non_roots_and_more_than_thirty_two_paths() {
    let (repo, base) = create_range_fixture();
    let nested = repo.path().join("docs");
    let error =
        git_branch_file_diffs_for_paths(&nested.to_string_lossy(), &base, Some("HEAD"), Vec::new())
            .expect_err("nested branch root");
    assert!(error.contains("does not match"));

    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    let error = git_file_commit_diffs_for_paths(
        &repo.path().to_string_lossy(),
        &revision,
        (0..33).map(|index| format!("docs/{index}.md")).collect(),
    )
    .expect_err("oversized commit batch");
    assert!(error.contains("at most 32 paths"));

    let outside = tempdir().expect("outside");
    let error =
        git_file_commit_diffs_for_paths(&outside.path().to_string_lossy(), &revision, Vec::new())
            .expect_err("outside commit root");
    assert!(error.contains("not inside"));
}

#[test]
fn commit_batch_uses_previous_for_a_root_commit() {
    let repo = create_fixture_repo();
    let root = git_stdout(repo.path(), &["rev-list", "--max-parents=0", "HEAD"]);
    let entries = git_file_commit_diffs_for_paths(
        &repo.path().to_string_lossy(),
        &root,
        vec!["docs/sample.md".to_string()],
    )
    .expect("root commit batch");
    assert_eq!(ready(&entries[0]).left_label, "Previous");
    assert_eq!(ready(&entries[0]).status, GitDiffStatus::Added);
}
