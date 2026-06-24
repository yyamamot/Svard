use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_norway::{Mapping, Value};

use crate::{
    backend_types::{
        AllowedRoots, DocumentOrderDocumentStatus, DocumentOrderNode, DocumentOrderResult,
        DocumentOrderSource,
    },
    path_policy::{
        display_safe_path, ensure_path_allowed, path_for_policy, path_to_ui_string,
        resolve_existing_directory_path,
    },
};

const MKDOCS_CONFIG_NAMES: [&str; 2] = ["mkdocs.yml", "mkdocs.yaml"];

pub(crate) fn load_document_order_from_root(
    root_directory: &str,
    roots: &AllowedRoots,
) -> Result<DocumentOrderResult, String> {
    let root = resolve_existing_directory_path(Path::new(root_directory))?;
    ensure_path_allowed(&root, roots)?;
    Ok(load_mkdocs_order_from_root(&root, roots))
}

pub(crate) fn load_mkdocs_order_from_root(
    root: &Path,
    roots: &AllowedRoots,
) -> DocumentOrderResult {
    let Some(config_path) = find_mkdocs_config(root) else {
        return none_result(None);
    };
    let source = match fs::read_to_string(&config_path) {
        Ok(source) => source,
        Err(_) => {
            return none_result(Some("MkDocs configuration could not be read.".to_string()));
        }
    };
    let parsed: Value = match serde_norway::from_str(&source) {
        Ok(parsed) => parsed,
        Err(_) => {
            return none_result(Some(
                "MkDocs configuration could not be parsed.".to_string(),
            ));
        }
    };
    let Some(mapping) = parsed.as_mapping() else {
        return none_result(Some("MkDocs configuration is not a mapping.".to_string()));
    };
    let config_dir = config_path.parent().unwrap_or(root);
    let docs_dir = docs_dir_for_config(config_dir, mapping);
    if ensure_path_allowed(&docs_dir, roots).is_err() {
        return none_result(Some(
            "MkDocs documentation directory is outside the workspace.".to_string(),
        ));
    }
    let Some(nav) = mapping_get(mapping, "nav") else {
        return none_result(Some("MkDocs nav is not configured.".to_string()));
    };
    let Some(sequence) = nav.as_sequence() else {
        return none_result(Some("MkDocs nav is not a list.".to_string()));
    };

    let nodes = parse_nav_sequence(sequence, &docs_dir, 0, roots);
    if nodes.is_empty() {
        return none_result(Some(
            "MkDocs nav did not contain local document entries.".to_string(),
        ));
    }

    DocumentOrderResult {
        source: DocumentOrderSource::Mkdocs,
        nodes,
        message: None,
    }
}

fn none_result(message: Option<String>) -> DocumentOrderResult {
    DocumentOrderResult {
        source: DocumentOrderSource::None,
        nodes: Vec::new(),
        message,
    }
}

fn find_mkdocs_config(root: &Path) -> Option<PathBuf> {
    MKDOCS_CONFIG_NAMES
        .iter()
        .map(|name| root.join(name))
        .find(|path| path.is_file())
}

fn docs_dir_for_config(config_dir: &Path, mapping: &Mapping) -> PathBuf {
    mapping_get(mapping, "docs_dir")
        .and_then(Value::as_str)
        .map(|value| config_dir.join(value))
        .unwrap_or_else(|| config_dir.join("docs"))
}

fn mapping_get<'a>(mapping: &'a Mapping, key: &str) -> Option<&'a Value> {
    mapping.get(&Value::String(key.to_string()))
}

