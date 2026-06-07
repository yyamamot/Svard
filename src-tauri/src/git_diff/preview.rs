use super::*;

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
            relative_path_display,
            status,
            "HEAD".to_string(),
            "Index".to_string(),
            left,
            right,
        );
    }

    match (head_bytes, worktree_bytes) {
        (Some(left), Some(right)) if left == right => Ok(empty_preview(
            GitDiffStatus::Clean,
            repository_root,
            Some(relative_path_display),
            Some("No working tree changes for this document.".to_string()),
        )),
        (Some(left), Some(right)) => build_text_preview(
            repository_root,
            relative_path_display,
            GitDiffStatus::Modified,
            left,
            right,
        ),
        (Some(left), None) => build_text_preview(
            repository_root,
            relative_path_display,
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
                relative_path_display,
                status,
                Vec::new(),
                right,
            )
        }
        (None, None) => Ok(empty_preview(
            GitDiffStatus::Error,
            repository_root,
            Some(relative_path_display),
            Some("Document is not present in HEAD or the working tree.".to_string()),
        )),
    }
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
            Some(context.relative_path_display),
            Some("No changes between this commit and the working tree.".to_string()),
        ),
        (Some(left), Some(right)) => build_text_preview_with_labels(
            Some(path_string(&context.workdir)),
            context.relative_path_display,
            status,
            short_hash.clone(),
            "Working Tree".to_string(),
            left,
            right,
        )?,
        (Some(left), None) => build_text_preview_with_labels(
            Some(path_string(&context.workdir)),
            context.relative_path_display,
            status,
            short_hash.clone(),
            "Working Tree".to_string(),
            left,
            Vec::new(),
        )?,
        (None, Some(right)) => build_text_preview_with_labels(
            Some(path_string(&context.workdir)),
            context.relative_path_display,
            status,
            short_hash.clone(),
            "Working Tree".to_string(),
            Vec::new(),
            right,
        )?,
        (None, None) => empty_preview(
            GitDiffStatus::Error,
            Some(path_string(&context.workdir)),
            Some(context.relative_path_display),
            Some(
                "Document is not present in the selected revision or the working tree.".to_string(),
            ),
        ),
    };
    preview.left_label = short_hash;
    preview.right_label = "Working Tree".to_string();
    Ok(preview)
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
    let (left_label, left) = match parent {
        Some(parent) => (
            short_id_for_commit(&parent)?,
            blob_bytes_at_commit(&parent, &context.relative_path)?,
        ),
        None => ("Previous".to_string(), None),
    };
    let right = blob_bytes_at_commit(&commit, &context.relative_path)?;
    build_revision_preview(
        Some(path_string(&context.workdir)),
        context.relative_path_display,
        left_label,
        right_label,
        left,
        right,
        "Document is not present in this commit or its previous revision.",
    )
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
        context.relative_path_display,
        left_label,
        right_label,
        left,
        right,
        "Document is not present in either selected revision.",
    )
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
        context.relative_path_display,
        left_label,
        "Working Tree".to_string(),
        left,
        right,
        "Document is not present in the selected Git ref or the working tree.",
    )
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
    }
}

pub(super) fn line_diff_hunks(left: &str, right: &str) -> Vec<GitDiffHunk> {
    if left == right {
        return Vec::new();
    }
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let mut rows = vec![vec![0usize; right_lines.len() + 1]; left_lines.len() + 1];
    for i in (0..left_lines.len()).rev() {
        for j in (0..right_lines.len()).rev() {
            rows[i][j] = if left_lines[i] == right_lines[j] {
                rows[i + 1][j + 1] + 1
            } else {
                rows[i + 1][j].max(rows[i][j + 1])
            };
        }
    }

    let mut lines = Vec::new();
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

    if lines
        .iter()
        .all(|line| line.kind == GitDiffLineKind::Context)
    {
        return Vec::new();
    }

    vec![GitDiffHunk {
        old_start: 1,
        old_lines: left_lines.len(),
        new_start: 1,
        new_lines: right_lines.len(),
        lines,
    }]
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
