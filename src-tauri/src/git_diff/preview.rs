use super::*;

pub(super) mod batch;
pub use batch::{
    git_branch_file_diffs_for_paths, git_diff_previews_for_paths, git_file_commit_diffs_for_paths,
};

const MAX_GIT_DIFF_PREVIEW_BATCH_PATHS: usize = 32;

mod line_diff;
mod resource;

use line_diff::line_diff_hunks_bounded;
#[cfg(test)]
pub(in crate::git_diff) use line_diff::{
    line_diff_common_edges, line_diff_hunks, line_diff_hunks_full_lcs_for_test,
    line_diff_hunks_with_budget_for_test, line_diff_hunks_with_metrics_for_test, split_lines,
    LineDiffCommonEdges, LINEAR_DIFF_SCRATCH_COEFFICIENT, LINE_DIFF_WORK_BUDGET,
};
pub(in crate::git_diff) use line_diff::{
    looks_binary, LineDiffWorkBudgetExceeded, LINE_DIFF_WORK_BUDGET_MESSAGE,
};
use resource::*;

fn with_resource_sources(
    mut preview: GitDiffPreview,
    left_relative_path: Option<String>,
    right_relative_path: Option<String>,
    left_resource_source: Option<GitDiffResourceSource>,
    right_resource_source: Option<GitDiffResourceSource>,
) -> GitDiffPreview {
    preview.left_relative_path = left_relative_path;
    preview.right_relative_path = right_relative_path;
    preview.left_resource_source = left_resource_source;
    preview.right_resource_source = right_resource_source;
    preview
}

pub fn git_branch_file_diff_for_path(
    path: &str,
    base_ref: &str,
    head_ref: Option<&str>,
    relative_path: &str,
    old_path: Option<&str>,
) -> Result<GitDiffPreview, String> {
    let input_path = PathBuf::from(path);
    let discover_start = discover_start_for_path(&input_path)?;
    let repo = match gix::discover(&discover_start) {
        Ok(repo) => repo,
        Err(_) => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Path is not inside a Git repository.".to_string()),
            ));
        }
    };
    let workdir = match repo_workdir(&repo) {
        Some(path) => path,
        None => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Bare repositories are not supported for Branch Diff.".to_string()),
            ));
        }
    };
    let selected_head = head_ref
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("HEAD");
    let base_commit = resolve_commit(&repo, base_ref)?;
    let head_commit = resolve_commit(&repo, selected_head)?;
    let left_path = PathBuf::from(old_path.unwrap_or(relative_path));
    let right_path = PathBuf::from(relative_path);
    let left = blob_bytes_at_commit(&base_commit, &left_path)?;
    let right = blob_bytes_at_commit(&head_commit, &right_path)?;
    build_revision_preview(
        Some(path_string(&workdir)),
        relative_path.to_string(),
        base_ref.to_string(),
        selected_head.to_string(),
        left,
        right,
        "Document is not present in the selected Branch Diff range.",
    )
    .map(|preview| {
        with_resource_sources(
            preview,
            Some(repo_relative_path(&left_path)),
            Some(repo_relative_path(&right_path)),
            Some(commit_resource_source(&base_commit)),
            Some(commit_resource_source(&head_commit)),
        )
    })
}

pub fn git_diff_preview_for_path(path: &str) -> Result<GitDiffPreview, String> {
    let input_path = PathBuf::from(path);
    let discover_start = discover_start_for_path(&input_path)?;
    let repo = match gix::discover(&discover_start) {
        Ok(repo) => repo,
        Err(_) => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Document is not inside a Git repository.".to_string()),
            ));
        }
    };

    let workdir = match repo_workdir(&repo) {
        Some(path) => path,
        None => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Bare repositories are not supported for preview diff.".to_string()),
            ));
        }
    };
    let absolute_path = absolute_candidate_path(&input_path)?;
    let relative_path = match absolute_path.strip_prefix(&workdir) {
        Ok(path) => path.to_path_buf(),
        Err(_) => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                Some(path_string(&workdir)),
                None,
                Some("Document is outside the discovered Git worktree.".to_string()),
            ));
        }
    };
    let context = WorktreePreviewContext::prepare(&repo, workdir)?;
    build_worktree_preview(&context, absolute_path, relative_path)
}

