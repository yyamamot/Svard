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
mod tests_history;
#[cfg(test)]
mod tests_support;

pub use changes::{git_branch_diff_for_path, git_changes_for_path};
pub use history::{
    git_commit_details_for_path, git_commit_graph_for_path, git_file_history_for_path_with_cache,
};
pub use history_cache::GitFileHistoryCacheState;
pub use preview::{
    git_branch_file_diff_for_path, git_diff_preview_for_path, git_file_commit_diff_for_path,
    git_file_ref_diff_for_path, git_file_revision_diff_for_path,
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
