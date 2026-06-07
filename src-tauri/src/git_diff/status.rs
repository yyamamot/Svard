use super::*;

pub fn git_status_summary_for_paths(paths: Vec<String>) -> Result<Vec<GitStatusEntry>, String> {
    let mut entries = Vec::new();
    let mut repo_statuses = Vec::<RepoStatusSummary>::new();
    for path in paths {
        let input_path = PathBuf::from(&path);
        let absolute_path = match absolute_candidate_path(&input_path) {
            Ok(path) => path,
            Err(_) => {
                entries.push(GitStatusEntry {
                    path,
                    status: GitDiffStatus::NotInRepo,
                });
                continue;
            }
        };
        let repo_index = match repo_statuses
            .iter()
            .position(|summary| absolute_path.starts_with(&summary.workdir))
        {
            Some(index) => index,
            None => {
                let discover_start = discover_start_for_path(&input_path)?;
                let repo = match gix::discover(&discover_start) {
                    Ok(repo) => repo,
                    Err(_) => {
                        entries.push(GitStatusEntry {
                            path,
                            status: GitDiffStatus::NotInRepo,
                        });
                        continue;
                    }
                };
                let Some(workdir) = repo_workdir(&repo) else {
                    entries.push(GitStatusEntry {
                        path,
                        status: GitDiffStatus::NotInRepo,
                    });
                    continue;
                };
                let status_items = git_status_items(&repo)?;
                let statuses = status_items
                    .into_iter()
                    .map(|item| (item.path, item.status))
                    .collect();
                repo_statuses.push(RepoStatusSummary { workdir, statuses });
                repo_statuses.len() - 1
            }
        };
        let summary = &repo_statuses[repo_index];
        let status = match absolute_path.strip_prefix(&summary.workdir) {
            Ok(relative_path) => {
                let relative_path = repo_relative_path(relative_path);
                let status = summary
                    .statuses
                    .get(&relative_path)
                    .cloned()
                    .unwrap_or(GitDiffStatus::Clean);
                if status == GitDiffStatus::Renamed {
                    GitDiffStatus::Added
                } else {
                    status
                }
            }
            Err(_) => GitDiffStatus::NotInRepo,
        };
        entries.push(GitStatusEntry { path, status });
    }
    Ok(entries)
}

struct RepoStatusSummary {
    workdir: PathBuf,
    statuses: BTreeMap<String, GitDiffStatus>,
}

