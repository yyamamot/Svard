use std::{
    cmp::Ordering,
    fs,
    path::{Path, PathBuf},
};

use serde_norway::Value as YamlValue;

use crate::{
    backend_types::{
        AllowedRoots, DocumentOrderDocumentStatus, DocumentOrderNode, DocumentOrderResult,
        DocumentOrderSource,
    },
    document_order_common::{
        display_title_from_path, none_result, normalize_document_order_target_path,
    },
    path_policy::{ensure_path_allowed, path_to_ui_string},
    static_js::{
        collect_static_bindings, is_word_boundary, object_property, static_array, static_string,
        StaticParser, StaticValue,
    },
};

const CONFIG_EXTENSIONS: [&str; 4] = ["ts", "mts", "js", "mjs"];
const DOC_EXTENSIONS: [&str; 2] = ["md", "mdx"];

#[derive(Debug, Clone)]
struct DocusaurusConfig {
    docs_root: PathBuf,
    sidebars_path: Option<PathBuf>,
}

#[derive(Debug, Clone)]
struct EntryMetadata {
    label: Option<String>,
    position: Option<f64>,
    link_doc_id: Option<String>,
}

#[derive(Debug)]
struct GeneratedEntry {
    name: String,
    position: Option<f64>,
    node: DocumentOrderNode,
}

pub(crate) fn load_docusaurus_order_from_root(
    root: &Path,
    roots: &AllowedRoots,
) -> DocumentOrderResult {
    let config = docusaurus_config(root);
    let Some(sidebars_path) = config
        .sidebars_path
        .clone()
        .or_else(|| find_default_sidebars(root))
    else {
        return none_result(None);
    };
    if ensure_path_allowed(&sidebars_path, roots).is_err() {
        return none_result(Some(
            "Docusaurus sidebars configuration is outside the workspace.".to_string(),
        ));
    }
    let source = match fs::read_to_string(&sidebars_path) {
        Ok(source) => source,
        Err(_) => {
            return none_result(Some(
                "Docusaurus sidebars configuration could not be read.".to_string(),
            ));
        }
    };
    let Some(sidebars) = extract_sidebars_value(&source) else {
        return none_result(Some(
            "Docusaurus sidebars are not configured as a static value.".to_string(),
        ));
    };
    if matches!(
        sidebars,
        StaticValue::Unsupported | StaticValue::Identifier(_)
    ) {
        return none_result(Some(
            "Docusaurus sidebars are not configured as a static value.".to_string(),
        ));
    }

    let nodes = sidebars_nodes(&sidebars, &config.docs_root, roots);
    if nodes.is_empty() {
        return none_result(Some(
            "Docusaurus sidebars did not contain local document entries.".to_string(),
        ));
    }
    DocumentOrderResult {
        source: DocumentOrderSource::Docusaurus,
        nodes,
        message: None,
    }
}

fn docusaurus_config(root: &Path) -> DocusaurusConfig {
    let mut config = DocusaurusConfig {
        docs_root: root.join("docs"),
        sidebars_path: None,
    };
    let Some(config_path) = find_docusaurus_config(root) else {
        return config;
    };
    let Ok(source) = fs::read_to_string(&config_path) else {
        return config;
    };
    let Some(value) = extract_exported_static_value(&source) else {
        return config;
    };
    if let Some(docs_options) = find_docs_options(&value) {
        if let Some(path) = object_property(docs_options, "path").and_then(static_string) {
            config.docs_root = normalize_document_order_target_path(&root.join(path));
        }
        if let Some(sidebar_path) = object_property(docs_options, "sidebarPath")
            .and_then(static_string)
            .filter(|value| !value.is_empty())
        {
            config.sidebars_path = Some(normalize_document_order_target_path(
                &root.join(sidebar_path),
            ));
        }
    }
    config
}

fn find_docusaurus_config(root: &Path) -> Option<PathBuf> {
    CONFIG_EXTENSIONS
        .iter()
        .map(|extension| root.join(format!("docusaurus.config.{extension}")))
        .find(|path| path.is_file())
        .map(|path| normalize_document_order_target_path(&path))
}

