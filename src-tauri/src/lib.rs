use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{Emitter, Manager, Theme, WebviewUrl, WebviewWindowBuilder, window::Color};
use tauri_plugin_dialog::DialogExt;

mod antora_order;
mod antora_playbook;
mod app_error;
mod backend_types;
mod cache_prune;
mod config;
mod desktop_open;
mod document_io;
mod document_io_include;
mod document_order;
mod document_order_common;
mod docusaurus_order;
mod git_diff;
mod kroki;
mod local_assets;
mod mkdocs_order;
mod path_policy;
mod perf_trace;
mod plantuml_cache;
mod plantuml_external;
mod remote_providers;
mod static_js;
mod vitepress_order;
mod watchers;
mod workspace_paths;
mod zensical_order;

pub use app_error::*;
pub use backend_types::*;
use cache_prune::*;
use config::*;
use desktop_open::*;
use document_io::*;
pub use git_diff::{
    GitDiffResourceSource, GitFileHistory, GitFileHistoryCacheState, GitFileHistoryCacheStatus,
    GitFileHistoryMetrics, GitFileHistoryStatus, git_file_history_for_path_with_cache,
};
use kroki::*;
use local_assets::*;
use path_policy::*;
use plantuml_cache::*;
use remote_providers::*;
use watchers::*;
use workspace_paths::*;

const CONFIG_FILE_NAME: &str = "config.json";
static VIEWER_WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
async fn save_svg_file(app: tauri::AppHandle, file_name: String, svg: String) -> Result<bool, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app.dialog().file().add_filter("SVG image", &["svg"]).set_file_name(&file_name).blocking_save_file() else {
            return Ok(false);
        };
        let path = path.as_path().ok_or_else(|| AppError::from("failed to resolve SVG save path"))?;
        std::fs::write(path, svg)
            .map_err(|error| AppError::from(format!("failed to write SVG file: {error}")))?;
        Ok(true)
    }).await.map_err(|error| AppError::from(format!("failed to save SVG file: {error}")))?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ViewerWindowOpenRequest {
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    active_path: Option<String>,
    #[serde(default)]
    open_tabs: Vec<String>,
    #[serde(default)]
    pinned_tabs: Vec<String>,
    #[serde(default)]
    recent_tabs: Vec<String>,
    #[serde(default)]
    scroll_positions: BTreeMap<String, u32>,
    #[serde(default)]
    active_heading_by_path: BTreeMap<String, String>,
    #[serde(default)]
    split_session: Option<SplitSessionState>,
    root_directory: Option<String>,
    #[serde(default)]
    expanded_directories: Vec<String>,
    #[serde(default)]
    sidebar_tab: WorkspaceSidebarTab,
    #[serde(default)]
    sidebar_visible: Option<bool>,
    #[serde(default)]
    right_sidebar_visible: Option<bool>,
    #[serde(default)]
    layout: Option<LayoutConfig>,
    #[serde(default)]
    pinned: bool,
    #[serde(default)]
    bookmarks: Vec<BookmarkEntry>,
}

struct PendingViewerWindowOpenRequests(Mutex<BTreeMap<String, ViewerWindowOpenRequest>>);

#[tauri::command]
fn open_document(
    path: String,
    options: Option<OpenDocumentOptions>,
    roots: tauri::State<AllowedRoots>,
) -> Result<DocumentPayload, AppError> {
    let total_started_at = perf_trace::start();
    let requested_path = PathBuf::from(&path);
    let normalize_started_at = perf_trace::start();
    let document_path = normalize_document_path(&path).map_err(AppError::from)?;
    let basename = perf_trace::basename(&document_path);
    perf_trace::log(
        "open_document.normalize_document_path",
        &[
            ("basename", basename.clone()),
            (
                "durationMs",
                format!("{:.2}", perf_trace::duration_ms(normalize_started_at)),
            ),
        ],
    );
    let policy_started_at = perf_trace::start();
    authorize_document_path_for_open(&requested_path, &document_path, &roots)
        .map_err(AppError::from)?;
    perf_trace::log(
        "open_document.authorize_document_path",
        &[
            ("basename", basename.clone()),
            (
                "durationMs",
                format!("{:.2}", perf_trace::duration_ms(policy_started_at)),
            ),
        ],
    );
    let open_started_at = perf_trace::start();
    let payload = open_document_from_canonical_path_with_roots_and_options(
        &document_path,
        Some(&roots),
        options.as_ref(),
    )
    .map_err(AppError::from)?;
    perf_trace::log(
        "open_document.payload",
        &[
            ("basename", basename.clone()),
            ("format", payload.format.clone()),
            ("bytes", payload.source.len().to_string()),
            (
                "durationMs",
                format!("{:.2}", perf_trace::duration_ms(open_started_at)),
            ),
        ],
    );
    perf_trace::log(
        "open_document.total",
        &[
            ("basename", basename),
            ("format", payload.format.clone()),
            ("bytes", payload.source.len().to_string()),
            (
                "durationMs",
                format!("{:.2}", perf_trace::duration_ms(total_started_at)),
            ),
        ],
    );
    Ok(payload)
}

