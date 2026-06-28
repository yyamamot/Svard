use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

use serde_norway::{Mapping, Value};

use crate::{
    backend_types::{
        AllowedRoots, DocumentOrderDocumentStatus, DocumentOrderNode, DocumentOrderResult,
        DocumentOrderSource,
    },
    path_policy::{display_safe_path, ensure_path_allowed, path_for_policy, path_to_ui_string},
};

const DOCUMENT_ORDER_FALLBACK_EXCLUDED_DIRS: &[&str] = &[
    ".artifacts",
    ".cache",
    ".codegraph",
    ".git",
    ".serena",
    "dist",
    "node_modules",
    "playwright-report",
    "site",
    "target",
    "test-results",
];

pub(crate) fn none_result(message: Option<String>) -> DocumentOrderResult {
    DocumentOrderResult {
        source: DocumentOrderSource::None,
        nodes: Vec::new(),
        message,
    }
}

pub(crate) fn mapping_get<'a>(mapping: &'a Mapping, key: &str) -> Option<&'a Value> {
    mapping.get(&Value::String(key.to_string()))
}

pub(crate) fn normalize_document_order_target_path(path: &Path) -> PathBuf {
    path.canonicalize()
        .map(|canonical| path_for_policy(&canonical))
        .unwrap_or_else(|_| {
            path.parent()
                .and_then(|parent| parent.canonicalize().ok())
                .map(|parent| path_for_policy(&parent).join(path.file_name().unwrap_or_default()))
                .unwrap_or_else(|| path_for_policy(path))
        })
}

pub(crate) fn is_external_or_absolute_target(target: &str) -> bool {
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("//")
        || target.starts_with('/')
        || Path::new(target).is_absolute()
        || target.contains('\\')
        || looks_like_windows_drive_path(target)
        || target.contains("://")
}

fn looks_like_windows_drive_path(target: &str) -> bool {
    let bytes = target.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

pub(crate) fn display_title_from_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| display_safe_path(Path::new(path)))
}

pub(crate) fn fallback_docs_dir_nodes(
    docs_dir: &Path,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut entries = Vec::new();
    let mut visited_directories = BTreeSet::from([path_to_ui_string(docs_dir)]);
    collect_fallback_markdown_entries(
        docs_dir,
        docs_dir,
        roots,
        &mut visited_directories,
        &mut entries,
    );
    entries.sort_by(|left, right| {
        fallback_order_key(&left.display_path).cmp(&fallback_order_key(&right.display_path))
    });

    let mut groups = Vec::new();
    let mut sections: BTreeMap<String, Vec<FallbackMarkdownEntry>> = BTreeMap::new();
    for entry in entries {
        let Some((top_level, _)) = entry.display_path.split_once('/') else {
            groups.push(FallbackNodeGroup::Document(entry));
            continue;
        };
        let section_key = top_level.to_string();
        if !sections.contains_key(&section_key) {
            groups.push(FallbackNodeGroup::Section(section_key.clone()));
        }
        sections.entry(section_key).or_default().push(entry);
    }
    groups
        .into_iter()
        .map(|group| match group {
            FallbackNodeGroup::Document(entry) => fallback_document_node(entry, 0),
            FallbackNodeGroup::Section(section) => DocumentOrderNode::Section {
                title: display_title_from_path(&section),
                depth: 0,
                children: sections
                    .remove(&section)
                    .unwrap_or_default()
                    .into_iter()
                    .map(|entry| fallback_document_node(entry, 1))
                    .collect(),
            },
        })
        .collect()
}

fn collect_fallback_markdown_entries(
    directory: &Path,
    docs_dir: &Path,
    roots: &AllowedRoots,
    visited_directories: &mut BTreeSet<String>,
    entries: &mut Vec<FallbackMarkdownEntry>,
) {
    let read_dir = match fs::read_dir(directory) {
        Ok(read_dir) => read_dir,
        Err(_) => return,
    };
    for entry in read_dir.flatten() {
        let path = normalize_document_order_target_path(&entry.path());
        if ensure_path_allowed(&path, roots).is_err() {
            continue;
        }
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_dir() {
            if is_fallback_excluded_dir(&path) {
                continue;
            }
            let key = path_to_ui_string(&path);
            if !visited_directories.insert(key) {
                continue;
            }
            collect_fallback_markdown_entries(&path, docs_dir, roots, visited_directories, entries);
            continue;
        }
        if !metadata.is_file() || !path.extension().is_some_and(|extension| extension == "md") {
            continue;
        }
        let Some(display_path) = path.strip_prefix(docs_dir).ok().map(relative_slash_path) else {
            continue;
        };
        entries.push(FallbackMarkdownEntry { display_path, path });
    }
}

fn relative_slash_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn is_fallback_excluded_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            name.starts_with('.')
                || DOCUMENT_ORDER_FALLBACK_EXCLUDED_DIRS
                    .iter()
                    .any(|excluded| *excluded == name)
        })
        .unwrap_or(false)
}

fn fallback_order_key(display_path: &str) -> (usize, String) {
    match display_path {
        "index.md" => (0, display_path.to_string()),
        "00_overview.md" => (1, display_path.to_string()),
        _ => (2, display_path.to_string()),
    }
}

fn fallback_document_node(entry: FallbackMarkdownEntry, depth: usize) -> DocumentOrderNode {
    DocumentOrderNode::Document {
        title: display_title_from_path(&entry.display_path),
        path: path_to_ui_string(&entry.path),
        display_path: entry.display_path,
        depth,
        status: DocumentOrderDocumentStatus::Resolved,
    }
}

struct FallbackMarkdownEntry {
    display_path: String,
    path: PathBuf,
}

enum FallbackNodeGroup {
    Document(FallbackMarkdownEntry),
    Section(String),
}