fn find_default_sidebars(root: &Path) -> Option<PathBuf> {
    CONFIG_EXTENSIONS
        .iter()
        .map(|extension| root.join(format!("sidebars.{extension}")))
        .find(|path| path.is_file())
        .map(|path| normalize_document_order_target_path(&path))
}

fn extract_sidebars_value(source: &str) -> Option<StaticValue> {
    extract_exported_static_value(source).or_else(|| {
        let bindings = collect_static_bindings(source);
        bindings.get("sidebars").cloned()
    })
}

fn extract_exported_static_value(source: &str) -> Option<StaticValue> {
    let bindings = collect_static_bindings(source);
    if let Some(value) = parse_after_marker(source, "export default") {
        return resolve_identifier(value, &bindings);
    }
    if let Some(value) = parse_after_marker(source, "module.exports") {
        return resolve_identifier(value, &bindings);
    }
    None
}

fn parse_after_marker(source: &str, marker: &str) -> Option<StaticValue> {
    let mut offset = 0;
    while let Some(found) = source[offset..].find(marker) {
        let start = offset + found;
        if !is_word_boundary(source, start, marker.len()) {
            offset = start + marker.len();
            continue;
        }
        let mut parser = StaticParser::new(&source[start + marker.len()..]);
        if marker == "module.exports" && !parser.skip_until_equals() {
            return None;
        }
        let value = parser.parse_value();
        if !matches!(value, StaticValue::Unsupported) {
            return Some(value);
        }
        offset = start + marker.len();
    }
    None
}

fn resolve_identifier(
    value: StaticValue,
    bindings: &std::collections::BTreeMap<String, StaticValue>,
) -> Option<StaticValue> {
    match value {
        StaticValue::Identifier(name) => bindings.get(&name).cloned(),
        value => Some(value),
    }
}

fn find_docs_options(value: &StaticValue) -> Option<&StaticValue> {
    if let Some(docs) = object_property(value, "docs") {
        if matches!(docs, StaticValue::Object(_)) {
            return Some(docs);
        }
    }
    match value {
        StaticValue::Object(entries) => entries
            .iter()
            .find_map(|(_, child)| find_docs_options(child)),
        StaticValue::Array(items) => items.iter().find_map(find_docs_options),
        _ => None,
    }
}

fn sidebars_nodes(
    sidebars: &StaticValue,
    docs_root: &Path,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    match sidebars {
        StaticValue::Object(entries) => entries
            .iter()
            .filter_map(|(sidebar_id, value)| {
                let children = sidebar_children(value, docs_root, 1, roots);
                (!children.is_empty()).then(|| DocumentOrderNode::Section {
                    title: sidebar_title(sidebar_id),
                    depth: 0,
                    children,
                })
            })
            .collect(),
        StaticValue::Array(items) => parse_sidebar_items(items, docs_root, 0, roots),
        _ => Vec::new(),
    }
}

fn sidebar_children(
    value: &StaticValue,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    match value {
        StaticValue::Array(items) => parse_sidebar_items(items, docs_root, depth, roots),
        StaticValue::Object(_) => parse_category_shorthand(value, docs_root, depth, roots),
        _ => Vec::new(),
    }
}

fn parse_sidebar_items(
    items: &[StaticValue],
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut nodes = Vec::new();
    for item in items {
        match item {
            StaticValue::String(doc_id) => {
                nodes.push(doc_id_node(
                    display_title_from_path(doc_id),
                    doc_id,
                    docs_root,
                    depth,
                    roots,
                ));
            }
            StaticValue::Object(_) => {
                nodes.extend(parse_sidebar_object(item, docs_root, depth, roots));
            }
            _ => {}
        }
    }
    nodes
}

