use super::*;

pub fn git_diff_previews_for_paths(
    repository_root: &str,
    relative_paths: Vec<String>,
) -> Result<Vec<GitDiffPreviewBatchEntry>, String> {
    validate_batch_size("Git diff preview batch", relative_paths.len())?;
    let (repo, workdir) = batch_repository_for_root(repository_root)?;
    let context = WorktreePreviewContext::prepare(&repo, workdir)?;
    Ok(collect_batch_entries(relative_paths, |relative_path| {
        batch_preview_for_relative_path(&context, &relative_path)
    }))
}

struct BranchPreviewContext<'repo> {
    workdir: PathBuf,
    base_commit: gix::Commit<'repo>,
    head_commit: gix::Commit<'repo>,
    base_label: String,
    head_label: String,
    base_resource_source: GitDiffResourceSource,
    head_resource_source: GitDiffResourceSource,
}

struct CommitPreviewContext<'repo> {
    workdir: PathBuf,
    commit: gix::Commit<'repo>,
    parent: Option<gix::Commit<'repo>>,
    left_label: String,
    right_label: String,
    left_resource_source: Option<GitDiffResourceSource>,
    right_resource_source: GitDiffResourceSource,
}

pub fn git_branch_file_diffs_for_paths(
    repository_root: &str,
    base_ref: &str,
    head_ref: Option<&str>,
    items: Vec<GitBranchDiffPreviewBatchItem>,
) -> Result<Vec<GitDiffPreviewBatchEntry>, String> {
    validate_batch_size("Git Branch Diff preview batch", items.len())?;
    let (repo, workdir) = batch_repository_for_root(repository_root)?;
    let context = prepare_branch_preview_context(&repo, workdir, base_ref, head_ref)?;
    Ok(branch_entries(&context, items))
}

fn prepare_branch_preview_context<'repo>(
    repo: &'repo gix::Repository,
    workdir: PathBuf,
    base_ref: &str,
    head_ref: Option<&str>,
) -> Result<BranchPreviewContext<'repo>, String> {
    let selected_head = head_ref
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("HEAD");
    let base_commit = resolve_commit(repo, base_ref)?;
    let head_commit = resolve_commit(repo, selected_head)?;
    let base_resource_source = commit_resource_source(&base_commit);
    let head_resource_source = commit_resource_source(&head_commit);
    Ok(BranchPreviewContext {
        workdir,
        base_commit,
        head_commit,
        base_label: base_ref.to_string(),
        head_label: selected_head.to_string(),
        base_resource_source,
        head_resource_source,
    })
}

fn branch_entries(
    context: &BranchPreviewContext<'_>,
    items: Vec<GitBranchDiffPreviewBatchItem>,
) -> Vec<GitDiffPreviewBatchEntry> {
    collect_batch_entries(items, |item| {
        build_branch_preview(context, &item.path, item.old_path.as_deref())
    })
}

fn build_branch_preview(
    context: &BranchPreviewContext<'_>,
    relative_path: &str,
    old_path: Option<&str>,
) -> Result<GitDiffPreview, String> {
    let right_path = validated_batch_relative_path(relative_path)?;
    let left_path = validated_batch_relative_path(old_path.unwrap_or(relative_path))?;
    let left = blob_bytes_at_commit(&context.base_commit, &left_path)?;
    let right = blob_bytes_at_commit(&context.head_commit, &right_path)?;
    build_revision_preview(
        Some(path_string(&context.workdir)),
        relative_path.to_string(),
        context.base_label.clone(),
        context.head_label.clone(),
        left,
        right,
        "Document is not present in the selected Branch Diff range.",
    )
    .map(|preview| {
        with_resource_sources(
            preview,
            Some(repo_relative_path(&left_path)),
            Some(repo_relative_path(&right_path)),
            Some(context.base_resource_source.clone()),
            Some(context.head_resource_source.clone()),
        )
    })
}

pub fn git_file_commit_diffs_for_paths(
    repository_root: &str,
    revision: &str,
    relative_paths: Vec<String>,
) -> Result<Vec<GitDiffPreviewBatchEntry>, String> {
    validate_batch_size("Git commit preview batch", relative_paths.len())?;
    let (repo, workdir) = batch_repository_for_root(repository_root)?;
    let context = prepare_commit_preview_context(&repo, workdir, revision)?;
    Ok(commit_entries(&context, relative_paths))
}

