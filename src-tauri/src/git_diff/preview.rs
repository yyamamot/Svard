use super::*;

const MAX_GIT_DIFF_PREVIEW_BATCH_PATHS: usize = 32;

struct WorktreePreviewContext<'repo> {
    repo: &'repo gix::Repository,
    workdir: PathBuf,
    head_tree: Option<gix::Tree<'repo>>,
    head_resource_source: Option<GitDiffResourceSource>,
    index: gix::worktree::Index,
}

impl<'repo> WorktreePreviewContext<'repo> {
    fn prepare(repo: &'repo gix::Repository, workdir: PathBuf) -> Result<Self, String> {
        let head_commit = repo.head_commit().ok();
        let head_resource_source = head_commit.as_ref().map(commit_resource_source);
        let head_tree = head_commit
            .as_ref()
            .map(|commit| {
                commit
                    .tree()
                    .map_err(|error| format!("failed to read HEAD tree: {error}"))
            })
            .transpose()?;
        let index = repo
            .index_or_empty()
            .map_err(|error| format!("failed to read Git index: {error}"))?;
        Ok(Self {
            repo,
            workdir,
            head_tree,
            head_resource_source,
            index,
        })
    }
}

fn commit_resource_source(commit: &gix::Commit<'_>) -> GitDiffResourceSource {
    GitDiffResourceSource::Commit {
        revision: commit.id().to_string(),
    }
}

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

