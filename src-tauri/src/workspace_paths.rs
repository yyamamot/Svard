use std::{
    collections::{BTreeSet, HashMap},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Instant, SystemTime},
};

use crate::backend_types::{
    AllowedRoots, DocumentLinkResolution, DocumentLinkResolutionInput,
    DocumentLinkResolutionMetrics, WorkspaceEnvironment, WorkspaceLocationKind,
    WorkspacePathResolution, WorkspacePathResolutionInput, WorkspacePerformanceMode,
};

#[derive(Default)]
pub(crate) struct ObsidianVaultCacheState {
    notes_by_vault: Mutex<HashMap<PathBuf, ObsidianVaultIndex>>,
}

#[derive(Clone, Default)]
struct ObsidianVaultIndex {
    notes: HashMap<String, Vec<PathBuf>>,
    note_count: usize,
    scanned_dirs: usize,
    created_at: Option<SystemTime>,
    scan_limited: bool,
}
use crate::document_io::is_supported_document_file;
use crate::local_assets::{has_unsupported_local_image_scheme, percent_decode_path_source};
use crate::path_policy::{
    PathLocationKind, ensure_path_allowed, fallback_allowed_root_for_file, normalize_path,
    path_location_kind, path_to_ui_string, resolve_existing_directory_path,
    resolve_existing_file_path,
};

const OBSIDIAN_BOUNDED_SCAN_MAX_DIRS: usize = 200;
const OBSIDIAN_BOUNDED_SCAN_MAX_NOTES: usize = 2_000;

pub(crate) fn resolve_workspace_paths_inner(
    input: WorkspacePathResolutionInput,
) -> WorkspacePathResolution {
    let document_path = input
        .document_path
        .as_deref()
        .and_then(|path| resolve_existing_file_path(&PathBuf::from(path)).ok());
    let mut candidates = Vec::new();
    for value in input
        .last_directory
        .iter()
        .chain(input.recent_directories.iter())
    {
        if let Ok(path) = resolve_existing_directory_path(&PathBuf::from(value)) {
            if !candidates.iter().any(|candidate| candidate == &path) {
                candidates.push(path);
            }
        }
    }

    let initial_directory = if let Some(document_path) = &document_path {
        candidates
            .iter()
            .filter(|candidate| path_is_inside(document_path, candidate))
            .max_by_key(|candidate| candidate.components().count())
            .cloned()
            .or_else(|| fallback_allowed_root_for_file(document_path))
            .or_else(|| {
                input
                    .base_path
                    .as_deref()
                    .and_then(|path| resolve_existing_directory_path(&PathBuf::from(path)).ok())
            })
    } else {
        candidates.first().cloned().or_else(|| {
            input
                .base_path
                .as_deref()
                .and_then(|path| resolve_existing_directory_path(&PathBuf::from(path)).ok())
        })
    };

    let Some(initial_directory) = initial_directory else {
        return WorkspacePathResolution {
            initial_directory: None,
            expanded_directories: Vec::new(),
            environment: None,
        };
    };

    let mut expanded = Vec::new();
    let mut seen = BTreeSet::new();
    for value in input.expanded_directories {
        let Ok(path) = resolve_existing_directory_path(&PathBuf::from(&value)) else {
            continue;
        };
        if path_is_inside(&path, &initial_directory) {
            let ui_path = path_to_ui_string(&path);
            if seen.insert(ui_path.clone()) {
                expanded.push(ui_path);
            }
        }
    }
    if let Some(document_path) = &document_path {
        for ancestor in workspace_document_ancestors(document_path, &initial_directory) {
            let ui_path = path_to_ui_string(&ancestor);
            if seen.insert(ui_path.clone()) {
                expanded.push(ui_path);
            }
        }
    }

    let environment = workspace_environment_for_path(&initial_directory);

    WorkspacePathResolution {
        initial_directory: Some(path_to_ui_string(&initial_directory)),
        expanded_directories: expanded,
        environment: Some(environment),
    }
}

