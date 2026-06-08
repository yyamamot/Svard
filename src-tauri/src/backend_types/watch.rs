use notify::RecommendedWatcher;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{atomic::AtomicU64, Mutex},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWatchRegistration {
    pub watch_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWatchEvent {
    pub watch_id: String,
    pub path: String,
    pub kind: String,
}

pub(crate) struct DocumentWatchEntry {
    pub(crate) _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct DocumentWatchState {
    pub(crate) next_id: AtomicU64,
    pub(crate) watchers: Mutex<HashMap<String, DocumentWatchEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryWatchRegistration {
    pub watch_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryWatchEvent {
    pub watch_id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changed_path: Option<String>,
    pub kind: String,
}

pub(crate) struct DirectoryWatchEntry {
    pub(crate) _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct DirectoryWatchState {
    pub(crate) next_id: AtomicU64,
    pub(crate) watchers: Mutex<HashMap<String, DirectoryWatchEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusWatchRegistration {
    pub watch_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusWatchEvent {
    pub watch_id: String,
    pub repository_id: String,
    pub kind: String,
}

pub(crate) struct GitStatusWatchEntry {
    pub(crate) _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct GitStatusWatchState {
    pub(crate) next_id: AtomicU64,
    pub(crate) watchers: Mutex<HashMap<String, GitStatusWatchEntry>>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct GitMetadataWatchTarget {
    pub(crate) repository_id: String,
    pub(crate) git_dir: PathBuf,
    pub(crate) refs_dir: Option<PathBuf>,
}