fn parse_sidebar_object(
    item: &StaticValue,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let item_type = object_property(item, "type").and_then(static_string);
    match item_type {
        Some("doc") | Some("ref") => object_property(item, "id")
            .and_then(static_string)
            .map(|id| {
                vec![doc_id_node(
                    object_property(item, "label")
                        .and_then(static_string)
                        .map(str::to_string)
                        .unwrap_or_else(|| display_title_from_path(id)),
                    id,
                    docs_root,
                    depth,
                    roots,
                )]
            })
            .unwrap_or_default(),
        Some("category") => object_property(item, "label")
            .and_then(static_string)
            .map(|label| {
                let children = object_property(item, "items")
                    .and_then(static_array)
                    .map(|items| parse_sidebar_items(items, docs_root, depth + 1, roots))
                    .unwrap_or_default();
                let mut section_children = Vec::new();
                if let Some(link_doc_id) = category_link_doc_id(item) {
                    section_children.push(doc_id_node(
                        label.to_string(),
                        link_doc_id,
                        docs_root,
                        depth + 1,
                        roots,
                    ));
                }
                section_children.extend(children);
                vec![DocumentOrderNode::Section {
                    title: label.to_string(),
                    depth,
                    children: section_children,
                }]
            })
            .unwrap_or_default(),
        Some("autogenerated") => object_property(item, "dirName")
            .and_then(static_string)
            .map(|dir_name| generated_dir_nodes(docs_root, dir_name, depth, roots))
            .unwrap_or_default(),
        Some("link") | Some("html") => Vec::new(),
        Some(_) => Vec::new(),
        None => parse_category_shorthand(item, docs_root, depth, roots),
    }
}

fn parse_category_shorthand(
    item: &StaticValue,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let StaticValue::Object(entries) = item else {
        return Vec::new();
    };
    entries
        .iter()
        .filter_map(|(title, value)| {
            let children = sidebar_children(value, docs_root, depth + 1, roots);
            (!children.is_empty()).then(|| DocumentOrderNode::Section {
                title: title.to_string(),
                depth,
                children,
            })
        })
        .collect()
}

fn category_link_doc_id(item: &StaticValue) -> Option<&str> {
    let link = object_property(item, "link")?;
    if object_property(link, "type").and_then(static_string) != Some("doc") {
        return None;
    }
    object_property(link, "id").and_then(static_string)
}

fn generated_dir_nodes(
    docs_root: &Path,
    dir_name: &str,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    if is_external_or_unsafe_doc_id(dir_name) {
        return Vec::new();
    }
    let dir = normalize_document_order_target_path(&docs_root.join(dir_name));
    if ensure_path_allowed(&dir, roots).is_err() || !dir.is_dir() {
        return Vec::new();
    }
    generated_nodes_for_dir(&dir, docs_root, depth, roots)
}

fn generated_nodes_for_dir(
    dir: &Path,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut entries = Vec::new();
    let Ok(read_dir) = fs::read_dir(dir) else {
        return Vec::new();
    };
    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || is_category_metadata_file(&name) {
            continue;
        }
        if path.is_dir() {
            let metadata = category_metadata(&path);
            let title = metadata.label.clone().unwrap_or_else(|| name.clone());
            let mut children = Vec::new();
            if let Some(doc_id) = metadata.link_doc_id.as_deref() {
                children.push(doc_id_node(
                    title.clone(),
                    doc_id,
                    docs_root,
                    depth + 1,
                    roots,
                ));
            } else if let Some(index_doc) = category_index_doc(&path) {
                children.push(document_path_node(
                    title.clone(),
                    &index_doc,
                    docs_root,
                    depth + 1,
                    roots,
                ));
            }
            children.extend(generated_nodes_for_dir(&path, docs_root, depth + 1, roots));
            if !children.is_empty() {
                entries.push(GeneratedEntry {
                    name,
                    position: metadata.position,
                    node: DocumentOrderNode::Section {
                        title,
                        depth,
                        children,
                    },
                });
            }
        } else if is_markdown_document(&path) && !is_nested_category_index(&path, docs_root) {
            let metadata = document_metadata(&path);
            let title = metadata
                .label
                .clone()
                .unwrap_or_else(|| display_title_from_path(&name));
            entries.push(GeneratedEntry {
                name,
                position: metadata.position,
                node: document_path_node(title, &path, docs_root, depth, roots),
            });
        }
    }
    entries.sort_by(|left, right| compare_generated_entries(left, right));
    entries.into_iter().map(|entry| entry.node).collect()
}

