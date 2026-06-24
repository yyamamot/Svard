use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    ffi::OsString,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, atomic::Ordering},
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

use crate::backend_types::*;
use crate::document_io::is_supported_document_file;
use crate::git_diff::GitFileHistoryCacheState;
use crate::path_policy::{
    display_safe_path, path_to_ui_path, path_to_ui_string, resolve_existing_directory_path,
    resolve_existing_file_path,
};

const DOCUMENT_WATCH_EVENT: &str = "document-watch-event";
const DIRECTORY_WATCH_EVENT: &str = "directory-watch-event";
const GIT_STATUS_WATCH_EVENT: &str = "git-status-watch-event";
const DOCUMENT_WATCH_DEBOUNCE_MS: u64 = 200;
pub(crate) const GIT_STATUS_WATCH_DEBOUNCE_MS: u64 = 500;

pub(crate) fn register_document_watch(
    path: &str,
    app: &tauri::AppHandle,
    state: &DocumentWatchState,
) -> Result<DocumentWatchRegistration, String> {
    let document_path = normalize_watch_document_path(path)?;
    let parent = document_path
        .parent()
        .ok_or_else(|| "watch path has no parent directory".to_string())?
        .to_path_buf();
    let target_name = document_path
        .file_name()
        .ok_or_else(|| "watch path has no file name".to_string())?
        .to_os_string();
    let watch_id = format!(
        "watch-{}",
        state.next_id.fetch_add(1, Ordering::Relaxed) + 1
    );
    let event_path = path_to_ui_string(&document_path);
    let app_handle = app.clone();
    let watch_id_for_event = watch_id.clone();
    let event_path_for_event = event_path.clone();
    let last_emitted_at = Arc::new(Mutex::new(None::<Instant>));
    let last_emitted_for_event = Arc::clone(&last_emitted_at);

    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| match result {
            Ok(event) => {
                if !event_matches_document_path(&event.paths, &target_name) {
                    return;
                }
                if !should_emit_watch_event(&last_emitted_for_event) {
                    return;
                }
                let payload = DocumentWatchEvent {
                    watch_id: watch_id_for_event.clone(),
                    path: event_path_for_event.clone(),
                    kind: document_watch_event_kind(&event.kind),
                };
                let _ = app_handle.emit(DOCUMENT_WATCH_EVENT, payload);
            }
            Err(_) => {
                let payload = DocumentWatchEvent {
                    watch_id: watch_id_for_event.clone(),
                    path: event_path_for_event.clone(),
                    kind: "error".to_string(),
                };
                let _ = app_handle.emit(DOCUMENT_WATCH_EVENT, payload);
            }
        },
        Config::default(),
    )
    .map_err(|error| format!("failed to create file watcher: {error}"))?;

    watcher
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(|error| {
            format!(
                "failed to watch directory {}: {error}",
                display_safe_path(&parent)
            )
        })?;

    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "failed to lock document watchers".to_string())?;
    watchers.insert(watch_id.clone(), DocumentWatchEntry { _watcher: watcher });

    Ok(DocumentWatchRegistration {
        watch_id,
        path: event_path,
    })
}

pub(crate) fn remove_document_watch(
    watch_id: &str,
    state: &DocumentWatchState,
) -> Result<(), String> {
    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "failed to lock document watchers".to_string())?;
    watchers.remove(watch_id);
    Ok(())
}

pub(crate) fn register_directory_watch(
    path: &str,
    recursive: bool,
    app: &tauri::AppHandle,
    state: &DirectoryWatchState,
) -> Result<DirectoryWatchRegistration, String> {
    let directory_path = normalize_watch_directory_path(path)?;
    let watch_id = format!(
        "directory-watch-{}",
        state.next_id.fetch_add(1, Ordering::Relaxed) + 1
    );
    let event_path = path_to_ui_string(&directory_path);
    let app_handle = app.clone();
    let watch_id_for_event = watch_id.clone();
    let event_path_for_event = event_path.clone();
    let directory_path_for_event = directory_path.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| match result {
            Ok(event) => {
                if !event_matches_directory_watch_path(
                    &event.paths,
                    &directory_path_for_event,
                    recursive,
                ) {
                    return;
                }
                let changed_path =
                    directory_watch_changed_path(&event.paths, &directory_path_for_event);
                let payload = DirectoryWatchEvent {
                    watch_id: watch_id_for_event.clone(),
                    path: event_path_for_event.clone(),
                    changed_path,
                    kind: document_watch_event_kind(&event.kind),
                };
                let _ = app_handle.emit(DIRECTORY_WATCH_EVENT, payload);
            }
            Err(_) => {
                let payload = DirectoryWatchEvent {
                    watch_id: watch_id_for_event.clone(),
                    path: event_path_for_event.clone(),
                    changed_path: None,
                    kind: "error".to_string(),
                };
                let _ = app_handle.emit(DIRECTORY_WATCH_EVENT, payload);
            }
        },
        Config::default(),
    )
    .map_err(|error| format!("failed to create directory watcher: {error}"))?;

    watcher
        .watch(
            &directory_path,
            if recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            },
        )
        .map_err(|error| {
            format!(
                "failed to watch directory {}: {error}",
                display_safe_path(&directory_path)
            )
        })?;

    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "failed to lock directory watchers".to_string())?;
    watchers.insert(watch_id.clone(), DirectoryWatchEntry { _watcher: watcher });

    Ok(DirectoryWatchRegistration {
        watch_id,
        path: event_path,
    })
}