pub fn git_diff_previews_for_paths(
    repository_root: &str,
    relative_paths: Vec<String>,
) -> Result<Vec<GitDiffPreviewBatchEntry>, String> {
    if relative_paths.len() > MAX_GIT_DIFF_PREVIEW_BATCH_PATHS {
        return Err(format!(
            "Git diff preview batch accepts at most {MAX_GIT_DIFF_PREVIEW_BATCH_PATHS} paths."
        ));
    }

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
    let context = WorktreePreviewContext::prepare(&repo, canonical_workdir)?;

    Ok(relative_paths
        .into_iter()
        .map(|relative_path| {
            batch_preview_for_relative_path(&context, &relative_path)
                .map(|preview| GitDiffPreviewBatchEntry::Ready { preview })
                .unwrap_or_else(|message| GitDiffPreviewBatchEntry::Error { message })
        })
        .collect())
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

fn head_blob_bytes_from_tree(
    tree: Option<&gix::Tree<'_>>,
    relative_path: &Path,
) -> Result<Option<Vec<u8>>, String> {
    let Some(tree) = tree else {
        return Ok(None);
    };
    let entry = tree
        .lookup_entry_by_path(relative_path)
        .map_err(|error| format!("failed to lookup HEAD path: {error}"))?;
    let Some(entry) = entry else {
        return Ok(None);
    };
    let object = entry
        .object()
        .map_err(|error| format!("failed to read HEAD object: {error}"))?;
    if object.kind != gix::object::Kind::Blob {
        return Ok(None);
    }
    let mut blob = object.into_blob();
    Ok(Some(blob.take_data()))
}

fn index_blob_bytes_from_index(
    repo: &gix::Repository,
    index: &gix::worktree::Index,
    relative_path: &str,
) -> Result<Option<Vec<u8>>, String> {
    let Some(entry) = index.entry_by_path(relative_path.as_bytes().as_bstr()) else {
        return Ok(None);
    };
    let object = repo
        .find_object(entry.id)
        .map_err(|error| format!("failed to read Git index object: {error}"))?;
    if object.kind != gix::object::Kind::Blob {
        return Ok(None);
    }
    let mut blob = object.into_blob();
    Ok(Some(blob.take_data()))
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

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(super) struct LineDiffCommonEdges {
    pub(super) prefix_lines: usize,
    pub(super) suffix_lines: usize,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(super) struct LineDiffCoreMetrics {
    pub(super) peak_scratch_entries: u64,
    pub(super) work_units: u64,
}

pub(super) const LINEAR_DIFF_SCRATCH_COEFFICIENT: usize = 2;
pub(super) const LINE_DIFF_WORK_BUDGET: u64 = 25_000_000;
pub(super) const LINE_DIFF_WORK_BUDGET_MESSAGE: &str = "Highlighted diff is unavailable because this comparison exceeds the safe work limit. Both source versions remain available.";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct LineDiffWorkBudgetExceeded;

struct LineDiffCoreState {
    metrics: LineDiffCoreMetrics,
    remaining_work_units: u64,
}

impl LineDiffCoreState {
    fn new(work_budget: u64) -> Self {
        Self {
            metrics: LineDiffCoreMetrics::default(),
            remaining_work_units: work_budget,
        }
    }

    fn reserve_work(&mut self, requested: usize) -> usize {
        let requested = u64::try_from(requested).expect("line diff work reservation");
        let allowed = requested.min(self.remaining_work_units);
        self.remaining_work_units -= allowed;
        self.metrics.work_units = self
            .metrics
            .work_units
            .checked_add(allowed)
            .expect("line diff work units");
        usize::try_from(allowed).expect("line diff allowed work")
    }

    fn refund_work(&mut self, unused: usize) {
        let unused = u64::try_from(unused).expect("line diff work refund");
        self.remaining_work_units = self
            .remaining_work_units
            .checked_add(unused)
            .expect("line diff remaining work units");
        self.metrics.work_units = self
            .metrics
            .work_units
            .checked_sub(unused)
            .expect("line diff recorded work units");
    }

    fn record_scratch<const MEASURE: bool>(&mut self, entries: usize) {
        if MEASURE {
            self.metrics.peak_scratch_entries = self
                .metrics
                .peak_scratch_entries
                .max(u64::try_from(entries).expect("line diff scratch entries"));
        }
    }
}

pub(super) fn line_diff_common_edges(
    left_lines: &[&str],
    right_lines: &[&str],
) -> LineDiffCommonEdges {
    let prefix_lines = left_lines
        .iter()
        .zip(right_lines)
        .take_while(|(left, right)| left == right)
        .count();
    let remaining_left = left_lines.len() - prefix_lines;
    let remaining_right = right_lines.len() - prefix_lines;
    let maximal_suffix_lines = (0..remaining_left.min(remaining_right))
        .take_while(|offset| {
            left_lines[left_lines.len() - offset - 1] == right_lines[right_lines.len() - offset - 1]
        })
        .count();
    if maximal_suffix_lines == 0 {
        return LineDiffCommonEdges {
            prefix_lines,
            suffix_lines: 0,
        };
    }

    let left_middle_end = left_lines.len() - maximal_suffix_lines;
    let right_middle_end = right_lines.len() - maximal_suffix_lines;
    let suffix_boundary = left_lines[left_middle_end];
    let suffix_boundary_repeats = left_lines[prefix_lines..left_middle_end]
        .contains(&suffix_boundary)
        || right_lines[prefix_lines..right_middle_end].contains(&suffix_boundary);

    LineDiffCommonEdges {
        prefix_lines,
        suffix_lines: if suffix_boundary_repeats {
            0
        } else {
            maximal_suffix_lines
        },
    }
}

#[cfg(test)]
pub(super) fn line_diff_hunks(left: &str, right: &str) -> Vec<GitDiffHunk> {
    line_diff_hunks_bounded(left, right).expect("test fixture must fit the line diff work budget")
}

#[cfg(test)]
pub(super) fn line_diff_hunks_with_metrics_for_test(
    left: &str,
    right: &str,
) -> (Vec<GitDiffHunk>, LineDiffCoreMetrics) {
    let (result, metrics) = line_diff_hunks_linear::<true>(left, right, LINE_DIFF_WORK_BUDGET);
    (
        result.expect("test fixture must fit the line diff work budget"),
        metrics,
    )
}

#[cfg(test)]
pub(super) fn line_diff_hunks_with_budget_for_test(
    left: &str,
    right: &str,
    work_budget: u64,
) -> (
    Result<Vec<GitDiffHunk>, LineDiffWorkBudgetExceeded>,
    LineDiffCoreMetrics,
) {
    line_diff_hunks_linear::<true>(left, right, work_budget)
}

fn line_diff_hunks_bounded(
    left: &str,
    right: &str,
) -> Result<Vec<GitDiffHunk>, LineDiffWorkBudgetExceeded> {
    line_diff_hunks_linear::<false>(left, right, LINE_DIFF_WORK_BUDGET).0
}

fn line_diff_hunks_linear<const MEASURE: bool>(
    left: &str,
    right: &str,
    work_budget: u64,
) -> (
    Result<Vec<GitDiffHunk>, LineDiffWorkBudgetExceeded>,
    LineDiffCoreMetrics,
) {
    let mut state = LineDiffCoreState::new(work_budget);
    if left == right {
        return (Ok(Vec::new()), state.metrics);
    }
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let common_edges = line_diff_common_edges(&left_lines, &right_lines);
    let left_middle_end = left_lines.len() - common_edges.suffix_lines;
    let right_middle_end = right_lines.len() - common_edges.suffix_lines;
    let left_middle = &left_lines[common_edges.prefix_lines..left_middle_end];
    let right_middle = &right_lines[common_edges.prefix_lines..right_middle_end];
    let mut lines = Vec::with_capacity(left_lines.len() + right_lines.len());
    for index in 0..common_edges.prefix_lines {
        lines.push(GitDiffLine {
            kind: GitDiffLineKind::Context,
            old_line: Some(index + 1),
            new_line: Some(index + 1),
            text: left_lines[index].to_string(),
        });
    }
    let result = append_linear_diff::<MEASURE>(
        left_middle,
        right_middle,
        common_edges.prefix_lines,
        common_edges.prefix_lines,
        &mut lines,
        &mut state,
    );
    if let Err(error) = result {
        return (Err(error), state.metrics);
    }
    for offset in 0..common_edges.suffix_lines {
        let left_index = left_middle_end + offset;
        let right_index = right_middle_end + offset;
        lines.push(GitDiffLine {
            kind: GitDiffLineKind::Context,
            old_line: Some(left_index + 1),
            new_line: Some(right_index + 1),
            text: left_lines[left_index].to_string(),
        });
    }

    (
        Ok(finalize_line_diff_hunks(
            left_lines.len(),
            right_lines.len(),
            lines,
        )),
        state.metrics,
    )
}

fn finalize_line_diff_hunks(
    left_line_count: usize,
    right_line_count: usize,
    lines: Vec<GitDiffLine>,
) -> Vec<GitDiffHunk> {
    if lines
        .iter()
        .all(|line| line.kind == GitDiffLineKind::Context)
    {
        return Vec::new();
    }

    vec![GitDiffHunk {
        old_start: 1,
        old_lines: left_line_count,
        new_start: 1,
        new_lines: right_line_count,
        lines,
    }]
}

fn append_linear_diff<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    state: &mut LineDiffCoreState,
) -> Result<(), LineDiffWorkBudgetExceeded> {
    if append_linear_diff_base_case::<MEASURE>(left, right, old_offset, new_offset, output, state)?
    {
        return Ok(());
    }
    // With an empty LCS, the frozen full-matrix path follows right-on-tie successors:
    // every right line is Added before every left line is Removed. Detecting that exact
    // case avoids allocating workspace without changing the edit script.
    if !linear_diff_has_common_line(left, right, state)? {
        append_added_lines(right, new_offset, output);
        append_removed_lines(left, old_offset, output);
        return Ok(());
    }

    let workspace_len = right.len() + 1;
    state.record_scratch::<MEASURE>(
        LINEAR_DIFF_SCRATCH_COEFFICIENT
            .checked_mul(workspace_len)
            .expect("line diff scratch size"),
    );
    let mut scores = vec![0usize; workspace_len];
    let mut crossings = vec![0usize; workspace_len];
    append_canonical_diff::<MEASURE>(
        left,
        right,
        old_offset,
        new_offset,
        output,
        &mut scores,
        &mut crossings,
        state,
    )
}

fn append_canonical_diff<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    scores: &mut [usize],
    crossings: &mut [usize],
    state: &mut LineDiffCoreState,
) -> Result<(), LineDiffWorkBudgetExceeded> {
    if append_linear_diff_base_case::<MEASURE>(left, right, old_offset, new_offset, output, state)?
    {
        return Ok(());
    }

    let left_split = left.len() / 2;
    let right_split = canonical_diff_crossing(left, right, left_split, scores, crossings, state)?;
    append_canonical_diff::<MEASURE>(
        &left[..left_split],
        &right[..right_split],
        old_offset,
        new_offset,
        output,
        scores,
        crossings,
        state,
    )?;
    append_canonical_diff::<MEASURE>(
        &left[left_split..],
        &right[right_split..],
        old_offset + left_split,
        new_offset + right_split,
        output,
        scores,
        crossings,
        state,
    )
}

fn canonical_diff_crossing(
    left: &[&str],
    right: &[&str],
    left_split: usize,
    scores: &mut [usize],
    crossings: &mut [usize],
    state: &mut LineDiffCoreState,
) -> Result<usize, LineDiffWorkBudgetExceeded> {
    // Propagate the column where the frozen full-LCS successor path crosses left_split.
    // The mismatch branch intentionally selects the right successor on equal scores so
    // the reconstructed edit script preserves the existing Added-first tie behavior.
    let right_len = right.len();
    let scores = &mut scores[..=right_len];
    let crossings = &mut crossings[..=right_len];
    scores.fill(0);

    for left_index in (left_split..left.len()).rev() {
        let mut diagonal_score = scores[right_len];
        let allowed = state.reserve_work(right_len);
        for right_index in (0..right_len).rev().take(allowed) {
            let down_score = scores[right_index];
            scores[right_index] = if left[left_index] == right[right_index] {
                diagonal_score + 1
            } else {
                down_score.max(scores[right_index + 1])
            };
            diagonal_score = down_score;
        }
        if allowed < right_len {
            return Err(LineDiffWorkBudgetExceeded);
        }
    }

    for (right_index, crossing) in crossings.iter_mut().enumerate() {
        *crossing = right_index;
    }
    for left_index in (0..left_split).rev() {
        let mut diagonal_score = scores[right_len];
        let mut diagonal_crossing = crossings[right_len];
        let allowed = state.reserve_work(right_len);
        for right_index in (0..right_len).rev().take(allowed) {
            let down_score = scores[right_index];
            let down_crossing = crossings[right_index];
            let right_score = scores[right_index + 1];
            let right_crossing = crossings[right_index + 1];
            if left[left_index] == right[right_index] {
                scores[right_index] = diagonal_score + 1;
                crossings[right_index] = diagonal_crossing;
            } else if right_score >= down_score {
                scores[right_index] = right_score;
                crossings[right_index] = right_crossing;
            } else {
                scores[right_index] = down_score;
                crossings[right_index] = down_crossing;
            }
            diagonal_score = down_score;
            diagonal_crossing = down_crossing;
        }
        if allowed < right_len {
            return Err(LineDiffWorkBudgetExceeded);
        }
    }
    Ok(crossings[0])
}

fn append_linear_diff_base_case<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    state: &mut LineDiffCoreState,
) -> Result<bool, LineDiffWorkBudgetExceeded> {
    if left.is_empty() {
        append_added_lines(right, new_offset, output);
        return Ok(true);
    }
    if right.is_empty() {
        append_removed_lines(left, old_offset, output);
        return Ok(true);
    }
    if left.len() == 1 {
        let allowed = state.reserve_work(right.len());
        let match_index = find_line_match(left[0], &right[..allowed]);
        if let Some(match_index) = match_index {
            state.refund_work(allowed - match_index - 1);
            append_added_lines(&right[..match_index], new_offset, output);
            output.push(GitDiffLine {
                kind: GitDiffLineKind::Context,
                old_line: Some(old_offset + 1),
                new_line: Some(new_offset + match_index + 1),
                text: left[0].to_string(),
            });
            append_added_lines(
                &right[match_index + 1..],
                new_offset + match_index + 1,
                output,
            );
        } else if allowed < right.len() {
            return Err(LineDiffWorkBudgetExceeded);
        } else {
            append_added_lines(right, new_offset, output);
            append_removed_lines(left, old_offset, output);
        }
        return Ok(true);
    }
    if right.len() == 1 {
        let allowed = state.reserve_work(left.len());
        let match_index = find_line_match(right[0], &left[..allowed]);
        if let Some(match_index) = match_index {
            state.refund_work(allowed - match_index - 1);
            append_removed_lines(&left[..match_index], old_offset, output);
            output.push(GitDiffLine {
                kind: GitDiffLineKind::Context,
                old_line: Some(old_offset + match_index + 1),
                new_line: Some(new_offset + 1),
                text: right[0].to_string(),
            });
            append_removed_lines(
                &left[match_index + 1..],
                old_offset + match_index + 1,
                output,
            );
        } else if allowed < left.len() {
            return Err(LineDiffWorkBudgetExceeded);
        } else {
            append_added_lines(right, new_offset, output);
            append_removed_lines(left, old_offset, output);
        }
        return Ok(true);
    }
    Ok(false)
}

