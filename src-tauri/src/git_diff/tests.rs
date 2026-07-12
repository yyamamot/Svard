use super::tests_support::*;
use super::*;
use tempfile::tempdir;

#[test]
fn modified_file_returns_head_to_worktree_hunk_without_git_cli_at_read_time() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert_eq!(preview.relative_path.as_deref(), Some("docs/sample.md"));
    assert_eq!(preview.left_label, "HEAD");
    assert_eq!(preview.right_label, "Working Tree");
    assert!(matches!(
        preview.left_resource_source,
        Some(GitDiffResourceSource::Commit { .. })
    ));
    assert_eq!(
        preview.right_resource_source,
        Some(GitDiffResourceSource::Worktree)
    );
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Removed && line.text == "original")
    );
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Added && line.text == "changed")
    );
}

#[test]
fn clean_file_returns_empty_hunks() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Clean);
    assert!(preview.hunks.is_empty());
}

#[test]
fn line_diff_hunks_ignore_line_ending_only_changes() {
    let hunks = line_diff_hunks(
        "| Name | Status |\n| --- | --- |\n| Basic | Stable |\n",
        "| Name | Status |\r\n| --- | --- |\r\n| Basic | Stable |\r\n",
    );

    assert!(hunks.is_empty());
}

#[test]
fn git_status_byte_comparison_ignores_line_ending_only_changes() {
    let head = Some(b"| Name | Status |\n| --- | --- |\n| Basic | Stable |\n".to_vec());
    let worktree = Some(b"| Name | Status |\r\n| --- | --- |\r\n| Basic | Stable |\r\n".to_vec());

    assert_eq!(
        status_from_git_bytes(head.clone(), head.clone(), worktree.clone()),
        GitDiffStatus::Clean
    );
    assert_eq!(
        staged_status_from_bytes(head.as_deref(), worktree.as_deref()),
        None
    );
}

#[test]
fn status_summary_returns_metadata_without_diff_hunks() {
    let repo = create_fixture_repo();
    let modified = repo.path().join("docs").join("sample.md");
    let untracked = repo.path().join("docs").join("new.md");
    fs::write(&modified, "# Title\n\nchanged\n").expect("modify document");
    fs::write(&untracked, "# New\n").expect("write untracked");

    let summary = git_status_summary_for_paths(vec![
        modified.to_string_lossy().into_owned(),
        untracked.to_string_lossy().into_owned(),
    ])
    .expect("status summary");

    assert_eq!(summary[0].status, GitDiffStatus::Modified);
    assert_eq!(summary[1].status, GitDiffStatus::Untracked);
    assert_eq!(summary[0].path, modified.to_string_lossy());
}

#[test]
fn dirty_submodule_does_not_hide_modified_parent_document() {
    let repo = create_fixture_repo();
    let submodule_source = create_fixture_repo();
    let submodule_source_path = submodule_source.path().to_string_lossy().into_owned();
    git(
        repo.path(),
        &[
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            &submodule_source_path,
            "vendor/code",
        ],
    );
    git(repo.path(), &["commit", "-m", "add submodule"]);

    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify parent document");
    fs::write(
        repo.path()
            .join("vendor")
            .join("code")
            .join("docs")
            .join("sample.md"),
        "# Title\n\nchanged in submodule\n",
    )
    .expect("modify submodule document");

    let changes = git_changes_for_path(&document.to_string_lossy()).expect("changes");
    let summary = git_status_summary_for_paths(vec![document.to_string_lossy().into_owned()])
        .expect("status summary");

    assert_eq!(summary[0].status, GitDiffStatus::Modified);
    assert!(changes.items.iter().any(|item| {
        item.path == "docs/sample.md" && item.status == GitDiffStatus::Modified
    }));
    assert!(changes.items.iter().any(|item| {
        item.path == "vendor/code" && item.status == GitDiffStatus::Modified
    }));
}

#[test]
fn deleted_file_keeps_head_side_for_preview() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::remove_file(&document).expect("delete document");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Deleted);
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .all(|line| line.kind != GitDiffLineKind::Added)
    );
}

#[test]
fn untracked_file_returns_worktree_side_for_preview() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("new.md");
    fs::write(&document, "# New\n").expect("write untracked");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Untracked);
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .all(|line| line.kind != GitDiffLineKind::Removed)
    );
}

#[test]
fn added_file_is_distinguished_from_untracked_when_in_index() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("added.md");
    fs::write(&document, "# Added\n").expect("write added");
    git(repo.path(), &["add", "docs/added.md"]);

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Added);
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .all(|line| line.kind != GitDiffLineKind::Removed)
    );
}

