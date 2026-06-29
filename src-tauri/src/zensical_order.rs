use std::{fs, path::Path};

use toml::Value;

use crate::{
    backend_types::{
        AllowedRoots, DocumentOrderDocumentStatus, DocumentOrderKind, DocumentOrderNode,
        DocumentOrderResult, DocumentOrderSource,
    },
    document_order_common::{
        display_title_from_path, fallback_docs_dir_nodes, is_external_or_absolute_target,
        none_result, normalize_document_order_target_path,
    },
    path_policy::{ensure_path_allowed, path_to_ui_string},
};

const ZENSICAL_CONFIG_NAME: &str = "zensical.toml";

pub(crate) fn load_zensical_order_from_root(
    root: &Path,
    roots: &AllowedRoots,
) -> DocumentOrderResult {
    let config_path = root.join(ZENSICAL_CONFIG_NAME);
    if !config_path.is_file() {
        return none_result(None);
    }
    let config_path = normalize_document_order_target_path(&config_path);
    if ensure_path_allowed(&config_path, roots).is_err() {
        return none_result(Some(
            "Zensical configuration could not be read.".to_string(),
        ));
    }
    let parsed = match fs::read_to_string(&config_path)
        .ok()
        .and_then(|source| toml::from_str::<Value>(&source).ok())
    {
        Some(parsed) => parsed,
        None => {
            return none_result(Some(
                "Zensical configuration could not be parsed.".to_string(),
            ));
        }
    };
    let Some(project) = parsed.get("project").and_then(Value::as_table) else {
        return none_result(Some(
            "Zensical project configuration is not configured.".to_string(),
        ));
    };
    let config_dir = config_path.parent().unwrap_or(root);
    let docs_dir = project
        .get("docs_dir")
        .and_then(Value::as_str)
        .unwrap_or("docs");
    if docs_dir == "." || is_external_or_absolute_target(docs_dir) {
        return none_result(Some(
            "Zensical documentation directory is outside the workspace.".to_string(),
        ));
    }
    let docs_dir = normalize_document_order_target_path(&config_dir.join(docs_dir));
    if ensure_path_allowed(&docs_dir, roots).is_err() {
        return none_result(Some(
            "Zensical documentation directory is outside the workspace.".to_string(),
        ));
    }
    let Some(nav) = project.get("nav") else {
        let nodes = fallback_docs_dir_nodes(&docs_dir, roots);
        if nodes.is_empty() {
            return none_result(Some(
                "Zensical docs directory did not contain local Markdown entries.".to_string(),
            ));
        }
        return DocumentOrderResult {
            source: DocumentOrderSource::Zensical,
            nodes,
            order_kind: Some(DocumentOrderKind::DocsDirFallback),
            message: None,
        };
    };
    let Some(items) = nav.as_array() else {
        return none_result(Some("Zensical nav is not a list.".to_string()));
    };
    let nodes = parse_nav_items(items, &docs_dir, 0, roots);
    if nodes.is_empty() {
        return none_result(Some(
            "Zensical nav did not contain local document entries.".to_string(),
        ));
    }

    DocumentOrderResult {
        source: DocumentOrderSource::Zensical,
        nodes,
        order_kind: Some(DocumentOrderKind::ExplicitNav),
        message: None,
    }
}

