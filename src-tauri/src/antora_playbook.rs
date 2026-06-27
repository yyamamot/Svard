use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use serde_norway::Value;

use crate::{
    backend_types::{AllowedRoots, AntoraContextSourceKind, AntoraPlaybookContextSummary},
    document_order_common::{
        is_external_or_absolute_target, mapping_get, normalize_document_order_target_path,
    },
    path_policy::{ensure_path_allowed, path_to_ui_string},
};

const ANTORA_PLAYBOOK_NAMES: [&str; 2] = ["antora-playbook.yml", "antora-playbook.yaml"];

pub(crate) fn discover_antora_playbook_content_roots(
    root: &Path,
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
    discover_antora_playbook_contexts(root, roots)
        .into_iter()
        .flat_map(|context| context.content_roots)
        .collect()
}

pub(crate) fn discover_antora_playbook_context_summaries(
    root: &Path,
    roots: &AllowedRoots,
    selected_context_id: Option<&str>,
) -> (
    Vec<AntoraPlaybookContextSummary>,
    Option<AntoraPlaybookContextSummary>,
) {
    let contexts = discover_antora_playbook_contexts(root, roots);
    let selected_context = select_antora_context(&contexts, selected_context_id)
        .map(|context| context.summary.clone());
    (
        contexts
            .iter()
            .map(|context| context.summary.clone())
            .collect(),
        selected_context,
    )
}

pub(crate) fn selected_antora_content_roots(
    root: &Path,
    roots: &AllowedRoots,
    selected_context_id: Option<&str>,
) -> Vec<PathBuf> {
    let contexts = discover_antora_playbook_contexts(root, roots);
    select_antora_context(&contexts, selected_context_id)
        .map(|context| context.content_roots.clone())
        .unwrap_or_default()
}

pub(crate) fn discover_antora_playbook_contexts(
    root: &Path,
    roots: &AllowedRoots,
) -> Vec<AntoraPlaybookContext> {
    let root = normalize_document_order_target_path(root);
    let mut contexts: Vec<AntoraPlaybookContext> = ANTORA_PLAYBOOK_NAMES
        .iter()
        .enumerate()
        .flat_map(|(playbook_index, name)| {
            contexts_from_playbook(&root.join(name), &root, roots, playbook_index)
        })
        .collect();
    if root.join("antora.yml").is_file() {
        push_unique_context(
            &mut contexts,
            AntoraPlaybookContext::component_only(root.clone(), &root),
        );
    }
    contexts.sort_by(|left, right| {
        left.priority
            .cmp(&right.priority)
            .then_with(|| left.summary.label.cmp(&right.summary.label))
            .then_with(|| left.summary.context_id.cmp(&right.summary.context_id))
    });
    contexts
}

pub(crate) fn antora_static_asciidoc_attributes_for_document(
    document_path: &Path,
    workspace_root: &Path,
    roots: Option<&AllowedRoots>,
    selected_context_id: Option<&str>,
) -> BTreeMap<String, String> {
    let Some(roots) = roots else {
        return BTreeMap::new();
    };
    let document_path = normalize_document_order_target_path(document_path);
    let workspace_root = normalize_document_order_target_path(workspace_root);
    for root in antora_attribute_workspace_roots(&document_path, &workspace_root, roots) {
        let contexts = discover_antora_playbook_contexts(&root, roots);
        let matching_contexts = contexts
            .iter()
            .filter(|context| context.content_root_for_document(&document_path).is_some())
            .collect::<Vec<_>>();
        if let Some(context) = selected_context_id
            .and_then(|selected_context_id| {
                matching_contexts
                    .iter()
                    .copied()
                    .find(|context| context.summary.context_id == selected_context_id)
            })
            .or_else(|| matching_contexts.first().copied())
        {
            if let Some(content_root) = context.content_root_for_document(&document_path) {
                let mut attributes = context.attributes.clone();
                attributes.extend(read_component_attributes(content_root));
                return attributes;
            }
        }
    }
    let Some(content_root) = antora_content_root_for_document(&document_path, roots) else {
        return BTreeMap::new();
    };
    read_component_attributes(&content_root)
}

#[derive(Clone)]
pub(crate) struct AntoraPlaybookContext {
    pub(crate) summary: AntoraPlaybookContextSummary,
    pub(crate) content_roots: Vec<PathBuf>,
    pub(crate) attributes: BTreeMap<String, String>,
    priority: (usize, usize),
}

