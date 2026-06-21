use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    fs,
    path::{Path, PathBuf},
};

use crate::app_error::AppError;
use crate::backend_types::AllowedRoots;
use crate::backend_types::{
    AsciiDocIncludeFile, AsciiDocIncludeGraph, AsciiDocIncludeGraphEdge, AsciiDocIncludeGraphNode,
    AsciiDocIncludeGraphSourceLocation, AsciiDocRenderContext, DirectoryEntry, DocumentPayload,
    DocumentResourceContext, EntryKind, WorkspaceSearchInput, WorkspaceSearchResult,
    WorkspaceSearchResultItem,
};
use crate::path_policy::{
    antora_module_root_for_page, display_safe_path, ensure_path_allowed,
    fallback_allowed_root_for_file, normalize_path, path_for_policy, path_to_ui_string,
    resolve_existing_directory_path, resolve_existing_file_path,
};
use crate::perf_trace;

const MAX_INCLUDE_FILE_BYTES: u64 = 1_048_576;
const MAX_INCLUDE_FILES: usize = 64;
const MAX_INCLUDE_TOTAL_BYTES: u64 = 4 * 1_048_576;
const MAX_DOCUMENT_SOURCE_BYTES: u64 = 32 * 1_048_576;
const WORKSPACE_SEARCH_MAX_DIRECTORIES: usize = 10_000;
const WORKSPACE_SEARCH_MIN_SCANNED_ENTRIES: usize = 200;
const WORKSPACE_SEARCH_MAX_SCANNED_ENTRIES: usize = 20_000;
const WORKSPACE_SEARCH_EXCLUDED_DIRS: &[&str] = &[
    ".artifacts",
    ".codegraph",
    ".git",
    "dist",
    "node_modules",
    "playwright-report",
    "target",
    "test-results",
];

#[cfg(test)]
pub(crate) fn open_document_from_path(path: &str) -> Result<DocumentPayload, String> {
    let document_path = normalize_document_path(path)?;
    open_document_from_canonical_path_with_roots(&document_path, None)
}

pub(crate) fn open_document_from_canonical_path_with_roots(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
) -> Result<DocumentPayload, String> {
    let document_path_string = path_to_ui_string(document_path);

    if let Ok(metadata) = fs::metadata(document_path) {
        if metadata.len() > MAX_DOCUMENT_SOURCE_BYTES {
            return Err(format!(
                "document is too large to open safely: {}",
                display_safe_path(document_path)
            ));
        }
    }

    let read_started_at = perf_trace::start();
    let source = fs::read_to_string(&document_path).map_err(|error| {
        format!(
            "failed to read {}: {error}",
            display_safe_path(&document_path)
        )
    })?;
    let basename = perf_trace::basename(document_path);
    perf_trace::log(
        "open_document.fs.read_to_string",
        &[
            ("basename", basename.clone()),
            ("bytes", source.len().to_string()),
            (
                "durationMs",
                format!("{:.2}", perf_trace::duration_ms(read_started_at)),
            ),
        ],
    );

    let updated_at = document_updated_at(&document_path_string);
    let format = document_format_for_path(&document_path_string).to_string();
    let resource_context = build_document_resource_context(&document_path, roots);
    let asciidoc_context = if format == "asciidoc" {
        let context_started_at = perf_trace::start();
        let context = build_asciidoc_render_context(&source, &resource_context);
        perf_trace::log(
            "open_document.build_asciidoc_render_context",
            &[
                ("basename", basename.clone()),
                (
                    "durationMs",
                    format!("{:.2}", perf_trace::duration_ms(context_started_at)),
                ),
            ],
        );
        Some(context)
    } else {
        perf_trace::log(
            "open_document.build_asciidoc_render_context.skipped",
            &[("basename", basename.clone()), ("format", format.clone())],
        );
        None
    };
    let (include_files, include_graph) = if let Some(context) = &asciidoc_context {
        let include_started_at = perf_trace::start();
        let (include_files, include_graph) = collect_asciidoc_include_files_and_graph_with_base(
            &document_path,
            &source,
            roots,
            &PathBuf::from(&context.base_dir),
        );
        perf_trace::log(
            "open_document.collect_asciidoc_include_files",
            &[
                ("basename", basename.clone()),
                ("count", include_files.len().to_string()),
                (
                    "durationMs",
                    format!("{:.2}", perf_trace::duration_ms(include_started_at)),
                ),
            ],
        );
        (include_files, Some(include_graph))
    } else {
        perf_trace::log(
            "open_document.collect_asciidoc_include_files.skipped",
            &[("basename", basename.clone()), ("format", format.clone())],
        );
        (Vec::new(), None)
    };

    Ok(DocumentPayload {
        path: document_path_string.clone(),
        base_path: document_path
            .parent()
            .map(path_to_ui_string)
            .unwrap_or_else(|| ".".to_string()),
        format,
        source,
        updated_at,
        include_files,
        include_graph,
        resource_context,
        asciidoc_context,
    })
}

