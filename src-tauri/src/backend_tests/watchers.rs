use super::*;

use super::shared::{create_git_fixture_repo, git};

#[test]
fn watch_document_path_validation_accepts_supported_file() {
    let file = tempfile::Builder::new()
        .suffix(".adoc")
        .tempfile()
        .expect("temp file");
    fs::write(file.path(), "= Watched\n").expect("write fixture");

    let resolved =
        normalize_watch_document_path(&file.path().to_string_lossy()).expect("watch path");

    assert_eq!(
        resolved,
        path_to_ui_path(&file.path().canonicalize().unwrap())
    );
}

#[test]
fn watch_document_path_validation_rejects_directory_missing_and_unsupported() {
    let dir = tempdir().expect("temp dir");
    let unsupported = dir.path().join("notes.txt");
    fs::write(&unsupported, "plain").expect("write unsupported");
    let missing = dir.path().join("missing.adoc");

    assert!(normalize_watch_document_path(&dir.path().to_string_lossy()).is_err());
    assert!(normalize_watch_document_path(&missing.to_string_lossy()).is_err());
    assert!(normalize_watch_document_path(&unsupported.to_string_lossy()).is_err());
}

#[test]
fn watch_directory_path_validation_accepts_existing_directory() {
    let dir = tempdir().expect("temp dir");

    let resolved = normalize_watch_directory_path(&dir.path().to_string_lossy())
        .expect("directory watch path");

    assert_eq!(
        resolved,
        path_to_ui_path(&dir.path().canonicalize().unwrap())
    );
}

#[test]
fn watch_directory_path_validation_rejects_file_and_missing_path() {
    let dir = tempdir().expect("temp dir");
    let file = dir.path().join("guide.adoc");
    let missing = dir.path().join("missing");
    fs::write(&file, "= Guide\n").expect("write fixture");

    assert!(normalize_watch_directory_path(&file.to_string_lossy()).is_err());
    assert!(normalize_watch_directory_path(&missing.to_string_lossy()).is_err());
}

#[test]
fn watch_document_event_filter_matches_only_target_filename() {
    let target = OsString::from("guide.adoc");
    let paths = vec![
        PathBuf::from("/tmp/other.adoc"),
        PathBuf::from("/tmp/guide.adoc"),
    ];
    let unrelated = vec![PathBuf::from("/tmp/notes.md")];

    assert!(event_matches_document_path(&paths, &target));
    assert!(!event_matches_document_path(&unrelated, &target));
}

#[test]
fn watch_directory_event_filter_matches_direct_children_only() {
    let dir = PathBuf::from("/tmp/docs");
    let paths = vec![PathBuf::from("/tmp/docs/new.adoc")];
    let nested = vec![PathBuf::from("/tmp/docs/nested/new.adoc")];
    let unrelated = vec![PathBuf::from("/tmp/other/new.adoc")];

    assert!(event_matches_directory_path(&paths, &dir));
    assert!(!event_matches_directory_path(&nested, &dir));
    assert!(!event_matches_directory_path(&unrelated, &dir));
    assert!(event_matches_directory_watch_path(&paths, &dir, false));
    assert!(!event_matches_directory_watch_path(&nested, &dir, false));
    assert!(event_matches_directory_watch_path(&paths, &dir, true));
    assert!(event_matches_directory_watch_path(&nested, &dir, true));
    assert!(!event_matches_directory_watch_path(&unrelated, &dir, true));
}

#[test]
fn watch_directory_event_filter_rejects_sibling_prefix_paths() {
    let dir = PathBuf::from("/tmp/docs");
    let sibling_prefix = vec![PathBuf::from("/tmp/docs-other/new.adoc")];
    let nested_sibling_prefix = vec![PathBuf::from("/tmp/docs-other/nested/new.adoc")];

    assert!(!event_matches_directory_watch_path(
        &sibling_prefix,
        &dir,
        false
    ));
    assert!(!event_matches_directory_watch_path(
        &sibling_prefix,
        &dir,
        true
    ));
    assert!(!event_matches_directory_watch_path(
        &nested_sibling_prefix,
        &dir,
        true
    ));
    assert_eq!(directory_watch_changed_path(&sibling_prefix, &dir), None);
}

#[test]
fn watch_directory_changed_path_reports_direct_child_path() {
    let dir = PathBuf::from("/tmp/docs");
    let paths = vec![PathBuf::from("/tmp/docs/new.adoc")];
    let directory_and_child = vec![
        PathBuf::from("/tmp/docs"),
        PathBuf::from("/tmp/docs/new.adoc"),
    ];
    let nested = vec![PathBuf::from("/tmp/docs/nested/new.adoc")];

    assert_eq!(
        directory_watch_changed_path(&paths, &dir),
        Some("/tmp/docs/new.adoc".to_string())
    );
    assert_eq!(
        directory_watch_changed_path(&directory_and_child, &dir),
        Some("/tmp/docs/new.adoc".to_string())
    );
    assert_eq!(
        directory_watch_changed_path(&nested, &dir),
        Some("/tmp/docs/nested/new.adoc".to_string())
    );
}