#[test]
fn staged_modified_file_is_not_reported_clean_when_worktree_matches_head() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nstaged\n").expect("modify document");
    git(repo.path(), &["add", "docs/sample.md"]);
    fs::write(&document, "# Title\n\noriginal\n").expect("restore worktree");

    let summary = git_status_summary_for_paths(vec![document.to_string_lossy().into_owned()])
        .expect("status summary");
    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(summary[0].status, GitDiffStatus::Modified);
    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert_eq!(preview.right_label, "Index");
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Added && line.text == "staged")
    );
}

#[test]
fn staged_delete_is_reported_from_index_even_when_worktree_file_exists() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    git(repo.path(), &["rm", "--cached", "docs/sample.md"]);

    let summary = git_status_summary_for_paths(vec![document.to_string_lossy().into_owned()])
        .expect("status summary");
    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(summary[0].status, GitDiffStatus::Deleted);
    assert_eq!(preview.status, GitDiffStatus::Deleted);
    assert_eq!(preview.right_label, "Index");
}

#[test]
fn staged_rename_reports_old_deleted_and_new_added() {
    let repo = create_fixture_repo();
    let old_path = repo.path().join("docs").join("sample.md");
    let new_path = repo.path().join("docs").join("renamed.md");
    git(repo.path(), &["mv", "docs/sample.md", "docs/renamed.md"]);

    let summary = git_status_summary_for_paths(vec![
        old_path.to_string_lossy().into_owned(),
        new_path.to_string_lossy().into_owned(),
    ])
    .expect("status summary");
    let new_preview = git_diff_preview_for_path(&new_path.to_string_lossy()).expect("preview");

    assert_eq!(summary[0].status, GitDiffStatus::Deleted);
    assert_eq!(summary[1].status, GitDiffStatus::Added);
    assert_eq!(new_preview.status, GitDiffStatus::Added);
    assert_eq!(new_preview.right_label, "Index");
}

#[test]
fn worktree_rename_reports_old_deleted_and_new_untracked() {
    let repo = create_fixture_repo();
    let old_path = repo.path().join("docs").join("sample.md");
    let new_path = repo.path().join("docs").join("renamed.md");
    fs::rename(&old_path, &new_path).expect("rename worktree file");

    let summary = git_status_summary_for_paths(vec![
        old_path.to_string_lossy().into_owned(),
        new_path.to_string_lossy().into_owned(),
    ])
    .expect("status summary");

    assert_eq!(summary[0].status, GitDiffStatus::Deleted);
    assert_eq!(summary[1].status, GitDiffStatus::Untracked);
}

#[test]
fn non_git_file_returns_not_in_repo() {
    let dir = tempdir().expect("temp dir");
    let document = dir.path().join("sample.md");
    fs::write(&document, "# Outside\n").expect("write document");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::NotInRepo);
    assert!(preview.repository_root.is_none());
}

#[test]
fn binary_file_returns_binary_without_hunks() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, b"\0binary").expect("write binary");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Binary);
    assert!(preview.hunks.is_empty());
}

#[test]
fn repo_relative_path_uses_forward_slashes_for_windows_style_assertions() {
    let path = PathBuf::from("docs").join("nested").join("sample.md");

    assert_eq!(repo_relative_path(&path), "docs/nested/sample.md");
}

