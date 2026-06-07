use super::*;
use std::{collections::HashMap, sync::Mutex, time::Instant};

#[derive(Default)]
pub struct GitFileHistoryCacheState {
    entries: Mutex<GitFileHistoryCache>,
}

impl GitFileHistoryCacheState {
    pub fn clear_all(&self) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.by_head.clear();
            entries.page_by_cursor.clear();
            entries.latest_by_path.clear();
        }
    }
}

#[derive(Default)]
struct GitFileHistoryCache {
    by_head: HashMap<String, GitFileHistoryCacheEntry>,
    page_by_cursor: HashMap<String, GitFileHistoryCacheEntry>,
    latest_by_path: HashMap<String, String>,
}

#[derive(Clone)]
pub(super) struct GitFileHistoryCacheEntry {
    pub(super) history: GitFileHistory,
    pub(super) head_oid: String,
    _repository_root: String,
    _relative_path: String,
    _created_at: Instant,
}

pub(super) fn new_file_history_metrics() -> GitFileHistoryMetrics {
    GitFileHistoryMetrics {
        cache_status: GitFileHistoryCacheStatus::Miss,
        duration_ms: 0,
        discovery_ms: 0,
        status_ms: 0,
        head_ms: 0,
        walk_ms: 0,
        blob_lookup_ms: 0,
        walked_commits: 0,
        matched_commits: 0,
        returned_commits: None,
        has_more: None,
        stale_cursor: None,
    }
}

pub(super) fn finalize_metrics(
    mut metrics: GitFileHistoryMetrics,
    total_started_at: Instant,
) -> GitFileHistoryMetrics {
    metrics.duration_ms = elapsed_ms(total_started_at);
    metrics
}

pub(super) fn with_metrics(
    mut history: GitFileHistory,
    metrics: GitFileHistoryMetrics,
    total_started_at: Instant,
) -> GitFileHistory {
    history.metrics = Some(finalize_metrics(metrics, total_started_at));
    history
}

pub(super) fn file_history_path_cache_key(repository_root: &str, relative_path: &str) -> String {
    format!("{repository_root}\0{relative_path}")
}

pub(super) fn file_history_head_cache_key(path_key: &str, head_oid: &str) -> String {
    format!("{path_key}\0{head_oid}")
}

pub(super) fn file_history_page_cache_key(
    head_key: &str,
    limit: usize,
    cursor: Option<&str>,
) -> String {
    format!("{head_key}\0limit={limit}\0cursor={}", cursor.unwrap_or(""))
}

pub(super) fn clamp_history_page_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(MAX_HISTORY_ITEMS)
        .clamp(1, MAX_HISTORY_ITEMS)
}

pub(super) fn cache_entry_for_page(
    cache: &GitFileHistoryCacheState,
    page_key: &str,
) -> Option<GitFileHistoryCacheEntry> {
    cache
        .entries
        .lock()
        .ok()
        .and_then(|entries| entries.page_by_cursor.get(page_key).cloned())
}

pub(super) fn cache_entry_for_head(
    cache: &GitFileHistoryCacheState,
    head_key: &str,
) -> Option<GitFileHistoryCacheEntry> {
    cache
        .entries
        .lock()
        .ok()
        .and_then(|entries| entries.by_head.get(head_key).cloned())
}

pub(super) fn latest_cache_entry_for_path(
    cache: &GitFileHistoryCacheState,
    path_key: &str,
) -> Option<GitFileHistoryCacheEntry> {
    cache.entries.lock().ok().and_then(|entries| {
        entries
            .latest_by_path
            .get(path_key)
            .and_then(|head_key| entries.by_head.get(head_key))
            .cloned()
    })
}

fn insert_file_history_cache(
    cache: &GitFileHistoryCacheState,
    head_key: String,
    path_key: String,
    entry: GitFileHistoryCacheEntry,
) {
    if let Ok(mut entries) = cache.entries.lock() {
        entries.latest_by_path.insert(path_key, head_key.clone());
        entries.by_head.insert(head_key, entry);
    }
}

pub(super) fn cache_file_history(
    cache: &GitFileHistoryCacheState,
    head_key: String,
    path_key: String,
    history: &GitFileHistory,
    head_oid: String,
    repository_root: String,
    relative_path: String,
) {
    insert_file_history_cache(
        cache,
        head_key,
        path_key,
        GitFileHistoryCacheEntry {
            history: history.clone_without_metrics(),
            head_oid,
            _repository_root: repository_root,
            _relative_path: relative_path,
            _created_at: Instant::now(),
        },
    );
}

pub(super) fn cache_file_history_page(
    cache: &GitFileHistoryCacheState,
    page_key: String,
    history: &GitFileHistory,
    head_oid: String,
    repository_root: String,
    relative_path: String,
) {
    if let Ok(mut entries) = cache.entries.lock() {
        entries.page_by_cursor.insert(
            page_key,
            GitFileHistoryCacheEntry {
                history: history.clone_without_metrics(),
                head_oid,
                _repository_root: repository_root,
                _relative_path: relative_path,
                _created_at: Instant::now(),
            },
        );
    }
}

trait GitFileHistoryMetricsStrip {
    fn clone_without_metrics(&self) -> GitFileHistory;
}

impl GitFileHistoryMetricsStrip for GitFileHistory {
    fn clone_without_metrics(&self) -> GitFileHistory {
        let mut history = self.clone();
        history.metrics = None;
        history
    }
}
