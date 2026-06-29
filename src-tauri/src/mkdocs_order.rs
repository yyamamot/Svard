use std::{
    fs,
    path::{Path, PathBuf},
};

use serde_norway::{Mapping, Value};

use crate::{
    backend_types::{
        AllowedRoots, DocumentOrderDocumentStatus, DocumentOrderKind, DocumentOrderNode,
        DocumentOrderResult, DocumentOrderSource,
    },
    document_order_common::{
        display_title_from_path, fallback_docs_dir_nodes, is_external_or_absolute_target,
        mapping_get, none_result, normalize_document_order_target_path,
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
    let parsed = match load_mkdocs_config_value(&config_path, roots, 0, &mut Vec::new()) {
        Ok(parsed) => parsed,
        Err(message) => return none_result(Some(message)),
    };
    let Some(mapping) = parsed.as_mapping() else {
        return none_result(Some("MkDocs configuration is not a mapping.".to_string()));
    };
    let config_dir = config_path.parent().unwrap_or(root);
    let docs_dir = normalize_document_order_target_path(&docs_dir_for_config(config_dir, mapping));
    if ensure_path_allowed(&docs_dir, roots).is_err() {
        return none_result(Some(
            "MkDocs documentation directory is outside the workspace.".to_string(),
        ));
    }
    let Some(nav) = mapping_get(mapping, "nav") else {
        let nodes = fallback_docs_dir_nodes(&docs_dir, roots);
        if nodes.is_empty() {
            return none_result(Some(
                "MkDocs docs directory did not contain local Markdown entries.".to_string(),
            ));
        }
        return DocumentOrderResult {
            source: DocumentOrderSource::Mkdocs,
            nodes,
            order_kind: Some(DocumentOrderKind::DocsDirFallback),
            message: None,
        };
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
        order_kind: Some(DocumentOrderKind::ExplicitNav),
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

fn load_mkdocs_config_value(
    config_path: &Path,
    roots: &AllowedRoots,
    depth: usize,
    stack: &mut Vec<PathBuf>,
) -> Result<Value, String> {
    if depth > 4 {
        return Err("MkDocs inherited configuration is too deep.".to_string());
    }
    let config_path = normalize_document_order_target_path(config_path);
    if ensure_path_allowed(&config_path, roots).is_err() || !config_path.is_file() {
        return Err("MkDocs configuration could not be read.".to_string());
    }
    if stack.iter().any(|current| current == &config_path) {
        return Err("MkDocs inherited configuration contains a cycle.".to_string());
    }
    let source = fs::read_to_string(&config_path)
        .map_err(|_| "MkDocs configuration could not be read.".to_string())?;
    let parsed: Value = serde_norway::from_str(&source)
        .map_err(|_| "MkDocs configuration could not be parsed.".to_string())?;
    let Some(mapping) = parsed.as_mapping() else {
        return Ok(parsed);
    };
    let Some(inherit) = mapping_get(mapping, "INHERIT").and_then(Value::as_str) else {
        return Ok(parsed);
    };
    if is_external_or_absolute_target(inherit) || inherit.contains('\\') {
        return Err("MkDocs inherited configuration is unsupported.".to_string());
    }
    let Some(config_dir) = config_path.parent() else {
        return Ok(parsed);
    };
    let parent_path = normalize_document_order_target_path(&config_dir.join(inherit));
    stack.push(config_path);
    let parent = load_mkdocs_config_value(&parent_path, roots, depth + 1, stack)?;
    stack.pop();
    Ok(merge_mkdocs_config(parent, parsed))
}

fn merge_mkdocs_config(parent: Value, child: Value) -> Value {
    let (Some(parent_mapping), Some(child_mapping)) = (parent.as_mapping(), child.as_mapping())
    else {
        return child;
    };
    let mut merged = parent_mapping.clone();
    for (key, value) in child_mapping {
        if key.as_str() == Some("INHERIT") {
            continue;
        }
        merged.insert(key.clone(), value.clone());
    }
    Value::Mapping(merged)
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

    fn flatten_display_paths(nodes: &[DocumentOrderNode], paths: &mut Vec<String>) {
        for node in nodes {
            match node {
                DocumentOrderNode::Document { display_path, .. } => {
                    paths.push(display_path.clone());
                }
                DocumentOrderNode::Section { children, .. } => {
                    flatten_display_paths(children, paths);
                }
            }
        }
    }

    fn display_paths(result: &DocumentOrderResult) -> Vec<String> {
        let mut paths = Vec::new();
        flatten_display_paths(&result.nodes, &mut paths);
        paths
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
    fn falls_back_to_docs_dir_markdown_when_mkdocs_nav_is_missing() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("site-docs");
        fs::create_dir_all(docs.join("01_basics")).expect("basics");
        fs::create_dir_all(docs.join("02_engines")).expect("engines");
        fs::create_dir_all(docs.join("03_kv_cache_systems").join("engines")).expect("kv engines");
        fs::create_dir_all(docs.join("03_kv_cache_systems").join("storage")).expect("kv storage");
        fs::write(docs.join("zeta.md"), "# Zeta").expect("zeta");
        fs::write(docs.join("index.md"), "# Home").expect("home");
        fs::write(docs.join("00_overview.md"), "# Overview").expect("overview");
        fs::write(docs.join("01_basics").join("kv_cache.md"), "# KV").expect("kv");
        fs::write(docs.join("01_basics").join("checkpoint.md"), "# Checkpoint")
            .expect("checkpoint");
        fs::write(docs.join("02_engines").join("overview.md"), "# Engines")
            .expect("engines overview");
        fs::write(
            docs.join("03_kv_cache_systems").join("overview.md"),
            "# KV Overview",
        )
        .expect("kv overview");
        fs::write(
            docs.join("03_kv_cache_systems")
                .join("engines")
                .join("overview.md"),
            "# Engine Overview",
        )
        .expect("engine overview");
        fs::write(
            docs.join("03_kv_cache_systems")
                .join("storage")
                .join("overview.md"),
            "# Storage Overview",
        )
        .expect("storage overview");
        fs::write(docs.join("ignored.adoc"), "= Ignored").expect("adoc");
        fs::write(dir.path().join("mkdocs.yml"), "docs_dir: site-docs\n").expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Mkdocs);
        assert_eq!(result.order_kind, Some(DocumentOrderKind::DocsDirFallback));
        assert_eq!(
            display_paths(&result),
            vec![
                "index.md",
                "00_overview.md",
                "01_basics/checkpoint.md",
                "01_basics/kv_cache.md",
                "02_engines/overview.md",
                "03_kv_cache_systems/overview.md",
                "03_kv_cache_systems/engines/overview.md",
                "03_kv_cache_systems/storage/overview.md",
                "zeta.md",
            ]
        );
        assert!(matches!(
            &result.nodes[2],
            DocumentOrderNode::Section { title, depth: 0, children }
                if title == "01_basics" && children.len() == 2
        ));
        assert!(matches!(
            &result.nodes[4],
            DocumentOrderNode::Section { title, depth: 0, children }
                if title == "03_kv_cache_systems"
                    && matches!(&children[0], DocumentOrderNode::Document { title, depth: 1, .. } if title == "overview")
                    && matches!(&children[1], DocumentOrderNode::Section { title, depth: 1, children } if title == "engines" && children.len() == 1)
                    && matches!(&children[2], DocumentOrderNode::Section { title, depth: 1, children } if title == "storage" && children.len() == 1)
        ));
    }

    #[test]
    fn explicit_mkdocs_nav_takes_precedence_over_docs_dir_fallback() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(&docs).expect("docs");
        fs::write(docs.join("alpha.md"), "# Alpha").expect("alpha");
        fs::write(docs.join("zeta.md"), "# Zeta").expect("zeta");
        fs::write(
            dir.path().join("mkdocs.yml"),
            "nav:\n  - Zeta first: zeta.md\n",
        )
        .expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Mkdocs);
        assert_eq!(result.order_kind, Some(DocumentOrderKind::ExplicitNav));
        assert_eq!(display_paths(&result), vec!["zeta.md"]);
    }

    #[test]
    fn mkdocs_fallback_skips_hidden_cache_build_and_symlink_escape_dirs() {
        let dir = tempdir().expect("tempdir");
        let outside = tempdir().expect("outside");
        let docs = dir.path().join("docs");
        fs::create_dir_all(docs.join(".cache")).expect("cache");
        fs::create_dir_all(docs.join("dist")).expect("dist");
        fs::create_dir_all(docs.join("guide")).expect("guide");
        fs::write(docs.join("index.md"), "# Home").expect("home");
        fs::write(docs.join(".cache").join("hidden.md"), "# Hidden").expect("hidden");
        fs::write(docs.join("dist").join("built.md"), "# Built").expect("built");
        fs::write(docs.join("guide").join("intro.md"), "# Intro").expect("intro");
        fs::write(outside.path().join("secret.md"), "# Secret").expect("secret");
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.path(), docs.join("linked-outside")).expect("symlink");
        fs::write(dir.path().join("mkdocs.yml"), "site_name: Docs\n").expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(display_paths(&result), vec!["index.md", "guide/intro.md"]);
        assert!(!serialized.contains("hidden.md"));
        assert!(!serialized.contains("built.md"));
        assert!(!serialized.contains("secret.md"));
    }

    #[test]
    fn resolves_local_mkdocs_inherit_for_nav_and_docs_dir() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("site-docs");
        fs::create_dir_all(&docs).expect("docs");
        fs::write(docs.join("index.md"), "# Home").expect("index");
        fs::write(
            dir.path().join("base.yml"),
            "docs_dir: site-docs\nnav:\n  - Home: index.md\n",
        )
        .expect("base config");
        fs::write(dir.path().join("mkdocs.yml"), "INHERIT: base.yml\n").expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Mkdocs);
        assert!(matches!(
            &result.nodes[0],
            DocumentOrderNode::Document {
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            }
        ));
    }

    #[test]
    fn rejects_outside_mkdocs_inherit_without_leaking_path() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("mkdocs.yml"), "INHERIT: ../base.yml\n").expect("config");

        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(result.source, DocumentOrderSource::None);
        assert!(!serialized.contains("../base.yml"));
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

        fs::write(dir.path().join("mkdocs.yml"), "nav: index.md\n").expect("config");
        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));
        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(result.message.as_deref(), Some("MkDocs nav is not a list."));

        fs::write(dir.path().join("mkdocs.yml"), "site_name: Docs\n").expect("config");
        let result = load_mkdocs_order_from_root(dir.path(), &roots_for(dir.path()));
        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("MkDocs docs directory did not contain local Markdown entries.")
        );
    }
}