fn compare_generated_entries(left: &GeneratedEntry, right: &GeneratedEntry) -> Ordering {
    match (left.position, right.position) {
        (Some(left), Some(right)) => left.partial_cmp(&right).unwrap_or(Ordering::Equal),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => left.name.cmp(&right.name),
    }
    .then_with(|| left.name.cmp(&right.name))
}

fn doc_id_node(
    title: String,
    doc_id: &str,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    let display_path = doc_id.to_string();
    let Some(candidate) = doc_id_candidate(doc_id, docs_root) else {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path,
            depth,
            status: DocumentOrderDocumentStatus::External,
        };
    };
    document_candidate_node(title, display_path, &candidate, depth, roots)
}

fn document_path_node(
    title: String,
    path: &Path,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    let display_path = path
        .strip_prefix(docs_root)
        .ok()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });
    document_candidate_node(
        title,
        display_path,
        &normalize_document_order_target_path(path),
        depth,
        roots,
    )
}

fn document_candidate_node(
    title: String,
    display_path: String,
    candidate: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    if ensure_path_allowed(candidate, roots).is_err() {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path,
            depth,
            status: DocumentOrderDocumentStatus::Unsupported,
        };
    }
    if candidate.is_file() {
        return DocumentOrderNode::Document {
            title,
            path: path_to_ui_string(candidate),
            display_path,
            depth,
            status: DocumentOrderDocumentStatus::Resolved,
        };
    }
    DocumentOrderNode::Document {
        title,
        path: String::new(),
        display_path,
        depth,
        status: DocumentOrderDocumentStatus::Missing,
    }
}

fn doc_id_candidate(doc_id: &str, docs_root: &Path) -> Option<PathBuf> {
    if is_external_or_unsafe_doc_id(doc_id) {
        return None;
    }
    let doc_id = doc_id.split(['#', '?']).next().unwrap_or_default().trim();
    if doc_id.is_empty() {
        return None;
    }
    let doc_id = doc_id.trim_start_matches('/');
    let base = docs_root.join(doc_id);
    candidate_documents(&base)
        .into_iter()
        .find(|path| path.is_file())
        .or_else(|| candidate_documents(&base).into_iter().next())
}

fn candidate_documents(base: &Path) -> Vec<PathBuf> {
    if base.extension().is_some() {
        return is_markdown_document(base)
            .then(|| normalize_document_order_target_path(base))
            .into_iter()
            .collect();
    }
    let mut candidates = Vec::new();
    for extension in DOC_EXTENSIONS {
        candidates.push(normalize_document_order_target_path(
            &base.with_extension(extension),
        ));
    }
    for name in ["index", "README"] {
        for extension in DOC_EXTENSIONS {
            candidates.push(normalize_document_order_target_path(
                &base.join(format!("{name}.{extension}")),
            ));
        }
    }
    candidates
}

fn category_index_doc(dir: &Path) -> Option<PathBuf> {
    let folder_name = dir.file_name()?.to_string_lossy().to_string();
    ["index".to_string(), "README".to_string(), folder_name]
        .into_iter()
        .flat_map(|name| {
            DOC_EXTENSIONS
                .iter()
                .map(move |extension| dir.join(format!("{name}.{extension}")))
        })
        .find(|path| path.is_file())
        .map(|path| normalize_document_order_target_path(&path))
}

fn is_category_index_for_parent(path: &Path) -> bool {
    let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
        return false;
    };
    let parent_name = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    stem.eq_ignore_ascii_case("index") || stem.eq_ignore_ascii_case("readme") || stem == parent_name
}

fn is_nested_category_index(path: &Path, docs_root: &Path) -> bool {
    path.parent().is_some_and(|parent| parent != docs_root) && is_category_index_for_parent(path)
}