fn build_worktree_preview(
    context: &WorktreePreviewContext<'_>,
    absolute_path: PathBuf,
    relative_path: PathBuf,
) -> Result<GitDiffPreview, String> {
    let relative_path_display = repo_relative_path(&relative_path);
    let repository_root = Some(path_string(&context.workdir));
    let head_bytes = head_blob_bytes_from_tree(context.head_tree.as_ref(), &relative_path)?;
    let index_bytes =
        index_blob_bytes_from_index(context.repo, &context.index, &relative_path_display)?;
    let worktree_bytes = match fs::read(&absolute_path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("failed to read worktree file: {error}")),
    };
    if let Some(status) = staged_status_from_bytes(head_bytes.as_deref(), index_bytes.as_deref()) {
        let left = head_bytes.clone().unwrap_or_default();
        let right = index_bytes.clone().unwrap_or_default();
        return build_text_preview_with_labels(
            repository_root,
            relative_path_display.clone(),
            status,
            "HEAD".to_string(),
            "Index".to_string(),
            left,
            right,
        )
        .map(|preview| {
            with_resource_sources(
                preview,
                Some(relative_path_display.clone()),
                Some(relative_path_display.clone()),
                context.head_resource_source.clone(),
                Some(GitDiffResourceSource::Index),
            )
        });
    }

    let preview = match (head_bytes, worktree_bytes) {
        (Some(left), Some(right)) if left == right => Ok(empty_preview(
            GitDiffStatus::Clean,
            repository_root,
            Some(relative_path_display.clone()),
            Some("No working tree changes for this document.".to_string()),
        )),
        (Some(left), Some(right)) => build_text_preview(
            repository_root,
            relative_path_display.clone(),
            GitDiffStatus::Modified,
            left,
            right,
        ),
        (Some(left), None) => build_text_preview(
            repository_root,
            relative_path_display.clone(),
            GitDiffStatus::Deleted,
            left,
            Vec::new(),
        ),
        (None, Some(right)) => {
            let status = if index_bytes.is_some() {
                GitDiffStatus::Added
            } else {
                GitDiffStatus::Untracked
            };
            build_text_preview(
                repository_root,
                relative_path_display.clone(),
                status,
                Vec::new(),
                right,
            )
        }
        (None, None) => Ok(empty_preview(
            GitDiffStatus::Error,
            repository_root,
            Some(relative_path_display.clone()),
            Some("Document is not present in HEAD or the working tree.".to_string()),
        )),
    }?;
    let left_source = if matches!(
        preview.status,
        GitDiffStatus::Added | GitDiffStatus::Untracked
    ) {
        None
    } else {
        context.head_resource_source.clone()
    };
    let right_source = if matches!(
        preview.status,
        GitDiffStatus::Deleted | GitDiffStatus::Error
    ) {
        None
    } else {
        Some(GitDiffResourceSource::Worktree)
    };
    Ok(with_resource_sources(
        preview,
        Some(relative_path_display.clone()),
        Some(relative_path_display),
        left_source,
        right_source,
    ))
}

pub fn git_file_revision_diff_for_path(
    path: &str,
    revision: &str,
) -> Result<GitDiffPreview, String> {
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Document is not inside a Git repository.".to_string()),
            ));
        }
    };
    let revision_id = context
        .repo
        .rev_parse_single(revision)
        .map_err(|error| format!("failed to resolve Git revision: {error}"))?;
    let commit = revision_id
        .object()
        .map_err(|error| format!("failed to read Git revision object: {error}"))?
        .into_commit();
    let left = blob_bytes_at_commit(&commit, &context.relative_path)?;
    let right = match fs::read(&context.absolute_path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("failed to read worktree file: {error}")),
    };
    let short_hash = short_id_for_commit(&commit)?;
    let resource_relative_path = context.relative_path_display.clone();
    let status = match (&left, &right) {
        (Some(left), Some(right)) if left == right => GitDiffStatus::Clean,
        (Some(_), Some(_)) => GitDiffStatus::Modified,
        (Some(_), None) => GitDiffStatus::Deleted,
        (None, Some(_)) => GitDiffStatus::Added,
        (None, None) => GitDiffStatus::Error,
    };
    let mut preview = match (left, right) {
        (Some(left), Some(right)) if left == right => empty_preview(
            GitDiffStatus::Clean,
            Some(path_string(&context.workdir)),
            Some(context.relative_path_display.clone()),
            Some("No changes between this commit and the working tree.".to_string()),
        ),
        (Some(left), Some(right)) => build_text_preview_with_labels(
            Some(path_string(&context.workdir)),
            context.relative_path_display.clone(),
            status,
            short_hash.clone(),
            "Working Tree".to_string(),
            left,
            right,
        )?,
        (Some(left), None) => build_text_preview_with_labels(
            Some(path_string(&context.workdir)),
            context.relative_path_display.clone(),
            status,
            short_hash.clone(),
            "Working Tree".to_string(),
            left,
            Vec::new(),
        )?,
        (None, Some(right)) => build_text_preview_with_labels(
            Some(path_string(&context.workdir)),
            context.relative_path_display.clone(),
            status,
            short_hash.clone(),
            "Working Tree".to_string(),
            Vec::new(),
            right,
        )?,
        (None, None) => empty_preview(
            GitDiffStatus::Error,
            Some(path_string(&context.workdir)),
            Some(context.relative_path_display.clone()),
            Some(
                "Document is not present in the selected revision or the working tree.".to_string(),
            ),
        ),
    };
    preview.left_label = short_hash;
    preview.right_label = "Working Tree".to_string();
    Ok(with_resource_sources(
        preview,
        Some(resource_relative_path.clone()),
        Some(resource_relative_path),
        Some(commit_resource_source(&commit)),
        Some(GitDiffResourceSource::Worktree),
    ))
}