pub(crate) fn normalize_document_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    let normalized = resolve_existing_file_path(&raw_path)?;

    if !is_supported_document_file(&normalized) {
        return Err("only supported markup documents can be opened".to_string());
    }

    Ok(normalized)
}

pub(crate) fn collect_asciidoc_include_files_and_graph_with_base(
    document_path: &Path,
    source: &str,
    roots: Option<&AllowedRoots>,
    base_root: &Path,
) -> (Vec<AsciiDocIncludeFile>, AsciiDocIncludeGraph) {
    let mut visited = BTreeSet::new();
    let mut files = Vec::new();
    let mut total_bytes = 0;
    let mut attributes = asciidoc_attributes(source);
    let mut graph = IncludeGraphBuilder::new(document_path);
    let mut stack = vec![path_to_ui_string(document_path)];
    collect_asciidoc_include_files_inner(
        document_path,
        source,
        base_root,
        roots,
        &mut visited,
        &mut files,
        &mut total_bytes,
        0,
        &mut attributes,
        &mut graph,
        "root",
        &mut stack,
    );
    (files, graph.finish())
}

pub(crate) fn build_document_resource_context(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
) -> DocumentResourceContext {
    let document_dir = document_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let workspace_root = static_asset_allowed_root_for_document(document_path, roots)
        .or_else(|| static_site_root_for_document(document_path))
        .or_else(|| explicit_allowed_root_for_document(document_path, roots))
        .or_else(|| fallback_allowed_root_for_file(document_path))
        .unwrap_or_else(|| document_dir.clone());
    let mut resource_roots = Vec::new();
    push_unique_path(&mut resource_roots, &workspace_root);
    for root in allowed_roots_for_document(document_path, roots) {
        push_unique_path(&mut resource_roots, &root);
    }
    if let Some(static_site_root) = static_site_root_for_document(document_path) {
        push_unique_path(&mut resource_roots, &static_site_root);
    }
    if let Some(module_root) = antora_module_root_for_page(document_path) {
        push_unique_path(&mut resource_roots, &module_root);
    }
    push_unique_path(&mut resource_roots, &document_dir);

    DocumentResourceContext {
        workspace_root: path_to_ui_string(&workspace_root),
        document_dir: path_to_ui_string(&document_dir),
        resource_roots,
    }
}

pub(crate) fn build_asciidoc_render_context(
    source: &str,
    resource_context: &DocumentResourceContext,
) -> AsciiDocRenderContext {
    AsciiDocRenderContext {
        base_dir: resource_context.workspace_root.clone(),
        workspace_root: resource_context.workspace_root.clone(),
        document_dir: resource_context.document_dir.clone(),
        attributes: asciidoc_attributes(source),
        resource_roots: resource_context.resource_roots.clone(),
    }
}

pub(crate) fn explicit_allowed_root_for_document(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
) -> Option<PathBuf> {
    let roots = roots?;
    let checked_document_path = path_for_policy(document_path);
    let guard = roots.0.lock().ok()?;
    guard
        .iter()
        .filter(|root| {
            checked_document_path == root.as_path() || checked_document_path.starts_with(root)
        })
        .max_by_key(|root| root.components().count())
        .cloned()
}