fn parse_nav_items(
    items: &[Value],
    docs_dir: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut nodes = Vec::new();
    for item in items {
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
        let Some(table) = item.as_table() else {
            continue;
        };
        for (title, value) in table {
            if let Some(path) = value.as_str() {
                nodes.push(nav_document(
                    title.to_string(),
                    path,
                    docs_dir,
                    depth,
                    roots,
                ));
            } else if let Some(children) = value.as_array() {
                nodes.push(DocumentOrderNode::Section {
                    title: title.to_string(),
                    depth,
                    children: parse_nav_items(children, docs_dir, depth + 1, roots),
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
    if target.ends_with(".html") {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path: "unsupported".to_string(),
            depth,
            status: DocumentOrderDocumentStatus::Unsupported,
        };
    }
    if target.contains('$') || target.contains('{') || target.contains('}') {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path: "unsupported".to_string(),
            depth,
            status: DocumentOrderDocumentStatus::Unsupported,
        };
    }

    let candidates = zensical_target_candidates(docs_dir, target);
    let outside_root = candidates
        .iter()
        .any(|candidate| ensure_path_allowed(candidate, roots).is_err());
    let resolved = candidates
        .iter()
        .find(|candidate| ensure_path_allowed(candidate, roots).is_ok() && candidate.is_file());

    let (path, display_path, status) = if outside_root {
        (
            String::new(),
            "unsupported".to_string(),
            DocumentOrderDocumentStatus::Unsupported,
        )
    } else if let Some(candidate) = resolved {
        (
            path_to_ui_string(&candidate),
            target.to_string(),
            DocumentOrderDocumentStatus::Resolved,
        )
    } else {
        (
            String::new(),
            target.to_string(),
            DocumentOrderDocumentStatus::Missing,
        )
    };

    DocumentOrderNode::Document {
        title,
        path,
        display_path,
        depth,
        status,
    }
}

fn zensical_target_candidates(docs_dir: &Path, target: &str) -> Vec<std::path::PathBuf> {
    let target_path = Path::new(target);
    let mut candidates = vec![normalize_document_order_target_path(
        &docs_dir.join(target_path),
    )];
    let has_extension = target_path.extension().is_some();
    if target.ends_with('/') {
        candidates.push(normalize_document_order_target_path(
            &docs_dir.join(target_path).join("index.md"),
        ));
    } else if !has_extension {
        candidates.push(normalize_document_order_target_path(
            &docs_dir.join(target_path).with_extension("md"),
        ));
        candidates.push(normalize_document_order_target_path(
            &docs_dir.join(target_path).join("index.md"),
        ));
    }
    candidates
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path, sync::Mutex};

    use tempfile::tempdir;

    use super::*;
    use crate::path_policy::path_for_policy;

    fn roots_for(path: &Path) -> AllowedRoots {
        AllowedRoots(Mutex::new([path_for_policy(path)].into_iter().collect()))
    }

    fn normalized_serialized_paths(value: &str) -> String {
        value.replace("\\\\", "/").replace('\\', "/")
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
    fn parses_zensical_nav_with_default_docs_dir() {
        let dir = tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("docs").join("guide")).expect("docs");
        fs::create_dir_all(dir.path().join("docs").join("reference")).expect("reference");
        fs::create_dir_all(dir.path().join("docs").join("tutorial")).expect("tutorial");
        fs::write(dir.path().join("docs").join("index.md"), "# Home").expect("home");
        fs::write(
            dir.path().join("docs").join("guide").join("intro.md"),
            "# Intro",
        )
        .expect("intro");
        fs::write(
            dir.path().join("docs").join("reference").join("api.md"),
            "# API",
        )
        .expect("api");
        fs::write(
            dir.path().join("docs").join("tutorial").join("index.md"),
            "# Tutorial",
        )
        .expect("tutorial");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
nav = [
  "index.md",
  { "Guide" = [
    { "Intro" = "guide/intro.md" },
    { "API" = "reference/api" },
    { "Tutorial" = "tutorial/" },
    { "Missing" = "guide/missing.md" },
    { "HTML" = "legacy/page.html" },
  ] },
  { "External" = "https://example.invalid/docs" },
]
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");
        let normalized = normalized_serialized_paths(&serialized);

        assert_eq!(result.source, DocumentOrderSource::Zensical);
        assert!(serialized.contains("\"title\":\"index\""));
        assert!(serialized.contains("\"title\":\"Guide\""));
        assert!(normalized.contains("reference/api.md"));
        assert!(normalized.contains("tutorial/index.md"));
        assert!(serialized.contains("\"status\":\"missing\""));
        assert!(serialized.contains("\"title\":\"HTML\""));
        assert!(serialized.contains("\"status\":\"unsupported\""));
        assert!(serialized.contains("\"status\":\"external\""));
        assert!(!serialized.contains("zensical.toml"));
        assert!(!serialized.contains("example.invalid"));
    }

    #[test]
    fn parses_zensical_nav_with_custom_docs_dir() {
        let dir = tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("content")).expect("content");
        fs::write(dir.path().join("content").join("home.md"), "# Home").expect("home");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
docs_dir = "content"
nav = [{ "Home" = "home.md" }]
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");
        let normalized = normalized_serialized_paths(&serialized);

        assert_eq!(result.source, DocumentOrderSource::Zensical);
        assert!(normalized.contains("content/home.md"));
    }

    #[test]
    fn falls_back_to_docs_dir_markdown_when_nav_is_missing() {
        let dir = tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("docs").join("01_basics")).expect("basics");
        fs::create_dir_all(dir.path().join("docs").join("02_engines")).expect("engines");
        fs::create_dir_all(
            dir.path()
                .join("docs")
                .join("03_kv_cache_systems")
                .join("engines"),
        )
        .expect("kv engines");
        fs::create_dir_all(
            dir.path()
                .join("docs")
                .join("03_kv_cache_systems")
                .join("storage"),
        )
        .expect("kv storage");
        fs::write(dir.path().join("docs").join("zeta.md"), "# Zeta").expect("zeta");
        fs::write(dir.path().join("docs").join("index.md"), "# Home").expect("home");
        fs::write(dir.path().join("docs").join("00_overview.md"), "# Overview").expect("overview");
        fs::write(
            dir.path()
                .join("docs")
                .join("01_basics")
                .join("kv_cache.md"),
            "# KV",
        )
        .expect("kv");
        fs::write(
            dir.path()
                .join("docs")
                .join("01_basics")
                .join("checkpoint.md"),
            "# Checkpoint",
        )
        .expect("checkpoint");
        fs::write(
            dir.path()
                .join("docs")
                .join("02_engines")
                .join("overview.md"),
            "# Engines",
        )
        .expect("engines overview");
        fs::write(
            dir.path()
                .join("docs")
                .join("03_kv_cache_systems")
                .join("overview.md"),
            "# KV Overview",
        )
        .expect("kv overview");
        fs::write(
            dir.path()
                .join("docs")
                .join("03_kv_cache_systems")
                .join("engines")
                .join("overview.md"),
            "# Engine Overview",
        )
        .expect("engine overview");
        fs::write(
            dir.path()
                .join("docs")
                .join("03_kv_cache_systems")
                .join("storage")
                .join("overview.md"),
            "# Storage Overview",
        )
        .expect("storage overview");
        fs::write(dir.path().join("docs").join("ignored.adoc"), "= Ignored").expect("adoc");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
docs_dir = "docs"
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Zensical);
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
    fn explicit_zensical_nav_takes_precedence_over_docs_dir_fallback() {
        let dir = tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("docs")).expect("docs");
        fs::write(dir.path().join("docs").join("alpha.md"), "# Alpha").expect("alpha");
        fs::write(dir.path().join("docs").join("zeta.md"), "# Zeta").expect("zeta");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
docs_dir = "docs"
nav = [{ "Zeta first" = "zeta.md" }]
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Zensical);
        assert_eq!(result.order_kind, Some(DocumentOrderKind::ExplicitNav));
        assert_eq!(display_paths(&result), vec!["zeta.md"]);
    }

    #[test]
    fn zensical_fallback_skips_hidden_cache_build_and_symlink_escape_dirs() {
        let dir = tempdir().expect("tempdir");
        let outside = tempdir().expect("outside");
        fs::create_dir_all(dir.path().join("docs").join(".cache")).expect("cache");
        fs::create_dir_all(dir.path().join("docs").join("dist")).expect("dist");
        fs::create_dir_all(dir.path().join("docs").join("guide")).expect("guide");
        fs::write(dir.path().join("docs").join("index.md"), "# Home").expect("home");
        fs::write(
            dir.path().join("docs").join(".cache").join("hidden.md"),
            "# Hidden",
        )
        .expect("hidden");
        fs::write(
            dir.path().join("docs").join("dist").join("built.md"),
            "# Built",
        )
        .expect("built");
        fs::write(
            dir.path().join("docs").join("guide").join("intro.md"),
            "# Intro",
        )
        .expect("intro");
        fs::write(outside.path().join("secret.md"), "# Secret").expect("secret");
        #[cfg(unix)]
        std::os::unix::fs::symlink(
            outside.path(),
            dir.path().join("docs").join("linked-outside"),
        )
        .expect("symlink");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
docs_dir = "docs"
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(display_paths(&result), vec!["index.md", "guide/intro.md"]);
        assert!(!serialized.contains("hidden.md"));
        assert!(!serialized.contains("built.md"));
        assert!(!serialized.contains("secret.md"));
    }

    #[test]
    fn rejects_malformed_empty_and_non_list_zensical_nav_safely() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("zensical.toml"), "[project]\nnav = [").expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("Zensical configuration could not be parsed.")
        );

        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