pub fn git_file_commit_diff_for_path(path: &str, revision: &str) -> Result<GitDiffPreview, String> {
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Document is not inside a Git repository.".to_string()),
            ));
        }
    };
    let commit = resolve_commit(&context.repo, revision)?;
    let right_label = short_id_for_commit(&commit)?;
    let parent = first_parent_commit(&commit);
    let (left_label, left, left_resource_source) = match parent {
        Some(parent) => (
            short_id_for_commit(&parent)?,
            blob_bytes_at_commit(&parent, &context.relative_path)?,
            Some(commit_resource_source(&parent)),
        ),
        None => ("Previous".to_string(), None, None),
    };
    let right = blob_bytes_at_commit(&commit, &context.relative_path)?;
    build_revision_preview(
        Some(path_string(&context.workdir)),
        context.relative_path_display.clone(),
        left_label,
        right_label,
        left,
        right,
        "Document is not present in this commit or its previous revision.",
    )
    .map(|preview| {
        with_resource_sources(
            preview,
            Some(context.relative_path_display.clone()),
            Some(context.relative_path_display.clone()),
            left_resource_source,
            Some(commit_resource_source(&commit)),
        )
    })
}

pub fn git_file_revision_pair_diff_for_path(
    path: &str,
    left_revision: &str,
    right_revision: &str,
) -> Result<GitDiffPreview, String> {
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Document is not inside a Git repository.".to_string()),
            ));
        }
    };
    let left_commit = resolve_commit(&context.repo, left_revision)?;
    let right_commit = resolve_commit(&context.repo, right_revision)?;
    let left_label = short_id_for_commit(&left_commit)?;
    let right_label = short_id_for_commit(&right_commit)?;
    let left = blob_bytes_at_commit(&left_commit, &context.relative_path)?;
    let right = blob_bytes_at_commit(&right_commit, &context.relative_path)?;
    build_revision_preview(
        Some(path_string(&context.workdir)),
        context.relative_path_display.clone(),
        left_label,
        right_label,
        left,
        right,
        "Document is not present in either selected revision.",
    )
    .map(|preview| {
        with_resource_sources(
            preview,
            Some(context.relative_path_display.clone()),
            Some(context.relative_path_display.clone()),
            Some(commit_resource_source(&left_commit)),
            Some(commit_resource_source(&right_commit)),
        )
    })
}

pub fn git_file_ref_diff_for_path(
    path: &str,
    ref_item: &GitRefItem,
) -> Result<GitDiffPreview, String> {
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            return Ok(empty_preview(
                GitDiffStatus::NotInRepo,
                None,
                None,
                Some("Document is not inside a Git repository.".to_string()),
            ));
        }
    };
    let commit = resolve_commit(&context.repo, &ref_item.revision)?;
    let left = blob_bytes_at_commit(&commit, &context.relative_path)?;
    let right = match fs::read(&context.absolute_path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("failed to read worktree file: {error}")),
    };
    let left_label = match ref_item.kind {
        GitRefKind::Branch => format!("branch:{}", ref_item.name),
        GitRefKind::Tag => format!("tag:{}", ref_item.name),
        GitRefKind::Commit => ref_item.short_revision.clone(),
    };
    build_revision_preview(
        Some(path_string(&context.workdir)),
        context.relative_path_display.clone(),
        left_label,
        "Working Tree".to_string(),
        left,
        right,
        "Document is not present in the selected Git ref or the working tree.",
    )
    .map(|preview| {
        with_resource_sources(
            preview,
            Some(context.relative_path_display.clone()),
            Some(context.relative_path_display.clone()),
            Some(commit_resource_source(&commit)),
            Some(GitDiffResourceSource::Worktree),
        )
    })
}