pub(crate) fn allowed_roots_for_document(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
) -> Vec<PathBuf> {
    let Some(roots) = roots else {
        return Vec::new();
    };
    let checked_document_path = path_for_policy(document_path);
    let Ok(guard) = roots.0.lock() else {
        return Vec::new();
    };
    guard
        .iter()
        .filter(|root| {
            checked_document_path == root.as_path() || checked_document_path.starts_with(root)
        })
        .cloned()
        .collect()
}

fn static_asset_allowed_root_for_document(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
) -> Option<PathBuf> {
    allowed_roots_for_document(document_path, roots)
        .into_iter()
        .filter(|root| {
            ["images", "assets", "img", "static"]
                .iter()
                .any(|directory| root.join(directory).is_dir())
        })
        .min_by_key(|root| root.components().count())
}

fn static_site_root_for_document(document_path: &Path) -> Option<PathBuf> {
    let mut current = document_path.parent()?;
    loop {
        if ["images", "assets", "img", "static"]
            .iter()
            .any(|directory| current.join(directory).is_dir())
        {
            return Some(current.to_path_buf());
        }
        current = current.parent()?;
    }
}

pub(crate) fn push_unique_path(paths: &mut Vec<String>, path: &Path) {
    let value = path_to_ui_string(path);
    if !paths.iter().any(|candidate| candidate == &value) {
        paths.push(value);
    }
}

struct IncludeGraphBuilder {
    nodes: Vec<AsciiDocIncludeGraphNode>,
    edges: Vec<AsciiDocIncludeGraphEdge>,
    next_id: usize,
}

impl IncludeGraphBuilder {
    fn new(document_path: &Path) -> Self {
        Self {
            nodes: vec![AsciiDocIncludeGraphNode {
                id: "root".to_string(),
                path: Some(path_to_ui_string(document_path)),
                display_path: include_display_path(document_path),
                kind: "root".to_string(),
                status: "active".to_string(),
                reason: None,
                source_location: None,
                parent_id: None,
            }],
            edges: Vec::new(),
            next_id: 1,
        }
    }

    fn add_include(
        &mut self,
        parent_id: &str,
        display_path: String,
        path: Option<String>,
        status: &str,
        reason: Option<&str>,
        source_location: AsciiDocIncludeGraphSourceLocation,
    ) -> String {
        let id = format!("include-{}", self.next_id);
        self.next_id += 1;
        self.nodes.push(AsciiDocIncludeGraphNode {
            id: id.clone(),
            path,
            display_path,
            kind: "include".to_string(),
            status: status.to_string(),
            reason: reason.map(str::to_string),
            source_location: Some(source_location.clone()),
            parent_id: Some(parent_id.to_string()),
        });
        self.edges.push(AsciiDocIncludeGraphEdge {
            from_id: parent_id.to_string(),
            to_id: id.clone(),
            source_location: Some(source_location),
            status: status.to_string(),
        });
        id
    }

    fn finish(self) -> AsciiDocIncludeGraph {
        AsciiDocIncludeGraph {
            nodes: self.nodes,
            edges: self.edges,
        }
    }
}

fn include_display_path(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| display_safe_path(path))
}

fn include_target_display_path(target: &str) -> String {
    Path::new(target)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| target.to_string())
}

pub(crate) fn asciidoc_attributes(source: &str) -> BTreeMap<String, String> {
    let mut attributes = BTreeMap::new();
    for line in source.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(':') {
            continue;
        }
        let Some(rest) = trimmed.strip_prefix(':') else {
            continue;
        };
        let Some((name, value)) = rest.split_once(':') else {
            continue;
        };
        let name = name.trim();
        if name.is_empty() || name.starts_with('!') {
            continue;
        }
        attributes.insert(name.to_string(), value.trim().to_string());
    }
    attributes
}