pub(crate) fn workspace_environment_for_path(path: &Path) -> WorkspaceEnvironment {
    let location_kind = match path_location_kind(path) {
        PathLocationKind::Local => WorkspaceLocationKind::Local,
        PathLocationKind::WslUnc => WorkspaceLocationKind::WslUnc,
        PathLocationKind::NetworkUnc => WorkspaceLocationKind::NetworkUnc,
        PathLocationKind::Unknown => WorkspaceLocationKind::Unknown,
    };
    let performance_mode = match location_kind {
        WorkspaceLocationKind::WslUnc => WorkspacePerformanceMode::WslMitigated,
        WorkspaceLocationKind::Local
        | WorkspaceLocationKind::NetworkUnc
        | WorkspaceLocationKind::Unknown => WorkspacePerformanceMode::Normal,
    };
    WorkspaceEnvironment {
        location_kind,
        performance_mode,
    }
}

pub(crate) fn workspace_document_ancestors(document_path: &Path, root: &Path) -> Vec<PathBuf> {
    let mut ancestors = Vec::new();
    let mut current = document_path.parent();
    while let Some(path) = current {
        if path == root {
            break;
        }
        if path_is_inside(path, root) {
            ancestors.push(path.to_path_buf());
            current = path.parent();
        } else {
            break;
        }
    }
    ancestors.reverse();
    ancestors
}

pub(crate) fn resolve_document_link_inner(
    input: DocumentLinkResolutionInput,
    roots: &AllowedRoots,
    obsidian_cache: &ObsidianVaultCacheState,
) -> DocumentLinkResolution {
    let href = input.href.trim();
    if input.kind.as_deref() == Some("wikilink") {
        return resolve_obsidian_wikilink_inner(input, roots, obsidian_cache);
    }
    if href.starts_with('#') {
        return document_link_passthrough("anchor", href);
    }
    if href.starts_with("http://") || href.starts_with("https://") {
        return document_link_passthrough("external", href);
    }

    let (path_part, hash) = split_document_href(href);
    if path_part.is_empty() || has_unsupported_local_image_scheme(path_part) {
        return blocked_document_link("Document link is not allowed.");
    }

    let source_path = PathBuf::from(percent_decode_path_source(path_part).as_ref());
    if !is_supported_document_file(&source_path) {
        return blocked_document_link("Document link is not a supported markup document.");
    }

    let document_path = match resolve_existing_file_path(&PathBuf::from(&input.document_path)) {
        Ok(path) => path,
        Err(_) => return blocked_document_link("Document link source is not available."),
    };
    if ensure_path_allowed(&document_path, roots).is_err() {
        return blocked_document_link("Document link source is outside the current workspace.");
    }

    let Some(parent) = document_path.parent() else {
        return blocked_document_link("Document link source has no parent directory.");
    };
    let candidate = if source_path.is_absolute() {
        source_path
    } else {
        normalize_path(parent.join(source_path))
    };
    let resolved_path = match resolve_existing_file_path(&candidate) {
        Ok(path) => path,
        Err(_) => return blocked_document_link("Document link is not available."),
    };
    if !resolved_path.is_file() || !is_supported_document_file(&resolved_path) {
        return blocked_document_link("Document link is not a supported markup document.");
    }
    if ensure_path_allowed(&resolved_path, roots).is_err() {
        return blocked_document_link("Document link is outside the current workspace.");
    }

    DocumentLinkResolution {
        status: "resolved".to_string(),
        path: Some(path_to_ui_string(&resolved_path)),
        href: None,
        hash: hash.map(ToString::to_string),
        message: None,
        metrics: None,
    }
}

