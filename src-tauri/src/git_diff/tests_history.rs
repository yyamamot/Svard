use super::tests_support::*;
use super::*;

#[test]
fn file_history_returns_commits_touching_document() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    git(repo.path(), &["add", "docs/sample.md"]);
    git(repo.path(), &["commit", "-m", "update sample"]);

    let history = git_file_history_for_path(&document.to_string_lossy()).expect("history");

    assert_eq!(history.status, GitFileHistoryStatus::Ok);
    assert_eq!(history.relative_path.as_deref(), Some("docs/sample.md"));
    assert!(
        history
            .items
            .iter()
            .any(|item| item.summary == "update sample"
                && item.file_status == GitDiffStatus::Modified)
    );
    assert!(history
        .items
        .iter()
        .any(|item| item.summary == "initial" && item.file_status == GitDiffStatus::Added));
}

#[test]
fn file_history_reports_untracked_document() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("new.md");
    fs::write(&document, "# New\n").expect("write untracked");

    let history = git_file_history_for_path(&document.to_string_lossy()).expect("history");

    assert_eq!(history.status, GitFileHistoryStatus::Untracked);
    assert!(history.items.is_empty());
    assert_eq!(history.relative_path.as_deref(), Some("docs/new.md"));
}

#[test]
fn file_history_cache_hits_for_same_head() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let cache = GitFileHistoryCacheState::default();

    let first =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("first history");
    let second =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("second history");

    assert_eq!(
        first.metrics.as_ref().map(|metrics| &metrics.cache_status),
        Some(&GitFileHistoryCacheStatus::Miss)
    );
    assert_eq!(
        second.metrics.as_ref().map(|metrics| &metrics.cache_status),
        Some(&GitFileHistoryCacheStatus::Hit)
    );
    assert_eq!(
        second
            .metrics
            .as_ref()
            .map(|metrics| metrics.walked_commits),
        Some(0)
    );
    assert_eq!(second.items, first.items);
}

#[test]
fn file_history_cache_incrementally_refreshes_until_previous_head() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let cache = GitFileHistoryCacheState::default();
    git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
        .expect("initial history");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    git(repo.path(), &["add", "docs/sample.md"]);
    git(repo.path(), &["commit", "-m", "update sample"]);

    let history =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("incremental history");

    assert_eq!(
        history
            .metrics
            .as_ref()
            .map(|metrics| &metrics.cache_status),
        Some(&GitFileHistoryCacheStatus::Incremental)
    );
    assert_eq!(
        history
            .metrics
            .as_ref()
            .map(|metrics| metrics.walked_commits),
        Some(1)
    );
    assert_eq!(
        history.items.first().map(|item| item.summary.as_str()),
        Some("update sample")
    );
}

#[test]
fn file_history_cache_falls_back_when_previous_head_is_unreachable() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let cache = GitFileHistoryCacheState::default();
    git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
        .expect("initial history");
    git(repo.path(), &["checkout", "--orphan", "rewritten"]);
    git(repo.path(), &["rm", "-rf", "."]);
    fs::create_dir_all(repo.path().join("docs")).expect("create docs");
    fs::write(&document, "# Title\n\nrewritten\n").expect("rewrite document");
    git(repo.path(), &["add", "."]);
    git(repo.path(), &["commit", "-m", "rewritten root"]);

    let history =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("fallback history");

    assert_eq!(
        history
            .metrics
            .as_ref()
            .map(|metrics| &metrics.cache_status),
        Some(&GitFileHistoryCacheStatus::Fallback)
    );
    assert_eq!(
        history.items.first().map(|item| item.summary.as_str()),
        Some("rewritten root")
    );
}

#[test]
fn file_history_cache_does_not_store_untracked_history() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("new.md");
    fs::write(&document, "# New\n").expect("write untracked");
    let cache = GitFileHistoryCacheState::default();

    let first =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("first history");
    let second =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("second history");

    assert_eq!(first.status, GitFileHistoryStatus::Untracked);
    assert_eq!(
        second.metrics.as_ref().map(|metrics| &metrics.cache_status),
        Some(&GitFileHistoryCacheStatus::Miss)
    );
}