fn prepare_commit_preview_context<'repo>(
    repo: &'repo gix::Repository,
    workdir: PathBuf,
    revision: &str,
) -> Result<CommitPreviewContext<'repo>, String> {
    let commit = resolve_commit(repo, revision)?;
    let right_label = short_id_for_commit(&commit)?;
    let parent = first_parent_commit(&commit);
    let left_label = match parent.as_ref() {
        Some(parent) => short_id_for_commit(parent)?,
        None => "Previous".to_string(),
    };
    let left_resource_source = parent.as_ref().map(commit_resource_source);
    let right_resource_source = commit_resource_source(&commit);
    Ok(CommitPreviewContext {
        workdir,
        commit,
        parent,
        left_label,
        right_label,
        left_resource_source,
        right_resource_source,
    })
}

fn commit_entries(
    context: &CommitPreviewContext<'_>,
    relative_paths: Vec<String>,
) -> Vec<GitDiffPreviewBatchEntry> {
    collect_batch_entries(relative_paths, |relative_path| {
        build_commit_preview(context, &relative_path)
    })
}

fn validate_batch_size(label: &str, item_count: usize) -> Result<(), String> {
    if item_count > MAX_GIT_DIFF_PREVIEW_BATCH_PATHS {
        return Err(format!(
            "{label} accepts at most {MAX_GIT_DIFF_PREVIEW_BATCH_PATHS} paths."
        ));
    }
    Ok(())
}

fn collect_batch_entries<T>(
    items: Vec<T>,
    mut build: impl FnMut(T) -> Result<GitDiffPreview, String>,
) -> Vec<GitDiffPreviewBatchEntry> {
    items
        .into_iter()
        .map(|item| {
            build(item)
                .map(|preview| GitDiffPreviewBatchEntry::Ready { preview })
                .unwrap_or_else(|message| GitDiffPreviewBatchEntry::Error { message })
        })
        .collect()
}

fn batch_repository_for_root(repository_root: &str) -> Result<(gix::Repository, PathBuf), String> {
    let requested_root = canonicalize_path(Path::new(repository_root))
        .map_err(|error| format!("failed to resolve Git repository root: {error}"))?;
    if !requested_root.is_dir() {
        return Err("Git repository root is not a directory.".to_string());
    }
    let repo = gix::discover(&requested_root)
        .map_err(|_| "Git repository root is not inside a Git repository.".to_string())?;
    let workdir = repo_workdir(&repo)
        .ok_or_else(|| "Bare repositories are not supported for preview diff.".to_string())?;
    let canonical_workdir = canonicalize_path(&workdir)
        .map_err(|error| format!("failed to resolve Git worktree root: {error}"))?;
    if canonical_workdir != requested_root {
        return Err("Git repository root does not match the discovered worktree.".to_string());
    }
    Ok((repo, canonical_workdir))
}

fn batch_preview_for_relative_path(
    context: &WorktreePreviewContext<'_>,
    relative_path: &str,
) -> Result<GitDiffPreview, String> {
    let relative_path = validated_batch_relative_path(relative_path)?;
    let requested_path = context.workdir.join(&relative_path);
    let absolute_path = absolute_candidate_path(&requested_path)?;
    if !absolute_path.starts_with(&context.workdir) {
        return Err("Git diff preview path resolves outside the repository root.".to_string());
    }
    let resolved_relative_path = absolute_path
        .strip_prefix(&context.workdir)
        .map_err(|_| "Git diff preview path resolves outside the repository root.".to_string())?
        .to_path_buf();
    build_worktree_preview(context, absolute_path, resolved_relative_path)
}

fn validated_batch_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    if relative_path.is_empty() || path.is_absolute() {
        return Err("Git diff preview path must be a non-empty relative path.".to_string());
    }
    if path
        .components()
        .any(|component| !matches!(component, std::path::Component::Normal(_)))
    {
        return Err("Git diff preview path must not contain traversal components.".to_string());
    }
    Ok(path.to_path_buf())
}

