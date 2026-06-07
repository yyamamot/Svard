use super::*;

pub fn git_changes_for_path(path: &str) -> Result<GitChanges, String> {
    let context = match git_repository_context_for_path(path)? {
        Some(context) => context,
        None => {
            return Ok(empty_changes(
                GitChangesStatus::NotInRepo,
                None,
                None,
                Some("Path is not inside a Git repository.".to_string()),
            ));
        }
    };
    let items = git_status_items(&context.repo)?;

    Ok(GitChanges {
        status: GitChangesStatus::Ok,
        repository_root: Some(path_string(&context.workdir)),
        current_branch: current_branch_name(&context.repo),
        head_commit: head_commit_summary(&context.repo)?,
        items,
        message: None,
    })
}

struct GitRepositoryContext {
    repo: gix::Repository,
    workdir: PathBuf,
}

fn git_repository_context_for_path(path: &str) -> Result<Option<GitRepositoryContext>, String> {
    let input_path = PathBuf::from(path);
    let discover_start = discover_start_for_path(&input_path)?;
    let repo = match gix::discover(&discover_start) {
        Ok(repo) => repo,
        Err(_) => return Ok(None),
    };
    let Some(workdir) = repo_workdir(&repo) else {
        return Ok(None);
    };
    Ok(Some(GitRepositoryContext { repo, workdir }))
}

pub fn git_branch_diff_for_path(
    path: &str,
    base_ref: Option<&str>,
    head_ref: Option<&str>,
    providers: Option<&crate::backend_types::RemoteProvidersConfig>,
    network: Option<&crate::backend_types::NetworkConfig>,
) -> Result<GitBranchDiff, String> {
    let input_path = PathBuf::from(path);
    let discover_start = discover_start_for_path(&input_path)?;
    let repo = match gix::discover(&discover_start) {
        Ok(repo) => repo,
        Err(_) => {
            return Ok(empty_branch_diff(
                GitBranchDiffStatus::NotInRepo,
                None,
                None,
                Vec::new(),
                Vec::new(),
                Some("Path is not inside a Git repository.".to_string()),
            ));
        }
    };
    let workdir = match repo_workdir(&repo) {
        Some(path) => path,
        None => {
            return Ok(empty_branch_diff(
                GitBranchDiffStatus::NotInRepo,
                None,
                None,
                Vec::new(),
                Vec::new(),
                Some("Bare repositories are not supported.".to_string()),
            ));
        }
    };
    if repo.head_commit().is_err() {
        return Ok(empty_branch_diff(
            GitBranchDiffStatus::NoHistory,
            Some(path_string(&workdir)),
            current_branch_name(&repo),
            branch_ref_names(&repo)?,
            Vec::new(),
            Some("No commits are available for this repository.".to_string()),
        ));
    }

    let candidates = branch_ref_names(&repo)?;
    let provider_candidates = crate::remote_providers::detect_provider_base_candidates(
        &workdir,
        current_branch_name(&repo).as_deref(),
        &candidates,
        providers,
        network,
    );
    let selected_base = match base_ref.map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) if candidates.iter().any(|candidate| candidate == value) => value.to_string(),
        _ => match default_branch_diff_base(&candidates, &provider_candidates) {
            Some(value) => value,
            None => {
                return Ok(empty_branch_diff(
                    GitBranchDiffStatus::Error,
                    Some(path_string(&workdir)),
                    current_branch_name(&repo),
                    candidates,
                    provider_candidates,
                    Some("Select a base branch to view Branch Diff.".to_string()),
                ));
            }
        },
    };
    let selected_head = head_ref
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("HEAD")
        .to_string();
    let base_commit = resolve_commit(&repo, &selected_base)?;
    let head_commit = resolve_commit(&repo, &selected_head)?;
    let merge_base_id = repo
        .merge_base(base_commit.id, head_commit.id)
        .map_err(|error| format!("failed to find Git merge base: {error}"))?;
    let merge_base = merge_base_id.to_string();
    let merge_base_commit = repo
        .find_commit(merge_base_id)
        .map_err(|error| format!("failed to read Git merge base commit: {error}"))?;
    let items = git_branch_diff_items(&workdir, &merge_base_commit, &head_commit)?;

    Ok(GitBranchDiff {
        status: GitBranchDiffStatus::Ok,
        repository_root: Some(path_string(&workdir)),
        current_branch: current_branch_name(&repo),
        head_commit: head_commit_summary(&repo)?,
        base_ref: Some(selected_base),
        head_ref: Some(selected_head),
        merge_base: Some(merge_base),
        base_candidates: candidates,
        provider_base_candidates: provider_candidates,
        items,
        message: None,
    })
}