docs_dir = "docs"
nav = "index.md"
"#,
        )
        .expect("config");
        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("Zensical nav is not a list.")
        );

        fs::write(dir.path().join("zensical.toml"), "[project]\n").expect("config");
        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("Zensical docs directory did not contain local Markdown entries.")
        );
    }

    #[test]
    fn marks_outside_zensical_targets_as_unsupported_without_leaking_path() {
        let dir = tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("docs")).expect("docs");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
nav = [{ "Outside" = "../../outside.md" }]
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(result.source, DocumentOrderSource::Zensical);
        assert!(serialized.contains("\"status\":\"unsupported\""));
        assert!(!serialized.contains("/outside.md"));
    }

    #[test]
    fn rejects_invalid_zensical_docs_dir_safely() {
        let dir = tempdir().expect("tempdir");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
docs_dir = "."
nav = ["index.md"]
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("Zensical documentation directory is outside the workspace.")
        );
    }

    #[test]
    fn keeps_generated_zensical_navigation_out_of_scope() {
        let dir = tempdir().expect("tempdir");
        fs::create_dir_all(dir.path().join("docs")).expect("docs");
        fs::write(
            dir.path().join("zensical.toml"),
            r#"[project]
nav = [{ "Generated" = "${generated_nav}" }]
"#,
        )
        .expect("config");

        let result = load_zensical_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(result.source, DocumentOrderSource::Zensical);
        assert!(serialized.contains("\"status\":\"unsupported\""));
        assert!(!serialized.contains("generated_nav"));
    }
}
