use super::history_cache::*;
use super::*;
use std::time::{Duration, Instant};

pub fn git_commit_graph_for_path(
    path: &str,
    scope: GitCommitGraphScope,
    file_path: Option<&str>,
    limit: Option<usize>,
    cursor: Option<&str>,
) -> Result<GitCommitGraph, String> {
    if scope == GitCommitGraphScope::File {
        let path = file_path.unwrap_or(path);
        return git_file_commit_graph_for_path(path, limit, cursor);
    }

    let total_started_at = Instant::now();
    let input_path = PathBuf::from(path);
    let discover_start = discover_start_for_path(&input_path)?;
    let repo = match gix::discover(&discover_start) {
        Ok(repo) => repo,
        Err(_) => {
            return Ok(empty_commit_graph(
                GitCommitGraphStatus::NotInRepo,
                GitCommitGraphScope::Repository,
                None,
                None,
                None,
                Some("Path is not inside a Git repository.".to_string()),
            ));
        }
    };
    let workdir = match repo_workdir(&repo) {
        Some(path) => path,
        None => {
            return Ok(empty_commit_graph(
                GitCommitGraphStatus::NotInRepo,
                GitCommitGraphScope::Repository,
                None,
                None,
                None,
                Some("Bare repositories are not supported.".to_string()),
            ));
        }
    };
    let head = match repo.head_commit() {
        Ok(commit) => commit,
        Err(_) => {
            return Ok(empty_commit_graph(
                GitCommitGraphStatus::NoHistory,
                GitCommitGraphScope::Repository,
                Some(path_string(&workdir)),
                None,
                current_branch_name(&repo),
                Some("No commits are available for this repository.".to_string()),
            ));
        }
    };
    let mut items: Vec<GitCommitGraphItem> = Vec::new();
    let max_items = clamp_history_page_limit(limit);
    let mut walked_commits = 0usize;
    let mut cursor_seen = cursor.is_none();
    let walk = head
        .ancestors()
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .map_err(|error| format!("failed to walk Git graph: {error}"))?;
    for info in walk {
        let info = info.map_err(|error| format!("failed to read Git graph: {error}"))?;
        let commit = info
            .object()
            .map_err(|error| format!("failed to read commit object: {error}"))?;
        walked_commits += 1;
        let revision = commit.id().to_string();
        if !cursor_seen {
            if Some(revision.as_str()) == cursor {
                cursor_seen = true;
            }
            continue;
        }
        if items.len() >= max_items {
            let next_cursor = items.last().map(|item| item.revision.clone());
            return Ok(GitCommitGraph {
                status: GitCommitGraphStatus::Ok,
                scope: GitCommitGraphScope::Repository,
                repository_root: Some(path_string(&workdir)),
                relative_path: None,
                current_branch: current_branch_name(&repo),
                head_commit: head_commit_summary(&repo)?,
                items,
                message: None,
                has_more: Some(true),
                next_cursor,
                metrics: Some(GitCommitGraphMetrics {
                    cache_status: GitFileHistoryCacheStatus::Miss,
                    duration_ms: elapsed_ms(total_started_at),
                    walked_commits,
                    returned_commits: max_items,
                    has_more: true,
                    stale_cursor: None,
                }),
            });
        }
        items.push(graph_item_for_commit(&commit, GitDiffStatus::Modified)?);
    }
    if !cursor_seen {
        let mut graph = git_commit_graph_for_path(path, scope, file_path, limit, None)?;
        if let Some(metrics) = graph.metrics.as_mut() {
            metrics.cache_status = GitFileHistoryCacheStatus::Fallback;
            metrics.stale_cursor = Some(true);
        }
        return Ok(graph);
    }

    let returned_commits = items.len();
    Ok(GitCommitGraph {
        status: GitCommitGraphStatus::Ok,
        scope: GitCommitGraphScope::Repository,
        repository_root: Some(path_string(&workdir)),
        relative_path: None,
        current_branch: current_branch_name(&repo),
        head_commit: head_commit_summary(&repo)?,
        items,
        message: None,
        has_more: Some(false),
        next_cursor: None,
        metrics: Some(GitCommitGraphMetrics {
            cache_status: GitFileHistoryCacheStatus::Miss,
            duration_ms: elapsed_ms(total_started_at),
            walked_commits,
            returned_commits,
            has_more: false,
            stale_cursor: None,
        }),
    })
}