#[test]
fn git_changes_returns_repo_wide_changed_files() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let staged = repo.path().join("docs").join("staged.md");
    let deleted = repo.path().join("docs").join("deleted.md");
    let renamed_old = repo.path().join("docs").join("renamed-old.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    fs::write(&staged, "# Staged\n").expect("write staged");
    fs::write(&deleted, "# Deleted\n").expect("write deleted");
    fs::write(&renamed_old, "# Rename\n").expect("write renamed");
    git(
        repo.path(),
        &[
            "add",
            "docs/staged.md",
            "docs/deleted.md",
            "docs/renamed-old.md",
        ],
    );
    git(repo.path(), &["commit", "-m", "status base"]);
    fs::remove_file(&deleted).expect("delete staged tracked file");
    git(
        repo.path(),
        &["mv", "docs/renamed-old.md", "docs/renamed-new.md"],
    );
    fs::write(repo.path().join("docs").join("added.md"), "# Added\n").expect("write added");
    git(
        repo.path(),
        &[
            "add",
            "docs/added.md",
            "docs/deleted.md",
            "docs/renamed-new.md",
        ],
    );
    fs::write(repo.path().join("docs").join("new.md"), "# New\n").expect("write new");
    fs::write(repo.path().join("image.png"), b"\0png").expect("write binary");

    let changes = git_changes_for_path(&document.to_string_lossy()).expect("changes");

    assert_eq!(changes.status, GitChangesStatus::Ok);
    assert!(changes.current_branch.is_some());
    assert_eq!(
        changes
            .head_commit
            .as_ref()
            .map(|commit| commit.summary.as_str()),
        Some("status base")
    );
    assert!(changes.items.iter().any(|item| {
        item.path == "docs/sample.md"
            && item.status == GitDiffStatus::Modified
            && item.document_path.is_some()
    }));
    assert!(changes.items.iter().any(|item| {
        item.path == "docs/added.md"
            && item.status == GitDiffStatus::Added
            && item.document_path.is_some()
    }));
    assert!(changes.items.iter().any(|item| {
        item.path == "docs/deleted.md"
            && item.status == GitDiffStatus::Deleted
            && item.document_path.is_some()
    }));
    assert!(changes.items.iter().any(|item| {
        item.path == "docs/renamed-new.md"
            && item.status == GitDiffStatus::Renamed
            && item.document_path.is_some()
    }));
    assert!(changes.items.iter().any(|item| {
        item.path == "docs/new.md"
            && item.status == GitDiffStatus::Untracked
            && item.document_path.is_some()
    }));
    assert!(changes.items.iter().any(|item| {
        item.path == "image.png"
            && item.status == GitDiffStatus::Untracked
            && item.document_path.is_none()
    }));
}

#[test]
fn git_changes_treats_similarity_rename_as_deleted_and_added_for_speed() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let old_path = repo.path().join("docs").join("similar-old.md");
    let new_path = repo.path().join("docs").join("similar-new.md");
    fs::write(&old_path, "# Similar\n\nOriginal body\n").expect("write old");
    git(repo.path(), &["add", "docs/similar-old.md"]);
    git(repo.path(), &["commit", "-m", "similar rename base"]);
    fs::remove_file(&old_path).expect("delete old");
    fs::write(&new_path, "# Similar\n\nOriginal body changed\n").expect("write new");
    git(
        repo.path(),
        &["add", "docs/similar-old.md", "docs/similar-new.md"],
    );

    let changes = git_changes_for_path(&document.to_string_lossy()).expect("changes");

    assert!(changes.items.iter().any(|item| {
        item.path == "docs/similar-old.md" && item.status == GitDiffStatus::Deleted
    }));
    assert!(
        changes.items.iter().any(|item| {
            item.path == "docs/similar-new.md" && item.status == GitDiffStatus::Added
        })
    );
    assert!(!changes.items.iter().any(|item| {
        item.path == "docs/similar-new.md" && item.status == GitDiffStatus::Renamed
    }));
}