#[tauri::command]
fn search_workspace(
    input: WorkspaceSearchInput,
    roots: tauri::State<AllowedRoots>,
) -> Result<WorkspaceSearchResult, AppError> {
    document_io::search_workspace(input, Some(&roots)).map_err(AppError::from)
}

#[tauri::command]
fn resolve_dropped_document_path(
    path: String,
    roots: tauri::State<AllowedRoots>,
) -> Result<String, AppError> {
    let path = normalize_dropped_document_path(&path).map_err(AppError::from)?;
    register_allowed_root_for_file(&path, &roots).map_err(AppError::from)?;
    Ok(path_to_ui_string(&path))
}

#[tauri::command]
fn authorize_directory(path: String, roots: tauri::State<AllowedRoots>) -> Result<(), AppError> {
    let directory_path = normalize_directory_path(&path).map_err(AppError::from)?;
    register_allowed_root(&directory_path, &roots).map_err(AppError::from)
}

#[tauri::command]
fn resolve_workspace_paths(
    input: WorkspacePathResolutionInput,
) -> Result<WorkspacePathResolution, String> {
    Ok(resolve_workspace_paths_inner(input))
}

#[tauri::command]
fn resolve_document_link(
    input: DocumentLinkResolutionInput,
    roots: tauri::State<AllowedRoots>,
    obsidian_cache: tauri::State<ObsidianVaultCacheState>,
) -> Result<DocumentLinkResolution, String> {
    Ok(resolve_document_link_inner(input, &roots, &obsidian_cache))
}

#[tauri::command]
fn clear_obsidian_vault_cache(
    path: String,
    roots: tauri::State<AllowedRoots>,
    obsidian_cache: tauri::State<ObsidianVaultCacheState>,
) -> Result<(), String> {
    obsidian_cache
        .clear_for_path(&PathBuf::from(path), &roots)
        .map(|_| ())
}

#[tauri::command]
fn frontend_perf_log(event: String, fields: BTreeMap<String, String>) {
    let field_pairs = fields
        .iter()
        .map(|(key, value)| (key.as_str(), value.clone()))
        .collect::<Vec<_>>();
    perf_trace::log(&format!("frontend.{event}"), &field_pairs);
}
#[tauri::command]
fn open_path_in_editor(path: String, roots: tauri::State<AllowedRoots>) -> Result<(), AppError> {
    let path = normalize_editor_document_path(&path).map_err(AppError::from)?;
    ensure_path_allowed(&path, &roots).map_err(AppError::from)?;
    open_editor_path(&path).map_err(AppError::from)
}

fn next_viewer_window_request_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|_| "0".to_string());
    let counter = VIEWER_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{timestamp}-{counter}")
}

