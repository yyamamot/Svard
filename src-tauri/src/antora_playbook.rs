use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_norway::Value;

use crate::{
    backend_types::AllowedRoots,
    document_order_common::{
        is_external_or_absolute_target, mapping_get, normalize_document_order_target_path,
    },
    path_policy::ensure_path_allowed,
};

const ANTORA_PLAYBOOK_NAMES: [&str; 2] = ["antora-playbook.yml", "antora-playbook.yaml"];

pub(crate) fn discover_antora_playbook_content_roots(
    root: &Path,
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
    ANTORA_PLAYBOOK_NAMES
        .iter()
        .flat_map(|name| discover_content_roots_from_playbook(&root.join(name), root, roots))
        .collect()
}

fn discover_content_roots_from_playbook(
    playbook_path: &Path,
    workspace_root: &Path,
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
    if !playbook_path.is_file() {
        return Vec::new();
    }
    let source = match fs::read_to_string(playbook_path) {
        Ok(source) => source,
        Err(_) => return Vec::new(),
    };
    let parsed: Value = match serde_norway::from_str(&source) {
        Ok(parsed) => parsed,
        Err(_) => return Vec::new(),
    };
    let Some(mapping) = parsed.as_mapping() else {
        return Vec::new();
    };
    let Some(content) = mapping_get(mapping, "content").and_then(Value::as_mapping) else {
        return Vec::new();
    };
    let Some(sources) = mapping_get(content, "sources") else {
        return Vec::new();
    };

    if let Some(sequence) = sources.as_sequence() {
        return sequence
            .iter()
            .flat_map(|source| content_source_roots(source, workspace_root, roots))
            .collect();
    }
    content_source_roots(sources, workspace_root, roots)
}

fn content_source_roots(
    source: &Value,
    workspace_root: &Path,
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
    let Some(mapping) = source.as_mapping() else {
        return Vec::new();
    };
    let Some(url) = mapping_get(mapping, "url").and_then(Value::as_str) else {
        return Vec::new();
    };
    let start_paths = source_start_paths(
        mapping_get(mapping, "start_path"),
        mapping_get(mapping, "start_paths"),
    );
    let source_root = if is_remote_source_url(url) {
        if start_paths.is_empty() {
            return Vec::new();
        }
        normalize_document_order_target_path(workspace_root)
    } else {
        let Some(source_root) = local_source_root(workspace_root, url, roots) else {
            return Vec::new();
        };
        source_root
    };
    if start_paths.is_empty() {
        return antora_content_root(&source_root, roots)
            .into_iter()
            .collect();
    }
    start_paths
        .iter()
        .flat_map(|start_path| expand_start_path(&source_root, start_path, roots))
        .collect()
}

fn local_source_root(workspace_root: &Path, url: &str, roots: &AllowedRoots) -> Option<PathBuf> {
    if is_remote_source_url(url) || url.contains('\\') {
        return None;
    }
    let candidate = if Path::new(url).is_absolute() {
        PathBuf::from(url)
    } else {
        workspace_root.join(url)
    };
    let candidate = normalize_document_order_target_path(&candidate);
    if ensure_path_allowed(&candidate, roots).is_ok() && candidate.is_dir() {
        Some(candidate)
    } else {
        None
    }
}

fn is_remote_source_url(url: &str) -> bool {
    url.starts_with("git@")
        || url.starts_with("//")
        || url.contains("://")
        || (!Path::new(url).is_absolute() && is_external_or_absolute_target(url))
}

fn source_start_paths(start_path: Option<&Value>, start_paths: Option<&Value>) -> Vec<String> {
    let mut paths = Vec::new();
    if let Some(path) = start_path.and_then(Value::as_str) {
        paths.extend(start_path_entries(path));
    }
    if let Some(path) = start_paths.and_then(Value::as_str) {
        paths.extend(start_path_entries(path));
    } else if let Some(sequence) = start_paths.and_then(Value::as_sequence) {
        for item in sequence {
            if let Some(path) = item.as_str() {
                paths.extend(start_path_entries(path));
            }
        }
    }
    paths
}

fn start_path_entries(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .collect()
}

fn expand_start_path(source_root: &Path, pattern: &str, roots: &AllowedRoots) -> Vec<PathBuf> {
    if pattern.contains('\\') || Path::new(pattern).is_absolute() || pattern.starts_with("//") {
        return Vec::new();
    }
    let segments: Vec<&str> = pattern
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    if segments
        .iter()
        .any(|segment| *segment == "." || *segment == ".." || segment.contains("**"))
    {
        return Vec::new();
    }
    expand_start_path_segments(source_root, &segments, roots)
        .into_iter()
        .filter_map(|candidate| antora_content_root(&candidate, roots))
        .collect()
}

fn expand_start_path_segments(
    base: &Path,
    segments: &[&str],
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
    if segments.is_empty() {
        return vec![normalize_document_order_target_path(base)];
    }
    let (head, tail) = segments.split_first().expect("non-empty segments");
    if *head == "*" {
        let entries = match fs::read_dir(base) {
            Ok(entries) => entries,
            Err(_) => return Vec::new(),
        };
        let mut directories = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect::<Vec<_>>();
        directories.sort();
        directories
            .iter()
            .flat_map(|directory| expand_start_path_segments(directory, tail, roots))
            .collect()
    } else if head.contains('*') {
        Vec::new()
    } else {
        let next = normalize_document_order_target_path(&base.join(head));
        if ensure_path_allowed(&next, roots).is_ok() {
            expand_start_path_segments(&next, tail, roots)
        } else {
            Vec::new()
        }
    }
}

fn antora_content_root(candidate: &Path, roots: &AllowedRoots) -> Option<PathBuf> {
    let candidate = normalize_document_order_target_path(candidate);
    if ensure_path_allowed(&candidate, roots).is_ok()
        && candidate.is_dir()
        && candidate.join("antora.yml").is_file()
    {
        Some(candidate)
    } else {
        None
    }
}
