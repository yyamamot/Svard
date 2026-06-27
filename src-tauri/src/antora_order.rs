use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use serde_norway::Value;

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

const ANTORA_CONFIG_NAME: &str = "antora.yml";

pub(crate) fn load_antora_order_from_roots(
    content_roots: &[PathBuf],
    roots: &AllowedRoots,
) -> DocumentOrderResult {
    if content_roots.is_empty() {
        return none_result(None);
    }
    if content_roots.len() == 1 {
        return load_antora_order_from_content_root(&content_roots[0], roots);
    }

    let mut sections = Vec::new();
    for root in content_roots {
        let result = load_antora_order_from_content_root(root, roots);
        if result.source != DocumentOrderSource::Antora || result.nodes.is_empty() {
            continue;
        }
        sections.push(DocumentOrderNode::Section {
            title: antora_content_root_title(root),
            depth: 0,
            children: shift_nodes_depth(result.nodes, 1),
        });
    }

    if sections.is_empty() {
        return none_result(Some(
            "Antora nav did not contain local document entries.".to_string(),
        ));
    }
    DocumentOrderResult {
        source: DocumentOrderSource::Antora,
        nodes: sections,
        message: None,
    }
}

fn load_antora_order_from_content_root(root: &Path, roots: &AllowedRoots) -> DocumentOrderResult {
    let config_path = root.join(ANTORA_CONFIG_NAME);
    if !config_path.is_file() {
        return none_result(None);
    }
    let source = match fs::read_to_string(&config_path) {
        Ok(source) => source,
        Err(_) => {
            return none_result(Some("Antora descriptor could not be read.".to_string()));
        }
    };
    let parsed: Value = match serde_norway::from_str(&source) {
        Ok(parsed) => parsed,
        Err(_) => {
            return none_result(Some("Antora descriptor could not be parsed.".to_string()));
        }
    };
    let Some(mapping) = parsed.as_mapping() else {
        return none_result(Some("Antora descriptor is not a mapping.".to_string()));
    };
    let config_dir = config_path.parent().unwrap_or(root);
    let Some(nav) = mapping_get(mapping, "nav") else {
        return none_result(Some("Antora nav is not configured.".to_string()));
    };
    let Some(sequence) = nav.as_sequence() else {
        return none_result(Some("Antora nav is not a list.".to_string()));
    };

    let mut nodes = Vec::new();
    for item in sequence {
        let Some(nav_path) = item.as_str() else {
            continue;
        };
        if is_external_or_absolute_target(nav_path) {
            continue;
        }
        let candidate = normalize_document_order_target_path(&config_dir.join(nav_path));
        if ensure_path_allowed(&candidate, roots).is_err() || !candidate.is_file() {
            continue;
        }
        let nav_source = match fs::read_to_string(&candidate) {
            Ok(nav_source) => nav_source,
            Err(_) => continue,
        };
        nodes.extend(parse_antora_nav_file(&candidate, &nav_source, roots));
    }

    if nodes.is_empty() {
        return none_result(Some(
            "Antora nav did not contain local document entries.".to_string(),
        ));
    }

    DocumentOrderResult {
        source: DocumentOrderSource::Antora,
        nodes,
        message: None,
    }
}

