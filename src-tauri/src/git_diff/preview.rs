use super::*;

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
    let relative_path_display = repo_relative_path(&relative_path);
    let repository_root = Some(path_string(&workdir));
    let head_resource_source = resolve_commit(&repo, "HEAD")
        .ok()
        .map(|commit| commit_resource_source(&commit));
    let head_bytes = head_blob_bytes(&repo, &relative_path)?;
    let index_bytes = index_blob_bytes(&repo, &relative_path_display)?;
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
                head_resource_source.clone(),
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
        head_resource_source
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
    Ok(GitDiffPreview {
        repository_root,
        relative_path: Some(relative_path),
        status,
        left_label,
        right_label,
        hunks: line_diff_hunks(&left_text, &right_text),
        message: None,
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

impl LineDiffCoreMetrics {
    fn record_work<const MEASURE: bool>(&mut self) {
        if MEASURE {
            self.work_units = self
                .work_units
                .checked_add(1)
                .expect("line diff work units");
        }
    }

    fn record_scratch<const MEASURE: bool>(&mut self, entries: usize) {
        if MEASURE {
            self.peak_scratch_entries = self
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

pub(super) fn line_diff_hunks(left: &str, right: &str) -> Vec<GitDiffHunk> {
    line_diff_hunks_linear::<false>(left, right).0
}

#[cfg(test)]
pub(super) fn line_diff_hunks_with_metrics_for_test(
    left: &str,
    right: &str,
) -> (Vec<GitDiffHunk>, LineDiffCoreMetrics) {
    line_diff_hunks_linear::<true>(left, right)
}

fn line_diff_hunks_linear<const MEASURE: bool>(
    left: &str,
    right: &str,
) -> (Vec<GitDiffHunk>, LineDiffCoreMetrics) {
    let mut metrics = LineDiffCoreMetrics::default();
    if left == right {
        return (Vec::new(), metrics);
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
    append_linear_diff::<MEASURE>(
        left_middle,
        right_middle,
        common_edges.prefix_lines,
        common_edges.prefix_lines,
        &mut lines,
        &mut metrics,
    );
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
        finalize_line_diff_hunks(left_lines.len(), right_lines.len(), lines),
        metrics,
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
    metrics: &mut LineDiffCoreMetrics,
) {
    if append_linear_diff_base_case::<MEASURE>(left, right, old_offset, new_offset, output, metrics)
    {
        return;
    }
    // With an empty LCS, the frozen full-matrix path follows right-on-tie successors:
    // every right line is Added before every left line is Removed. Detecting that exact
    // case avoids allocating workspace without changing the edit script.
    if !linear_diff_has_common_line::<MEASURE>(left, right, metrics) {
        append_added_lines(right, new_offset, output);
        append_removed_lines(left, old_offset, output);
        return;
    }

    let workspace_len = right.len() + 1;
    metrics.record_scratch::<MEASURE>(
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
        metrics,
    );
}

fn append_canonical_diff<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    scores: &mut [usize],
    crossings: &mut [usize],
    metrics: &mut LineDiffCoreMetrics,
) {
    if append_linear_diff_base_case::<MEASURE>(left, right, old_offset, new_offset, output, metrics)
    {
        return;
    }

    let left_split = left.len() / 2;
    let right_split =
        canonical_diff_crossing::<MEASURE>(left, right, left_split, scores, crossings, metrics);
    append_canonical_diff::<MEASURE>(
        &left[..left_split],
        &right[..right_split],
        old_offset,
        new_offset,
        output,
        scores,
        crossings,
        metrics,
    );
    append_canonical_diff::<MEASURE>(
        &left[left_split..],
        &right[right_split..],
        old_offset + left_split,
        new_offset + right_split,
        output,
        scores,
        crossings,
        metrics,
    );
}

fn canonical_diff_crossing<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    left_split: usize,
    scores: &mut [usize],
    crossings: &mut [usize],
    metrics: &mut LineDiffCoreMetrics,
) -> usize {
    // Propagate the column where the frozen full-LCS successor path crosses left_split.
    // The mismatch branch intentionally selects the right successor on equal scores so
    // the reconstructed edit script preserves the existing Added-first tie behavior.
    let right_len = right.len();
    let scores = &mut scores[..=right_len];
    let crossings = &mut crossings[..=right_len];
    scores.fill(0);

    for left_index in (left_split..left.len()).rev() {
        let mut diagonal_score = scores[right_len];
        for right_index in (0..right_len).rev() {
            let down_score = scores[right_index];
            metrics.record_work::<MEASURE>();
            scores[right_index] = if left[left_index] == right[right_index] {
                diagonal_score + 1
            } else {
                down_score.max(scores[right_index + 1])
            };
            diagonal_score = down_score;
        }
    }

    for (right_index, crossing) in crossings.iter_mut().enumerate() {
        *crossing = right_index;
    }
    for left_index in (0..left_split).rev() {
        let mut diagonal_score = scores[right_len];
        let mut diagonal_crossing = crossings[right_len];
        for right_index in (0..right_len).rev() {
            let down_score = scores[right_index];
            let down_crossing = crossings[right_index];
            let right_score = scores[right_index + 1];
            let right_crossing = crossings[right_index + 1];
            metrics.record_work::<MEASURE>();
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
    }
    crossings[0]
}

fn append_linear_diff_base_case<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    metrics: &mut LineDiffCoreMetrics,
) -> bool {
    if left.is_empty() {
        append_added_lines(right, new_offset, output);
        return true;
    }
    if right.is_empty() {
        append_removed_lines(left, old_offset, output);
        return true;
    }
    if left.len() == 1 {
        let match_index = right.iter().position(|right_line| {
            metrics.record_work::<MEASURE>();
            left[0] == *right_line
        });
        if let Some(match_index) = match_index {
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
        } else {
            append_added_lines(right, new_offset, output);
            append_removed_lines(left, old_offset, output);
        }
        return true;
    }
    if right.len() == 1 {
        let match_index = left.iter().position(|left_line| {
            metrics.record_work::<MEASURE>();
            *left_line == right[0]
        });
        if let Some(match_index) = match_index {
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
        } else {
            append_added_lines(right, new_offset, output);
            append_removed_lines(left, old_offset, output);
        }
        return true;
    }
    false
}

fn linear_diff_has_common_line<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    metrics: &mut LineDiffCoreMetrics,
) -> bool {
    for left_line in left {
        for right_line in right {
            metrics.record_work::<MEASURE>();
            if left_line == right_line {
                return true;
            }
        }
    }
    false
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
