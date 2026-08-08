use super::*;

#[tauri::command]
pub(super) fn get_git_diff_preview(path: String) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_diff_preview_for_path(&path)
}

#[tauri::command]
pub(super) async fn get_git_diff_previews(
    repository_root: String,
    relative_paths: Vec<String>,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    run_git_preview_batch_task("Git diff preview batch", move || {
        git_diff::git_diff_previews_for_paths(&repository_root, relative_paths)
    })
    .await
}

#[tauri::command]
pub(super) async fn get_git_status_summary(
    paths: Vec<String>,
) -> Result<Vec<git_diff::GitStatusEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || git_diff::git_status_summary_for_paths(paths))
        .await
        .map_err(|error| format!("Git status task failed: {error}"))?
}

#[tauri::command]
pub(super) async fn get_git_changes(path: String) -> Result<git_diff::GitChanges, String> {
    tauri::async_runtime::spawn_blocking(move || git_diff::git_changes_for_path(&path))
        .await
        .map_err(|error| format!("Git changes task failed: {error}"))?
}

#[tauri::command]
pub(super) async fn get_git_branch_diff(
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
pub(super) fn save_provider_token(
    provider: String,
    host_url: String,
    token: String,
) -> Result<ProviderTokenStatus, String> {
    save_provider_token_inner(&provider, &host_url, &token)
}

#[tauri::command]
pub(super) fn delete_provider_token(
    provider: String,
    host_url: String,
) -> Result<ProviderTokenStatus, String> {
    delete_provider_token_inner(&provider, &host_url)
}

#[tauri::command]
pub(super) fn get_provider_token_status(
    provider: String,
    host_url: String,
) -> Result<ProviderTokenStatus, String> {
    get_provider_token_status_inner(&provider, &host_url)
}

#[tauri::command]
pub(super) fn test_provider_connection(
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
pub(super) fn get_git_branch_file_diff(
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
pub(super) async fn get_git_branch_file_diffs(
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
pub(super) fn get_git_commit_graph(
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
pub(super) fn get_git_file_history(
    path: String,
    limit: Option<usize>,
    cursor: Option<String>,
    state: tauri::State<git_diff::GitFileHistoryCacheState>,
) -> Result<git_diff::GitFileHistory, String> {
    git_diff::git_file_history_for_path_with_cache(&path, &state, limit, cursor.as_deref())
}

#[tauri::command]
pub(super) fn get_git_file_revision_diff(
    path: String,
    revision: String,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_revision_diff_for_path(&path, &revision)
}

#[tauri::command]
pub(super) fn get_git_file_commit_diff(
    path: String,
    revision: String,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_commit_diff_for_path(&path, &revision)
}

#[tauri::command]
pub(super) async fn get_git_file_commit_diffs(
    repository_root: String,
    revision: String,
    relative_paths: Vec<String>,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    run_git_preview_batch_task("Git commit preview batch", move || {
        git_diff::git_file_commit_diffs_for_paths(&repository_root, &revision, relative_paths)
    })
    .await
}

pub(super) async fn run_git_preview_batch_task(
    label: &'static str,
    task: impl FnOnce() -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> + Send + 'static,
) -> Result<Vec<git_diff::GitDiffPreviewBatchEntry>, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("{label} task failed: {error}"))?
}

#[tauri::command]
pub(super) fn get_git_file_revision_pair_diff(
    path: String,
    left_revision: String,
    right_revision: String,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_revision_pair_diff_for_path(&path, &left_revision, &right_revision)
}

#[tauri::command]
pub(super) fn get_git_commit_details(
    path: String,
    revision: String,
) -> Result<git_diff::GitCommitDetails, String> {
    git_diff::git_commit_details_for_path(&path, &revision)
}

#[tauri::command]
pub(super) fn list_git_refs(
    path: String,
    kind: git_diff::GitRefKind,
    limit: Option<usize>,
    cursor: Option<String>,
    query: Option<String>,
) -> Result<git_diff::GitRefList, String> {
    git_diff::git_refs_for_path(&path, kind, limit, cursor.as_deref(), query.as_deref())
}

#[tauri::command]
pub(super) fn get_git_file_ref_diff(
    path: String,
    ref_item: git_diff::GitRefItem,
) -> Result<git_diff::GitDiffPreview, String> {
    git_diff::git_file_ref_diff_for_path(&path, &ref_item)
}

#[tauri::command]
pub(super) fn watch_git_status(
    paths: Vec<String>,
    app: tauri::AppHandle,
    state: tauri::State<GitStatusWatchState>,
) -> Result<GitStatusWatchRegistration, String> {
    register_git_status_watch(paths, &app, &state)
}

#[tauri::command]
pub(super) fn unwatch_git_status(
    watch_id: String,
    state: tauri::State<GitStatusWatchState>,
) -> Result<(), String> {
    remove_git_status_watch(&watch_id, &state)
}
