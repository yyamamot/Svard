use super::*;

pub(super) struct WorktreePreviewContext<'repo> {
    pub(super) repo: &'repo gix::Repository,
    pub(super) workdir: PathBuf,
    pub(super) head_tree: Option<gix::Tree<'repo>>,
    pub(super) head_resource_source: Option<GitDiffResourceSource>,
    pub(super) index: gix::worktree::Index,
}

impl<'repo> WorktreePreviewContext<'repo> {
    pub(super) fn prepare(repo: &'repo gix::Repository, workdir: PathBuf) -> Result<Self, String> {
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

pub(super) fn commit_resource_source(commit: &gix::Commit<'_>) -> GitDiffResourceSource {
    GitDiffResourceSource::Commit {
        revision: commit.id().to_string(),
    }
}

pub(super) fn head_blob_bytes_from_tree(
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

pub(super) fn index_blob_bytes_from_index(
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
