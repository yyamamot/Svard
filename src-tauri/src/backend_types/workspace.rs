use serde::{Deserialize, Serialize};

use super::{BookmarkKind, SourceControlGraphScope, SourceControlView, WorkspaceSidebarTab};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub last_directory: Option<String>,
    pub open_tabs: Vec<String>,
    pub active_path: Option<String>,
    pub pinned_search: Option<String>,
    #[serde(default)]
    pub expanded_directories: Vec<String>,
    #[serde(default = "default_sidebar_tab")]
    pub sidebar_tab: WorkspaceSidebarTab,
    #[serde(default = "default_source_control_view")]
    pub source_control_view: SourceControlView,
    #[serde(default = "default_source_control_graph_scope")]
    pub source_control_graph_scope: SourceControlGraphScope,
    #[serde(default)]
    pub source_control_branch_diff_base_ref: Option<String>,
    #[serde(default)]
    pub bookmarks: Vec<BookmarkEntry>,
    #[serde(default)]
    pub recent_documents: Vec<RecentDocumentEntry>,
    #[serde(default)]
    pub recent_directories: Vec<RecentDirectoryEntry>,
    #[serde(default)]
    pub recent_tabs: Vec<String>,
    #[serde(default)]
    pub pinned_tabs: Vec<String>,
    #[serde(default)]
    pub scroll_positions: std::collections::BTreeMap<String, u32>,
    #[serde(default)]
    pub active_heading_by_path: std::collections::BTreeMap<String, String>,
    #[serde(default)]
    pub split_session: Option<SplitSessionState>,
    #[serde(default)]
    pub window_sessions: std::collections::BTreeMap<String, WorkspaceWindowSession>,
    #[serde(default)]
    pub restorable_window_session_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceWindowSession {
    #[serde(default)]
    pub last_directory: Option<String>,
    #[serde(default)]
    pub open_tabs: Vec<String>,
    #[serde(default)]
    pub active_path: Option<String>,
    #[serde(default)]
    pub pinned_search: Option<String>,
    #[serde(default)]
    pub expanded_directories: Vec<String>,
    #[serde(default = "default_sidebar_tab")]
    pub sidebar_tab: WorkspaceSidebarTab,
    #[serde(default = "default_source_control_view")]
    pub source_control_view: SourceControlView,
    #[serde(default = "default_source_control_graph_scope")]
    pub source_control_graph_scope: SourceControlGraphScope,
    #[serde(default)]
    pub source_control_branch_diff_base_ref: Option<String>,
    #[serde(default)]
    pub recent_directories: Vec<RecentDirectoryEntry>,
    #[serde(default)]
    pub recent_tabs: Vec<String>,
    #[serde(default)]
    pub pinned_tabs: Vec<String>,
    #[serde(default)]
    pub scroll_positions: std::collections::BTreeMap<String, u32>,
    #[serde(default)]
    pub active_heading_by_path: std::collections::BTreeMap<String, String>,
    #[serde(default)]
    pub split_session: Option<SplitSessionState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkEntry {
    pub path: String,
    #[serde(default)]
    pub kind: BookmarkKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentDocumentEntry {
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    pub last_opened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentDirectoryEntry {
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub last_opened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SplitSessionState {
    pub enabled: bool,
    pub focused_pane_id: String,
    pub split_ratio: f64,
    pub pane_paths: SplitPanePaths,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SplitPanePaths {
    pub left: Option<String>,
    pub right: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathResolutionInput {
    pub document_path: Option<String>,
    pub base_path: Option<String>,
    pub last_directory: Option<String>,
    #[serde(default)]
    pub recent_directories: Vec<String>,
    #[serde(default)]
    pub expanded_directories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum WorkspaceLocationKind {
    Local,
    WslUnc,
    NetworkUnc,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum WorkspacePerformanceMode {
    Normal,
    WslMitigated,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEnvironment {
    pub location_kind: WorkspaceLocationKind,
    pub performance_mode: WorkspacePerformanceMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathResolution {
    pub initial_directory: Option<String>,
    pub expanded_directories: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<WorkspaceEnvironment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentLinkResolutionInput {
    pub document_path: String,
    pub href: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentLinkResolutionMetrics {
    pub kind: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note_count: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scanned_dirs: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub performance_mode: Option<WorkspacePerformanceMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentLinkResolution {
    pub status: String,
    pub path: Option<String>,
    pub href: Option<String>,
    pub hash: Option<String>,
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metrics: Option<DocumentLinkResolutionMetrics>,
}

pub(crate) fn default_workspace_state() -> WorkspaceState {
    WorkspaceState {
        last_directory: None,
        open_tabs: Vec::new(),
        active_path: None,
        pinned_search: None,
        expanded_directories: Vec::new(),
        sidebar_tab: default_sidebar_tab(),
        source_control_view: default_source_control_view(),
        source_control_graph_scope: default_source_control_graph_scope(),
        source_control_branch_diff_base_ref: None,
        bookmarks: Vec::new(),
        recent_documents: Vec::new(),
        recent_directories: Vec::new(),
        recent_tabs: Vec::new(),
        pinned_tabs: Vec::new(),
        scroll_positions: std::collections::BTreeMap::new(),
        active_heading_by_path: std::collections::BTreeMap::new(),
        split_session: None,
        window_sessions: std::collections::BTreeMap::new(),
        restorable_window_session_ids: Vec::new(),
    }
}

fn default_sidebar_tab() -> WorkspaceSidebarTab {
    WorkspaceSidebarTab::Files
}

fn default_source_control_view() -> SourceControlView {
    SourceControlView::Changes
}

fn default_source_control_graph_scope() -> SourceControlGraphScope {
    SourceControlGraphScope::Repository
}