fn antora_content_root_title(root: &Path) -> String {
    let config_path = root.join(ANTORA_CONFIG_NAME);
    let source = fs::read_to_string(&config_path).ok();
    let parsed = source
        .as_deref()
        .and_then(|source| serde_norway::from_str::<Value>(source).ok());
    let title = parsed
        .as_ref()
        .and_then(Value::as_mapping)
        .and_then(|mapping| {
            mapping_get(mapping, "title")
                .or_else(|| mapping_get(mapping, "name"))
                .and_then(Value::as_str)
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    title.unwrap_or_else(|| {
        root.file_name()
            .map(|value| value.to_string_lossy().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "Antora content root".to_string())
    })
}

fn shift_nodes_depth(nodes: Vec<DocumentOrderNode>, delta: usize) -> Vec<DocumentOrderNode> {
    nodes
        .into_iter()
        .map(|node| shift_node_tree_depth(node, delta))
        .collect()
}

fn shift_node_tree_depth(node: DocumentOrderNode, delta: usize) -> DocumentOrderNode {
    match node {
        DocumentOrderNode::Section {
            title,
            depth,
            children,
        } => DocumentOrderNode::Section {
            title,
            depth: depth + delta,
            children: shift_nodes_depth(children, delta),
        },
        DocumentOrderNode::Document {
            title,
            path,
            display_path,
            depth,
            status,
        } => DocumentOrderNode::Document {
            title,
            path,
            display_path,
            depth: depth + delta,
            status,
        },
    }
}

fn parse_antora_nav_file(
    nav_path: &Path,
    source: &str,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let module_root = nav_path.parent().unwrap_or_else(|| Path::new(""));
    let module_name = module_root
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "ROOT".to_string());
    let mut blocks = Vec::<(Option<String>, Vec<(usize, String)>)>::new();
    let mut current_title: Option<String> = None;
    let mut current_items = Vec::new();

    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") {
            continue;
        }
        if let Some(title) = trimmed.strip_prefix('.') {
            push_antora_nav_block(&mut blocks, current_title.take(), &mut current_items);
            let title = title.trim();
            if !title.is_empty() {
                current_title = Some(title.to_string());
            }
            continue;
        }
        if let Some((depth, content)) = antora_list_item(trimmed) {
            current_items.push((depth, content.to_string()));
        }
    }
    push_antora_nav_block(&mut blocks, current_title, &mut current_items);

    let mut nodes = Vec::new();
    for (section_title, list_items) in blocks {
        let children = build_antora_nodes(&list_items, 0, module_root, roots);
        if let Some(title) = section_title {
            if !children.is_empty() {
                nodes.push(DocumentOrderNode::Section {
                    title,
                    depth: 0,
                    children,
                });
            }
        } else {
            nodes.extend(
                children
                    .into_iter()
                    .map(|node| shift_node_depth(node, &module_name)),
            );
        }
    }
    nodes
}

fn push_antora_nav_block(
    blocks: &mut Vec<(Option<String>, Vec<(usize, String)>)>,
    title: Option<String>,
    items: &mut Vec<(usize, String)>,
) {
    if title.is_some() || !items.is_empty() {
        blocks.push((title, std::mem::take(items)));
    }
}

fn antora_list_item(line: &str) -> Option<(usize, &str)> {
    let marker_count = line.chars().take_while(|value| *value == '*').count();
    if marker_count == 0 || marker_count > 5 {
        return None;
    }
    let content = line.get(marker_count..)?.trim();
    if content.is_empty() {
        return None;
    }
    Some((marker_count - 1, content))
}

fn build_antora_nodes(
    items: &[(usize, String)],
    parent_depth: usize,
    module_root: &Path,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut nodes = Vec::new();
    let mut index = 0;
    while index < items.len() {
        let (depth, content) = &items[index];
        if *depth < parent_depth {
            break;
        }
        if *depth > parent_depth {
            index += 1;
            continue;
        }
        let mut next_index = index + 1;
        while next_index < items.len() && items[next_index].0 > *depth {
            next_index += 1;
        }
        let children =
            build_antora_nodes(&items[index + 1..next_index], depth + 1, module_root, roots);
        let node = antora_nav_node(content, *depth, module_root, roots);
        if !children.is_empty() {
            match node {
                DocumentOrderNode::Document {
                    title,
                    status: DocumentOrderDocumentStatus::Unsupported,
                    ..
                } => nodes.push(DocumentOrderNode::Section {
                    title,
                    depth: *depth,
                    children,
                }),
                other => {
                    let title = document_order_node_title(&other);
                    let mut section_children =
                        vec![with_document_order_node_depth(other, depth + 1)];
                    section_children.extend(children);
                    nodes.push(DocumentOrderNode::Section {
                        title,
                        depth: *depth,
                        children: section_children,
                    });
                }
            }
            index = next_index;
            continue;
        }
        nodes.push(node);
        index = next_index;
    }
    nodes
}

fn document_order_node_title(node: &DocumentOrderNode) -> String {
    match node {
        DocumentOrderNode::Section { title, .. } | DocumentOrderNode::Document { title, .. } => {
            title.clone()
        }
    }
}