fn branch_ref_names(repo: &gix::Repository) -> Result<Vec<String>, String> {
    Ok(branch_ref_items(repo)?
        .into_iter()
        .map(|item| item.name)
        .collect())
}

fn default_branch_diff_base(
    candidates: &[String],
    provider_candidates: &[GitBranchDiffProviderBaseCandidate],
) -> Option<String> {
    if let Some(candidate) = provider_candidates
        .iter()
        .find(|candidate| candidate.available)
    {
        return Some(candidate.base_ref.clone());
    }
    ["origin/main", "origin/master"]
        .iter()
        .find(|candidate| candidates.iter().any(|item| item == **candidate))
        .map(|candidate| (*candidate).to_string())
}

fn git_branch_diff_items(
    workdir: &Path,
    base_commit: &gix::Commit<'_>,
    head_commit: &gix::Commit<'_>,
) -> Result<Vec<GitBranchDiffEntry>, String> {
    let base_tree = base_commit
        .tree()
        .map_err(|error| format!("failed to read Git merge base tree: {error}"))?;
    let head_tree = head_commit
        .tree()
        .map_err(|error| format!("failed to read Git head tree: {error}"))?;
    let mut items = Vec::new();
    base_tree
        .changes()
        .map_err(|error| format!("failed to prepare Git tree diff: {error}"))?
        .options(|options| {
            options.track_path();
            options.track_rewrites(Some(gix::diff::Rewrites::default()));
        })
        .for_each_to_obtain_tree(&head_tree, |change| {
            match change {
                gix::object::tree::diff::Change::Addition { location, .. } => {
                    items.push(branch_diff_entry(
                        workdir,
                        location.to_string(),
                        None,
                        GitDiffStatus::Added,
                    ));
                }
                gix::object::tree::diff::Change::Deletion { location, .. } => {
                    items.push(branch_diff_entry(
                        workdir,
                        location.to_string(),
                        None,
                        GitDiffStatus::Deleted,
                    ));
                }
                gix::object::tree::diff::Change::Modification { location, .. } => {
                    items.push(branch_diff_entry(
                        workdir,
                        location.to_string(),
                        None,
                        GitDiffStatus::Modified,
                    ));
                }
                gix::object::tree::diff::Change::Rewrite {
                    source_location,
                    location,
                    copy,
                    ..
                } => {
                    items.push(branch_diff_entry(
                        workdir,
                        location.to_string(),
                        if copy {
                            None
                        } else {
                            Some(source_location.to_string())
                        },
                        if copy {
                            GitDiffStatus::Added
                        } else {
                            GitDiffStatus::Renamed
                        },
                    ));
                }
            }
            Ok::<_, std::convert::Infallible>(std::ops::ControlFlow::Continue(()))
        })
        .map_err(|error| format!("failed to read Git tree diff: {error}"))?;
    items.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(items)
}

fn branch_diff_entry(
    workdir: &Path,
    path: String,
    old_path: Option<String>,
    status: GitDiffStatus,
) -> GitBranchDiffEntry {
    let preview_path = if status == GitDiffStatus::Deleted {
        old_path.as_deref().unwrap_or(&path)
    } else {
        &path
    };
    let document_path = if is_supported_document_relative_path(preview_path) {
        Some(path_string(&workdir.join(preview_path)))
    } else {
        None
    };
    GitBranchDiffEntry {
        path,
        old_path,
        status,
        document_path,
    }
}

fn empty_changes(
    status: GitChangesStatus,
    repository_root: Option<String>,
    current_branch: Option<String>,
    message: Option<String>,
) -> GitChanges {
    GitChanges {
        status,
        repository_root,
        current_branch,
        head_commit: None,
        items: Vec::new(),
        message,
    }
}

fn empty_branch_diff(
    status: GitBranchDiffStatus,
    repository_root: Option<String>,
    current_branch: Option<String>,
    base_candidates: Vec<String>,
    provider_base_candidates: Vec<GitBranchDiffProviderBaseCandidate>,
    message: Option<String>,
) -> GitBranchDiff {
    GitBranchDiff {
        status,
        repository_root,
        current_branch,
        head_commit: None,
        base_ref: None,
        head_ref: Some("HEAD".to_string()),
        merge_base: None,
        base_candidates,
        provider_base_candidates,
        items: Vec::new(),
        message,
    }
}