fn resolve_obsidian_wikilink_inner(
    input: DocumentLinkResolutionInput,
    roots: &AllowedRoots,
    obsidian_cache: &ObsidianVaultCacheState,
) -> DocumentLinkResolution {
    let total_started_at = Instant::now();
    let target = input.target.as_deref().unwrap_or(input.href.trim()).trim();
    let (target_without_hash, hash) = split_document_href(target);
    let Some(note_key) = normalize_obsidian_note_key(target_without_hash) else {
        return blocked_obsidian_wikilink(
            "Obsidian wikilink is not available.",
            total_started_at,
            None,
            "invalid-target",
        );
    };

    let document_path = match resolve_existing_file_path(&PathBuf::from(&input.document_path)) {
        Ok(path) => path,
        Err(_) => {
            return blocked_obsidian_wikilink(
                "Document link source is not available.",
                total_started_at,
                None,
                "source-unavailable",
            );
        }
    };
    if ensure_path_allowed(&document_path, roots).is_err() {
        return blocked_obsidian_wikilink(
            "Document link source is outside the current workspace.",
            total_started_at,
            None,
            "source-outside-workspace",
        );
    }

    let Some(vault_root) = find_obsidian_vault_root(&document_path, roots) else {
        return blocked_obsidian_wikilink(
            "Obsidian vault is not available.",
            total_started_at,
            None,
            "non-vault",
        );
    };

    let environment = workspace_environment_for_path(&vault_root);
    if let Some(path) = resolve_direct_obsidian_note(&vault_root, &note_key) {
        return resolved_obsidian_wikilink(
            path,
            hash,
            total_started_at,
            "direct",
            0,
            0,
            environment,
        );
    }

    let (index, cache_status, scan_duration_ms) =
        match obsidian_cache.index_for_vault(&vault_root, environment.performance_mode.clone()) {
            Ok(result) => result,
            Err(_) => {
                return blocked_obsidian_wikilink(
                    "Obsidian vault is not available.",
                    total_started_at,
                    Some(environment.performance_mode),
                    "cache-error",
                );
            }
        };
    let matches = index.notes.get(&note_key).cloned().unwrap_or_default();
    if matches.len() != 1 {
        return DocumentLinkResolution {
            status: "blocked".to_string(),
            path: None,
            href: None,
            hash: None,
            message: Some("Obsidian wikilink is not available.".to_string()),
            metrics: Some(DocumentLinkResolutionMetrics {
                kind: "wikilink".to_string(),
                status: "blocked".to_string(),
                cache_status: Some(cache_status),
                note_count: Some(index.note_count),
                scanned_dirs: Some(index.scanned_dirs),
                duration_ms: Some(duration_ms(total_started_at)),
                performance_mode: Some(environment.performance_mode),
                reason: Some(if matches.is_empty() {
                    if index.scan_limited {
                        "missing-or-scan-limited".to_string()
                    } else {
                        "missing".to_string()
                    }
                } else {
                    "duplicate".to_string()
                }),
            }),
        };
    }
    let resolved_path = match resolve_existing_file_path(&matches[0]) {
        Ok(path) => path,
        Err(_) => {
            return DocumentLinkResolution {
                status: "blocked".to_string(),
                path: None,
                href: None,
                hash: None,
                message: Some("Obsidian wikilink is not available.".to_string()),
                metrics: Some(DocumentLinkResolutionMetrics {
                    kind: "wikilink".to_string(),
                    status: "blocked".to_string(),
                    cache_status: Some(cache_status),
                    note_count: Some(index.note_count),
                    scanned_dirs: Some(index.scanned_dirs),
                    duration_ms: Some(duration_ms(total_started_at)),
                    performance_mode: Some(environment.performance_mode),
                    reason: Some("stale-cache".to_string()),
                }),
            };
        }
    };
    if ensure_path_allowed(&resolved_path, roots).is_err() {
        return blocked_obsidian_wikilink(
            "Document link is outside the current workspace.",
            total_started_at,
            Some(environment.performance_mode),
            "outside-workspace",
        );
    }

    DocumentLinkResolution {
        status: "resolved".to_string(),
        path: Some(path_to_ui_string(&resolved_path)),
        href: None,
        hash: hash.map(ToString::to_string),
        message: None,
        metrics: Some(DocumentLinkResolutionMetrics {
            kind: "wikilink".to_string(),
            status: "resolved".to_string(),
            cache_status: Some(cache_status),
            note_count: Some(index.note_count),
            scanned_dirs: Some(index.scanned_dirs),
            duration_ms: Some(if scan_duration_ms > 0.0 {
                scan_duration_ms
            } else {
                duration_ms(total_started_at)
            }),
            performance_mode: Some(environment.performance_mode),
            reason: None,
        }),
    }
}