fn is_safe_viewer_window_session_id(session_id: &str) -> bool {
    !session_id.is_empty()
        && session_id.len() <= 80
        && session_id != "main"
        && session_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn viewer_window_request_id(request: &mut ViewerWindowOpenRequest) -> String {
    let request_id = request
        .session_id
        .take()
        .filter(|session_id| is_safe_viewer_window_session_id(session_id))
        .unwrap_or_else(next_viewer_window_request_id);
    request.session_id = Some(request_id.clone());
    request_id
}

fn take_viewer_window_open_request_inner(
    pending: &PendingViewerWindowOpenRequests,
    request_id: &str,
) -> Result<Option<ViewerWindowOpenRequest>, AppError> {
    pending
        .0
        .lock()
        .map_err(|_| AppError::new(AppErrorCode::Lock, "failed to lock viewer window requests"))
        .map(|mut guard| guard.remove(request_id))
}

#[tauri::command]
fn take_current_viewer_window_open_request(
    window: tauri::WebviewWindow,
    pending: tauri::State<PendingViewerWindowOpenRequests>,
) -> Result<Option<ViewerWindowOpenRequest>, AppError> {
    let Some(request_id) = window.label().strip_prefix("viewer-") else {
        return Ok(None);
    };
    take_viewer_window_open_request_inner(&pending, &request_id)
}

#[tauri::command]
fn open_current_document_in_new_window(
    request: ViewerWindowOpenRequest,
    app: tauri::AppHandle,
    roots: tauri::State<AllowedRoots>,
    pending: tauri::State<PendingViewerWindowOpenRequests>,
) -> Result<(), AppError> {
    let Some(path) = request.path.as_deref() else {
        return Err(AppError::new(
            AppErrorCode::InvalidPath,
            "document path is required",
        ));
    };
    let requested_path = PathBuf::from(path);
    let document_path = normalize_document_path(path).map_err(AppError::from)?;
    authorize_document_path_for_open(&requested_path, &document_path, &roots)
        .map_err(AppError::from)?;
    let mut request = request;
    request.path = Some(path_to_ui_string(&document_path));
    open_viewer_window(request, app, pending)
}

#[tauri::command]
fn open_new_window(
    request: Option<ViewerWindowOpenRequest>,
    app: tauri::AppHandle,
    pending: tauri::State<PendingViewerWindowOpenRequests>,
) -> Result<(), AppError> {
    let mut request = request.unwrap_or(ViewerWindowOpenRequest {
        session_id: None,
        path: None,
        active_path: None,
        open_tabs: Vec::new(),
        pinned_tabs: Vec::new(),
        recent_tabs: Vec::new(),
        scroll_positions: BTreeMap::new(),
        active_heading_by_path: BTreeMap::new(),
        split_session: None,
        root_directory: None,
        expanded_directories: Vec::new(),
        sidebar_tab: WorkspaceSidebarTab::Files,
        sidebar_visible: None,
        right_sidebar_visible: None,
        layout: None,
        pinned: false,
        bookmarks: Vec::new(),
    });
    request.path = None;
    open_viewer_window(request, app, pending)
}

fn open_viewer_window(
    mut request: ViewerWindowOpenRequest,
    app: tauri::AppHandle,
    pending: tauri::State<PendingViewerWindowOpenRequests>,
) -> Result<(), AppError> {
    let request_id = viewer_window_request_id(&mut request);
    let label = format!("viewer-{request_id}");
    pending
        .0
        .lock()
        .map_err(|_| AppError::new(AppErrorCode::Lock, "failed to lock viewer window requests"))?
        .insert(request_id.clone(), request);
    let builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
        .title("Svard")
        .inner_size(1280.0, 840.0)
        .min_inner_size(960.0, 640.0);
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(TitleBarStyle::Transparent)
        .hidden_title(true);
    let window = builder
        .build()
        .map_err(|error| AppError::from(format!("failed to create viewer window: {error}")))?;
    if let Ok(config_path) = config_file_path(&app) {
        if let Ok(config) = load_config_from_path(&config_path) {
            let _ = window.set_background_color(Some(window_background_from_config(&config)));
        }
    }
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn get_git_diff_preview(path: String) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_diff_preview_for_path(&path)
}

#[tauri::command]
async fn get_git_diff_previews(
    repository_root: String,
    relative_paths: Vec<String>,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    run_git_preview_batch_task("Git diff preview batch", move || {
        git_diff::git_diff_previews_for_paths(&repository_root, relative_paths)
    })
    .await
}

#[tauri::command]
async fn get_git_status_summary(
    paths: Vec<String>,
) -> Result<Vec<git_diff::GitStatusEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || git_diff::git_status_summary_for_paths(paths))
        .await
        .map_err(|error| format!("Git status task failed: {error}"))?
}