#[cfg(test)]
pub fn git_file_history_for_path(path: &str) -> Result<GitFileHistory, String> {
    git_file_history_for_path_inner(path, None, None, None)
}

pub fn git_file_history_for_path_with_cache(
    path: &str,
    cache: &GitFileHistoryCacheState,
    limit: Option<usize>,
    cursor: Option<&str>,
) -> Result<GitFileHistory, String> {
    git_file_history_for_path_inner(path, Some(cache), limit, cursor)
}

fn git_file_history_for_path_inner(
    path: &str,
    cache: Option<&GitFileHistoryCacheState>,
    limit: Option<usize>,
    cursor: Option<&str>,
) -> Result<GitFileHistory, String> {
    let total_started_at = Instant::now();
    let mut metrics = new_file_history_metrics();

    let discovery_started_at = Instant::now();
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            metrics.discovery_ms = elapsed_ms(discovery_started_at);
            return Ok(with_metrics(
                empty_history(
                    GitFileHistoryStatus::NotInRepo,
                    None,
                    Some("Document is not inside a Git repository.".to_string()),
                ),
                metrics,
                total_started_at,
            ));
        }
    };
    metrics.discovery_ms = elapsed_ms(discovery_started_at);

    let status_started_at = Instant::now();
    let status = git_status_for_resolved_path(
        &context.repo,
        &context.absolute_path,
        &context.relative_path,
        &context.relative_path_display,
    )?;
    metrics.status_ms = elapsed_ms(status_started_at);
    if status == GitDiffStatus::Untracked {
        return Ok(with_metrics(
            empty_history(
                GitFileHistoryStatus::Untracked,
                Some(context.relative_path_display),
                Some("This document is not tracked by Git yet.".to_string()),
            ),
            metrics,
            total_started_at,
        ));
    }

    let head_started_at = Instant::now();
    let head = match context.repo.head_commit() {
        Ok(commit) => commit,
        Err(_) => {
            metrics.head_ms = elapsed_ms(head_started_at);
            return Ok(with_metrics(
                empty_history(
                    GitFileHistoryStatus::NoHistory,
                    Some(context.relative_path_display),
                    Some("No commits are available for this repository.".to_string()),
                ),
                metrics,
                total_started_at,
            ));
        }
    };
    metrics.head_ms = elapsed_ms(head_started_at);
    let head_oid = head.id().to_string();
    let repository_root = path_string(&context.workdir);
    let path_key = file_history_path_cache_key(&repository_root, &context.relative_path_display);
    let head_key = file_history_head_cache_key(&path_key, &head_oid);
    let max_items = clamp_history_page_limit(limit);
    let page_key = file_history_page_cache_key(&head_key, max_items, cursor);
    if let Some(cache) = cache {
        if let Some(entry) = cache_entry_for_page(cache, &page_key) {
            let mut history = entry.history;
            metrics.cache_status = GitFileHistoryCacheStatus::Hit;
            metrics.matched_commits = history.items.len();
            metrics.returned_commits = Some(history.items.len());
            metrics.has_more = history.has_more;
            history.metrics = Some(finalize_metrics(metrics, total_started_at));
            return Ok(history);
        }
        if cursor.is_none() {
            if let Some(entry) = cache_entry_for_head(cache, &head_key) {
                let mut history = entry.history;
                metrics.cache_status = GitFileHistoryCacheStatus::Hit;
                metrics.matched_commits = history.items.len();
                metrics.returned_commits = Some(history.items.len());
                metrics.has_more = history.has_more;
                history.metrics = Some(finalize_metrics(metrics, total_started_at));
                return Ok(history);
            }
        }
        if let Some(previous_entry) = latest_cache_entry_for_path(cache, &path_key) {
            if previous_entry.head_oid != head_oid
                && previous_entry.history.status == GitFileHistoryStatus::Ok
            {
                match scan_incremental_file_history(
                    &head,
                    &context.relative_path,
                    &previous_entry,
                    &mut metrics,
                )? {
                    Some(mut history) => {
                        metrics.cache_status = GitFileHistoryCacheStatus::Incremental;
                        history.metrics = Some(finalize_metrics(metrics, total_started_at));
                        cache_file_history(
                            cache,
                            head_key,
                            path_key,
                            &history,
                            head_oid,
                            repository_root,
                            context.relative_path_display,
                        );
                        return Ok(history);
                    }
                    None => {
                        metrics.cache_status = GitFileHistoryCacheStatus::Fallback;
                    }
                }
            }
        }
    }
    let mut history = scan_file_history_page(
        &head,
        &context.relative_path,
        &mut metrics,
        max_items,
        cursor,
    )?;
    if history.items.is_empty() {
        history = empty_history(
            GitFileHistoryStatus::NoHistory,
            Some(context.relative_path_display.clone()),
            Some("No commits touch this document path.".to_string()),
        );
    } else {
        history.relative_path = Some(context.relative_path_display.clone());
    }
    history.metrics = Some(finalize_metrics(metrics, total_started_at));
    if let Some(cache) = cache {
        if history.status == GitFileHistoryStatus::Ok {
            if cursor.is_none() {
                cache_file_history(
                    cache,
                    head_key,
                    path_key,
                    &history,
                    head_oid,
                    repository_root,
                    context.relative_path_display,
                );
            } else {
                cache_file_history_page(
                    cache,
                    page_key,
                    &history,
                    head_oid,
                    repository_root,
                    context.relative_path_display,
                );
            }
        }
    }
    Ok(history)
}