pub(super) fn head_blob_bytes(
    repo: &gix::Repository,
    relative_path: &Path,
) -> Result<Option<Vec<u8>>, String> {
    let commit = match repo.head_commit() {
        Ok(commit) => commit,
        Err(_) => return Ok(None),
    };
    let tree = commit
        .tree()
        .map_err(|error| format!("failed to read HEAD tree: {error}"))?;
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

pub(super) fn index_blob_bytes(
    repo: &gix::Repository,
    relative_path: &str,
) -> Result<Option<Vec<u8>>, String> {
    let index = repo
        .index_or_empty()
        .map_err(|error| format!("failed to read Git index: {error}"))?;
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

pub(super) fn git_status_for_resolved_path(
    repo: &gix::Repository,
    absolute_path: &Path,
    relative_path: &Path,
    relative_path_display: &str,
) -> Result<GitDiffStatus, String> {
    let head_bytes = head_blob_bytes(repo, relative_path)?;
    let index_bytes = index_blob_bytes(repo, relative_path_display)?;
    let worktree_bytes = match fs::read(absolute_path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("failed to read worktree file: {error}")),
    };
    Ok(status_from_git_bytes(
        head_bytes,
        index_bytes,
        worktree_bytes,
    ))
}

pub(super) fn status_from_git_bytes(
    head_bytes: Option<Vec<u8>>,
    index_bytes: Option<Vec<u8>>,
    worktree_bytes: Option<Vec<u8>>,
) -> GitDiffStatus {
    if let Some(status) = staged_status_from_bytes(head_bytes.as_deref(), index_bytes.as_deref()) {
        return status;
    }

    match (head_bytes, worktree_bytes) {
        (Some(left), Some(right)) if text_bytes_equal_for_status(&left, &right) => {
            GitDiffStatus::Clean
        }
        (Some(left), Some(right)) if looks_binary(&left) || looks_binary(&right) => {
            GitDiffStatus::Binary
        }
        (Some(_), Some(_)) => GitDiffStatus::Modified,
        (Some(_), None) => GitDiffStatus::Deleted,
        (None, Some(right)) if looks_binary(&right) => GitDiffStatus::Binary,
        (None, Some(_)) => GitDiffStatus::Untracked,
        (None, None) => GitDiffStatus::Error,
    }
}

pub(super) fn staged_status_from_bytes(
    head: Option<&[u8]>,
    index: Option<&[u8]>,
) -> Option<GitDiffStatus> {
    match (head, index) {
        (Some(left), Some(right)) if text_bytes_equal_for_status(left, right) => None,
        (Some(left), Some(right)) if looks_binary(left) || looks_binary(right) => {
            Some(GitDiffStatus::Binary)
        }
        (Some(_), Some(_)) => Some(GitDiffStatus::Modified),
        (Some(_), None) => Some(GitDiffStatus::Deleted),
        (None, Some(right)) if looks_binary(right) => Some(GitDiffStatus::Binary),
        (None, Some(_)) => Some(GitDiffStatus::Added),
        (None, None) => None,
    }
}

fn text_bytes_equal_for_status(left: &[u8], right: &[u8]) -> bool {
    left == right || utf8_text_equal_ignoring_line_endings(left, right)
}

fn utf8_text_equal_ignoring_line_endings(left: &[u8], right: &[u8]) -> bool {
    let Ok(left) = std::str::from_utf8(left) else {
        return false;
    };
    let Ok(right) = std::str::from_utf8(right) else {
        return false;
    };
    normalize_line_endings(left) == normalize_line_endings(right)
}

fn normalize_line_endings(value: &str) -> String {
    value.replace("\r\n", "\n").replace('\r', "\n")
}

pub(super) fn git_status_items(repo: &gix::Repository) -> Result<Vec<GitChangeEntry>, String> {
    let workdir =
        repo_workdir(repo).ok_or_else(|| "Bare repositories are not supported.".to_string())?;
    let mut items = BTreeMap::<String, GitDiffStatus>::new();
    let iter = repo
        .status(gix::progress::Discard)
        .map_err(|error| format!("failed to prepare Git status: {error}"))?
        .untracked_files(gix::status::UntrackedFiles::Files)
        .tree_index_track_renames(gix::status::tree_index::TrackRenames::AsConfigured)
        .index_worktree_rewrites(None)
        .into_iter(Vec::new())
        .map_err(|error| format!("failed to read Git status: {error}"))?;

    for item in iter {
        let item = item.map_err(|error| format!("failed to read Git status item: {error}"))?;
        match item {
            gix::status::Item::IndexWorktree(entry) => {
                let Some(summary) = entry.summary() else {
                    continue;
                };
                let path = entry.rela_path().to_string();
                let status = status_from_index_worktree_summary(summary);
                if status == GitDiffStatus::Clean {
                    continue;
                }
                if status == GitDiffStatus::Modified
                    && git_status_for_resolved_path(
                        repo,
                        &workdir.join(&path),
                        &PathBuf::from(&path),
                        &path,
                    )? == GitDiffStatus::Clean
                {
                    continue;
                }
                merge_status(&mut items, path, status);
            }
            gix::status::Item::TreeIndex(change) => {
                let (path, status) = match change {
                    gix::diff::index::Change::Addition { location, .. } => {
                        (location.to_string(), GitDiffStatus::Added)
                    }
                    gix::diff::index::Change::Deletion { location, .. } => {
                        (location.to_string(), GitDiffStatus::Deleted)
                    }
                    gix::diff::index::Change::Modification { location, .. } => {
                        (location.to_string(), GitDiffStatus::Modified)
                    }
                    gix::diff::index::Change::Rewrite {
                        source_location,
                        location,
                        copy,
                        ..
                    } => {
                        if !copy {
                            merge_status(
                                &mut items,
                                source_location.to_string(),
                                GitDiffStatus::Deleted,
                            );
                        }
                        (
                            location.to_string(),
                            if copy {
                                GitDiffStatus::Added
                            } else {
                                GitDiffStatus::Renamed
                            },
                        )
                    }
                };
                if status == GitDiffStatus::Clean {
                    continue;
                }
                if status == GitDiffStatus::Modified {
                    let head_bytes = head_blob_bytes(repo, &PathBuf::from(&path))?;
                    let index_bytes = index_blob_bytes(repo, &path)?;
                    if staged_status_from_bytes(head_bytes.as_deref(), index_bytes.as_deref())
                        .is_none()
                    {
                        continue;
                    }
                }
                merge_status(&mut items, path, status);
            }
        }
    }

    Ok(items
        .into_iter()
        .map(|(path, status)| {
            let document_path = if is_supported_document_relative_path(&path) {
                Some(path_string(&workdir.join(&path)))
            } else {
                None
            };
            GitChangeEntry {
                path,
                status,
                document_path,
            }
        })
        .collect())
}

fn merge_status(items: &mut BTreeMap<String, GitDiffStatus>, path: String, status: GitDiffStatus) {
    items
        .entry(path)
        .and_modify(|existing| *existing = combined_status(existing.clone(), status.clone()))
        .or_insert(status);
}

fn combined_status(left: GitDiffStatus, right: GitDiffStatus) -> GitDiffStatus {
    use GitDiffStatus::*;
    match (left, right) {
        (Renamed, _) | (_, Renamed) => Renamed,
        (Binary, _) | (_, Binary) => Binary,
        (Added, _) | (_, Added) => Added,
        (Deleted, _) | (_, Deleted) => Deleted,
        (Modified, _) | (_, Modified) => Modified,
        (Untracked, _) | (_, Untracked) => Untracked,
        _ => Clean,
    }
}

fn status_from_index_worktree_summary(
    summary: gix::status::index_worktree::iter::Summary,
) -> GitDiffStatus {
    use gix::status::index_worktree::iter::Summary;
    match summary {
        Summary::Added => GitDiffStatus::Untracked,
        Summary::Removed => GitDiffStatus::Deleted,
        Summary::Modified | Summary::TypeChange | Summary::Conflict => GitDiffStatus::Modified,
        Summary::Renamed => GitDiffStatus::Renamed,
        Summary::Copied => GitDiffStatus::Added,
        Summary::IntentToAdd => GitDiffStatus::Added,
    }
}