#[tauri::command]
async fn get_git_changes(path: String) -> Result<git_diff::GitChanges, String> {
    tauri::async_runtime::spawn_blocking(move || git_diff::git_changes_for_path(&path))
        .await
        .map_err(|error| format!("Git changes task failed: {error}"))?
}

#[tauri::command]
async fn get_git_branch_diff(
    path: String,
    base_ref: Option<String>,
    head_ref: Option<String>,
    remote_providers: Option<RemoteProvidersConfig>,
    network: Option<NetworkConfig>,
) -> Result<git_diff::GitBranchDiff, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git_diff::git_branch_diff_for_path(
            &path,
            base_ref.as_deref(),
            head_ref.as_deref(),
            remote_providers.as_ref(),
            network.as_ref(),
        )
    })
    .await
    .map_err(|error| format!("Git branch diff task failed: {error}"))?
}

#[tauri::command]
fn save_provider_token(
    provider: String,
    host_url: String,
    token: String,
) -> Result<ProviderTokenStatus, String> {
    save_provider_token_inner(&provider, &host_url, &token)
}

#[tauri::command]
fn delete_provider_token(
    provider: String,
    host_url: String,
) -> Result<ProviderTokenStatus, String> {
    delete_provider_token_inner(&provider, &host_url)
}

#[tauri::command]
fn get_provider_token_status(
    provider: String,
    host_url: String,
) -> Result<ProviderTokenStatus, String> {
    get_provider_token_status_inner(&provider, &host_url)
}

#[tauri::command]
fn test_provider_connection(
    provider: String,
    host_url: String,
    network: Option<NetworkConfig>,
) -> Result<RemoteProviderTestStatus, String> {
    let network = network.unwrap_or(NetworkConfig {
        http_proxy: HttpProxyConfig {
            mode: HttpProxyMode::Disabled,
            url: None,
        },
    });
    test_provider_connection_inner(&provider, &host_url, &network)
}

#[tauri::command]
fn get_git_branch_file_diff(
    path: String,
    base_ref: String,
    head_ref: Option<String>,
    relative_path: String,
    old_path: Option<String>,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_branch_file_diff_for_path(
        &path,
        &base_ref,
        head_ref.as_deref(),
        &relative_path,
        old_path.as_deref(),
    )
}

#[tauri::command]
async fn get_git_branch_file_diffs(
    repository_root: String,
    base_ref: String,
    head_ref: Option<String>,
    items: Vec<git_diff::GitBranchDiffPreviewBatchItem>,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    run_git_preview_batch_task("Git Branch Diff preview batch", move || {
        git_diff::git_branch_file_diffs_for_paths(
            &repository_root,
            &base_ref,
            head_ref.as_deref(),
            items,
        )
    })
    .await
}

#[tauri::command]
fn get_git_commit_graph(
    path: String,
    scope: git_diff::GitCommitGraphScope,
    file_path: Option<String>,
    limit: Option<usize>,
    cursor: Option<String>,
) -> Result<git_diff::GitCommitGraph, String> {
    git_diff::git_commit_graph_for_path(
        &path,
        scope,
        file_path.as_deref(),
        limit,
        cursor.as_deref(),
    )
}

#[tauri::command]
fn get_git_file_history(
    path: String,
    limit: Option<usize>,
    cursor: Option<String>,
    state: tauri::State<git_diff::GitFileHistoryCacheState>,
) -> Result<git_diff::GitFileHistory, String> {
    git_diff::git_file_history_for_path_with_cache(&path, &state, limit, cursor.as_deref())
}

#[tauri::command]
fn get_git_file_revision_diff(
    path: String,
    revision: String,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_revision_diff_for_path(&path, &revision)
}

#[tauri::command]
fn get_git_file_commit_diff(
    path: String,
    revision: String,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_commit_diff_for_path(&path, &revision)
}

#[tauri::command]
async fn get_git_file_commit_diffs(
    repository_root: String,
    revision: String,
    relative_paths: Vec<String>,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    run_git_preview_batch_task("Git commit preview batch", move || {
        git_diff::git_file_commit_diffs_for_paths(&repository_root, &revision, relative_paths)
    })
    .await
}

