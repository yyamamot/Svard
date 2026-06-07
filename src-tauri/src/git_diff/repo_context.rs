use super::*;

pub(super) fn discover_start_for_path(path: &Path) -> Result<PathBuf, String> {
    if path.is_file() {
        let parent = path
            .parent()
            .ok_or_else(|| "document path has no parent directory".to_string())?;
        canonicalize_path(parent).map_err(|error| format!("failed to resolve parent path: {error}"))
    } else if path.exists() {
        canonicalize_path(path).map_err(|error| format!("failed to resolve path: {error}"))
    } else {
        let parent = path
            .parent()
            .ok_or_else(|| "document path has no parent directory".to_string())?;
        canonicalize_path(parent).map_err(|error| format!("failed to resolve parent path: {error}"))
    }
}

pub(super) enum GitPathContext {
    InRepo(ResolvedGitPath),
    NotInRepo,
}

pub(super) struct ResolvedGitPath {
    pub(super) repo: gix::Repository,
    pub(super) workdir: PathBuf,
    pub(super) absolute_path: PathBuf,
    pub(super) relative_path: PathBuf,
    pub(super) relative_path_display: String,
}

pub(super) fn git_context_for_path(path: &str) -> Result<GitPathContext, String> {
    let input_path = PathBuf::from(path);
    let discover_start = discover_start_for_path(&input_path)?;
    let repo = match gix::discover(&discover_start) {
        Ok(repo) => repo,
        Err(_) => return Ok(GitPathContext::NotInRepo),
    };
    let workdir = match repo_workdir(&repo) {
        Some(path) => path,
        None => return Ok(GitPathContext::NotInRepo),
    };
    let absolute_path = absolute_candidate_path(&input_path)?;
    let relative_path = match absolute_path.strip_prefix(&workdir) {
        Ok(path) => path.to_path_buf(),
        Err(_) => return Ok(GitPathContext::NotInRepo),
    };
    let relative_path_display = repo_relative_path(&relative_path);
    Ok(GitPathContext::InRepo(ResolvedGitPath {
        repo,
        workdir,
        absolute_path,
        relative_path,
        relative_path_display,
    }))
}

pub(super) fn absolute_candidate_path(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        canonicalize_path(path).map_err(|error| format!("failed to resolve path: {error}"))
    } else if let (Some(parent), Some(file_name)) = (path.parent(), path.file_name()) {
        canonicalize_path(parent)
            .map(|parent| parent.join(file_name))
            .map_err(|error| format!("failed to resolve parent path: {error}"))
    } else if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(path))
            .map_err(|error| format!("failed to resolve current directory: {error}"))
    }
}

pub(super) fn canonicalize_path(path: &Path) -> std::io::Result<PathBuf> {
    fs::canonicalize(path).map(normalize_verbatim_path)
}

pub(super) fn repo_workdir(repo: &gix::Repository) -> Option<PathBuf> {
    repo.workdir()
        .map(|path| normalize_verbatim_path(path.to_path_buf()))
}

pub(super) fn blob_bytes_at_commit(
    commit: &gix::Commit<'_>,
    relative_path: &Path,
) -> Result<Option<Vec<u8>>, String> {
    let tree = commit
        .tree()
        .map_err(|error| format!("failed to read commit tree: {error}"))?;
    let entry = tree
        .lookup_entry_by_path(relative_path)
        .map_err(|error| format!("failed to lookup commit path: {error}"))?;
    let Some(entry) = entry else {
        return Ok(None);
    };
    let object = entry
        .object()
        .map_err(|error| format!("failed to read commit object: {error}"))?;
    if object.kind != gix::object::Kind::Blob {
        return Ok(None);
    }
    let mut blob = object.into_blob();
    Ok(Some(blob.take_data()))
}

pub(super) fn resolve_commit<'repo>(
    repo: &'repo gix::Repository,
    revision: &str,
) -> Result<gix::Commit<'repo>, String> {
    let revision_id = repo
        .rev_parse_single(revision)
        .map_err(|error| format!("failed to resolve Git revision: {error}"))?;
    Ok(revision_id
        .object()
        .map_err(|error| format!("failed to read Git revision object: {error}"))?
        .into_commit())
}

pub(super) fn is_supported_document_relative_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    [".adoc", ".asciidoc", ".asc", ".md", ".markdown"]
        .iter()
        .any(|extension| lower.ends_with(extension))
}

pub(super) fn commit_summary(commit: &gix::Commit<'_>) -> Result<String, String> {
    commit
        .message()
        .map_err(|error| format!("failed to read commit message: {error}"))
        .map(|message| message.summary().to_string())
}

pub(super) fn short_id_for_commit(commit: &gix::Commit<'_>) -> Result<String, String> {
    commit
        .short_id()
        .map(|id| id.to_string())
        .map_err(|error| format!("failed to shorten commit id: {error}"))
}

pub(super) fn repo_relative_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

pub(super) fn current_branch_name(repo: &gix::Repository) -> Option<String> {
    repo.head_name()
        .ok()
        .flatten()
        .map(|name| name.shorten().to_string())
}

pub(super) fn head_commit_summary(repo: &gix::Repository) -> Result<Option<GitHeadCommit>, String> {
    let commit = match repo.head_commit() {
        Ok(commit) => commit,
        Err(_) => return Ok(None),
    };
    let revision = commit.id().to_string();
    let short_hash = short_id_for_commit(&commit)?;
    let summary = commit
        .message()
        .map_err(|error| format!("failed to read HEAD commit message: {error}"))?
        .summary()
        .to_string();
    Ok(Some(GitHeadCommit {
        revision,
        short_hash,
        summary,
    }))
}

pub(super) fn path_string(path: &Path) -> String {
    normalize_verbatim_path(path.to_path_buf())
        .to_string_lossy()
        .into_owned()
}

pub(super) fn normalize_verbatim_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};

        let mut components = path.components();
        if let Some(Component::Prefix(prefix)) = components.next() {
            match prefix.kind() {
                Prefix::VerbatimDisk(disk) => {
                    let mut normalized = PathBuf::from(format!("{}:\\", disk as char));
                    normalized.extend(components);
                    return normalized;
                }
                Prefix::VerbatimUNC(server, share) => {
                    let mut normalized = PathBuf::from(format!(
                        "\\\\{}\\{}",
                        server.to_string_lossy(),
                        share.to_string_lossy()
                    ));
                    normalized.extend(components);
                    return normalized;
                }
                _ => {}
            }
        }
    }
    path
}