pub(super) fn build_revision_preview(
    repository_root: Option<String>,
    relative_path: String,
    left_label: String,
    right_label: String,
    left: Option<Vec<u8>>,
    right: Option<Vec<u8>>,
    missing_message: &str,
) -> Result<GitDiffPreview, String> {
    let status = match (&left, &right) {
        (Some(left), Some(right)) if left == right => GitDiffStatus::Clean,
        (Some(_), Some(_)) => GitDiffStatus::Modified,
        (Some(_), None) => GitDiffStatus::Deleted,
        (None, Some(_)) => GitDiffStatus::Added,
        (None, None) => GitDiffStatus::Error,
    };
    let mut preview = match (left, right) {
        (Some(left), Some(right)) if left == right => empty_preview(
            GitDiffStatus::Clean,
            repository_root,
            Some(relative_path),
            Some("No changes between the selected Git revisions.".to_string()),
        ),
        (Some(left), Some(right)) => build_text_preview_with_labels(
            repository_root,
            relative_path,
            status,
            left_label.clone(),
            right_label.clone(),
            left,
            right,
        )?,
        (Some(left), None) => build_text_preview_with_labels(
            repository_root,
            relative_path,
            status,
            left_label.clone(),
            right_label.clone(),
            left,
            Vec::new(),
        )?,
        (None, Some(right)) => build_text_preview_with_labels(
            repository_root,
            relative_path,
            status,
            left_label.clone(),
            right_label.clone(),
            Vec::new(),
            right,
        )?,
        (None, None) => empty_preview(
            GitDiffStatus::Error,
            repository_root,
            Some(relative_path),
            Some(missing_message.to_string()),
        ),
    };
    preview.left_label = left_label;
    preview.right_label = right_label;
    Ok(preview)
}

pub(super) fn build_text_preview(
    repository_root: Option<String>,
    relative_path: String,
    status: GitDiffStatus,
    left: Vec<u8>,
    right: Vec<u8>,
) -> Result<GitDiffPreview, String> {
    build_text_preview_with_labels(
        repository_root,
        relative_path,
        status,
        "HEAD".to_string(),
        "Working Tree".to_string(),
        left,
        right,
    )
}

pub(super) fn build_text_preview_with_labels(
    repository_root: Option<String>,
    relative_path: String,
    status: GitDiffStatus,
    left_label: String,
    right_label: String,
    left: Vec<u8>,
    right: Vec<u8>,
) -> Result<GitDiffPreview, String> {
    if left.len() > MAX_TEXT_DIFF_BYTES || right.len() > MAX_TEXT_DIFF_BYTES {
        return Ok(empty_preview(
            GitDiffStatus::Binary,
            repository_root,
            Some(relative_path),
            Some("Document is too large for inline diff preview.".to_string()),
        ));
    }
    if looks_binary(&left) || looks_binary(&right) {
        return Ok(empty_preview(
            GitDiffStatus::Binary,
            repository_root,
            Some(relative_path),
            Some("Binary document diff preview is not supported.".to_string()),
        ));
    }
    let left_text =
        String::from_utf8(left).map_err(|_| "HEAD content is not UTF-8 text".to_string())?;
    let right_text = String::from_utf8(right)
        .map_err(|_| "Working tree content is not UTF-8 text".to_string())?;
    let (line_diff_availability, line_diff_fallback_reason, hunks, message) =
        match line_diff_hunks_bounded(&left_text, &right_text) {
            Ok(hunks) => (LineDiffAvailability::Available, None, hunks, None),
            Err(LineDiffWorkBudgetExceeded) => (
                LineDiffAvailability::TooComplex,
                Some(LineDiffFallbackReason::WorkBudgetExceeded),
                Vec::new(),
                Some(LINE_DIFF_WORK_BUDGET_MESSAGE.to_string()),
            ),
        };
    Ok(GitDiffPreview {
        repository_root,
        relative_path: Some(relative_path),
        status,
        line_diff_availability,
        line_diff_fallback_reason,
        left_label,
        right_label,
        hunks,
        message,
        left_text: Some(left_text),
        right_text: Some(right_text),
        left_relative_path: None,
        right_relative_path: None,
        left_resource_source: None,
        right_resource_source: None,
    })
}

pub(super) fn empty_preview(
    status: GitDiffStatus,
    repository_root: Option<String>,
    relative_path: Option<String>,
    message: Option<String>,
) -> GitDiffPreview {
    GitDiffPreview {
        repository_root,
        relative_path,
        status,
        line_diff_availability: LineDiffAvailability::Available,
        line_diff_fallback_reason: None,
        left_label: "HEAD".to_string(),
        right_label: "Working Tree".to_string(),
        hunks: Vec::new(),
        message,
        left_text: None,
        right_text: None,
        left_relative_path: None,
        right_relative_path: None,
        left_resource_source: None,
        right_resource_source: None,
    }
}