impl AntoraPlaybookContext {
    fn from_playbook(
        playbook_path: PathBuf,
        content_roots: Vec<PathBuf>,
        workspace_root: &Path,
        attributes: BTreeMap<String, String>,
        playbook_index: usize,
    ) -> Self {
        let context_id = context_id(
            Some(&playbook_path),
            &content_roots,
            workspace_root,
            AntoraContextSourceKind::StandardPlaybook,
        );
        let label = context_label(Some(&playbook_path), &content_roots, workspace_root);
        Self {
            summary: AntoraPlaybookContextSummary {
                context_id,
                playbook_path: Some(display_relative_path(&playbook_path, workspace_root)),
                content_root: content_roots_label(&content_roots, workspace_root),
                source_kind: AntoraContextSourceKind::StandardPlaybook,
                label,
            },
            content_roots,
            attributes,
            priority: (playbook_path.components().count(), playbook_index),
        }
    }

    fn component_only(content_root: PathBuf, workspace_root: &Path) -> Self {
        let context_id = context_id(
            None,
            std::slice::from_ref(&content_root),
            workspace_root,
            AntoraContextSourceKind::ComponentOnly,
        );
        Self {
            summary: AntoraPlaybookContextSummary {
                context_id,
                playbook_path: None,
                content_root: display_relative_path(&content_root, workspace_root),
                source_kind: AntoraContextSourceKind::ComponentOnly,
                label: format!(
                    "Component: {}",
                    display_relative_path(&content_root, workspace_root)
                ),
            },
            content_roots: vec![content_root],
            attributes: BTreeMap::new(),
            priority: (usize::MAX, usize::MAX),
        }
    }

    fn content_root_for_document(&self, document_path: &Path) -> Option<&PathBuf> {
        self.content_roots
            .iter()
            .find(|content_root| is_antora_module_page(document_path, content_root))
    }
}

pub(crate) fn select_antora_context<'a>(
    contexts: &'a [AntoraPlaybookContext],
    selected_context_id: Option<&str>,
) -> Option<&'a AntoraPlaybookContext> {
    if let Some(selected_context_id) = selected_context_id {
        if let Some(context) = contexts
            .iter()
            .find(|context| context.summary.context_id == selected_context_id)
        {
            return Some(context);
        }
    }
    contexts.first()
}

fn contexts_from_playbook(
    playbook_path: &Path,
    workspace_root: &Path,
    roots: &AllowedRoots,
    playbook_index: usize,
) -> Vec<AntoraPlaybookContext> {
    let Some(playbook) = read_playbook(playbook_path, roots) else {
        return Vec::new();
    };
    if playbook.content_roots.is_empty() {
        return Vec::new();
    }
    vec![AntoraPlaybookContext::from_playbook(
        playbook_path.to_path_buf(),
        playbook.content_roots,
        workspace_root,
        playbook.attributes,
        playbook_index,
    )]
}

fn push_unique_context(contexts: &mut Vec<AntoraPlaybookContext>, context: AntoraPlaybookContext) {
    if !contexts
        .iter()
        .any(|current| current.summary.context_id == context.summary.context_id)
    {
        contexts.push(context);
    }
}

fn context_id(
    playbook_path: Option<&Path>,
    content_roots: &[PathBuf],
    workspace_root: &Path,
    source_kind: AntoraContextSourceKind,
) -> String {
    let source = match source_kind {
        AntoraContextSourceKind::StandardPlaybook => "standard-playbook",
        AntoraContextSourceKind::ComponentOnly => "component-only",
    };
    let playbook = playbook_path
        .map(|path| display_relative_path(path, workspace_root))
        .unwrap_or_else(|| "component".to_string());
    let roots = content_roots_label(content_roots, workspace_root);
    format!("{source}:{}:{}", slug_path(&playbook), slug_path(&roots))
}

fn context_label(
    playbook_path: Option<&Path>,
    content_roots: &[PathBuf],
    workspace_root: &Path,
) -> String {
    let playbook = playbook_path
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .unwrap_or("antora-playbook");
    format!(
        "{} ({})",
        playbook,
        content_roots_label(content_roots, workspace_root)
    )
}