fn is_markdown_document(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("mdx")
        })
}

fn category_metadata(dir: &Path) -> EntryMetadata {
    for file_name in ["_category_.json", "_category_.yml", "_category_.yaml"] {
        let path = dir.join(file_name);
        if !path.is_file() {
            continue;
        }
        if let Some(metadata) = metadata_from_file(&path) {
            return metadata;
        }
    }
    EntryMetadata {
        label: None,
        position: None,
        link_doc_id: None,
    }
}

fn document_metadata(path: &Path) -> EntryMetadata {
    let Ok(source) = fs::read_to_string(path) else {
        return empty_metadata();
    };
    let Some(frontmatter) = frontmatter_yaml(&source) else {
        return empty_metadata();
    };
    yaml_metadata(frontmatter)
}

fn metadata_from_file(path: &Path) -> Option<EntryMetadata> {
    let source = fs::read_to_string(path).ok()?;
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
    {
        let value: serde_json::Value = serde_json::from_str(&source).ok()?;
        return Some(json_metadata(&value));
    }
    Some(yaml_metadata(&source))
}

fn json_metadata(value: &serde_json::Value) -> EntryMetadata {
    let label = value
        .get("label")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let position = value.get("position").and_then(serde_json::Value::as_f64);
    let link_doc_id = value
        .get("link")
        .and_then(|link| {
            (link.get("type").and_then(serde_json::Value::as_str) == Some("doc"))
                .then(|| link.get("id").and_then(serde_json::Value::as_str))
                .flatten()
        })
        .map(str::to_string);
    EntryMetadata {
        label,
        position,
        link_doc_id,
    }
}

fn yaml_metadata(source: &str) -> EntryMetadata {
    let Ok(value) = serde_norway::from_str::<YamlValue>(source) else {
        return empty_metadata();
    };
    let Some(mapping) = value.as_mapping() else {
        return empty_metadata();
    };
    let label = mapping
        .get(&YamlValue::String("label".to_string()))
        .or_else(|| mapping.get(&YamlValue::String("sidebar_label".to_string())))
        .and_then(YamlValue::as_str)
        .map(str::to_string);
    let position = mapping
        .get(&YamlValue::String("position".to_string()))
        .or_else(|| mapping.get(&YamlValue::String("sidebar_position".to_string())))
        .and_then(YamlValue::as_f64);
    let link_doc_id = mapping
        .get(&YamlValue::String("link".to_string()))
        .and_then(YamlValue::as_mapping)
        .and_then(|link| {
            (link
                .get(&YamlValue::String("type".to_string()))
                .and_then(YamlValue::as_str)
                == Some("doc"))
            .then(|| {
                link.get(&YamlValue::String("id".to_string()))
                    .and_then(YamlValue::as_str)
            })
            .flatten()
        })
        .map(str::to_string);
    EntryMetadata {
        label,
        position,
        link_doc_id,
    }
}

fn frontmatter_yaml(source: &str) -> Option<&str> {
    let source = source.strip_prefix("---\n")?;
    let end = source.find("\n---")?;
    Some(&source[..end])
}

fn empty_metadata() -> EntryMetadata {
    EntryMetadata {
        label: None,
        position: None,
        link_doc_id: None,
    }
}

fn is_category_metadata_file(name: &str) -> bool {
    matches!(
        name,
        "_category_.json" | "_category_.yml" | "_category_.yaml"
    )
}

fn is_external_or_unsafe_doc_id(target: &str) -> bool {
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("//")
        || target.contains("://")
        || target.contains('\\')
        || looks_like_windows_drive_path(target)
        || Path::new(target).is_absolute()
}