fn parse_nav_sequence(
    sequence: &[Value],
    docs_dir: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut nodes = Vec::new();
    for item in sequence {
        if let Some(path) = item.as_str() {
            nodes.push(nav_document(
                display_title_from_path(path),
                path,
                docs_dir,
                depth,
                roots,
            ));
            continue;
        }
        let Some(mapping) = item.as_mapping() else {
            continue;
        };
        for (key, value) in mapping {
            let Some(title) = key.as_str() else {
                continue;
            };
            if let Some(path) = value.as_str() {
                nodes.push(nav_document(
                    title.to_string(),
                    path,
                    docs_dir,
                    depth,
                    roots,
                ));
            } else if let Some(children) = value.as_sequence() {
                nodes.push(DocumentOrderNode::Section {
                    title: title.to_string(),
                    depth,
                    children: parse_nav_sequence(children, docs_dir, depth + 1, roots),
                });
            }
        }
    }
    nodes
}

fn nav_document(
    title: String,
    target: &str,
    docs_dir: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    if is_external_or_absolute_target(target) {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path: "external".to_string(),
            depth,
            status: DocumentOrderDocumentStatus::External,
        };
    }

    let candidate = normalize_mkdocs_target_path(&docs_dir.join(target));
    let (path, status) = if ensure_path_allowed(&candidate, roots).is_err() {
        (String::new(), DocumentOrderDocumentStatus::Unsupported)
    } else if candidate.is_file() {
        (
            path_to_ui_string(&candidate),
            DocumentOrderDocumentStatus::Resolved,
        )
    } else {
        (String::new(), DocumentOrderDocumentStatus::Missing)
    };

    DocumentOrderNode::Document {
        title,
        path,
        display_path: target.to_string(),
        depth,
        status,
    }
}

fn normalize_mkdocs_target_path(path: &Path) -> PathBuf {
    path.canonicalize()
        .map(|canonical| path_for_policy(&canonical))
        .unwrap_or_else(|_| {
            path.parent()
                .and_then(|parent| parent.canonicalize().ok())
                .map(|parent| path_for_policy(&parent).join(path.file_name().unwrap_or_default()))
                .unwrap_or_else(|| path_for_policy(path))
        })
}

fn is_external_or_absolute_target(target: &str) -> bool {
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

fn display_title_from_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| display_safe_path(Path::new(path)))
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use tempfile::tempdir;

    use super::*;

    fn roots_for(path: &Path) -> AllowedRoots {
        AllowedRoots(Mutex::new([path_for_policy(path)].into_iter().collect()))
    }

    #[test]
    fn parses_nested_mkdocs_nav_with_docs_dir() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("site-docs");
        fs::create_dir_all(docs.join("guide")).expect("dirs");
        fs::write(docs.join("index.md"), "# Home").expect("index");
        fs::write(docs.join("guide").join("intro.md"), "# Intro").expect("intro");
        fs::write(
            dir.path().join("mkdocs.yml"),
            "docs_dir: site-docs\nnav:\n  - Home: index.md\n  - Guide:\n      - Intro: guide/intro.md\n      - Missing: guide/missing.md\n",
        )
        .expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Mkdocs);
        assert_eq!(result.nodes.len(), 2);
        match &result.nodes[1] {
            DocumentOrderNode::Section {
                title, children, ..
            } => {
                assert_eq!(title, "Guide");
                assert_eq!(children.len(), 2);
                assert!(matches!(
                    &children[1],
                    DocumentOrderNode::Document {
                        status: DocumentOrderDocumentStatus::Missing,
                        ..
                    }
                ));
            }
            other => panic!("unexpected node: {other:?}"),
        }
    }

    #[test]
    fn rejects_absolute_and_url_targets_without_leaking_paths() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(&docs).expect("docs");
        fs::write(
            dir.path().join("mkdocs.yml"),
            "nav:\n  - Secret: /private/secret.md\n  - Remote: https://example.invalid/doc\n",
        )
        .expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(result.source, DocumentOrderSource::Mkdocs);
        assert!(!serialized.contains("/private/secret.md"));
        assert!(serialized.contains("external"));
    }

    #[test]
    fn falls_back_when_yaml_is_not_supported() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("mkdocs.yml"), "nav: [").expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("MkDocs configuration could not be parsed.")
        );
    }
}