#[test]
fn file_history_metrics_do_not_expose_private_path_or_file_content() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    let cache = GitFileHistoryCacheState::default();

    let history =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, None, None)
            .expect("history");
    let serialized = serde_json::to_string(&history.metrics).expect("serialize metrics");

    assert!(!serialized.contains(&repo.path().to_string_lossy().to_string()));
    assert!(!serialized.contains("original"));
    assert!(serialized.contains("walkedCommits"));
}

#[test]
fn git_commit_graph_returns_repository_and_file_scopes() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    fs::write(&document, "# Title\n\nchanged\n").expect("modify document");
    git(repo.path(), &["add", "docs/sample.md"]);
    git(repo.path(), &["commit", "-m", "update sample"]);

    let repository_graph = git_commit_graph_for_path(
        &repo.path().to_string_lossy(),
        GitCommitGraphScope::Repository,
        None,
        Some(10),
        None,
    )
    .expect("repository graph");
    let file_graph = git_commit_graph_for_path(
        &repo.path().to_string_lossy(),
        GitCommitGraphScope::File,
        Some(&document.to_string_lossy()),
        Some(10),
        None,
    )
    .expect("file graph");

    assert_eq!(repository_graph.status, GitCommitGraphStatus::Ok);
    assert_eq!(repository_graph.scope, GitCommitGraphScope::Repository);
    assert_eq!(
        repository_graph
            .head_commit
            .as_ref()
            .map(|commit| commit.summary.as_str()),
        Some("update sample")
    );
    assert!(repository_graph
        .items
        .iter()
        .any(|item| item.summary == "update sample" && !item.parent_revisions.is_empty()));
    assert_eq!(file_graph.status, GitCommitGraphStatus::Ok);
    assert_eq!(file_graph.scope, GitCommitGraphScope::File);
    assert_eq!(file_graph.relative_path.as_deref(), Some("docs/sample.md"));
}

#[test]
fn git_commit_graph_pages_repository_history_without_overlap() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    for index in 0..5 {
        fs::write(&document, format!("# Title\n\nchange {index}\n")).expect("modify document");
        git(repo.path(), &["add", "docs/sample.md"]);
        git(repo.path(), &["commit", "-m", &format!("change {index}")]);
    }

    let first = git_commit_graph_for_path(
        &repo.path().to_string_lossy(),
        GitCommitGraphScope::Repository,
        None,
        Some(3),
        None,
    )
    .expect("first graph page");
    let second = git_commit_graph_for_path(
        &repo.path().to_string_lossy(),
        GitCommitGraphScope::Repository,
        None,
        Some(3),
        first.next_cursor.as_deref(),
    )
    .expect("second graph page");

    assert_eq!(first.items.len(), 3);
    assert!(first.has_more.unwrap_or(false));
    assert!(first.items.iter().all(|item| !second
        .items
        .iter()
        .any(|next| next.revision == item.revision)));
}

#[test]
fn git_file_history_pages_and_caches_cursor_pages() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("sample.md");
    for index in 0..5 {
        fs::write(&document, format!("# Title\n\nhistory {index}\n")).expect("modify document");
        git(repo.path(), &["add", "docs/sample.md"]);
        git(repo.path(), &["commit", "-m", &format!("history {index}")]);
    }
    let cache = GitFileHistoryCacheState::default();
    let first =
        git_file_history_for_path_with_cache(&document.to_string_lossy(), &cache, Some(3), None)
            .expect("first history page");
    let second = git_file_history_for_path_with_cache(
        &document.to_string_lossy(),
        &cache,
        Some(3),
        first.next_cursor.as_deref(),
    )
    .expect("second history page");
    let cached_second = git_file_history_for_path_with_cache(
        &document.to_string_lossy(),
        &cache,
        Some(3),
        first.next_cursor.as_deref(),
    )
    .expect("cached second history page");

    assert_eq!(first.items.len(), 3);
    assert!(first.has_more.unwrap_or(false));
    assert!(first.items.iter().all(|item| !second
        .items
        .iter()
        .any(|next| next.revision == item.revision)));
    assert_eq!(
        cached_second
            .metrics
            .as_ref()
            .map(|metrics| &metrics.cache_status),
        Some(&GitFileHistoryCacheStatus::Hit)
    );
}