fn scan_file_history_page(
    head: &gix::Commit<'_>,
    relative_path: &Path,
    metrics: &mut GitFileHistoryMetrics,
    max_items: usize,
    cursor: Option<&str>,
) -> Result<GitFileHistory, String> {
    let mut items: Vec<GitFileHistoryItem> = Vec::new();
    let walk_started_at = Instant::now();
    let mut cursor_seen = cursor.is_none();
    let walk = head
        .ancestors()
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .map_err(|error| format!("failed to walk Git history: {error}"))?;

    for info in walk {
        let info = info.map_err(|error| format!("failed to read Git history: {error}"))?;
        let commit = info
            .object()
            .map_err(|error| format!("failed to read commit object: {error}"))?;
        metrics.walked_commits += 1;
        let revision = commit.id().to_string();
        if !cursor_seen {
            if Some(revision.as_str()) == cursor {
                cursor_seen = true;
            }
            continue;
        }
        if let Some(file_status) = file_status_for_commit(&commit, relative_path, metrics)? {
            if items.len() >= max_items {
                let next_cursor = items.last().map(|item| item.revision.clone());
                metrics.walk_ms += elapsed_ms(walk_started_at);
                metrics.returned_commits = Some(items.len());
                metrics.has_more = Some(true);
                return Ok(GitFileHistory {
                    status: GitFileHistoryStatus::Ok,
                    relative_path: None,
                    items,
                    message: None,
                    has_more: Some(true),
                    next_cursor,
                    metrics: None,
                });
            }
            items.push(history_item_for_commit(&commit, file_status)?);
            metrics.matched_commits += 1;
        }
    }
    if !cursor_seen {
        metrics.cache_status = GitFileHistoryCacheStatus::Fallback;
        let history = scan_file_history_page(head, relative_path, metrics, max_items, None)?;
        metrics.stale_cursor = Some(true);
        return Ok(history);
    }
    metrics.walk_ms += elapsed_ms(walk_started_at);
    metrics.returned_commits = Some(items.len());
    metrics.has_more = Some(false);
    metrics.stale_cursor = None;
    Ok(GitFileHistory {
        status: GitFileHistoryStatus::Ok,
        relative_path: None,
        items,
        message: None,
        has_more: Some(false),
        next_cursor: None,
        metrics: None,
    })
}