pub(crate) fn remove_directory_watch(
    watch_id: &str,
    state: &DirectoryWatchState,
) -> Result<(), String> {
    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "failed to lock directory watchers".to_string())?;
    watchers.remove(watch_id);
    Ok(())
}

pub(crate) fn register_git_status_watch(
    paths: Vec<String>,
    app: &tauri::AppHandle,
    state: &GitStatusWatchState,
) -> Result<GitStatusWatchRegistration, String> {
    let targets = git_metadata_watch_targets_for_paths(&paths);
    let watch_id = format!(
        "git-status-watch-{}",
        state.next_id.fetch_add(1, Ordering::Relaxed) + 1
    );

    if targets.is_empty() {
        return Ok(GitStatusWatchRegistration { watch_id });
    }

    let app_handle = app.clone();
    let watch_id_for_event = watch_id.clone();
    let target_git_dirs = targets
        .iter()
        .map(|target| target.git_dir.clone())
        .collect::<Vec<_>>();
    let target_refs_dirs = targets
        .iter()
        .filter_map(|target| target.refs_dir.clone())
        .collect::<Vec<_>>();
    let repository_id = targets
        .first()
        .map(|target| target.repository_id.clone())
        .unwrap_or_else(|| "unknown".to_string());
    let last_emitted_at = Arc::new(Mutex::new(None::<Instant>));
    let last_emitted_for_event = Arc::clone(&last_emitted_at);

    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| match result {
            Ok(event) => {
                if !event_matches_git_metadata(&event.paths, &target_git_dirs, &target_refs_dirs) {
                    return;
                }
                if !should_emit_debounced_event(
                    &last_emitted_for_event,
                    GIT_STATUS_WATCH_DEBOUNCE_MS,
                ) {
                    return;
                }
                app_handle.state::<GitFileHistoryCacheState>().clear_all();
                let payload = GitStatusWatchEvent {
                    watch_id: watch_id_for_event.clone(),
                    repository_id: repository_id.clone(),
                    kind: document_watch_event_kind(&event.kind),
                };
                let _ = app_handle.emit(GIT_STATUS_WATCH_EVENT, payload);
            }
            Err(_) => {
                let payload = GitStatusWatchEvent {
                    watch_id: watch_id_for_event.clone(),
                    repository_id: repository_id.clone(),
                    kind: "error".to_string(),
                };
                let _ = app_handle.emit(GIT_STATUS_WATCH_EVENT, payload);
            }
        },
        Config::default(),
    )
    .map_err(|error| format!("failed to create Git status watcher: {error}"))?;

    for target in &targets {
        watcher
            .watch(&target.git_dir, RecursiveMode::NonRecursive)
            .map_err(|error| {
                format!(
                    "failed to watch Git metadata {}: {error}",
                    display_safe_path(&target.git_dir)
                )
            })?;
        if let Some(refs_dir) = &target.refs_dir {
            watcher
                .watch(refs_dir, RecursiveMode::Recursive)
                .map_err(|error| {
                    format!(
                        "failed to watch Git refs {}: {error}",
                        display_safe_path(refs_dir)
                    )
                })?;
        }
    }

    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "failed to lock Git status watchers".to_string())?;
    watchers.insert(watch_id.clone(), GitStatusWatchEntry { _watcher: watcher });

    Ok(GitStatusWatchRegistration { watch_id })
}

pub(crate) fn remove_git_status_watch(
    watch_id: &str,
    state: &GitStatusWatchState,
) -> Result<(), String> {
    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "failed to lock Git status watchers".to_string())?;
    watchers.remove(watch_id);
    Ok(())
}

pub(crate) fn git_metadata_watch_targets_for_paths(
    paths: &[String],
) -> Vec<GitMetadataWatchTarget> {
    let mut targets = BTreeSet::new();
    for path in paths {
        if let Some(target) = git_metadata_watch_target_for_path(path) {
            targets.insert(target);
        }
    }
    targets.into_iter().collect()
}

