use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    path::PathBuf,
    sync::{atomic::AtomicU64, Mutex},
};

use notify::RecommendedWatcher;

macro_rules! string_enum {
    (
        $vis:vis enum $name:ident {
            default $default:ident = $default_value:literal,
            $($variant:ident = $value:literal),* $(,)?
        }
    ) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        $vis enum $name {
            $default,
            $($variant),*
        }

        impl $name {
            pub(crate) fn as_str(self) -> &'static str {
                match self {
                    Self::$default => $default_value,
                    $(Self::$variant => $value),*
                }
            }

            pub(crate) fn from_value(value: &str) -> Self {
                match value {
                    $default_value => Self::$default,
                    $($value => Self::$variant,)*
                    _ => Self::$default,
                }
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::$default
            }
        }

        impl Serialize for $name {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::Serializer,
            {
                serializer.serialize_str(self.as_str())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                let value = String::deserialize(deserializer)?;
                Ok(Self::from_value(&value))
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self::from_value(value)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self::from_value(&value)
            }
        }

        impl PartialEq<&str> for $name {
            fn eq(&self, other: &&str) -> bool {
                self.as_str() == *other
            }
        }

        impl PartialEq<$name> for &str {
            fn eq(&self, other: &$name) -> bool {
                *self == other.as_str()
            }
        }
    };
}

string_enum!(pub enum ConfigTheme {
    default Light = "light",
    Dark = "dark",
});

string_enum!(pub enum AsciiDocTheme {
    default Antora = "antora",
    Asciidoctor = "asciidoctor",
});

string_enum!(pub enum WorkspaceSidebarTab {
    default Files = "files",
    Bookmarks = "bookmarks",
    SourceControl = "sourceControl",
});

string_enum!(pub enum SourceControlView {
    default Changes = "changes",
    BranchDiff = "branchDiff",
    Graph = "graph",
});

string_enum!(pub enum SourceControlGraphScope {
    default Repository = "repository",
    File = "file",
});

string_enum!(pub enum DiagramRenderer {
    default Local = "local",
    Kroki = "kroki",
});

string_enum!(pub enum KrokiMode {
    default Disabled = "disabled",
    Local = "local",
    Remote = "remote",
    Public = "public",
});

string_enum!(pub enum KrokiOutputFormat {
    default Svg = "svg",
    Png = "png",
});

string_enum!(pub enum HttpProxyMode {
    default Disabled = "disabled",
    Custom = "custom",
});