pub fn git_commit_details_for_path(path: &str, revision: &str) -> Result<GitCommitDetails, String> {
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            return Err("Document is not inside a Git repository.".to_string());
        }
    };
    let commit = resolve_commit(&context.repo, revision)?;
    let revision = commit.id().to_string();
    let short_hash = short_id_for_commit(&commit)?;
    let summary = commit
        .message()
        .map_err(|error| format!("failed to read commit message: {error}"))?
        .summary()
        .to_string();
    let author = commit
        .author()
        .map(|author| author.name.to_string())
        .unwrap_or_else(|_| "Unknown author".to_string());
    let date = commit
        .time()
        .map(|time| time.seconds.to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let message = None;
    let parent = first_parent_commit(&commit);
    let parent_tree = match parent {
        Some(ref parent) => Some(tree_entries(parent)?),
        None => None,
    };
    let commit_tree = tree_entries(&commit)?;
    let files = changed_files_between_trees(parent_tree.as_ref(), &commit_tree, &context.workdir);

    Ok(GitCommitDetails {
        repository_root: Some(path_string(&context.workdir)),
        revision,
        short_hash,
        summary,
        author,
        date,
        files,
        message,
    })
}

pub(super) fn first_parent_commit<'repo>(
    commit: &gix::Commit<'repo>,
) -> Option<gix::Commit<'repo>> {
    commit
        .parent_ids()
        .next()
        .and_then(|id| id.object().ok())
        .map(|object| object.into_commit())
}

fn tree_entries(commit: &gix::Commit<'_>) -> Result<BTreeMap<String, gix::ObjectId>, String> {
    let tree = commit
        .tree()
        .map_err(|error| format!("failed to read commit tree: {error}"))?;
    let files = tree
        .traverse()
        .breadthfirst
        .files()
        .map_err(|error| format!("failed to walk commit tree: {error}"))?;
    Ok(files
        .into_iter()
        .map(|entry| (entry.filepath.as_bstr().to_string(), entry.oid))
        .collect())
}