fn with_document_order_node_depth(node: DocumentOrderNode, depth: usize) -> DocumentOrderNode {
    match node {
        DocumentOrderNode::Section {
            title, children, ..
        } => DocumentOrderNode::Section {
            title,
            depth,
            children,
        },
        DocumentOrderNode::Document {
            title,
            path,
            display_path,
            status,
            ..
        } => DocumentOrderNode::Document {
            title,
            path,
            display_path,
            depth,
            status,
        },
    }
}

fn antora_nav_node(
    content: &str,
    depth: usize,
    module_root: &Path,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    if let Some((target, title)) = parse_antora_xref(content) {
        return antora_document(title, target, module_root, depth, roots);
    }
    if content.starts_with("http://") || content.starts_with("https://") {
        return DocumentOrderNode::Document {
            title: parse_antora_link_label(content).unwrap_or_else(|| "External".to_string()),
            path: String::new(),
            display_path: "external".to_string(),
            depth,
            status: DocumentOrderDocumentStatus::External,
        };
    }
    DocumentOrderNode::Document {
        title: display_antora_text(content),
        path: String::new(),
        display_path: "unsupported".to_string(),
        depth,
        status: DocumentOrderDocumentStatus::Unsupported,
    }
}

fn parse_antora_xref(content: &str) -> Option<(&str, Option<String>)> {
    let start = content.find("xref:")?;
    let after_prefix = &content[start + "xref:".len()..];
    let bracket_start = after_prefix.find('[')?;
    let target = &after_prefix[..bracket_start];
    let after_bracket = &after_prefix[bracket_start + 1..];
    let bracket_end = after_bracket.find(']')?;
    let label = after_bracket[..bracket_end].trim();
    let title = if label.is_empty() {
        None
    } else {
        Some(label.to_string())
    };
    Some((target, title))
}

fn parse_antora_link_label(content: &str) -> Option<String> {
    let bracket_start = content.find('[')?;
    let after_bracket = &content[bracket_start + 1..];
    let bracket_end = after_bracket.find(']')?;
    let label = after_bracket[..bracket_end].trim();
    if label.is_empty() {
        None
    } else {
        Some(label.to_string())
    }
}

fn antora_document(
    title: Option<String>,
    target: &str,
    module_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    let path_target = target.split_once('#').map_or(target, |(path, _)| path);
    if is_external_or_absolute_target(path_target) {
        return DocumentOrderNode::Document {
            title: title.unwrap_or_else(|| display_title_from_path(target)),
            path: String::new(),
            display_path: "external".to_string(),
            depth,
            status: DocumentOrderDocumentStatus::External,
        };
    }
    let Some((target_module, page)) = antora_page_target(path_target, module_root) else {
        return DocumentOrderNode::Document {
            title: title.unwrap_or_else(|| display_title_from_path(target)),
            path: String::new(),
            display_path: "unsupported".to_string(),
            depth,
            status: DocumentOrderDocumentStatus::Unsupported,
        };
    };
    let candidate = normalize_document_order_target_path(&target_module.join("pages").join(&page));
    let (path, status, resolved_title) = if ensure_path_allowed(&candidate, roots).is_err() {
        (
            String::new(),
            DocumentOrderDocumentStatus::Unsupported,
            title.unwrap_or_else(|| display_title_from_path(target)),
        )
    } else if candidate.is_file() {
        (
            path_to_ui_string(&candidate),
            DocumentOrderDocumentStatus::Resolved,
            title
                .or_else(|| antora_page_display_title(&candidate))
                .unwrap_or_else(|| display_title_from_path(target)),
        )
    } else {
        (
            String::new(),
            DocumentOrderDocumentStatus::Missing,
            title.unwrap_or_else(|| display_title_from_path(target)),
        )
    };
    DocumentOrderNode::Document {
        title: resolved_title,
        path,
        display_path: target.to_string(),
        depth,
        status,
    }
}

fn antora_page_display_title(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut reader = file.take(64 * 1024);
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes).ok()?;
    let source = String::from_utf8_lossy(&bytes);
    let mut document_title = None;
    for line in source.lines().take(120) {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix(":docname:") {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
        if document_title.is_none() {
            if let Some(value) = trimmed.strip_prefix("= ") {
                let value = value.trim();
                if !value.is_empty() {
                    document_title = Some(value.to_string());
                }
            }
        }
    }
    document_title
}