string_enum!(pub enum BookmarkKind {
    default File = "file",
    Directory = "directory",
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPayload {
    pub path: String,
    pub base_path: String,
    pub format: String,
    pub source: String,
    pub updated_at: String,
    #[serde(default)]
    pub include_files: Vec<AsciiDocIncludeFile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asciidoc_context: Option<AsciiDocRenderContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocIncludeFile {
    pub path: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocRenderContext {
    pub base_dir: String,
    pub workspace_root: String,
    pub document_dir: String,
    #[serde(default)]
    pub attributes: BTreeMap<String, String>,
    #[serde(default)]
    pub resource_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchInput {
    pub root_path: String,
    pub query: String,
    pub max_files: usize,
    pub max_matches: usize,
    pub max_bytes_per_file: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResultItem {
    pub path: String,
    pub display_path: String,
    pub line: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heading: Option<String>,
    pub snippet: String,
    pub match_count: usize,
    pub source_reference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResult {
    pub status: String,
    pub root_path: String,
    pub query: String,
    pub results: Vec<WorkspaceSearchResultItem>,
    pub total_matches: usize,
    pub searched_files: usize,
    pub skipped_files: usize,
    pub capped: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub theme: ConfigTheme,
    pub sidebar_visible: bool,
    pub right_sidebar_visible: bool,
    pub zoom: u16,
    #[serde(default)]
    pub zoom_with_mouse_wheel: bool,
    #[serde(default = "default_reader_config")]
    pub reader: ReaderConfig,
    #[serde(default = "default_zen_mode_config")]
    pub zen_mode: ZenModeConfig,
    #[serde(default = "default_layout_config")]
    pub layout: LayoutConfig,
    #[serde(default = "default_workspace_state")]
    pub workspace: WorkspaceState,
    #[serde(default = "default_diagram_config")]
    pub diagram: DiagramConfig,
    pub kroki: KrokiConfig,
    #[serde(default = "default_network_config")]
    pub network: NetworkConfig,
    #[serde(default = "default_remote_providers_config")]
    pub remote_providers: RemoteProvidersConfig,
    pub security: SecurityConfig,
    #[serde(default = "default_experimental_config")]
    pub experimental: ExperimentalConfig,
    #[serde(default = "default_keybindings_config")]
    pub keybindings: KeybindingsConfig,
    #[serde(default = "default_mouse_gestures_config")]
    pub mouse_gestures: MouseGesturesConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReaderConfig {
    #[serde(default = "default_asciidoc_theme")]
    pub asciidoc_theme: AsciiDocTheme,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExperimentalConfig {
    #[serde(default)]
    pub search_hit_ruler: bool,
    #[serde(default)]
    pub restore_additional_windows_on_startup: bool,
    #[serde(default)]
    pub diagram_placeholder_rendering: bool,
    #[serde(default)]
    pub post_diff_git_markers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ZenModeConfig {
    #[serde(default = "default_true")]
    pub center_layout: bool,
    #[serde(default = "default_zen_mode_max_content_width")]
    pub max_content_width: u16,
    #[serde(default = "default_true")]
    pub hide_topbar: bool,
    #[serde(default = "default_true")]
    pub hide_tabs: bool,
    #[serde(default = "default_true")]
    pub hide_left_sidebar: bool,
    #[serde(default = "default_true")]
    pub hide_right_sidebar: bool,
    #[serde(default = "default_true")]
    pub hide_status_bar: bool,
    #[serde(default)]
    pub full_screen: bool,
    #[serde(default = "default_true")]
    pub exit_on_escape: bool,
    #[serde(default = "default_true")]
    pub restore_previous_layout: bool,
    #[serde(default)]
    pub apply_to_diff_preview: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutConfig {
    #[serde(default = "default_left_sidebar_width")]
    pub left_sidebar_width: u16,
    #[serde(default = "default_right_sidebar_width")]
    pub right_sidebar_width: u16,
    #[serde(default = "default_open_files_height")]
    pub open_files_height: u16,
    #[serde(default)]
    pub open_files_collapsed: bool,
}

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
pub struct DiagramConfig {
    #[serde(default = "default_mermaid_renderer")]
    pub mermaid_renderer: DiagramRenderer,
    #[serde(default = "default_plantuml_renderer")]
    pub plantuml_renderer: DiagramRenderer,
    #[serde(default = "default_plantuml_timeout_ms")]
    pub plantuml_timeout_ms: u64,
    #[serde(default = "default_graphviz_renderer")]
    pub graphviz_renderer: DiagramRenderer,
    #[serde(default = "default_graphviz_timeout_ms")]
    pub graphviz_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KrokiConfig {
    #[serde(default)]
    pub mode: KrokiMode,
    pub endpoint_url: Option<String>,
    #[serde(default)]
    pub output_format: KrokiOutputFormat,
    pub timeout_ms: u64,
    pub max_body_bytes: u64,
    pub cache_enabled: bool,
    pub require_remote_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConfig {
    #[serde(default = "default_http_proxy_config")]
    pub http_proxy: HttpProxyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyConfig {
    #[serde(default = "default_http_proxy_mode")]
    pub mode: HttpProxyMode,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProvidersConfig {
    #[serde(default = "default_github_provider_config")]
    pub github: RemoteProviderConfig,
    #[serde(default = "default_gitlab_provider_config")]
    pub gitlab: RemoteProviderConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProviderConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub host_url: String,
    #[serde(default)]
    pub token_stored: bool,
    #[serde(default)]
    pub last_test_status: Option<RemoteProviderTestStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProviderTestStatus {
    pub status: String,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTokenStatus {
    pub stored: bool,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecurityConfig {
    pub allow_local_images: bool,
    #[serde(default)]
    pub show_external_images: bool,
    pub confirm_external_links: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingsConfig {
    pub preset: String,
    #[serde(default)]
    pub mappings: Vec<KeybindingMappingConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingMappingConfig {
    pub keys: String,
    pub command_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MouseGesturesConfig {
    pub enabled: bool,
    pub trigger: String,
    pub show_trail: bool,
    pub min_distance_px: u16,
    #[serde(default)]
    pub mappings: Vec<MouseGestureMappingConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MouseGestureMappingConfig {
    pub pattern: String,
    pub command_id: String,
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KrokiRequest {
    pub diagram_type: String,
    pub source: String,
    pub config: KrokiConfig,
    pub confirmed_remote_send: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KrokiResult {
    pub status: String,
    pub message: Option<String>,
    pub artifact_url: Option<String>,
    pub media_type: Option<String>,
    pub content: Option<String>,
    pub cache_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalImageResult {
    pub status: String,
    pub media_type: Option<String>,
    pub content: Option<String>,
    pub encoding: Option<String>,
    pub placeholder_text: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenRequest {
    pub paths: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diagnostics: Vec<String>,
}

pub(crate) struct PendingOpenRequests(pub(crate) Mutex<Vec<DesktopOpenRequest>>);

#[derive(Default)]
pub(crate) struct AllowedRoots(pub(crate) Mutex<BTreeSet<PathBuf>>);

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

fn default_workspace_state() -> WorkspaceState {
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

fn default_diagram_config() -> DiagramConfig {
    DiagramConfig {
        mermaid_renderer: default_mermaid_renderer(),
        plantuml_renderer: default_plantuml_renderer(),
        plantuml_timeout_ms: default_plantuml_timeout_ms(),
        graphviz_renderer: default_graphviz_renderer(),
        graphviz_timeout_ms: default_graphviz_timeout_ms(),
    }
}

fn default_mermaid_renderer() -> DiagramRenderer {
    DiagramRenderer::Local
}

fn default_plantuml_renderer() -> DiagramRenderer {
    DiagramRenderer::Local
}

fn default_plantuml_timeout_ms() -> u64 {
    10_000
}

fn default_graphviz_renderer() -> DiagramRenderer {
    DiagramRenderer::Local
}

fn default_graphviz_timeout_ms() -> u64 {
    10_000
}

fn default_http_proxy_mode() -> HttpProxyMode {
    HttpProxyMode::Disabled
}

fn default_http_proxy_config() -> HttpProxyConfig {
    HttpProxyConfig {
        mode: default_http_proxy_mode(),
        url: None,
    }
}

fn default_network_config() -> NetworkConfig {
    NetworkConfig {
        http_proxy: default_http_proxy_config(),
    }
}

fn default_github_provider_config() -> RemoteProviderConfig {
    RemoteProviderConfig {
        enabled: false,
        host_url: "https://github.com".to_string(),
        token_stored: false,
        last_test_status: None,
    }
}

fn default_gitlab_provider_config() -> RemoteProviderConfig {
    RemoteProviderConfig {
        enabled: false,
        host_url: "https://gitlab.com".to_string(),
        token_stored: false,
        last_test_status: None,
    }
}

fn default_remote_providers_config() -> RemoteProvidersConfig {
    RemoteProvidersConfig {
        github: default_github_provider_config(),
        gitlab: default_gitlab_provider_config(),
    }
}

fn default_keybindings_config() -> KeybindingsConfig {
    KeybindingsConfig {
        preset: "native".to_string(),
        mappings: Vec::new(),
    }
}

fn default_mouse_gestures_config() -> MouseGesturesConfig {
    MouseGesturesConfig {
        enabled: false,
        trigger: "rightButton".to_string(),
        show_trail: true,
        min_distance_px: 32,
        mappings: Vec::new(),
    }
}

fn default_left_sidebar_width() -> u16 {
    260
}

fn default_right_sidebar_width() -> u16 {
    320
}

fn default_open_files_height() -> u16 {
    144
}

fn default_asciidoc_theme() -> AsciiDocTheme {
    AsciiDocTheme::Antora
}

fn default_true() -> bool {
    true
}

fn default_zen_mode_max_content_width() -> u16 {
    960
}

fn default_zen_mode_config() -> ZenModeConfig {
    ZenModeConfig {
        center_layout: true,
        max_content_width: default_zen_mode_max_content_width(),
        hide_topbar: true,
        hide_tabs: true,
        hide_left_sidebar: true,
        hide_right_sidebar: true,
        hide_status_bar: true,
        full_screen: false,
        exit_on_escape: true,
        restore_previous_layout: true,
        apply_to_diff_preview: false,
    }
}

fn default_reader_config() -> ReaderConfig {
    ReaderConfig {
        asciidoc_theme: default_asciidoc_theme(),
    }
}

fn default_layout_config() -> LayoutConfig {
    LayoutConfig {
        left_sidebar_width: default_left_sidebar_width(),
        right_sidebar_width: default_right_sidebar_width(),
        open_files_height: default_open_files_height(),
        open_files_collapsed: false,
    }
}

fn default_experimental_config() -> ExperimentalConfig {
    ExperimentalConfig {
        search_hit_ruler: false,
        restore_additional_windows_on_startup: false,
        diagram_placeholder_rendering: false,
        post_diff_git_markers: false,
    }
}

pub fn default_config() -> AppConfig {
    AppConfig {
        theme: ConfigTheme::Light,
        sidebar_visible: true,
        right_sidebar_visible: true,
        zoom: 100,
        zoom_with_mouse_wheel: false,
        reader: default_reader_config(),
        zen_mode: default_zen_mode_config(),
        layout: default_layout_config(),
        workspace: default_workspace_state(),
        diagram: default_diagram_config(),
        kroki: KrokiConfig {
            mode: KrokiMode::Disabled,
            endpoint_url: None,
            output_format: KrokiOutputFormat::Svg,
            timeout_ms: 10_000,
            max_body_bytes: 1_048_576,
            cache_enabled: true,
            require_remote_confirmation: true,
        },
        network: default_network_config(),
        remote_providers: default_remote_providers_config(),
        security: SecurityConfig {
            allow_local_images: true,
            show_external_images: false,
            confirm_external_links: true,
        },
        experimental: default_experimental_config(),
        keybindings: default_keybindings_config(),
        mouse_gestures: default_mouse_gestures_config(),
    }
}