async fn run_git_preview_batch_task(
    label: &'static str,
    task: impl FnOnce() -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> + Send + 'static,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("{label} task failed: {error}"))?
}

#[tauri::command]
fn get_git_file_revision_pair_diff(
    path: String,
    left_revision: String,
    right_revision: String,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_revision_pair_diff_for_path(&path, &left_revision, &right_revision)
}

#[tauri::command]
fn get_git_commit_details(
    path: String,
    revision: String,
) -> Result<git_diff::GitCommitDetails, String> {
    git_diff::git_commit_details_for_path(&path, &revision)
}

#[tauri::command]
fn list_git_refs(
    path: String,
    kind: git_diff::GitRefKind,
    limit: Option<usize>,
    cursor: Option<String>,
    query: Option<String>,
) -> Result<git_diff::GitRefList, String> {
    git_diff::git_refs_for_path(&path, kind, limit, cursor.as_deref(), query.as_deref())
}

#[tauri::command]
fn get_git_file_ref_diff(
    path: String,
    ref_item: git_diff::GitRefItem,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_ref_diff_for_path(&path, &ref_item)
}

#[tauri::command]
fn watch_git_status(
    paths: Vec<String>,
    app: tauri::AppHandle,
    state: tauri::State<GitStatusWatchState>,
) -> Result<GitStatusWatchRegistration, String> {
    register_git_status_watch(paths, &app, &state)
}

#[tauri::command]
fn unwatch_git_status(
    watch_id: String,
    state: tauri::State<GitStatusWatchState>,
) -> Result<(), String> {
    remove_git_status_watch(&watch_id, &state)
}

#[tauri::command]
fn watch_document(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<DocumentWatchState>,
    roots: tauri::State<AllowedRoots>,
) -> Result<DocumentWatchRegistration, String> {
    let document_path = normalize_watch_document_path(&path)?;
    ensure_path_allowed(&document_path, &roots)?;
    register_document_watch(&path, &app, &state)
}

#[tauri::command]
fn unwatch_document(
    watch_id: String,
    state: tauri::State<DocumentWatchState>,
) -> Result<(), String> {
    remove_document_watch(&watch_id, &state)
}

#[tauri::command]
fn watch_directory(
    path: String,
    recursive: Option<bool>,
    app: tauri::AppHandle,
    state: tauri::State<DirectoryWatchState>,
    roots: tauri::State<AllowedRoots>,
) -> Result<DirectoryWatchRegistration, String> {
    let directory_path = normalize_watch_directory_path(&path)?;
    ensure_path_allowed(&directory_path, &roots)?;
    register_directory_watch(&path, recursive.unwrap_or(false), &app, &state)
}

#[tauri::command]
fn unwatch_directory(
    watch_id: String,
    state: tauri::State<DirectoryWatchState>,
) -> Result<(), String> {
    remove_directory_watch(&watch_id, &state)
}

#[tauri::command]
fn resolve_local_image(
    path: String,
    document_path: String,
    context: Option<LocalImageResolveContext>,
    roots: tauri::State<AllowedRoots>,
) -> Result<LocalImageResult, String> {
    resolve_local_image_from_path_with_local_context(
        &path,
        &document_path,
        &roots,
        context.as_ref(),
    )
}