fn antora_page_target(target: &str, module_root: &Path) -> Option<(PathBuf, String)> {
    if target.contains("::") || target.matches(':').count() > 1 {
        return None;
    }
    let mut parts = target.split(':');
    let first = parts.next()?;
    let second = parts.next();
    if let Some(page) = second {
        if first.contains('/') || first.contains('\\') || first.is_empty() {
            return None;
        }
        let modules_dir = module_root.parent()?;
        Some((modules_dir.join(first), page.to_string()))
    } else {
        Some((module_root.to_path_buf(), first.to_string()))
    }
}

fn display_antora_text(content: &str) -> String {
    content
        .trim()
        .trim_matches('*')
        .trim_matches('_')
        .trim()
        .to_string()
}

fn shift_node_depth(node: DocumentOrderNode, fallback_title: &str) -> DocumentOrderNode {
    match node {
        DocumentOrderNode::Section {
            title,
            depth,
            children,
        } => DocumentOrderNode::Section {
            title,
            depth,
            children,
        },
        DocumentOrderNode::Document {
            title,
            path,
            display_path,
            depth,
            status,
        } => {
            if depth == 0 && status == DocumentOrderDocumentStatus::Unsupported {
                DocumentOrderNode::Section {
                    title: if title.is_empty() {
                        fallback_title.to_string()
                    } else {
                        title
                    },
                    depth,
                    children: Vec::new(),
                }
            } else {
                DocumentOrderNode::Document {
                    title,
                    path,
                    display_path,
                    depth,
                    status,
                }
            }
        }
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
    fn parses_antora_registered_nav_files() {
        let dir = tempdir().expect("tempdir");
        let root_module = dir.path().join("modules").join("ROOT");
        let admin_module = dir.path().join("modules").join("admin");
        fs::create_dir_all(root_module.join("pages")).expect("root pages");
        fs::create_dir_all(admin_module.join("pages")).expect("admin pages");
        fs::write(
            root_module.join("pages").join("index.adoc"),
            "include::../partials/header.adoc[]\n:docname: Product Home\n\n= Home",
        )
        .expect("home");
        fs::write(root_module.join("pages").join("install.adoc"), "= Install").expect("install");
        fs::write(admin_module.join("pages").join("users.adoc"), "= Users").expect("users");
        fs::write(
            root_module.join("nav.adoc"),
            ".Product\n* xref:index.adoc[]\n** xref:install.adoc[Install]\n* xref:admin:users.adoc[Users]\n* xref:missing.adoc[Missing]\n",
        )
        .expect("root nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: product\nversion: '1.0'\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let result = load_antora_order_from_content_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Antora);
        assert_eq!(result.nodes.len(), 1);
        match &result.nodes[0] {
            DocumentOrderNode::Section {
                title, children, ..
            } => {
                assert_eq!(title, "Product");
                assert_eq!(children.len(), 3);
                assert!(matches!(
                    &children[0],
                    DocumentOrderNode::Section {
                        title,
                        children,
                        ..
                    } if title == "Product Home" && children.len() == 2
                ));
                let DocumentOrderNode::Section {
                    children: home_children,
                    ..
                } = &children[0]
                else {
                    panic!("expected nested home section");
                };
                assert!(matches!(
                    &home_children[0],
                    DocumentOrderNode::Document {
                        title,
                        path,
                        depth: 1,
                        status: DocumentOrderDocumentStatus::Resolved,
                        ..
                    } if title == "Product Home" && path.ends_with("modules/ROOT/pages/index.adoc")
                ));
                assert!(matches!(
                    &home_children[1],
                    DocumentOrderNode::Document {
                        title,
                        depth: 1,
                        status: DocumentOrderDocumentStatus::Resolved,
                        ..
                    } if title == "Install"
                ));
                assert!(matches!(
                    &children[1],
                    DocumentOrderNode::Document {
                        title,
                        status: DocumentOrderDocumentStatus::Resolved,
                        ..
                    } if title == "Users"
                ));
                assert!(matches!(
                    &children[2],
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
    fn parses_antora_parent_xref_as_collapsible_section_without_nav_title() {
        let dir = tempdir().expect("tempdir");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(root_module.join("pages")).expect("root pages");
        fs::write(
            root_module.join("pages").join("index.adoc"),
            ":docname: Root Guide\n\n= Index",
        )
        .expect("index");
        fs::write(root_module.join("pages").join("child.adoc"), "= Child").expect("child");
        fs::write(
            root_module.join("nav.adoc"),
            "* xref:index.adoc[]\n** xref:child.adoc[]\n",
        )
        .expect("root nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: product\nversion: true\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let result = load_antora_order_from_content_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Antora);
        assert_eq!(result.nodes.len(), 1);
        let DocumentOrderNode::Section {
            title,
            children,
            depth,
        } = &result.nodes[0]
        else {
            panic!("expected parent xref section");
        };
        assert_eq!(title, "Root Guide");
        assert_eq!(*depth, 0);
        assert_eq!(children.len(), 2);
        assert!(matches!(
            &children[0],
            DocumentOrderNode::Document {
                title,
                depth: 1,
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            } if title == "Root Guide"
        ));
        assert!(matches!(
            &children[1],
            DocumentOrderNode::Document {
                title,
                depth: 1,
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            } if title == "Child"
        ));
    }

    #[test]
    fn reads_antora_page_title_when_scan_limit_splits_utf8() {
        let dir = tempdir().expect("tempdir");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(root_module.join("pages")).expect("root pages");
        let mut source = ":docname: Bounded Title\n\n= Fallback Title\n\n".to_string();
        source.push_str(&"a".repeat((64 * 1024) - source.len() - 1));
        source.push('判');
        fs::write(root_module.join("pages").join("index.adoc"), source).expect("index");
        fs::write(root_module.join("nav.adoc"), "* xref:index.adoc[]\n").expect("nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: product\nversion: true\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let result = load_antora_order_from_content_root(dir.path(), &roots_for(dir.path()));

        assert!(matches!(
            &result.nodes[0],
            DocumentOrderNode::Document {
                title,
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            } if title == "Bounded Title"
        ));
    }

    #[test]
    fn preserves_multiple_antora_nav_section_blocks() {
        let dir = tempdir().expect("tempdir");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(root_module.join("pages")).expect("root pages");
        fs::write(root_module.join("pages").join("guide.adoc"), "= Guide").expect("guide");
        fs::write(
            root_module.join("pages").join("reference.adoc"),
            "= Reference",
        )
        .expect("reference");
        fs::write(
            root_module.join("nav.adoc"),
            ".Guide\n* xref:guide.adoc[]\n.Reference\n* xref:reference.adoc[]\n",
        )
        .expect("root nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: component-a\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let result = load_antora_order_from_content_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Antora);
        assert_eq!(result.nodes.len(), 2);
        assert!(matches!(
            &result.nodes[0],
            DocumentOrderNode::Section { title, children, .. }
                if title == "Guide" && children.len() == 1
        ));
        assert!(matches!(
            &result.nodes[1],
            DocumentOrderNode::Section { title, children, .. }
                if title == "Reference" && children.len() == 1
        ));
    }

    #[test]
    fn resolves_antora_xref_with_anchor_to_document_path() {
        let dir = tempdir().expect("tempdir");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(root_module.join("pages")).expect("root pages");
        fs::write(root_module.join("pages").join("guide.adoc"), "= Guide").expect("guide");
        fs::write(
            root_module.join("nav.adoc"),
            ".Guide\n* xref:guide.adoc#install[]\n",
        )
        .expect("root nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: component-a\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let result = load_antora_order_from_content_root(dir.path(), &roots_for(dir.path()));
        let DocumentOrderNode::Section { children, .. } = &result.nodes[0] else {
            panic!("expected guide section");
        };

        assert!(matches!(
            &children[0],
            DocumentOrderNode::Document {
                path,
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            } if path.ends_with("modules/ROOT/pages/guide.adoc")
        ));
    }

    #[test]
    fn antora_order_rejects_unsupported_targets_without_leaking_paths() {
        let dir = tempdir().expect("tempdir");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(&root_module).expect("root module");
        fs::write(
            root_module.join("nav.adoc"),
            ".Product\n* xref:other::secret.adoc[Secret]\n* https://example.invalid[Remote]\n",
        )
        .expect("nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: product\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let result = load_antora_order_from_content_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(result.source, DocumentOrderSource::Antora);
        assert!(!serialized.contains("other::secret"));
        assert!(!serialized.contains("example.invalid"));
        assert!(serialized.contains("unsupported"));
        assert!(serialized.contains("external"));
    }
}
