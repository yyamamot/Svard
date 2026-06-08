use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPayload {
    pub path: String,
    pub base_path: String,
    pub format: String,
    pub source: String,
    pub updated_at: String,
    #[serde(default)]
    pub include_files: Vec<AsciiDocIncludeFile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asciidoc_context: Option<AsciiDocRenderContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocIncludeFile {
    pub path: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocRenderContext {
    pub base_dir: String,
    pub workspace_root: String,
    pub document_dir: String,
    #[serde(default)]
    pub attributes: BTreeMap<String, String>,
    #[serde(default)]
    pub resource_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchInput {
    pub root_path: String,
    pub query: String,
    pub max_files: usize,
    pub max_matches: usize,
    pub max_bytes_per_file: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResultItem {
    pub path: String,
    pub display_path: String,
    pub line: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heading: Option<String>,
    pub snippet: String,
    pub match_count: usize,
    pub source_reference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResult {
    pub status: String,
    pub root_path: String,
    pub query: String,
    pub results: Vec<WorkspaceSearchResultItem>,
    pub total_matches: usize,
    pub searched_files: usize,
    pub skipped_files: usize,
    pub capped: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Directory,
}