#[tauri::command]
fn resolve_git_diff_local_image(
    path: String,
    document_path: String,
    repository_root: String,
    resource_source: GitDiffResourceSource,
    context: Option<LocalImageResolveContext>,
    roots: tauri::State<AllowedRoots>,
) -> Result<LocalImageResult, String> {
    resolve_git_diff_local_image_from_source(
        &path,
        &document_path,
        &repository_root,
        &resource_source,
        &roots,
        context.as_ref(),
    )
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<AppConfig, AppError> {
    load_config_from_path(&config_file_path(&app).map_err(AppError::from)?)
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), AppError> {
    apply_app_theme_from_config(&app, &config);
    save_config_to_path(&config_file_path(&app).map_err(AppError::from)?, &config)?;
    let _ = app.emit("config-changed", ());
    Ok(())
}

#[tauri::command]
fn set_window_theme(app: tauri::AppHandle, theme: String) {
    apply_app_theme(&app, theme.as_str());
}

#[tauri::command]
fn take_pending_open_requests(
    state: tauri::State<PendingOpenRequests>,
) -> Result<Vec<DesktopOpenRequest>, String> {
    let mut requests = state
        .0
        .lock()
        .map_err(|_| "failed to lock pending open requests".to_string())?;
    Ok(requests.drain(..).collect())
}

fn normalize_desktop_open_request<I>(
    args: I,
    cwd: Option<PathBuf>,
    source: &str,
) -> Option<DesktopOpenRequest>
where
    I: IntoIterator<Item = String>,
{
    let mut paths = Vec::new();
    let mut seen = BTreeSet::new();
    let mut diagnostics = Vec::new();

    for arg in args {
        if arg.trim().is_empty() {
            continue;
        }
        if arg.starts_with('-') {
            if env::var("SVARD_SITE_SCREENSHOT").ok().as_deref() == Some("1") {
                continue;
            }
            diagnostics.push(format!(
                "Unsupported desktop open option ignored: {}",
                display_safe_option(&arg)
            ));
            continue;
        }

        let raw_path = PathBuf::from(&arg);
        let joined_path = if raw_path.is_absolute() {
            raw_path
        } else if let Some(cwd) = &cwd {
            cwd.join(raw_path)
        } else {
            raw_path
        };
        let resolved_path = resolve_existing_path(&joined_path, ExistingPathKind::Any)
            .unwrap_or_else(|_| normalize_path(joined_path));

        if is_openable_desktop_path(&resolved_path) {
            let value = path_to_ui_string(&resolved_path);
            if seen.insert(value.clone()) {
                paths.push(value);
            }
        } else {
            if env::var("SVARD_SITE_SCREENSHOT").ok().as_deref() == Some("1") {
                continue;
            }
            diagnostics.push(format!(
                "Unsupported desktop open path ignored: {}",
                display_safe_path(&resolved_path)
            ));
        }
    }

    if paths.is_empty() && diagnostics.is_empty() {
        return None;
    }

    Some(DesktopOpenRequest {
        paths,
        cwd: cwd.map(|path| path_to_ui_string(&path)),
        source: source.to_string(),
        diagnostics,
    })
}

fn display_safe_option(arg: &str) -> String {
    arg.split('=').next().unwrap_or(arg).to_string()
}

fn strip_binary_arg(args: Vec<String>) -> Vec<String> {
    let Some(first) = args.first() else {
        return args;
    };
    let Ok(current_exe) = env::current_exe() else {
        return args;
    };
    let first_name = Path::new(first).file_name();
    if first_name.is_some() && first_name == current_exe.file_name() {
        return args.into_iter().skip(1).collect();
    }
    args
}

#[tauri::command]
fn render_diagram(app: tauri::AppHandle, input: KrokiRequest) -> Result<KrokiResult, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache dir: {error}"))?
        .join("kroki");
    render_diagram_with_cache_dir(input, &cache_dir)
}

#[tauri::command]
fn clear_kroki_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache dir: {error}"))?
        .join("kroki");
    clear_kroki_cache_dir(&cache_dir)
}

#[tauri::command]
fn read_plantuml_svg_cache(
    app: tauri::AppHandle,
    input: PlantUmlSvgCacheReadInput,
) -> Result<PlantUmlSvgCacheReadResult, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache dir: {error}"))?
        .join("plantuml-local");
    read_plantuml_svg_cache_dir(input, &cache_dir)
}

#[tauri::command]
fn write_plantuml_svg_cache(
    app: tauri::AppHandle,
    input: PlantUmlSvgCacheWriteInput,
) -> Result<PlantUmlSvgCacheWriteResult, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache dir: {error}"))?
        .join("plantuml-local");
    write_plantuml_svg_cache_dir(input, &cache_dir)
}

#[tauri::command]
fn clear_plantuml_svg_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache dir: {error}"))?
        .join("plantuml-local");
    clear_plantuml_svg_cache_dir(&cache_dir)
}

#[tauri::command]
fn render_external_plantuml(
    app: tauri::AppHandle,
    input: ExternalPlantUmlRenderInput,
) -> Result<PlantUmlRenderResult, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache dir: {error}"))?
        .join("plantuml-external");
    plantuml_external::render_external_plantuml_with_cache_dir(input, &cache_dir)
}