fn build_commit_preview(
    context: &CommitPreviewContext<'_>,
    relative_path: &str,
) -> Result<GitDiffPreview, String> {
    let relative_path = validated_batch_relative_path(relative_path)?;
    let relative_path_display = repo_relative_path(&relative_path);
    let left = match context.parent.as_ref() {
        Some(parent) => blob_bytes_at_commit(parent, &relative_path)?,
        None => None,
    };
    let right = blob_bytes_at_commit(&context.commit, &relative_path)?;
    build_revision_preview(
        Some(path_string(&context.workdir)),
        relative_path_display.clone(),
        context.left_label.clone(),
        context.right_label.clone(),
        left,
        right,
        "Document is not present in this commit or its previous revision.",
    )
    .map(|preview| {
        with_resource_sources(
            preview,
            Some(relative_path_display.clone()),
            Some(relative_path_display),
            context.left_resource_source.clone(),
            Some(context.right_resource_source.clone()),
        )
    })
}

#[cfg(test)]
#[derive(Debug, Clone, Copy)]
pub(in crate::git_diff) struct GitStreamPreviewProbeTimings {
    pub repository_setup_ms: f64,
    pub revision_setup_ms: f64,
    pub preview_build_ms: f64,
}

#[cfg(test)]
pub(in crate::git_diff) fn probe_branch_file_diffs_for_paths(
    repository_root: &str,
    base_ref: &str,
    head_ref: Option<&str>,
    items: Vec<GitBranchDiffPreviewBatchItem>,
) -> Result<(Vec<GitDiffPreviewBatchEntry>, GitStreamPreviewProbeTimings), String> {
    let repository_started_at = std::time::Instant::now();
    let (repo, workdir) = batch_repository_for_root(repository_root)?;
    let repository_setup_ms = repository_started_at.elapsed().as_secs_f64() * 1_000.0;
    let revision_started_at = std::time::Instant::now();
    let context = prepare_branch_preview_context(&repo, workdir, base_ref, head_ref)?;
    let revision_setup_ms = revision_started_at.elapsed().as_secs_f64() * 1_000.0;
    let preview_started_at = std::time::Instant::now();
    let entries = branch_entries(&context, items);
    Ok((
        entries,
        GitStreamPreviewProbeTimings {
            repository_setup_ms,
            revision_setup_ms,
            preview_build_ms: preview_started_at.elapsed().as_secs_f64() * 1_000.0,
        },
    ))
}

#[cfg(test)]
pub(in crate::git_diff) fn probe_commit_file_diffs_for_paths(
    repository_root: &str,
    revision: &str,
    relative_paths: Vec<String>,
) -> Result<(Vec<GitDiffPreviewBatchEntry>, GitStreamPreviewProbeTimings), String> {
    let repository_started_at = std::time::Instant::now();
    let (repo, workdir) = batch_repository_for_root(repository_root)?;
    let repository_setup_ms = repository_started_at.elapsed().as_secs_f64() * 1_000.0;
    let revision_started_at = std::time::Instant::now();
    let context = prepare_commit_preview_context(&repo, workdir, revision)?;
    let revision_setup_ms = revision_started_at.elapsed().as_secs_f64() * 1_000.0;
    let preview_started_at = std::time::Instant::now();
    let entries = commit_entries(&context, relative_paths);
    Ok((
        entries,
        GitStreamPreviewProbeTimings {
            repository_setup_ms,
            revision_setup_ms,
            preview_build_ms: preview_started_at.elapsed().as_secs_f64() * 1_000.0,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn common_batch_runner_preserves_order_and_isolates_errors() {
        let entries = collect_batch_entries(vec!["first", "invalid", "last"], |item| {
            if item == "invalid" {
                return Err("fixture error".to_string());
            }
            let mut preview = empty_preview(GitDiffStatus::Clean, None, None, None);
            preview.relative_path = Some(item.to_string());
            Ok(preview)
        });

        assert!(matches!(
            &entries[0],
            GitDiffPreviewBatchEntry::Ready { preview }
                if preview.relative_path.as_deref() == Some("first")
        ));
        assert!(matches!(
            &entries[1],
            GitDiffPreviewBatchEntry::Error { message } if message == "fixture error"
        ));
        assert!(matches!(
            &entries[2],
            GitDiffPreviewBatchEntry::Ready { preview }
                if preview.relative_path.as_deref() == Some("last")
        ));
    }

    #[test]
    fn common_batch_limit_preserves_route_specific_labels() {
        assert_eq!(
            validate_batch_size("Git commit preview batch", 33),
            Err("Git commit preview batch accepts at most 32 paths.".to_string())
        );
    }
}