impl ObsidianVaultCacheState {
    fn index_for_vault(
        &self,
        vault_root: &Path,
        performance_mode: WorkspacePerformanceMode,
    ) -> Result<(ObsidianVaultIndex, String, f64), String> {
        let mut guard = self
            .notes_by_vault
            .lock()
            .map_err(|_| "failed to lock Obsidian vault cache".to_string())?;
        if let Some(index) = guard.get(vault_root) {
            let _ = index.created_at;
            return Ok((index.clone(), "hit".to_string(), 0.0));
        }
        let started_at = Instant::now();
        let bounded = performance_mode == WorkspacePerformanceMode::WslMitigated
            || path_location_kind(vault_root) == PathLocationKind::NetworkUnc;
        let index = scan_obsidian_vault(vault_root, bounded);
        let duration = duration_ms(started_at);
        guard.insert(vault_root.to_path_buf(), index.clone());
        Ok((index, "miss".to_string(), duration))
    }

    pub(crate) fn clear_for_path(&self, path: &Path, roots: &AllowedRoots) -> Result<bool, String> {
        let resolved_path = resolve_existing_file_path(path)
            .or_else(|_| resolve_existing_directory_path(path))
            .or_else(|_| {
                path.parent()
                    .ok_or_else(|| "Obsidian vault cache path is not available.".to_string())
                    .and_then(resolve_existing_directory_path)
            })
            .map_err(|_| "Obsidian vault cache path is not available.".to_string())?;
        if ensure_path_allowed(&resolved_path, roots).is_err() {
            return Err("Obsidian vault cache path is outside the current workspace.".to_string());
        }
        let Some(vault_root) = find_obsidian_vault_root(&resolved_path, roots) else {
            return Ok(false);
        };
        let mut guard = self
            .notes_by_vault
            .lock()
            .map_err(|_| "failed to lock Obsidian vault cache".to_string())?;
        Ok(guard.remove(&vault_root).is_some())
    }
}

fn resolved_obsidian_wikilink(
    resolved_path: PathBuf,
    hash: Option<&str>,
    started_at: Instant,
    cache_status: &str,
    note_count: usize,
    scanned_dirs: usize,
    environment: WorkspaceEnvironment,
) -> DocumentLinkResolution {
    DocumentLinkResolution {
        status: "resolved".to_string(),
        path: Some(path_to_ui_string(&resolved_path)),
        href: None,
        hash: hash.map(ToString::to_string),
        message: None,
        metrics: Some(DocumentLinkResolutionMetrics {
            kind: "wikilink".to_string(),
            status: "resolved".to_string(),
            cache_status: Some(cache_status.to_string()),
            note_count: Some(note_count),
            scanned_dirs: Some(scanned_dirs),
            duration_ms: Some(duration_ms(started_at)),
            performance_mode: Some(environment.performance_mode),
            reason: None,
        }),
    }
}

fn blocked_obsidian_wikilink(
    message: &str,
    started_at: Instant,
    performance_mode: Option<WorkspacePerformanceMode>,
    reason: &str,
) -> DocumentLinkResolution {
    DocumentLinkResolution {
        status: "blocked".to_string(),
        path: None,
        href: None,
        hash: None,
        message: Some(message.to_string()),
        metrics: Some(DocumentLinkResolutionMetrics {
            kind: "wikilink".to_string(),
            status: "blocked".to_string(),
            cache_status: None,
            note_count: None,
            scanned_dirs: None,
            duration_ms: Some(duration_ms(started_at)),
            performance_mode,
            reason: Some(reason.to_string()),
        }),
    }
}

fn resolve_direct_obsidian_note(vault_root: &Path, note_key: &str) -> Option<PathBuf> {
    if !note_key.contains('/') {
        return None;
    }
    let candidate = normalize_path(vault_root.join(format!("{note_key}.md")));
    resolve_existing_file_path(&candidate)
        .ok()
        .filter(|path| is_supported_document_file(path))
}