fn linear_diff_has_common_line(
    left: &[&str],
    right: &[&str],
    state: &mut LineDiffCoreState,
) -> Result<bool, LineDiffWorkBudgetExceeded> {
    if let Some(total_work) = left.len().checked_mul(right.len()) {
        let total_work_u64 = u64::try_from(total_work).expect("line diff common-line work");
        if total_work_u64 <= state.remaining_work_units {
            state.reserve_work(total_work);
            for left_line in left {
                if let Some(right_index) = find_line_match(left_line, right) {
                    let left_index = find_slice_element_position(left, left_line);
                    let completed_work = left_index
                        .checked_mul(right.len())
                        .and_then(|value| value.checked_add(right_index + 1))
                        .expect("line diff completed common-line work");
                    state.refund_work(total_work - completed_work);
                    return Ok(true);
                }
            }
            return Ok(false);
        }
    }

    for left_line in left {
        let allowed = state.reserve_work(right.len());
        if let Some(right_index) = find_line_match(left_line, &right[..allowed]) {
            state.refund_work(allowed - right_index - 1);
            return Ok(true);
        }
        if allowed < right.len() {
            return Err(LineDiffWorkBudgetExceeded);
        }
    }
    Ok(false)
}

fn find_line_match(line: &str, candidates: &[&str]) -> Option<usize> {
    for candidate in candidates {
        if line == *candidate {
            return Some(find_slice_element_position(candidates, candidate));
        }
    }
    None
}

