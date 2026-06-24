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
    pub include_graph: Option<AsciiDocIncludeGraph>,
    pub resource_context: DocumentResourceContext,
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
pub struct AsciiDocIncludeGraph {
    #[serde(default)]
    pub nodes: Vec<AsciiDocIncludeGraphNode>,
    #[serde(default)]
    pub edges: Vec<AsciiDocIncludeGraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocIncludeGraphNode {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub display_path: String,
    pub kind: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_location: Option<AsciiDocIncludeGraphSourceLocation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocIncludeGraphEdge {
    pub from_id: String,
    pub to_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_location: Option<AsciiDocIncludeGraphSourceLocation>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AsciiDocIncludeGraphSourceLocation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    pub line: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column: Option<usize>,
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
pub struct DocumentResourceContext {
    pub workspace_root: String,
    pub document_dir: String,
    #[serde(default)]
    pub resource_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalImageResolveContext {
    #[serde(default)]
    pub base_dir: Option<String>,
    pub workspace_root: String,
    pub document_dir: String,
    #[serde(default)]
    pub attributes: BTreeMap<String, String>,
    #[serde(default)]
    pub resource_roots: Vec<String>,
}

impl From<&AsciiDocRenderContext> for LocalImageResolveContext {
    fn from(value: &AsciiDocRenderContext) -> Self {
        Self {
            base_dir: Some(value.base_dir.clone()),
            workspace_root: value.workspace_root.clone(),
            document_dir: value.document_dir.clone(),
            attributes: value.attributes.clone(),
            resource_roots: value.resource_roots.clone(),
        }
    }
}

impl From<&DocumentResourceContext> for LocalImageResolveContext {
    fn from(value: &DocumentResourceContext) -> Self {
        Self {
            base_dir: None,
            workspace_root: value.workspace_root.clone(),
            document_dir: value.document_dir.clone(),
            attributes: BTreeMap::new(),
            resource_roots: value.resource_roots.clone(),
        }
    }
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
pub struct DocumentOrderResult {
    pub source: DocumentOrderSource,
    pub nodes: Vec<DocumentOrderNode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DocumentOrderSource {
    None,
    Mkdocs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum DocumentOrderNode {
    Section {
        title: String,
        depth: usize,
        children: Vec<DocumentOrderNode>,
    },
    Document {
        title: String,
        path: String,
        display_path: String,
        depth: usize,
        status: DocumentOrderDocumentStatus,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DocumentOrderDocumentStatus {
    Resolved,
    Missing,
    External,
    Unsupported,
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