#[tauri::command]
fn test_external_plantuml(
    input: ExternalPlantUmlTestInput,
) -> Result<PlantUmlRenderResult, String> {
    plantuml_external::test_external_plantuml(input)
}

fn config_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config dir: {error}"))?
        .join(CONFIG_FILE_NAME))
}

fn tauri_theme_from_theme(theme: &str) -> Option<Theme> {
    match theme {
        "dark" => Some(Theme::Dark),
        "light" => Some(Theme::Light),
        _ => None,
    }
}

fn window_background_from_config(config: &AppConfig) -> Color {
    window_background_from_theme(config.theme.as_str())
}

fn window_background_from_theme(theme: &str) -> Color {
    match theme {
        "dark" => Color(0x10, 0x14, 0x17, 0xff),
        _ => Color(0xf4, 0xf6, 0xf7, 0xff),
    }
}

fn apply_app_theme_from_config(app: &tauri::AppHandle, config: &AppConfig) {
    apply_app_theme(app, config.theme.as_str());
}

fn apply_app_theme(app: &tauri::AppHandle, theme: &str) {
    app.set_theme(tauri_theme_from_theme(theme));
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_background_color(Some(window_background_from_theme(theme)));
    }
}

fn apply_saved_app_theme(app: &tauri::App) {
    let handle = app.handle().clone();
    let Ok(config_path) = config_file_path(&handle) else {
        return;
    };
    let Ok(config) = load_config_from_path(&config_path) else {
        return;
    };
    apply_app_theme_from_config(&handle, &config);
}

pub fn run() {
    let initial_open_requests =
        normalize_desktop_open_request(env::args().skip(1), env::current_dir().ok(), "initial")
            .into_iter()
            .collect::<Vec<_>>();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(request) = normalize_desktop_open_request(
                strip_binary_arg(args),
                Some(PathBuf::from(cwd)),
                "single-instance",
            ) {
                let _ = app.emit("desktop-open-request", request);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingOpenRequests(Mutex::new(initial_open_requests)))
        .manage(PendingViewerWindowOpenRequests(Mutex::new(BTreeMap::new())))
        .manage(AllowedRoots::default())
        .manage(DocumentWatchState::default())
        .manage(DirectoryWatchState::default())
        .manage(GitStatusWatchState::default())
        .manage(git_diff::GitFileHistoryCacheState::default())
        .manage(ObsidianVaultCacheState::default())
        .setup(|app| {
            apply_saved_app_theme(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_svg_file,
            search_workspace,
            open_path_in_editor,
            open_new_window,
            open_current_document_in_new_window,
            take_current_viewer_window_open_request,
            get_git_diff_preview,
            get_git_diff_previews,
            get_git_status_summary,
            get_git_changes,
            get_git_branch_diff,
            save_provider_token,
            delete_provider_token,
            get_provider_token_status,
            test_provider_connection,
            get_git_branch_file_diff,
            get_git_branch_file_diffs,
            get_git_commit_graph,
            get_git_file_history,
            get_git_file_revision_diff,
            get_git_file_commit_diff,
            get_git_file_commit_diffs,
            get_git_file_revision_pair_diff,
            get_git_commit_details,
            list_git_refs,
            get_git_file_ref_diff,
            watch_git_status,
            unwatch_git_status,
            watch_document,
            unwatch_document,
            watch_directory,
            unwatch_directory,
            resolve_dropped_document_path,
            authorize_directory,
            load_document_order,
            resolve_workspace_paths,
            resolve_document_link,
            clear_obsidian_vault_cache,
            frontend_perf_log,
            resolve_local_image,
            resolve_git_diff_local_image,
            list_directory,
            load_config,
            save_config,
            set_window_theme,
            take_pending_open_requests,
            render_diagram,
            clear_kroki_cache,
            read_plantuml_svg_cache,
            write_plantuml_svg_cache,
            clear_plantuml_svg_cache,
            render_external_plantuml,
            test_external_plantuml
        ])
        .run(tauri::generate_context!())
        .expect("error while running Svard");
}

#[cfg(test)]
mod backend_tests;