fn collect_asciidoc_include_files_inner(
    current_path: &Path,
    source: &str,
    base_root: &Path,
    roots: Option<&AllowedRoots>,
    visited: &mut BTreeSet<String>,
    files: &mut Vec<AsciiDocIncludeFile>,
    total_bytes: &mut u64,
    depth: usize,
    attributes: &mut BTreeMap<String, String>,
    graph: &mut IncludeGraphBuilder,
    parent_id: &str,
    stack: &mut Vec<String>,
) {
    if depth > 12 {
        return;
    }
    let current_dir = current_path.parent().unwrap_or(base_root);
    let canonical_base = resolve_existing_directory_path(base_root)
        .unwrap_or_else(|_| normalize_path(base_root.to_path_buf()));
    let mut condition_stack: Vec<bool> = Vec::new();
    let mut in_delimited_block = false;
    for (line_index, line) in source.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        if !in_delimited_block {
            if is_asciidoc_endif(trimmed) {
                condition_stack.pop();
                continue;
            }
            if let Some(condition) = evaluate_asciidoc_condition(trimmed, attributes) {
                condition_stack.push(condition_stack.iter().all(|active| *active) && condition);
                continue;
            }
            if !condition_stack.iter().all(|active| *active) {
                if let Some(target) = include_target_from_line(trimmed, attributes) {
                    graph.add_include(
                        parent_id,
                        include_target_display_path(&target),
                        None,
                        "skipped",
                        Some("conditional"),
                        include_source_location(current_path, line_number),
                    );
                }
                continue;
            }
            apply_asciidoc_attribute_directive(trimmed, attributes);
        }
        if trimmed == "----" || trimmed == "...." {
            in_delimited_block = !in_delimited_block;
        }
        let Some(target) = include_target_from_line(trimmed, attributes) else {
            continue;
        };
        if target.is_empty() {
            continue;
        }
        if target.starts_with('/')
            || target.contains("://")
            || target.starts_with("http:")
            || target.starts_with("https:")
        {
            graph.add_include(
                parent_id,
                include_target_display_path(&target),
                None,
                "blocked",
                Some("unsafe"),
                include_source_location(current_path, line_number),
            );
            continue;
        }
        let candidate = normalize_path(current_dir.join(&target));
        let canonical = match resolve_existing_file_path(&candidate) {
            Ok(path) => path,
            Err(_) => {
                graph.add_include(
                    parent_id,
                    include_target_display_path(&target),
                    None,
                    "missing",
                    Some("missing"),
                    include_source_location(current_path, line_number),
                );
                continue;
            }
        };
        let allowed = roots
            .map(|roots| ensure_path_allowed(&canonical, roots).is_ok())
            .unwrap_or_else(|| canonical.starts_with(&canonical_base));
        if !allowed {
            graph.add_include(
                parent_id,
                include_display_path(&canonical),
                None,
                "blocked",
                Some("outside-root"),
                include_source_location(current_path, line_number),
            );
            continue;
        }
        let include_bytes = match fs::metadata(&canonical) {
            Ok(metadata) if metadata.is_file() && metadata.len() <= MAX_INCLUDE_FILE_BYTES => {
                metadata.len()
            }
            Ok(metadata) if metadata.is_file() => {
                graph.add_include(
                    parent_id,
                    include_display_path(&canonical),
                    None,
                    "blocked",
                    Some("too-large"),
                    include_source_location(current_path, line_number),
                );
                continue;
            }
            _ => {
                graph.add_include(
                    parent_id,
                    include_display_path(&canonical),
                    None,
                    "blocked",
                    Some("not-file"),
                    include_source_location(current_path, line_number),
                );
                continue;
            }
        };
        if files.len() >= MAX_INCLUDE_FILES
            || total_bytes.saturating_add(include_bytes) > MAX_INCLUDE_TOTAL_BYTES
        {
            graph.add_include(
                parent_id,
                include_display_path(&canonical),
                Some(path_to_ui_string(&canonical)),
                "depth-limit",
                Some("limit"),
                include_source_location(current_path, line_number),
            );
            return;
        }
        let resolved_source = match fs::read_to_string(&canonical) {
            Ok(content) if is_supported_include_text(&content) => Some((canonical, content)),
            Err(_) => {
                graph.add_include(
                    parent_id,
                    include_display_path(&canonical),
                    None,
                    "blocked",
                    Some("unreadable"),
                    include_source_location(current_path, line_number),
                );
                continue;
            }
            _ => {
                graph.add_include(
                    parent_id,
                    include_display_path(&canonical),
                    None,
                    "blocked",
                    Some("binary"),
                    include_source_location(current_path, line_number),
                );
                continue;
            }
        };

        let Some((resolved_path, include_source)) = resolved_source else {
            continue;
        };
        let resolved_string = path_to_ui_string(&resolved_path);
        let is_recursive = stack.iter().any(|item| item == &resolved_string);
        if !visited.insert(resolved_string.clone()) {
            if is_recursive {
                graph.add_include(
                    parent_id,
                    include_display_path(&resolved_path),
                    Some(resolved_string),
                    "recursive",
                    Some("recursive"),
                    include_source_location(current_path, line_number),
                );
            }
            continue;
        }
        let include_id = graph.add_include(
            parent_id,
            include_display_path(&resolved_path),
            Some(resolved_string.clone()),
            "active",
            None,
            include_source_location(current_path, line_number),
        );
        files.push(AsciiDocIncludeFile {
            path: resolved_string,
            source: include_source.clone(),
        });
        *total_bytes = total_bytes.saturating_add(include_bytes);
        if is_recursive_include_file(&resolved_path) {
            stack.push(path_to_ui_string(&resolved_path));
            collect_asciidoc_include_files_inner(
                &resolved_path,
                &include_source,
                base_root,
                roots,
                visited,
                files,
                total_bytes,
                depth + 1,
                attributes,
                graph,
                &include_id,
                stack,
            );
            stack.pop();
        }
    }
}