fn changed_files_between_trees(
    left: Option<&BTreeMap<String, gix::ObjectId>>,
    right: &BTreeMap<String, gix::ObjectId>,
    workdir: &Path,
) -> Vec<GitCommitChangedFile> {
    let empty = BTreeMap::new();
    let left = left.unwrap_or(&empty);
    let mut files = Vec::new();
    for (path, right_id) in right {
        match left.get(path) {
            Some(left_id) if left_id == right_id => {}
            Some(_) => files.push(commit_changed_file(path, GitDiffStatus::Modified, workdir)),
            None => files.push(commit_changed_file(path, GitDiffStatus::Added, workdir)),
        }
    }
    for path in left.keys() {
        if !right.contains_key(path) {
            files.push(commit_changed_file(path, GitDiffStatus::Deleted, workdir));
        }
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    files
}

fn commit_changed_file(
    relative_path: &str,
    status: GitDiffStatus,
    workdir: &Path,
) -> GitCommitChangedFile {
    let document_path = if is_supported_document_relative_path(relative_path) {
        Some(path_string(&workdir.join(relative_path)))
    } else {
        None
    };
    GitCommitChangedFile {
        path: relative_path.to_string(),
        status,
        document_path,
    }
}

fn file_status_for_commit(
    commit: &gix::Commit<'_>,
    relative_path: &Path,
    metrics: &mut GitFileHistoryMetrics,
) -> Result<Option<GitDiffStatus>, String> {
    let blob_started_at = Instant::now();
    let current = blob_bytes_at_commit(commit, relative_path)?;
    let parent = first_parent_commit(commit);
    let parent_bytes = match parent {
        Some(parent) => blob_bytes_at_commit(&parent, relative_path)?,
        None => None,
    };
    metrics.blob_lookup_ms += elapsed_ms(blob_started_at);
    Ok(match (parent_bytes, current) {
        (None, None) => None,
        (Some(left), Some(right)) if left == right => None,
        (Some(_), Some(_)) => Some(GitDiffStatus::Modified),
        (None, Some(_)) => Some(GitDiffStatus::Added),
        (Some(_), None) => Some(GitDiffStatus::Deleted),
    })
}

fn scan_incremental_file_history(
    head: &gix::Commit<'_>,
    relative_path: &Path,
    previous_entry: &GitFileHistoryCacheEntry,
    metrics: &mut GitFileHistoryMetrics,
) -> Result<Option<GitFileHistory>, String> {
    let mut reached_previous_head = false;
    let mut new_items = Vec::new();
    let walk_started_at = Instant::now();
    let walk = head
        .ancestors()
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .map_err(|error| format!("failed to walk Git history: {error}"))?;

    for info in walk {
        let info = info.map_err(|error| format!("failed to read Git history: {error}"))?;
        let commit = info
            .object()
            .map_err(|error| format!("failed to read commit object: {error}"))?;
        if commit.id().to_string() == previous_entry.head_oid {
            reached_previous_head = true;
            break;
        }
        metrics.walked_commits += 1;
        if let Some(file_status) = file_status_for_commit(&commit, relative_path, metrics)? {
            new_items.push(history_item_for_commit(&commit, file_status)?);
            metrics.matched_commits += 1;
        }
    }
    metrics.walk_ms += elapsed_ms(walk_started_at);

    if !reached_previous_head {
        return Ok(None);
    }

    let mut items = new_items;
    items.extend(previous_entry.history.items.clone());
    items.truncate(MAX_HISTORY_ITEMS);
    Ok(Some(GitFileHistory {
        status: GitFileHistoryStatus::Ok,
        relative_path: previous_entry.history.relative_path.clone(),
        items,
        message: previous_entry.history.message.clone(),
        has_more: previous_entry.history.has_more,
        next_cursor: previous_entry.history.next_cursor.clone(),
        metrics: None,
    }))
}

fn history_item_for_commit(
    commit: &gix::Commit<'_>,
    file_status: GitDiffStatus,
) -> Result<GitFileHistoryItem, String> {
    let revision = commit.id().to_string();
    let short_hash = short_id_for_commit(commit)?;
    let parent = first_parent_commit(commit);
    let (parent_revision, parent_short_hash) = match parent {
        Some(parent) => (
            Some(parent.id().to_string()),
            Some(short_id_for_commit(&parent)?),
        ),
        None => (None, None),
    };
    let summary = commit
        .message()
        .map_err(|error| format!("failed to read commit message: {error}"))?
        .summary()
        .to_string();
    let author = commit
        .author()
        .map(|author| author.name.to_string())
        .unwrap_or_else(|_| "Unknown author".to_string());
    let date = commit
        .time()
        .map(|time| time.seconds.to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    Ok(GitFileHistoryItem {
        revision,
        short_hash,
        parent_revision,
        parent_short_hash,
        summary,
        author,
        date,
        file_status,
    })
}

fn git_file_commit_graph_for_path(
    path: &str,
    limit: Option<usize>,
    cursor: Option<&str>,
) -> Result<GitCommitGraph, String> {
    let history = git_file_history_for_path_inner(path, None, limit, cursor)?;
    let (repository_root, current_branch, head_commit) = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => (
            Some(path_string(&context.workdir)),
            current_branch_name(&context.repo),
            head_commit_summary(&context.repo)?,
        ),
        GitPathContext::NotInRepo => (None, None, None),
    };
    let status = match history.status {
        GitFileHistoryStatus::Ok => GitCommitGraphStatus::Ok,
        GitFileHistoryStatus::NotInRepo => GitCommitGraphStatus::NotInRepo,
        GitFileHistoryStatus::Untracked => GitCommitGraphStatus::Untracked,
        GitFileHistoryStatus::NoHistory => GitCommitGraphStatus::NoHistory,
        GitFileHistoryStatus::Unsupported => GitCommitGraphStatus::Unsupported,
        GitFileHistoryStatus::Error => GitCommitGraphStatus::Error,
    };
    let items = history
        .items
        .into_iter()
        .map(|item| GitCommitGraphItem {
            parent_revisions: item
                .parent_revision
                .as_ref()
                .map(|revision| vec![revision.clone()])
                .unwrap_or_default(),
            parent_short_hashes: item
                .parent_short_hash
                .as_ref()
                .map(|short_hash| vec![short_hash.clone()])
                .unwrap_or_default(),
            revision: item.revision,
            short_hash: item.short_hash,
            parent_revision: item.parent_revision,
            parent_short_hash: item.parent_short_hash,
            summary: item.summary,
            author: item.author,
            date: item.date,
            file_status: item.file_status,
        })
        .collect();
    Ok(GitCommitGraph {
        status,
        scope: GitCommitGraphScope::File,
        repository_root,
        relative_path: history.relative_path,
        current_branch,
        head_commit,
        items,
        message: history.message,
        has_more: history.has_more,
        next_cursor: history.next_cursor,
        metrics: history.metrics.map(|metrics| GitCommitGraphMetrics {
            cache_status: metrics.cache_status,
            duration_ms: metrics.duration_ms,
            walked_commits: metrics.walked_commits,
            returned_commits: metrics.returned_commits.unwrap_or(0),
            has_more: metrics.has_more.unwrap_or(false),
            stale_cursor: metrics.stale_cursor,
        }),
    })
}

fn graph_item_for_commit(
    commit: &gix::Commit<'_>,
    file_status: GitDiffStatus,
) -> Result<GitCommitGraphItem, String> {
    let revision = commit.id().to_string();
    let short_hash = short_id_for_commit(commit)?;
    let parent_revisions = commit
        .parent_ids()
        .map(|id| id.to_string())
        .collect::<Vec<_>>();
    let parent_short_hashes = parent_revisions
        .iter()
        .map(|revision| revision.chars().take(7).collect::<String>())
        .collect::<Vec<_>>();
    let summary = commit
        .message()
        .map_err(|error| format!("failed to read commit message: {error}"))?
        .summary()
        .to_string();
    let author = commit
        .author()
        .map(|author| author.name.to_string())
        .unwrap_or_else(|_| "Unknown author".to_string());
    let date = commit
        .time()
        .map(|time| time.seconds.to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    Ok(GitCommitGraphItem {
        revision,
        short_hash,
        parent_revision: parent_revisions.first().cloned(),
        parent_short_hash: parent_short_hashes.first().cloned(),
        parent_revisions,
        parent_short_hashes,
        summary,
        author,
        date,
        file_status,
    })
}
fn empty_history(
    status: GitFileHistoryStatus,
    relative_path: Option<String>,
    message: Option<String>,
) -> GitFileHistory {
    GitFileHistory {
        status,
        relative_path,
        items: Vec::new(),
        message,
        has_more: Some(false),
        next_cursor: None,
        metrics: None,
    }
}

pub(super) fn elapsed_ms(started_at: Instant) -> u64 {
    duration_ms(started_at.elapsed())
}

fn duration_ms(duration: Duration) -> u64 {
    duration.as_millis().try_into().unwrap_or(u64::MAX)
}

fn empty_commit_graph(
    status: GitCommitGraphStatus,
    scope: GitCommitGraphScope,
    repository_root: Option<String>,
    relative_path: Option<String>,
    current_branch: Option<String>,
    message: Option<String>,
) -> GitCommitGraph {
    GitCommitGraph {
        status,
        scope,
        repository_root,
        relative_path,
        current_branch,
        head_commit: None,
        items: Vec::new(),
        message,
        has_more: Some(false),
        next_cursor: None,
        metrics: None,
    }
}