fn looks_like_windows_drive_path(target: &str) -> bool {
    let bytes = target.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

fn sidebar_title(sidebar_id: &str) -> String {
    let title = sidebar_id.trim();
    if title.is_empty() {
        "Docusaurus".to_string()
    } else {
        title.replace(['-', '_'], " ")
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
    fn parses_static_sidebars_with_common_item_types() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(docs.join("guide")).expect("guide dir");
        fs::write(docs.join("intro.md"), "# Intro").expect("intro");
        fs::write(docs.join("guide").join("setup.mdx"), "# Setup").expect("setup");
        fs::write(
            dir.path().join("sidebars.ts"),
            "const sidebars = { docs: ['intro', { type: 'category', label: 'Guide', link: { type: 'doc', id: 'guide/setup' }, items: [{ type: 'doc', id: 'guide/missing', label: 'Missing' }, { type: 'link', label: 'External', href: 'https://example.invalid' }] }] }; export default sidebars;",
        )
        .expect("sidebars");

        let result = load_docusaurus_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Docusaurus);
        let DocumentOrderNode::Section { children, .. } = &result.nodes[0] else {
            panic!("expected sidebar section");
        };
        assert!(matches!(
            &children[0],
            DocumentOrderNode::Document {
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            }
        ));
        let DocumentOrderNode::Section {
            title,
            children: guide_children,
            ..
        } = &children[1]
        else {
            panic!("expected category");
        };
        assert_eq!(title, "Guide");
        assert_eq!(guide_children.len(), 2);
        assert!(matches!(
            &guide_children[1],
            DocumentOrderNode::Document {
                status: DocumentOrderDocumentStatus::Missing,
                ..
            }
        ));
    }

    #[test]
    fn expands_autogenerated_sidebar_with_metadata_order() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(docs.join("guide")).expect("guide dir");
        fs::write(docs.join("index.md"), "# Home").expect("home");
        fs::write(
            docs.join("guide").join("_category_.json"),
            r#"{"label":"Guide","position":1}"#,
        )
        .expect("category");
        fs::write(docs.join("guide").join("index.md"), "# Guide").expect("index");
        fs::write(
            docs.join("guide").join("later.md"),
            "---\nsidebar_position: 2\nsidebar_label: Later\n---\n# Later",
        )
        .expect("later");
        fs::write(
            docs.join("guide").join("first.mdx"),
            "---\nsidebar_position: 1\nsidebar_label: First\n---\n# First",
        )
        .expect("first");
        fs::write(
            dir.path().join("sidebars.js"),
            "module.exports = { docs: [{ type: 'autogenerated', dirName: '.' }] };",
        )
        .expect("sidebars");

        let result = load_docusaurus_order_from_root(dir.path(), &roots_for(dir.path()));
        let serialized = serde_json::to_string(&result).expect("serialize");

        assert_eq!(result.source, DocumentOrderSource::Docusaurus);
        assert!(serialized.contains("Guide"));
        assert!(serialized.contains("index.md"));
        assert!(serialized.find("First").unwrap() < serialized.find("Later").unwrap());
        assert!(!serialized.contains("sidebars.js"));
    }

    #[test]
    fn reads_static_docusaurus_config_path_and_sidebar_path() {
        let dir = tempdir().expect("tempdir");
        let content = dir.path().join("content");
        fs::create_dir_all(&content).expect("content dir");
        fs::write(content.join("intro.md"), "# Intro").expect("intro");
        fs::write(
            dir.path().join("docs.sidebars.ts"),
            "export default { docs: ['intro'] }",
        )
        .expect("sidebars");
        fs::write(
            dir.path().join("docusaurus.config.ts"),
            "export default { presets: [['classic', { docs: { path: 'content', sidebarPath: './docs.sidebars.ts' } }]] }",
        )
        .expect("config");

        let result = load_docusaurus_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Docusaurus);
        let serialized = serde_json::to_string(&result).expect("serialize");
        assert!(serialized.contains("intro.md"));
        assert!(!serialized.contains("docusaurus.config"));
    }

    #[test]
    fn rejects_dynamic_sidebars_without_executing_code() {
        let dir = tempdir().expect("tempdir");
        fs::write(
            dir.path().join("sidebars.mjs"),
            "export default generateSidebars();",
        )
        .expect("sidebars");

        let result = load_docusaurus_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("Docusaurus sidebars are not configured as a static value.")
        );
    }
}