fn include_source_location(
    current_path: &Path,
    line_number: usize,
) -> AsciiDocIncludeGraphSourceLocation {
    AsciiDocIncludeGraphSourceLocation {
        source_path: Some(path_to_ui_string(current_path)),
        line: line_number,
        column: Some(1),
    }
}

fn include_target_from_line(
    trimmed: &str,
    attributes: &BTreeMap<String, String>,
) -> Option<String> {
    let rest = trimmed.strip_prefix("include::")?;
    let (target, _attributes) = rest.split_once('[')?;
    Some(substitute_asciidoc_attributes(target.trim(), attributes))
}

fn substitute_asciidoc_attributes(value: &str, attributes: &BTreeMap<String, String>) -> String {
    let mut result = String::new();
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '{' {
            result.push(ch);
            continue;
        }
        let mut name = String::new();
        let mut closed = false;
        for inner in chars.by_ref() {
            if inner == '}' {
                closed = true;
                break;
            }
            name.push(inner);
        }
        if closed {
            result.push_str(
                attributes
                    .get(name.trim())
                    .map(String::as_str)
                    .unwrap_or(""),
            );
        } else {
            result.push('{');
            result.push_str(&name);
        }
    }
    result
}

fn apply_asciidoc_attribute_directive(
    trimmed: &str,
    attributes: &mut BTreeMap<String, String>,
) -> bool {
    if let Some(rest) = trimmed.strip_prefix(":!") {
        if let Some(name) = rest.strip_suffix(':') {
            attributes.remove(name.trim());
            return true;
        }
    }
    if let Some(rest) = trimmed.strip_prefix(':') {
        if let Some(name) = rest.strip_suffix("!:") {
            attributes.remove(name.trim());
            return true;
        }
    }
    if let Some(rest) = trimmed.strip_prefix(':') {
        let Some((name, value)) = rest.split_once(':') else {
            return false;
        };
        let name = name.trim();
        if name.is_empty() || name.starts_with('!') {
            return false;
        }
        let value = substitute_asciidoc_attributes(value.trim(), attributes);
        attributes.insert(name.to_string(), value);
        return true;
    }
    false
}

fn evaluate_asciidoc_condition(
    trimmed: &str,
    attributes: &BTreeMap<String, String>,
) -> Option<bool> {
    if let Some(rest) = trimmed.strip_prefix("ifdef::") {
        let names = rest.split_once('[')?.0;
        return Some(
            names
                .split([',', '+'])
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .any(|name| attributes.contains_key(name)),
        );
    }
    if let Some(rest) = trimmed.strip_prefix("ifndef::") {
        let names = rest.split_once('[')?.0;
        return Some(
            names
                .split([',', '+'])
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .all(|name| !attributes.contains_key(name)),
        );
    }
    if let Some(rest) = trimmed.strip_prefix("ifeval::[") {
        let expression = rest.strip_suffix(']')?;
        return Some(evaluate_asciidoc_ifeval(expression, attributes));
    }
    None
}