fn find_obsidian_vault_root(document_path: &Path, roots: &AllowedRoots) -> Option<PathBuf> {
    let mut current = if document_path.is_dir() {
        Some(document_path)
    } else {
        document_path.parent()
    };
    while let Some(path) = current {
        if path.join(".obsidian").is_dir() && ensure_path_allowed(path, roots).is_ok() {
            return Some(path.to_path_buf());
        }
        current = path.parent();
    }
    None
}

fn normalize_obsidian_note_key(target: &str) -> Option<String> {
    let target = target.trim().replace('\\', "/");
    if target.is_empty()
        || target.starts_with('/')
        || target
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return None;
    }
    let without_extension = target.strip_suffix(".md").unwrap_or(&target);
    if without_extension.contains('.') {
        return None;
    }
    Some(without_extension.to_string())
}

fn scan_obsidian_vault(vault_root: &Path, bounded: bool) -> ObsidianVaultIndex {
    fn visit(path: &Path, root: &Path, index: &mut ObsidianVaultIndex, bounded: bool) {
        if bounded
            && (index.scanned_dirs >= OBSIDIAN_BOUNDED_SCAN_MAX_DIRS
                || index.note_count >= OBSIDIAN_BOUNDED_SCAN_MAX_NOTES)
        {
            index.scan_limited = true;
            return;
        }
        index.scanned_dirs += 1;
        let Ok(entries) = fs::read_dir(path) else {
            return;
        };
        for entry in entries.flatten() {
            if bounded
                && (index.scanned_dirs >= OBSIDIAN_BOUNDED_SCAN_MAX_DIRS
                    || index.note_count >= OBSIDIAN_BOUNDED_SCAN_MAX_NOTES)
            {
                index.scan_limited = true;
                return;
            }
            let path = entry.path();
            let file_name = entry.file_name();
            if file_name.to_string_lossy() == ".obsidian" {
                continue;
            }
            if path.is_dir() {
                visit(&path, root, index, bounded);
                continue;
            }
            if path.extension().and_then(|value| value.to_str()) != Some("md") {
                continue;
            }
            index.note_count += 1;
            if let Some(stem) = path.file_stem().and_then(|value| value.to_str()) {
                index
                    .notes
                    .entry(stem.to_string())
                    .or_default()
                    .push(path.clone());
            }
            if let Ok(relative) = path.strip_prefix(root) {
                let mut key = relative.to_string_lossy().replace('\\', "/");
                if let Some(stripped) = key.strip_suffix(".md") {
                    key = stripped.to_string();
                }
                index.notes.entry(key).or_default().push(path.clone());
            }
        }
    }

    let mut index = ObsidianVaultIndex {
        created_at: Some(SystemTime::now()),
        ..ObsidianVaultIndex::default()
    };
    visit(vault_root, vault_root, &mut index, bounded);
    for matches in index.notes.values_mut() {
        matches.sort();
        matches.dedup();
    }
    index
}

fn duration_ms(started_at: Instant) -> f64 {
    (started_at.elapsed().as_secs_f64() * 1000.0 * 100.0).round() / 100.0
}

pub(crate) fn split_document_href(value: &str) -> (&str, Option<&str>) {
    if let Some((path, hash)) = value.split_once('#') {
        (path, Some(hash))
    } else {
        (value, None)
    }
}

pub(crate) fn document_link_passthrough(status: &str, href: &str) -> DocumentLinkResolution {
    DocumentLinkResolution {
        status: status.to_string(),
        path: None,
        href: Some(href.to_string()),
        hash: None,
        message: None,
        metrics: None,
    }
}

pub(crate) fn blocked_document_link(message: &str) -> DocumentLinkResolution {
    DocumentLinkResolution {
        status: "blocked".to_string(),
        path: None,
        href: None,
        hash: None,
        message: Some(message.to_string()),
        metrics: None,
    }
}

pub(crate) fn path_is_inside(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}