#[test]
fn git_branch_diff_returns_pr_style_changed_files_and_previews() {
    let repo = create_fixture_repo();
    let sample = repo.path().join("docs").join("sample.md");
    let deleted = repo.path().join("docs").join("deleted.md");
    let renamed_old = repo.path().join("docs").join("renamed-old.md");
    let image = repo.path().join("image.png");
    fs::write(&deleted, "# Deleted\n").expect("write deleted");
    fs::write(&renamed_old, "# Rename\n").expect("write renamed");
    fs::write(&image, b"\0png").expect("write image");
    git(repo.path(), &["add", "."]);
    git(repo.path(), &["commit", "-m", "base docs"]);
    let base = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    git(
        repo.path(),
        &["update-ref", "refs/remotes/origin/main", "HEAD"],
    );

    fs::write(&sample, "# Title\n\nchanged\n").expect("modify sample");
    fs::write(repo.path().join("docs").join("new.md"), "# New\n").expect("new doc");
    fs::remove_file(&deleted).expect("delete doc");
    git(
        repo.path(),
        &["mv", "docs/renamed-old.md", "docs/renamed-new.md"],
    );
    fs::write(
        repo.path().join("docs").join("renamed-new.md"),
        "# Rename\n\nchanged\n",
    )
    .expect("modify renamed file");
    fs::write(&image, b"\0png2").expect("modify image");
    git(repo.path(), &["add", "."]);
    git(repo.path(), &["commit", "-m", "feature docs"]);

    let diff = git_branch_diff_for_path(&repo.path().to_string_lossy(), None, None, None, None)
        .expect("diff");

    assert_eq!(diff.status, GitBranchDiffStatus::Ok);
    assert_eq!(diff.base_ref.as_deref(), Some("origin/main"));
    assert_eq!(diff.head_ref.as_deref(), Some("HEAD"));
    assert_eq!(diff.merge_base.as_deref(), Some(base.as_str()));
    assert!(
        diff.base_candidates
            .iter()
            .any(|item| item == "origin/main")
    );
    assert!(diff.items.iter().any(|item| {
        item.path == "docs/sample.md"
            && item.status == GitDiffStatus::Modified
            && item.document_path.is_some()
    }));
    assert!(diff.items.iter().any(|item| {
        item.path == "docs/new.md"
            && item.status == GitDiffStatus::Added
            && item.document_path.is_some()
    }));
    assert!(diff.items.iter().any(|item| {
        item.path == "docs/deleted.md"
            && item.status == GitDiffStatus::Deleted
            && item.document_path.is_some()
    }));
    assert!(diff.items.iter().any(|item| {
        item.path == "docs/renamed-new.md"
            && item.old_path.as_deref() == Some("docs/renamed-old.md")
            && item.status == GitDiffStatus::Renamed
            && item.document_path.is_some()
    }));
    assert!(diff.items.iter().any(|item| {
        item.path == "image.png"
            && item.status == GitDiffStatus::Modified
            && item.document_path.is_none()
    }));

    let preview = git_branch_file_diff_for_path(
        &repo.path().to_string_lossy(),
        "origin/main",
        None,
        "docs/sample.md",
        None,
    )
    .expect("preview");
    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert_eq!(preview.left_label, "origin/main");
    assert_eq!(preview.right_label, "HEAD");
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Added && line.text == "changed")
    );

    let deleted_preview = git_branch_file_diff_for_path(
        &repo.path().to_string_lossy(),
        "origin/main",
        None,
        "docs/deleted.md",
        None,
    )
    .expect("deleted preview");
    assert_eq!(deleted_preview.status, GitDiffStatus::Deleted);
}

#[test]
fn git_branch_diff_ignores_stale_base_ref_from_another_repo() {
    let repo = create_fixture_repo();
    git(
        repo.path(),
        &["update-ref", "refs/remotes/origin/main", "HEAD"],
    );

    let diff = git_branch_diff_for_path(
        &repo.path().to_string_lossy(),
        Some("feature/leaflet"),
        None,
        None,
        None,
    )
    .expect("diff");

    assert_eq!(diff.status, GitBranchDiffStatus::Ok);
    assert_eq!(diff.base_ref.as_deref(), Some("origin/main"));
    assert!(
        diff.base_candidates
            .iter()
            .all(|item| item != "feature/leaflet")
    );
}

#[test]
fn file_revision_diff_uses_commit_label_and_worktree_side() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");

    let preview = git_file_revision_diff_for_path(&document.to_string_lossy(), &revision)
        .expect("revision diff");

    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert_eq!(preview.relative_path.as_deref(), Some("docs/sample.md"));
    assert!(revision.starts_with(&preview.left_label));
    assert_eq!(preview.right_label, "Working Tree");
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Added && line.text == "changed")
    );
}

#[test]
fn file_commit_diff_uses_parent_and_commit_sides() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    git(repo.path(), &["add", "docs/sample.md"]);
    git(repo.path(), &["commit", "-m", "update sample"]);
    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    let parent = git_stdout(repo.path(), &["rev-parse", "HEAD~1"]);

    let preview =
        git_file_commit_diff_for_path(&document.to_string_lossy(), &revision).expect("diff");

    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert!(parent.starts_with(&preview.left_label));
    assert!(revision.starts_with(&preview.right_label));
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Added && line.text == "changed")
    );
}

#[test]
fn file_revision_pair_diff_uses_two_commit_labels() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let left = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    git(repo.path(), &["add", "docs/sample.md"]);
    git(repo.path(), &["commit", "-m", "update sample"]);
    let right = git_stdout(repo.path(), &["rev-parse", "HEAD"]);

    let preview = git_file_revision_pair_diff_for_path(&document.to_string_lossy(), &left, &right)
        .expect("pair diff");

    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert!(left.starts_with(&preview.left_label));
    assert!(right.starts_with(&preview.right_label));
}

#[test]
fn commit_details_returns_changed_files() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    fs::write(repo.path().join("docs").join("extra.md"), "# Extra\n").expect("extra");
    git(repo.path(), &["add", "."]);
    git(repo.path(), &["commit", "-m", "update sample"]);
    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);

    let details =
        git_commit_details_for_path(&document.to_string_lossy(), &revision).expect("details");

    assert_eq!(details.summary, "update sample");
    assert!(
        details
            .files
            .iter()
            .any(|file| file.path == "docs/sample.md" && file.status == GitDiffStatus::Modified)
    );
    assert!(
        details
            .files
            .iter()
            .any(|file| file.path == "docs/extra.md" && file.status == GitDiffStatus::Added)
    );
}

