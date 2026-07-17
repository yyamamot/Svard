use super::tests_support::*;
use super::*;
use tempfile::tempdir;

fn ready_preview(entry: &GitDiffPreviewBatchEntry) -> &GitDiffPreview {
    match entry {
        GitDiffPreviewBatchEntry::Ready { preview } => preview,
        GitDiffPreviewBatchEntry::Error { message } => {
            panic!("expected ready batch entry, got error: {message}")
        }
    }
}

#[test]
fn batch_preserves_input_order_and_matches_single_preview_semantics() {
    let repo = create_fixture_repo();
    let docs = repo.path().join("docs");
    for name in ["unstaged.md", "staged.md", "deleted.md"] {
        fs::write(docs.join(name), format!("# {name}\n\nbase\n")).expect("write base document");
    }
    git(repo.path(), &["add", "docs"]);
    git(repo.path(), &["commit", "-m", "batch base"]);

    fs::write(docs.join("unstaged.md"), "# Unstaged\n\nworking\n")
        .expect("modify unstaged document");
    fs::write(docs.join("staged.md"), "# Staged\n\nindex\n").expect("modify staged document");
    git(repo.path(), &["add", "docs/staged.md"]);
    fs::remove_file(docs.join("deleted.md")).expect("delete document");
    fs::write(docs.join("added.md"), "# Added\n").expect("write added document");
    git(repo.path(), &["add", "docs/added.md"]);
    fs::write(docs.join("untracked.md"), "# Untracked\n").expect("write untracked document");

    let relative_paths = vec![
        "docs/untracked.md".to_string(),
        "docs/deleted.md".to_string(),
        "docs/staged.md".to_string(),
        "docs/added.md".to_string(),
        "docs/unstaged.md".to_string(),
        "docs/sample.md".to_string(),
    ];
    let entries =
        git_diff_previews_for_paths(&repo.path().to_string_lossy(), relative_paths.clone())
            .expect("batch previews");

    assert_eq!(entries.len(), relative_paths.len());
    for (entry, relative_path) in entries.iter().zip(relative_paths) {
        let single = git_diff_preview_for_path(&repo.path().join(&relative_path).to_string_lossy())
            .expect("single preview");
        assert_eq!(ready_preview(entry), &single, "{relative_path}");
    }
    assert_eq!(ready_preview(&entries[0]).status, GitDiffStatus::Untracked);
    assert_eq!(ready_preview(&entries[1]).status, GitDiffStatus::Deleted);
    assert_eq!(ready_preview(&entries[2]).status, GitDiffStatus::Modified);
    assert_eq!(ready_preview(&entries[2]).right_label, "Index");
    assert_eq!(ready_preview(&entries[3]).status, GitDiffStatus::Added);
    assert_eq!(ready_preview(&entries[4]).status, GitDiffStatus::Modified);
    assert_eq!(ready_preview(&entries[5]).status, GitDiffStatus::Clean);
}

#[test]
fn invalid_relative_path_is_a_partial_error_without_hiding_ready_entries() {
    let repo = create_fixture_repo();
    let absolute = repo.path().join("docs/sample.md");
    let entries = git_diff_previews_for_paths(
        &repo.path().to_string_lossy(),
        vec![
            "docs/sample.md".to_string(),
            "../outside.md".to_string(),
            absolute.to_string_lossy().into_owned(),
            "docs/sample.md".to_string(),
        ],
    )
    .expect("batch previews");

    assert!(matches!(entries[0], GitDiffPreviewBatchEntry::Ready { .. }));
    assert!(matches!(entries[1], GitDiffPreviewBatchEntry::Error { .. }));
    assert!(matches!(entries[2], GitDiffPreviewBatchEntry::Error { .. }));
    assert!(matches!(entries[3], GitDiffPreviewBatchEntry::Ready { .. }));
}

#[test]
fn batch_rejects_more_than_thirty_two_paths_as_an_overall_error() {
    let repo = create_fixture_repo();
    let error = git_diff_previews_for_paths(
        &repo.path().to_string_lossy(),
        (0..33).map(|index| format!("docs/{index}.md")).collect(),
    )
    .expect_err("too many paths must fail");

    assert!(error.contains("at most 32 paths"));
}

#[test]
fn invalid_or_non_root_repository_is_an_overall_error() {
    let outside = tempdir().expect("outside temp dir");
    let non_repo_error = git_diff_previews_for_paths(
        &outside.path().to_string_lossy(),
        vec!["sample.md".to_string()],
    )
    .expect_err("non repository root must fail");
    assert!(non_repo_error.contains("not inside a Git repository"));

    let repo = create_fixture_repo();
    let nested_error = git_diff_previews_for_paths(
        &repo.path().join("docs").to_string_lossy(),
        vec!["sample.md".to_string()],
    )
    .expect_err("nested directory must not stand in for repository root");
    assert!(nested_error.contains("does not match the discovered worktree"));
}

#[cfg(unix)]
#[test]
fn symlink_that_escapes_repository_is_a_partial_error() {
    use std::os::unix::fs::symlink;

    let repo = create_fixture_repo();
    let outside = tempdir().expect("outside temp dir");
    let outside_document = outside.path().join("outside.md");
    fs::write(&outside_document, "# Outside\n").expect("write outside document");
    symlink(
        &outside_document,
        repo.path().join("docs").join("escape.md"),
    )
    .expect("create escaping symlink");

    let entries = git_diff_previews_for_paths(
        &repo.path().to_string_lossy(),
        vec!["docs/escape.md".to_string(), "docs/sample.md".to_string()],
    )
    .expect("batch previews");

    assert!(matches!(entries[0], GitDiffPreviewBatchEntry::Error { .. }));
    assert!(matches!(entries[1], GitDiffPreviewBatchEntry::Ready { .. }));
}

#[test]
fn batch_entry_serialization_uses_fixed_ready_and_error_statuses() {
    let repo = create_fixture_repo();
    let entries = git_diff_previews_for_paths(
        &repo.path().to_string_lossy(),
        vec!["docs/sample.md".to_string(), "../outside.md".to_string()],
    )
    .expect("batch previews");
    let value = serde_json::to_value(entries).expect("serialize batch entries");

    assert_eq!(value[0]["status"], "ready");
    assert!(value[0].get("preview").is_some());
    assert_eq!(value[1]["status"], "error");
    assert!(value[1].get("message").is_some());
}
