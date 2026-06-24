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
    document_order_common::{
        display_title_from_path, is_external_or_absolute_target, mapping_get, none_result,
        normalize_document_order_target_path,
    },
    path_policy::{ensure_path_allowed, path_to_ui_string},
};

const MKDOCS_CONFIG_NAMES: [&str; 2] = ["mkdocs.yml", "mkdocs.yaml"];

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

    let candidate = normalize_document_order_target_path(&docs_dir.join(target));
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

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use tempfile::tempdir;

    use super::*;
    use crate::path_policy::path_for_policy;

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