fn evaluate_asciidoc_ifeval(expression: &str, attributes: &BTreeMap<String, String>) -> bool {
    let expression = substitute_asciidoc_attributes(expression, attributes);
    for operator in ["==", "!=", ">=", "<=", ">", "<"] {
        let Some((left, right)) = expression.split_once(operator) else {
            continue;
        };
        let left = left.trim().trim_matches(['"', '\'']);
        let right = right.trim().trim_matches(['"', '\'']);
        let left_number = left.parse::<f64>();
        let right_number = right.parse::<f64>();
        return match operator {
            "==" => left == right,
            "!=" => left != right,
            ">" => compare_asciidoc_ifeval(left, right, left_number, right_number, |a, b| a > b),
            "<" => compare_asciidoc_ifeval(left, right, left_number, right_number, |a, b| a < b),
            ">=" => compare_asciidoc_ifeval(left, right, left_number, right_number, |a, b| a >= b),
            "<=" => compare_asciidoc_ifeval(left, right, left_number, right_number, |a, b| a <= b),
            _ => false,
        };
    }
    false
}

fn compare_asciidoc_ifeval(
    left: &str,
    right: &str,
    left_number: Result<f64, std::num::ParseFloatError>,
    right_number: Result<f64, std::num::ParseFloatError>,
    numeric_compare: impl Fn(f64, f64) -> bool,
) -> bool {
    match (left_number, right_number) {
        (Ok(left), Ok(right)) => numeric_compare(left, right),
        _ => numeric_compare(
            if left > right {
                1.0
            } else if left == right {
                0.0
            } else {
                -1.0
            },
            0.0,
        ),
    }
}

fn is_asciidoc_endif(trimmed: &str) -> bool {
    trimmed.starts_with("endif::") && trimmed.ends_with("[]")
}

pub(crate) fn document_updated_at(path: &str) -> String {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

#[tauri::command]
pub(crate) fn list_directory(
    path: String,
    roots: tauri::State<AllowedRoots>,
) -> Result<Vec<DirectoryEntry>, AppError> {
    let directory_path = normalize_directory_path(&path).map_err(AppError::from)?;
    ensure_path_allowed(&directory_path, &roots).map_err(AppError::from)?;
    list_directory_from_canonical_path_with_roots(&directory_path, Some(&roots))
        .map_err(AppError::from)
}

#[cfg(test)]
pub(crate) fn list_directory_from_path(path: &str) -> Result<Vec<DirectoryEntry>, String> {
    let directory_path = normalize_directory_path(path)?;
    list_directory_from_canonical_path(&directory_path)
}

#[cfg(test)]
pub(crate) fn list_directory_from_canonical_path(
    directory_path: &Path,
) -> Result<Vec<DirectoryEntry>, String> {
    list_directory_from_canonical_path_with_roots(directory_path, None)
}

pub(crate) fn list_directory_from_canonical_path_with_roots(
    directory_path: &Path,
    roots: Option<&AllowedRoots>,
) -> Result<Vec<DirectoryEntry>, String> {
    let entries = fs::read_dir(&directory_path).map_err(|error| {
        format!(
            "failed to list {}: {error}",
            display_safe_path(&directory_path)
        )
    })?;
    let mut result = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = path_for_policy(&entry.path());
        if roots
            .map(|roots| ensure_path_allowed(&entry_path, roots).is_err())
            .unwrap_or(false)
        {
            continue;
        }
        let kind = if entry_path.is_dir() {
            EntryKind::Directory
        } else {
            EntryKind::File
        };

        if kind == EntryKind::Directory || is_supported_document_file(&entry_path) {
            result.push(DirectoryEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path_to_ui_string(&entry_path),
                kind,
            });
        }
    }

    result.sort_by(|left, right| match (&left.kind, &right.kind) {
        (EntryKind::Directory, EntryKind::File) => std::cmp::Ordering::Less,
        (EntryKind::File, EntryKind::Directory) => std::cmp::Ordering::Greater,
        _ => left.name.cmp(&right.name),
    });
    Ok(result)
}