#[test]
fn unwatch_document_removes_watcher_state() {
    let state = DocumentWatchState::default();
    let watcher = RecommendedWatcher::new(|_: notify::Result<notify::Event>| {}, Config::default())
        .expect("watcher");
    state.watchers.lock().unwrap().insert(
        "watch-1".to_string(),
        DocumentWatchEntry { _watcher: watcher },
    );

    remove_document_watch("watch-1", &state).expect("unwatch");

    assert!(state.watchers.lock().unwrap().is_empty());
}

#[test]
fn unwatch_directory_removes_watcher_state() {
    let state = DirectoryWatchState::default();
    let watcher = RecommendedWatcher::new(|_: notify::Result<notify::Event>| {}, Config::default())
        .expect("watcher");
    state.watchers.lock().unwrap().insert(
        "directory-watch-1".to_string(),
        DirectoryWatchEntry { _watcher: watcher },
    );

    remove_directory_watch("directory-watch-1", &state).expect("unwatch");

    assert!(state.watchers.lock().unwrap().is_empty());
}

#[test]
fn git_metadata_watch_targets_resolve_git_dir_and_ignore_unsupported_paths() {
    let repo = create_git_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let unsupported = repo.path().join("docs").join("notes.txt");
    fs::write(&unsupported, "plain\n").expect("write unsupported");

    let targets = git_metadata_watch_targets_for_paths(&[
        document.to_string_lossy().into_owned(),
        unsupported.to_string_lossy().into_owned(),
    ]);

    assert_eq!(targets.len(), 1);
    let expected_git_dir =
        path_to_ui_path(&repo.path().join(".git").canonicalize().expect("git dir"));
    assert_eq!(targets[0].git_dir, expected_git_dir);
    assert_eq!(targets[0].refs_dir, Some(expected_git_dir.join("refs")));
    assert!(!targets[0].repository_id.is_empty());
}

#[test]
fn git_metadata_watch_targets_accept_repository_directory() {
    let repo = create_git_fixture_repo();

    let targets =
        git_metadata_watch_targets_for_paths(&[repo.path().to_string_lossy().into_owned()]);

    assert_eq!(targets.len(), 1);
    let expected_git_dir =
        path_to_ui_path(&repo.path().join(".git").canonicalize().expect("git dir"));
    assert_eq!(targets[0].git_dir, expected_git_dir);
    assert_eq!(targets[0].refs_dir, Some(expected_git_dir.join("refs")));
}

#[test]
fn git_metadata_watch_targets_resolve_worktree_gitdir_file() {
    let repo = create_git_fixture_repo();
    let linked = repo.path().join("linked-worktree");
    git(repo.path(), &["worktree", "add", "linked-worktree"]);
    let document = linked.join("docs").join("sample.md");

    let targets = git_metadata_watch_targets_for_paths(&[document.to_string_lossy().into_owned()]);

    assert_eq!(targets.len(), 1);
    assert!(targets[0].git_dir.is_dir());
    assert_ne!(targets[0].git_dir, linked.join(".git"));
}

#[test]
fn git_metadata_event_filter_matches_index_head_refs_and_packed_refs() {
    let git_dir = PathBuf::from("/repo/.git");
    let refs_dir = git_dir.join("refs");
    let git_dirs = vec![git_dir.clone()];
    let refs_dirs = vec![refs_dir.clone()];

    assert!(event_matches_git_metadata(
        &[git_dir.join("index.lock")],
        &git_dirs,
        &refs_dirs
    ));
    assert!(event_matches_git_metadata(
        &[git_dir.join("HEAD")],
        &git_dirs,
        &refs_dirs
    ));
    assert!(event_matches_git_metadata(
        &[git_dir.join("packed-refs")],
        &git_dirs,
        &refs_dirs
    ));
    assert!(event_matches_git_metadata(
        &[refs_dir.join("heads").join("main")],
        &git_dirs,
        &refs_dirs
    ));
    assert!(!event_matches_git_metadata(
        &[PathBuf::from("/repo/docs/sample.md")],
        &git_dirs,
        &refs_dirs
    ));
}

#[test]
fn git_status_watch_debounce_suppresses_immediate_duplicate_events() {
    let last = Mutex::new(None);

    assert!(should_emit_debounced_event(
        &last,
        GIT_STATUS_WATCH_DEBOUNCE_MS
    ));
    assert!(!should_emit_debounced_event(
        &last,
        GIT_STATUS_WATCH_DEBOUNCE_MS
    ));
}