#[test]
fn git_refs_list_branches_tags_and_recent_commits() {
    let repo = create_fixture_repo();
    git(repo.path(), &["tag", "v1.0.0"]);
    git(repo.path(), &["branch", "docs-preview"]);
    let document = repo.path().join("docs").join("sample.md");

    let branches = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Branch,
        None,
        None,
        None,
    )
    .expect("branches");
    let tags = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Tag,
        None,
        None,
        None,
    )
    .expect("tags");
    let commits = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Commit,
        None,
        None,
        None,
    )
    .expect("commits");

    assert_eq!(branches.status, GitRefListStatus::Ok);
    assert!(
        branches
            .items
            .iter()
            .any(|item| item.name == "docs-preview")
    );
    assert!(tags.items.iter().any(|item| item.name == "v1.0.0"));
    assert!(
        commits
            .items
            .iter()
            .any(|item| item.summary.as_deref() == Some("initial"))
    );
}

#[test]
fn git_refs_commit_pages_continue_without_overlap() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    for index in 0..25 {
        fs::write(&document, format!("# Title\n\nchange {index}\n")).expect("write");
        git(repo.path(), &["add", "."]);
        git(repo.path(), &["commit", "-m", &format!("change {index}")]);
    }

    let first = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Commit,
        Some(20),
        None,
        None,
    )
    .expect("first page");
    let second = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Commit,
        Some(50),
        first.next_cursor.as_deref(),
        None,
    )
    .expect("second page");

    assert_eq!(first.items.len(), 20);
    assert_eq!(first.has_more, Some(true));
    assert!(!second.items.is_empty());
    assert!(first.items.iter().all(|left| {
        second
            .items
            .iter()
            .all(|right| left.revision != right.revision)
    }));
    assert_eq!(
        first.metrics.as_ref().map(|metrics| metrics.walked_commits),
        Some(21)
    );
}

#[test]
fn git_refs_commit_query_searches_beyond_first_page() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    for index in 0..25 {
        fs::write(&document, format!("# Title\n\nchange {index}\n")).expect("write");
        git(repo.path(), &["add", "."]);
        let summary = if index == 0 {
            "very old searchable commit".to_string()
        } else {
            format!("change {index}")
        };
        git(repo.path(), &["commit", "-m", &summary]);
    }

    let refs = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Commit,
        Some(20),
        None,
        Some("searchable"),
    )
    .expect("search page");

    assert!(
        refs.items
            .iter()
            .any(|item| item.summary.as_deref() == Some("very old searchable commit"))
    );
    assert!(refs.metrics.as_ref().unwrap().walked_commits > 20);
}

#[test]
fn git_refs_branch_pages_keep_name_sort() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    for index in 0..24 {
        git(repo.path(), &["branch", &format!("feature-{index:02}")]);
    }

    let first = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Branch,
        Some(20),
        None,
        None,
    )
    .expect("first page");
    let second = git_refs_for_path(
        &document.to_string_lossy(),
        GitRefKind::Branch,
        Some(50),
        first.next_cursor.as_deref(),
        None,
    )
    .expect("second page");

    assert_eq!(first.items.len(), 20);
    assert_eq!(first.has_more, Some(true));
    assert!(
        first
            .items
            .windows(2)
            .all(|pair| pair[0].name <= pair[1].name)
    );
    assert!(
        second
            .items
            .windows(2)
            .all(|pair| pair[0].name <= pair[1].name)
    );
    assert!(
        first
            .items
            .iter()
            .all(|left| second.items.iter().all(|right| left.name != right.name))
    );
}

#[test]
fn git_ref_diff_uses_ref_label_and_worktree_side() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let revision = git_stdout(repo.path(), &["rev-parse", "HEAD"]);
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");

    let preview = git_file_ref_diff_for_path(
        &document.to_string_lossy(),
        &GitRefItem {
            kind: GitRefKind::Branch,
            name: "main".to_string(),
            revision,
            short_revision: "HEAD".to_string(),
            summary: None,
        },
    )
    .expect("ref diff");

    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert_eq!(preview.left_label, "branch:main");
    assert_eq!(preview.right_label, "Working Tree");
    assert!(
        preview.hunks[0]
            .lines
            .iter()
            .any(|line| line.kind == GitDiffLineKind::Added && line.text == "changed")
    );
}