fn content_roots_label(content_roots: &[PathBuf], workspace_root: &Path) -> String {
    if content_roots.len() == 1 {
        return display_relative_path(&content_roots[0], workspace_root);
    }
    format!("{} content roots", content_roots.len())
}

fn display_relative_path(path: &Path, workspace_root: &Path) -> String {
    path.strip_prefix(workspace_root)
        .ok()
        .filter(|relative| !relative.as_os_str().is_empty())
        .map(path_to_ui_string)
        .unwrap_or_else(|| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(str::to_string)
                .unwrap_or_else(|| "antora-context".to_string())
        })
}

fn slug_path(path: &str) -> String {
    path.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

struct ParsedAntoraPlaybook {
    content_roots: Vec<PathBuf>,
    attributes: BTreeMap<String, String>,
}

fn read_playbook(playbook_path: &Path, roots: &AllowedRoots) -> Option<ParsedAntoraPlaybook> {
    let workspace_root = playbook_path.parent()?;
    if !playbook_path.is_file() {
        return None;
    }
    let source = fs::read_to_string(playbook_path).ok()?;
    let parsed: Value = serde_norway::from_str(&source).ok()?;
    let mapping = parsed.as_mapping()?;
    let attributes = static_asciidoc_attributes(mapping);
    Some(ParsedAntoraPlaybook {
        content_roots: playbook_content_roots(mapping, workspace_root, roots),
        attributes,
    })
}

fn playbook_content_roots(
    mapping: &serde_norway::Mapping,
    workspace_root: &Path,
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
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

fn antora_attribute_workspace_roots(
    document_path: &Path,
    workspace_root: &Path,
    roots: &AllowedRoots,
) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    push_unique(&mut candidates, workspace_root);
    if let Ok(guard) = roots.0.lock() {
        for root in guard.iter() {
            if document_path.starts_with(root) || workspace_root.starts_with(root) {
                push_unique(&mut candidates, root);
            }
        }
    }
    candidates
}

fn antora_content_root_for_document(document_path: &Path, roots: &AllowedRoots) -> Option<PathBuf> {
    let mut current = document_path.parent()?;
    loop {
        if let Some(content_root) = antora_content_root(current, roots) {
            if is_antora_module_page(document_path, &content_root) {
                return Some(content_root);
            }
        }
        current = current.parent()?;
    }
}

fn is_antora_module_page(document_path: &Path, content_root: &Path) -> bool {
    let Ok(relative) = document_path.strip_prefix(content_root) else {
        return false;
    };
    let segments = relative
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect::<Vec<_>>();
    segments.len() >= 4 && segments[0] == "modules" && segments[2] == "pages"
}

fn read_component_attributes(content_root: &Path) -> BTreeMap<String, String> {
    let source = match fs::read_to_string(content_root.join("antora.yml")) {
        Ok(source) => source,
        Err(_) => return BTreeMap::new(),
    };
    let parsed: Value = match serde_norway::from_str(&source) {
        Ok(parsed) => parsed,
        Err(_) => return BTreeMap::new(),
    };
    parsed
        .as_mapping()
        .map(static_asciidoc_attributes)
        .unwrap_or_default()
}

fn static_asciidoc_attributes(mapping: &serde_norway::Mapping) -> BTreeMap<String, String> {
    let Some(asciidoc) = mapping_get(mapping, "asciidoc").and_then(Value::as_mapping) else {
        return BTreeMap::new();
    };
    let Some(attributes) = mapping_get(asciidoc, "attributes").and_then(Value::as_mapping) else {
        return BTreeMap::new();
    };
    attributes
        .iter()
        .filter_map(|(key, value)| {
            let name = key.as_str()?.trim();
            if !is_static_attribute_name(name) {
                return None;
            }
            static_attribute_value(value).map(|value| (name.to_string(), value))
        })
        .collect()
}

fn is_static_attribute_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('!')
        && !name.ends_with('!')
        && !name
            .chars()
            .any(|ch| ch == ':' || ch.is_control() || ch.is_whitespace())
}

fn static_attribute_value(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(true) => Some(String::new()),
        _ => None,
    }
}

fn push_unique(paths: &mut Vec<PathBuf>, path: &Path) {
    let path = normalize_document_order_target_path(path);
    if !paths.iter().any(|existing| existing == &path) {
        paths.push(path);
    }
}
