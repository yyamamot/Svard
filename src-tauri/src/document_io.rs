use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

use crate::antora_playbook::antora_static_asciidoc_attributes_for_document;
use crate::app_error::AppError;
use crate::backend_types::{
    AllowedRoots, AsciiDocRenderContext, DirectoryEntry, DocumentOrderCatalog,
    DocumentOrderLoadOptions, DocumentPayload, DocumentResourceContext, EntryKind,
    OpenDocumentOptions, WorkspaceSearchInput, WorkspaceSearchResult, WorkspaceSearchResultItem,
};
use crate::document_io_include::{
    asciidoc_attributes, collect_asciidoc_include_files_and_graph_with_attributes,
};
use crate::document_order::load_document_order_from_root_with_options;
use crate::path_policy::{
    antora_module_root_for_page, display_safe_path, ensure_path_allowed,
    fallback_allowed_root_for_file, path_for_policy, path_to_ui_string,
    resolve_existing_directory_path, resolve_existing_file_path,
};
use crate::perf_trace;

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

#[cfg(test)]
pub(crate) fn open_document_from_canonical_path_with_roots(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
) -> Result<DocumentPayload, String> {
    open_document_from_canonical_path_with_roots_and_options(document_path, roots, None)
}

pub(crate) fn open_document_from_canonical_path_with_roots_and_options(
    document_path: &Path,
    roots: Option<&AllowedRoots>,
    options: Option<&OpenDocumentOptions>,
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
        let context = build_asciidoc_render_context_for_document(
            &document_path,
            &source,
            &resource_context,
            roots,
            options.and_then(|options| options.antora_context_id.as_deref()),
        );
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
        let (include_files, include_graph) =
            collect_asciidoc_include_files_and_graph_with_attributes(
                &document_path,
                &source,
                roots,
                &PathBuf::from(&context.base_dir),
                context.attributes.clone(),
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

#[cfg(test)]
pub(crate) fn build_asciidoc_render_context(
    source: &str,
    resource_context: &DocumentResourceContext,
) -> AsciiDocRenderContext {
    build_asciidoc_render_context_with_attributes(source, resource_context, BTreeMap::new())
}

pub(crate) fn build_asciidoc_render_context_for_document(
    document_path: &Path,
    source: &str,
    resource_context: &DocumentResourceContext,
    roots: Option<&AllowedRoots>,
    selected_antora_context_id: Option<&str>,
) -> AsciiDocRenderContext {
    let workspace_root = PathBuf::from(&resource_context.workspace_root);
    let antora_attributes = antora_static_asciidoc_attributes_for_document(
        document_path,
        &workspace_root,
        roots,
        selected_antora_context_id,
    );
    build_asciidoc_render_context_with_attributes(source, resource_context, antora_attributes)
}

fn build_asciidoc_render_context_with_attributes(
    source: &str,
    resource_context: &DocumentResourceContext,
    mut attributes: BTreeMap<String, String>,
) -> AsciiDocRenderContext {
    attributes.extend(asciidoc_attributes(source));
    AsciiDocRenderContext {
        base_dir: resource_context.workspace_root.clone(),
        workspace_root: resource_context.workspace_root.clone(),
        document_dir: resource_context.document_dir.clone(),
        attributes,
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

#[tauri::command]
pub(crate) fn load_document_order(
    root_directory: String,
    options: Option<DocumentOrderLoadOptions>,
    roots: tauri::State<AllowedRoots>,
) -> Result<DocumentOrderCatalog, AppError> {
    load_document_order_from_root_with_options(&root_directory, &roots, options.as_ref())
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
    let query_lower = query.to_lowercase();
    let (search_paths, search_scan_capped) =
        collect_workspace_search_paths(&input, &root_path, roots, &mut skipped_files);

    let search_path_count = search_paths.len();
    for entry_path in search_paths {
        if searched_files >= input.max_files || results.len() >= input.max_matches {
            capped = true;
            break;
        }
        let metadata = match fs::metadata(&entry_path) {
            Ok(metadata) => metadata,
            Err(_) => {
                skipped_files += 1;
                continue;
            }
        };
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
    if (searched_files >= input.max_files && search_path_count > searched_files)
        || results.len() >= input.max_matches
        || search_scan_capped
    {
        capped = true;
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

fn collect_workspace_search_paths(
    input: &WorkspaceSearchInput,
    root_path: &Path,
    roots: Option<&AllowedRoots>,
    skipped_files: &mut usize,
) -> (Vec<PathBuf>, bool) {
    let mut ordered_paths = Vec::new();
    let mut ordered_keys = BTreeSet::new();
    for raw_path in &input.ordered_paths {
        let entry_path = path_for_policy(&PathBuf::from(raw_path));
        if !workspace_search_file_is_allowed(&entry_path, root_path, roots) {
            *skipped_files += 1;
            continue;
        }
        let key = path_to_ui_string(&entry_path);
        if ordered_keys.insert(key) {
            ordered_paths.push(entry_path);
        }
    }

    let mut fallback_paths = Vec::new();
    let mut visited_directories = BTreeSet::from([path_to_ui_string(root_path)]);
    let mut scanned_entries = 0usize;
    let max_scanned_entries = workspace_search_max_scanned_entries(input.max_files);
    let mut capped = false;
    collect_workspace_search_paths_from_directory(
        root_path,
        root_path,
        roots,
        &ordered_keys,
        &mut visited_directories,
        &mut scanned_entries,
        max_scanned_entries,
        &mut capped,
        skipped_files,
        &mut fallback_paths,
    );
    fallback_paths.sort_by(|left, right| {
        display_path_for_workspace_search(left, root_path)
            .cmp(&display_path_for_workspace_search(right, root_path))
    });
    ordered_paths.extend(fallback_paths);
    (ordered_paths, capped)
}

fn collect_workspace_search_paths_from_directory(
    directory: &Path,
    root_path: &Path,
    roots: Option<&AllowedRoots>,
    ordered_keys: &BTreeSet<String>,
    visited_directories: &mut BTreeSet<String>,
    scanned_entries: &mut usize,
    max_scanned_entries: usize,
    capped: &mut bool,
    skipped_files: &mut usize,
    fallback_paths: &mut Vec<PathBuf>,
) {
    if *scanned_entries > max_scanned_entries {
        *capped = true;
        return;
    }
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => {
            *skipped_files += 1;
            return;
        }
    };
    for entry in entries.flatten() {
        *scanned_entries += 1;
        if *scanned_entries > max_scanned_entries {
            *capped = true;
            break;
        }
        let entry_path = path_for_policy(&entry.path());
        if roots
            .map(|roots| ensure_path_allowed(&entry_path, roots).is_err())
            .unwrap_or(false)
        {
            *skipped_files += 1;
            continue;
        }
        let metadata = match fs::metadata(&entry_path) {
            Ok(metadata) => metadata,
            Err(_) => {
                *skipped_files += 1;
                continue;
            }
        };
        if metadata.is_dir() {
            if is_workspace_search_excluded_dir(&entry_path) {
                *skipped_files += 1;
                continue;
            }
            let directory_key = path_to_ui_string(&entry_path);
            if !visited_directories.insert(directory_key) {
                *skipped_files += 1;
                continue;
            }
            if visited_directories.len() > WORKSPACE_SEARCH_MAX_DIRECTORIES {
                *capped = true;
                break;
            }
            collect_workspace_search_paths_from_directory(
                &entry_path,
                root_path,
                roots,
                ordered_keys,
                visited_directories,
                scanned_entries,
                max_scanned_entries,
                capped,
                skipped_files,
                fallback_paths,
            );
            continue;
        }
        let entry_key = path_to_ui_string(&entry_path);
        if ordered_keys.contains(&entry_key) {
            continue;
        }
        if workspace_search_file_is_allowed(&entry_path, root_path, roots) {
            fallback_paths.push(entry_path);
        } else {
            *skipped_files += 1;
        }
    }
}

fn workspace_search_file_is_allowed(
    path: &Path,
    root_path: &Path,
    roots: Option<&AllowedRoots>,
) -> bool {
    path.starts_with(root_path)
        && roots
            .map(|roots| ensure_path_allowed(path, roots).is_ok())
            .unwrap_or(true)
        && fs::metadata(path)
            .map(|metadata| metadata.is_file())
            .unwrap_or(false)
        && is_supported_document_file(path)
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