pub(crate) fn git_metadata_watch_target_for_path(path: &str) -> Option<GitMetadataWatchTarget> {
    let raw_path = PathBuf::from(path);
    let absolute_path = resolve_existing_directory_path(&raw_path)
        .or_else(|_| resolve_existing_file_path(&raw_path))
        .ok()?;
    if absolute_path.is_file() && !is_supported_document_file(&absolute_path) {
        return None;
    }
    if !absolute_path.is_file() && !absolute_path.is_dir() {
        return None;
    }
    let discover_start = if absolute_path.is_dir() {
        absolute_path.clone()
    } else {
        absolute_path.parent()?.to_path_buf()
    };
    let repo = gix::discover(discover_start).ok()?;
    let git_dir = path_to_ui_path(repo.git_dir());
    let refs_dir = git_dir.join("refs").is_dir().then(|| git_dir.join("refs"));
    Some(GitMetadataWatchTarget {
        repository_id: hash_path_for_event(&git_dir),
        git_dir,
        refs_dir,
    })
}

pub(crate) fn hash_path_for_event(path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    hex_encode(&hasher.finalize()[..8])
}

pub(crate) fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(crate) fn event_matches_git_metadata(
    paths: &[PathBuf],
    git_dirs: &[PathBuf],
    refs_dirs: &[PathBuf],
) -> bool {
    paths.iter().any(|path| {
        let file_name = path.file_name().and_then(|name| name.to_str());
        if matches!(
            file_name,
            Some("index" | "index.lock" | "HEAD" | "packed-refs" | "packed-refs.lock")
        ) {
            return true;
        }
        refs_dirs.iter().any(|refs_dir| path.starts_with(refs_dir))
            || git_dirs
                .iter()
                .any(|git_dir| path == git_dir || path.starts_with(git_dir.join("refs")))
    })
}

pub(crate) fn normalize_watch_document_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    let normalized = resolve_existing_file_path(&raw_path).map_err(|error| {
        format!(
            "failed to resolve watch path {}: {error}",
            display_safe_path(&raw_path)
        )
    })?;

    if !is_supported_document_file(&normalized) {
        return Err("only supported markup documents can be watched".to_string());
    }

    Ok(normalized)
}

pub(crate) fn normalize_watch_directory_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    resolve_existing_directory_path(&raw_path).map_err(|error| {
        format!(
            "failed to resolve directory watch path {}: {error}",
            display_safe_path(&raw_path)
        )
    })
}

pub(crate) fn event_matches_document_path(paths: &[PathBuf], target_name: &OsString) -> bool {
    paths
        .iter()
        .any(|path| path.file_name() == Some(target_name))
}

pub(crate) fn event_matches_directory_path(paths: &[PathBuf], directory_path: &Path) -> bool {
    paths
        .iter()
        .any(|path| path_is_same(path, directory_path) || path_parent_is(path, directory_path))
}

pub(crate) fn event_matches_directory_watch_path(
    paths: &[PathBuf],
    directory_path: &Path,
    recursive: bool,
) -> bool {
    if !recursive {
        return event_matches_directory_path(paths, directory_path);
    }
    paths
        .iter()
        .any(|path| path_is_same(path, directory_path) || path_is_descendant(path, directory_path))
}

pub(crate) fn directory_watch_changed_path(
    paths: &[PathBuf],
    directory_path: &Path,
) -> Option<String> {
    paths
        .iter()
        .find(|path| path.parent() == Some(directory_path))
        .or_else(|| {
            paths
                .iter()
                .find(|path| path_is_descendant(path, directory_path))
        })
        .map(|path| path_to_ui_string(path))
}

fn path_is_same(path: &Path, directory_path: &Path) -> bool {
    path == directory_path
}

fn path_parent_is(path: &Path, directory_path: &Path) -> bool {
    path.parent()
        .map(|parent| parent == directory_path)
        .unwrap_or(false)
}

fn path_is_descendant(path: &Path, directory_path: &Path) -> bool {
    path.strip_prefix(directory_path)
        .map(|relative| relative.components().next().is_some())
        .unwrap_or(false)
}

pub(crate) fn should_emit_watch_event(last_emitted_at: &Mutex<Option<Instant>>) -> bool {
    should_emit_debounced_event(last_emitted_at, DOCUMENT_WATCH_DEBOUNCE_MS)
}

pub(crate) fn should_emit_debounced_event(
    last_emitted_at: &Mutex<Option<Instant>>,
    debounce_ms: u64,
) -> bool {
    let Ok(mut last_emitted_at) = last_emitted_at.lock() else {
        return true;
    };
    let now = Instant::now();
    if last_emitted_at
        .map(|last| now.duration_since(last) < Duration::from_millis(debounce_ms))
        .unwrap_or(false)
    {
        return false;
    }
    *last_emitted_at = Some(now);
    true
}

pub(crate) fn document_watch_event_kind(kind: &EventKind) -> String {
    match kind {
        EventKind::Create(_) => "created",
        EventKind::Modify(_) => "modified",
        EventKind::Remove(_) => "removed",
        EventKind::Access(_) => "accessed",
        EventKind::Any => "changed",
        EventKind::Other => "other",
    }
    .to_string()
}
