use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffPreview {
    pub repository_root: Option<String>,
    pub relative_path: Option<String>,
    pub status: GitDiffStatus,
    pub left_label: String,
    pub right_label: String,
    pub hunks: Vec<GitDiffHunk>,
    pub message: Option<String>,
    pub left_text: Option<String>,
    pub right_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_relative_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_relative_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_resource_source: Option<GitDiffResourceSource>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_resource_source: Option<GitDiffResourceSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GitDiffResourceSource {
    Worktree,
    Index,
    Commit { revision: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    pub path: String,
    pub status: GitDiffStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitChangesStatus {
    Ok,
    NotInRepo,
    NoHistory,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitChangeEntry {
    pub path: String,
    pub status: GitDiffStatus,
    pub document_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitHeadCommit {
    pub revision: String,
    pub short_hash: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitChanges {
    pub status: GitChangesStatus,
    pub repository_root: Option<String>,
    pub current_branch: Option<String>,
    pub head_commit: Option<GitHeadCommit>,
    pub items: Vec<GitChangeEntry>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchDiffEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub status: GitDiffStatus,
    pub document_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitBranchDiffStatus {
    Ok,
    NotInRepo,
    NoHistory,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchDiff {
    pub status: GitBranchDiffStatus,
    pub repository_root: Option<String>,
    pub current_branch: Option<String>,
    pub head_commit: Option<GitHeadCommit>,
    pub base_ref: Option<String>,
    pub head_ref: Option<String>,
    pub merge_base: Option<String>,
    pub base_candidates: Vec<String>,
    #[serde(default)]
    pub provider_base_candidates: Vec<GitBranchDiffProviderBaseCandidate>,
    pub items: Vec<GitBranchDiffEntry>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchDiffProviderBaseCandidate {
    pub provider: String,
    pub label: String,
    pub base_ref: String,
    pub source_branch: String,
    pub target_branch: String,
    pub available: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitFileHistory {
    pub status: GitFileHistoryStatus,
    pub relative_path: Option<String>,
    pub items: Vec<GitFileHistoryItem>,
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_more: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metrics: Option<GitFileHistoryMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitFileHistoryCacheStatus {
    Miss,
    Hit,
    Incremental,
    Fallback,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitFileHistoryMetrics {
    pub cache_status: GitFileHistoryCacheStatus,
    pub duration_ms: u64,
    pub discovery_ms: u64,
    pub status_ms: u64,
    pub head_ms: u64,
    pub walk_ms: u64,
    pub blob_lookup_ms: u64,
    pub walked_commits: usize,
    pub matched_commits: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub returned_commits: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_more: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stale_cursor: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitRefKind {
    Branch,
    Tag,
    Commit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitRefListStatus {
    Ok,
    NotInRepo,
    Untracked,
    Unsupported,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitRefItem {
    pub kind: GitRefKind,
    pub name: String,
    pub revision: String,
    pub short_revision: String,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitRefList {
    pub status: GitRefListStatus,
    pub relative_path: Option<String>,
    pub items: Vec<GitRefItem>,
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_more: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metrics: Option<GitRefListMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitRefListMetrics {
    pub kind: GitRefKind,
    pub duration_ms: f64,
    pub returned_refs: usize,
    pub walked_commits: usize,
    pub has_more: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor_present: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stale_cursor: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitFileHistoryStatus {
    Ok,
    NotInRepo,
    Untracked,
    NoHistory,
    Unsupported,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitFileHistoryItem {
    pub revision: String,
    pub short_hash: String,
    pub parent_revision: Option<String>,
    pub parent_short_hash: Option<String>,
    pub summary: String,
    pub author: String,
    pub date: String,
    pub file_status: GitDiffStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitCommitGraphScope {
    Repository,
    File,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitCommitGraphStatus {
    Ok,
    NotInRepo,
    Untracked,
    NoHistory,
    Unsupported,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitGraphItem {
    pub revision: String,
    pub short_hash: String,
    pub parent_revision: Option<String>,
    pub parent_short_hash: Option<String>,
    pub parent_revisions: Vec<String>,
    pub parent_short_hashes: Vec<String>,
    pub summary: String,
    pub author: String,
    pub date: String,
    pub file_status: GitDiffStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitGraph {
    pub status: GitCommitGraphStatus,
    pub scope: GitCommitGraphScope,
    pub repository_root: Option<String>,
    pub relative_path: Option<String>,
    pub current_branch: Option<String>,
    pub head_commit: Option<GitHeadCommit>,
    pub items: Vec<GitCommitGraphItem>,
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_more: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metrics: Option<GitCommitGraphMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitGraphMetrics {
    pub cache_status: GitFileHistoryCacheStatus,
    pub duration_ms: u64,
    pub walked_commits: usize,
    pub returned_commits: usize,
    pub has_more: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stale_cursor: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitChangedFile {
    pub path: String,
    pub status: GitDiffStatus,
    pub document_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDetails {
    pub revision: String,
    pub short_hash: String,
    pub summary: String,
    pub author: String,
    pub date: String,
    pub files: Vec<GitCommitChangedFile>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitDiffStatus {
    Clean,
    Modified,
    Added,
    Deleted,
    Renamed,
    Untracked,
    Binary,
    NotInRepo,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffLine {
    pub kind: GitDiffLineKind,
    pub old_line: Option<usize>,
    pub new_line: Option<usize>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitDiffLineKind {
    Context,
    Added,
    Removed,
}
