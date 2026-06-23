use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};

use crate::backend_types::AllowedRoots;
use crate::backend_types::{
    AsciiDocIncludeFile, AsciiDocIncludeGraph, AsciiDocIncludeGraphEdge, AsciiDocIncludeGraphNode,
    AsciiDocIncludeGraphSourceLocation,
};
use crate::path_policy::{
    display_safe_path, ensure_path_allowed, normalize_path, path_to_ui_string,
    resolve_existing_directory_path, resolve_existing_file_path,
};

const MAX_INCLUDE_FILE_BYTES: u64 = 1_048_576;
const MAX_INCLUDE_FILES: usize = 64;
const MAX_INCLUDE_TOTAL_BYTES: u64 = 4 * 1_048_576;

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

fn is_supported_include_text(source: &str) -> bool {
    !source.contains('\0')
}

fn is_recursive_include_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("adoc" | "asciidoc" | "asc")
    )
}