pub(crate) fn search_workspace(
    input: WorkspaceSearchInput,
    roots: Option<&AllowedRoots>,
) -> Result<WorkspaceSearchResult, String> {
    let query = input.query.trim().to_string();
    if query.is_empty() {
        return Ok(WorkspaceSearchResult {
            status: "empty".to_string(),
            root_path: input.root_path,
            query: input.query,
            results: Vec::new(),
            total_matches: 0,
            searched_files: 0,
            skipped_files: 0,
            capped: false,
            message: Some("No search query".to_string()),
        });
    }

    let root_path = normalize_directory_path(&input.root_path)?;
    if let Some(roots) = roots {
        ensure_path_allowed(&root_path, roots)?;
    }

    let mut results = Vec::new();
    let mut total_matches = 0;
    let mut searched_files = 0;
    let mut skipped_files = 0;
    let mut capped = false;
    let mut pending = VecDeque::from([root_path.clone()]);
    let mut visited_directories = BTreeSet::from([path_to_ui_string(&root_path)]);
    let mut scanned_entries = 0usize;
    let max_scanned_entries = workspace_search_max_scanned_entries(input.max_files);
    let query_lower = query.to_lowercase();

    while let Some(directory) = pending.pop_front() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => {
                skipped_files += 1;
                continue;
            }
        };
        for entry in entries.flatten() {
            if searched_files >= input.max_files || results.len() >= input.max_matches {
                capped = true;
                break;
            }
            scanned_entries += 1;
            if scanned_entries > max_scanned_entries {
                capped = true;
                break;
            }
            let entry_path = path_for_policy(&entry.path());
            if roots
                .map(|roots| ensure_path_allowed(&entry_path, roots).is_err())
                .unwrap_or(false)
            {
                skipped_files += 1;
                continue;
            }
            let metadata = match fs::metadata(&entry_path) {
                Ok(metadata) => metadata,
                Err(_) => {
                    skipped_files += 1;
                    continue;
                }
            };
            if metadata.is_dir() {
                if is_workspace_search_excluded_dir(&entry_path) {
                    skipped_files += 1;
                    continue;
                }
                let directory_key = path_to_ui_string(&entry_path);
                if !visited_directories.insert(directory_key) {
                    skipped_files += 1;
                    continue;
                }
                if visited_directories.len() > WORKSPACE_SEARCH_MAX_DIRECTORIES {
                    capped = true;
                    break;
                }
                pending.push_back(entry_path);
                continue;
            }
            if !metadata.is_file() || !is_supported_document_file(&entry_path) {
                skipped_files += 1;
                continue;
            }
            if metadata.len() > input.max_bytes_per_file {
                skipped_files += 1;
                continue;
            }
            let source = match fs::read_to_string(&entry_path) {
                Ok(source) => source,
                Err(_) => {
                    skipped_files += 1;
                    continue;
                }
            };
            searched_files += 1;
            let path = path_to_ui_string(&entry_path);
            let file_results = search_document_source(
                &path,
                &display_path_for_workspace_search(&entry_path, &root_path),
                &source,
                &query,
                &query_lower,
                input.max_matches.saturating_sub(results.len()),
            );
            total_matches += file_results
                .iter()
                .map(|item| item.match_count)
                .sum::<usize>();
            results.extend(file_results);
        }
        if searched_files >= input.max_files || results.len() >= input.max_matches {
            capped = true;
            break;
        }
    }

    Ok(WorkspaceSearchResult {
        status: "ok".to_string(),
        root_path: path_to_ui_string(&root_path),
        query,
        message: if results.is_empty() {
            Some("No matches".to_string())
        } else {
            None
        },
        results,
        total_matches,
        searched_files,
        skipped_files,
        capped,
    })
}

