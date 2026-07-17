use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use gix::bstr::ByteSlice;

mod changes;
mod history;
mod history_cache;
mod preview;
mod refs;
mod repo_context;
mod status;
mod types;

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_git_diff_preview_batch;
#[cfg(test)]
mod tests_git_diff_preview_release_probe;
#[cfg(test)]
mod tests_history;
#[cfg(test)]
mod tests_line_diff_budget;
#[cfg(test)]
mod tests_line_diff_oracle;
#[cfg(test)]
mod tests_line_diff_probe;
#[cfg(test)]
mod tests_support;

pub use changes::{git_branch_diff_for_path, git_changes_for_path};
pub use history::{
    git_commit_details_for_path, git_commit_graph_for_path, git_file_history_for_path_with_cache,
};
pub use history_cache::GitFileHistoryCacheState;
pub use preview::{
    git_branch_file_diff_for_path, git_diff_preview_for_path, git_diff_previews_for_paths,
    git_file_commit_diff_for_path, git_file_ref_diff_for_path, git_file_revision_diff_for_path,
    git_file_revision_pair_diff_for_path,
};
pub use refs::git_refs_for_path;
pub use status::git_status_summary_for_paths;
pub use types::*;

use history::*;
use preview::*;
use refs::*;
use repo_context::*;
use status::*;

const MAX_TEXT_DIFF_BYTES: usize = 1_048_576;
const MAX_HISTORY_ITEMS: usize = 50;

pub(crate) fn git_resource_bytes(
    repository_root: &Path,
    relative_path: &Path,
    source: &GitDiffResourceSource,
) -> Result<Option<Vec<u8>>, String> {
    let repo = gix::discover(repository_root)
        .map_err(|_| "Git diff resource repository is not available.".to_string())?;
    let workdir = repo_workdir(&repo)
        .ok_or_else(|| "Git diff resource repository is not available.".to_string())?;
    let canonical_root = canonicalize_path(repository_root)
        .map_err(|_| "Git diff resource repository is not available.".to_string())?;
    if canonicalize_path(&workdir).ok().as_ref() != Some(&canonical_root) {
        return Err("Git diff resource repository does not match the worktree.".to_string());
    }
    let relative_display = repo_relative_path(relative_path);
    match source {
        GitDiffResourceSource::Worktree => match fs::read(workdir.join(relative_path)) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err("Git diff worktree resource is not available.".to_string()),
        },
        GitDiffResourceSource::Index => index_blob_bytes(&repo, &relative_display),
        GitDiffResourceSource::Commit { revision } => {
            let commit = resolve_commit(&repo, revision)?;
            blob_bytes_at_commit(&commit, relative_path)
        }
    }
}