fn find_slice_element_position(candidates: &[&str], target: &&str) -> usize {
    candidates
        .iter()
        .position(|candidate| std::ptr::eq(candidate, target))
        .expect("line diff slice element")
}

fn append_added_lines(right: &[&str], new_offset: usize, output: &mut Vec<GitDiffLine>) {
    for (index, text) in right.iter().enumerate() {
        output.push(GitDiffLine {
            kind: GitDiffLineKind::Added,
            old_line: None,
            new_line: Some(new_offset + index + 1),
            text: (*text).to_string(),
        });
    }
}

fn append_removed_lines(left: &[&str], old_offset: usize, output: &mut Vec<GitDiffLine>) {
    for (index, text) in left.iter().enumerate() {
        output.push(GitDiffLine {
            kind: GitDiffLineKind::Removed,
            old_line: Some(old_offset + index + 1),
            new_line: None,
            text: (*text).to_string(),
        });
    }
}

#[cfg(test)]
pub(super) fn line_diff_hunks_full_lcs_for_test(left: &str, right: &str) -> Vec<GitDiffHunk> {
    if left == right {
        return Vec::new();
    }
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let mut rows = vec![vec![0usize; right_lines.len() + 1]; left_lines.len() + 1];
    for left_index in (0..left_lines.len()).rev() {
        for right_index in (0..right_lines.len()).rev() {
            rows[left_index][right_index] = if left_lines[left_index] == right_lines[right_index] {
                rows[left_index + 1][right_index + 1] + 1
            } else {
                rows[left_index + 1][right_index].max(rows[left_index][right_index + 1])
            };
        }
    }

    let mut lines = Vec::with_capacity(left_lines.len() + right_lines.len());
    let mut left_index = 0usize;
    let mut right_index = 0usize;
    while left_index < left_lines.len() || right_index < right_lines.len() {
        if left_index < left_lines.len()
            && right_index < right_lines.len()
            && left_lines[left_index] == right_lines[right_index]
        {
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Context,
                old_line: Some(left_index + 1),
                new_line: Some(right_index + 1),
                text: left_lines[left_index].to_string(),
            });
            left_index += 1;
            right_index += 1;
        } else if right_index < right_lines.len()
            && (left_index == left_lines.len()
                || rows[left_index][right_index + 1] >= rows[left_index + 1][right_index])
        {
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Added,
                old_line: None,
                new_line: Some(right_index + 1),
                text: right_lines[right_index].to_string(),
            });
            right_index += 1;
        } else if left_index < left_lines.len() {
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Removed,
                old_line: Some(left_index + 1),
                new_line: None,
                text: left_lines[left_index].to_string(),
            });
            left_index += 1;
        }
    }
    finalize_line_diff_hunks(left_lines.len(), right_lines.len(), lines)
}

pub(super) fn split_lines(value: &str) -> Vec<&str> {
    if value.is_empty() {
        Vec::new()
    } else {
        value.lines().collect()
    }
}

pub(super) fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().any(|byte| *byte == 0)
}