fn workspace_search_max_scanned_entries(max_files: usize) -> usize {
    max_files.saturating_mul(20).clamp(
        WORKSPACE_SEARCH_MIN_SCANNED_ENTRIES,
        WORKSPACE_SEARCH_MAX_SCANNED_ENTRIES,
    )
}

fn search_document_source(
    path: &str,
    display_path: &str,
    source: &str,
    query: &str,
    query_lower: &str,
    max_matches: usize,
) -> Vec<WorkspaceSearchResultItem> {
    let mut results = Vec::new();
    let mut heading: Option<String> = None;
    for (index, line) in source.lines().enumerate() {
        if let Some(next_heading) = heading_text(line) {
            heading = Some(next_heading);
        }
        let match_count = count_matches(&line.to_lowercase(), query_lower);
        if match_count == 0 {
            continue;
        }
        let line_number = index + 1;
        results.push(WorkspaceSearchResultItem {
            path: path.to_string(),
            display_path: display_path.to_string(),
            line: line_number,
            heading: heading.clone(),
            snippet: build_workspace_search_snippet(line, query),
            match_count,
            source_reference: format!("{path}:{line_number}"),
        });
        if results.len() >= max_matches {
            break;
        }
    }
    results
}

fn is_workspace_search_excluded_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            WORKSPACE_SEARCH_EXCLUDED_DIRS
                .iter()
                .any(|item| *item == name)
        })
        .unwrap_or(false)
}

fn display_path_for_workspace_search(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .ok()
        .map(path_to_ui_string)
        .unwrap_or_else(|| path_to_ui_string(path))
}

fn count_matches(value: &str, query: &str) -> usize {
    if query.is_empty() {
        return 0;
    }
    let mut count = 0;
    let mut offset = 0;
    while offset < value.len() {
        let Some(index) = value[offset..].find(query) else {
            break;
        };
        count += 1;
        offset += index + query.len();
    }
    count
}

fn build_workspace_search_snippet(line: &str, query: &str) -> String {
    let compact = line.split_whitespace().collect::<Vec<_>>().join(" ");
    let char_count = compact.chars().count();
    if char_count <= 120 {
        return compact;
    }
    let compact_lower = compact.to_lowercase();
    let query_lower = query.to_lowercase();
    let hit_byte_index = compact_lower.find(&query_lower).unwrap_or(0);
    let hit_char_index = compact_lower[..hit_byte_index].chars().count();
    let start = hit_char_index.saturating_sub(42);
    let end = (hit_char_index + query.chars().count() + 64).min(char_count);
    format!(
        "{}{}{}",
        if start > 0 { "..." } else { "" },
        compact
            .chars()
            .skip(start)
            .take(end.saturating_sub(start))
            .collect::<String>(),
        if end < char_count { "..." } else { "" }
    )
}

fn heading_text(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let markdown = trimmed.strip_prefix('#').map(|_| {
        let marker_len = trimmed.chars().take_while(|ch| *ch == '#').count();
        (marker_len, trimmed[marker_len..].trim())
    });
    if let Some((marker_len, text)) = markdown {
        if (1..=6).contains(&marker_len) && !text.is_empty() {
            return Some(text.to_string());
        }
    }
    let asciidoc = trimmed.strip_prefix('=').map(|_| {
        let marker_len = trimmed.chars().take_while(|ch| *ch == '=').count();
        (marker_len, trimmed[marker_len..].trim())
    });
    if let Some((marker_len, text)) = asciidoc {
        if (1..=6).contains(&marker_len) && !text.is_empty() {
            return Some(text.to_string());
        }
    }
    None
}

pub(crate) fn normalize_directory_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    resolve_existing_directory_path(&raw_path)
}

pub(crate) fn document_format_for_path(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("md" | "markdown") => "markdown",
        _ => "asciidoc",
    }
}

pub(crate) fn is_supported_document_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("adoc" | "asciidoc" | "asc" | "md" | "markdown")
    )
}

pub(crate) fn is_supported_include_text(source: &str) -> bool {
    !source.contains('\0')
}

pub(crate) fn is_recursive_include_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("adoc" | "asciidoc" | "asc")
    )
}
