use base64::{engine::general_purpose, Engine as _};
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::backend_types::{AllowedRoots, LocalImageResolveContext, LocalImageResult};
#[cfg(test)]
use crate::backend_types::{AsciiDocRenderContext, DocumentResourceContext};
use crate::document_io::build_document_resource_context;
use crate::git_diff::{git_resource_bytes, GitDiffResourceSource};
use crate::path_policy::{
    antora_module_root_for_page, ensure_path_allowed, normalize_path, path_to_ui_string,
    resolve_existing_directory_path, resolve_existing_file_path,
};

pub(crate) const LOCAL_IMAGE_MAX_BYTES: u64 = 5 * 1024 * 1024;

#[cfg(test)]
pub(crate) fn resolve_local_image_from_path(
    source: &str,
    document_path: &str,
    roots: &AllowedRoots,
) -> Result<LocalImageResult, String> {
    resolve_local_image_from_path_with_local_context(source, document_path, roots, None)
}

#[cfg(test)]
pub(crate) fn resolve_local_image_from_path_with_context(
    source: &str,
    document_path: &str,
    roots: &AllowedRoots,
    context: Option<&AsciiDocRenderContext>,
) -> Result<LocalImageResult, String> {
    let context = context.map(LocalImageResolveContext::from);
    resolve_local_image_from_path_with_local_context(source, document_path, roots, context.as_ref())
}

#[cfg(test)]
pub(crate) fn resolve_local_image_from_path_with_resource_context(
    source: &str,
    document_path: &str,
    roots: &AllowedRoots,
    context: Option<&DocumentResourceContext>,
) -> Result<LocalImageResult, String> {
    let context = context.map(LocalImageResolveContext::from);
    resolve_local_image_from_path_with_local_context(source, document_path, roots, context.as_ref())
}

pub(crate) fn resolve_local_image_from_path_with_local_context(
    source: &str,
    document_path: &str,
    roots: &AllowedRoots,
    context: Option<&LocalImageResolveContext>,
) -> Result<LocalImageResult, String> {
    let document_path = match resolve_existing_file_path(&PathBuf::from(document_path)) {
        Ok(path) => path,
        Err(_) => {
            return Ok(blocked_local_image(
                "Local image document is not available.",
            ));
        }
    };

    ensure_path_allowed(&document_path, roots)?;
    let trusted_context = trusted_local_image_context(&document_path, roots, context);
    let image_path =
        match resolve_local_image_candidates(source, &document_path, Some(&trusted_context), roots)
        {
            Some(candidates) => match candidates
                .into_iter()
                .find_map(|candidate| resolve_existing_file_path(&candidate).ok())
            {
                Some(path) => path,
                None => return Ok(blocked_local_image("Local image is not available.")),
            },
            None => return Ok(blocked_local_image("Local image URL is not allowed.")),
        };
    let context_allows_root_relative_asset = is_root_relative_local_asset(source)
        && context_allows_image_path(&trusted_context, &image_path);
    if !image_path.is_file()
        || (ensure_path_allowed(&image_path, roots).is_err() && !context_allows_root_relative_asset)
    {
        return Ok(blocked_local_image(
            "Local image is outside the current workspace.",
        ));
    }

    let Some(media_type) = local_image_media_type(&image_path) else {
        return Ok(blocked_local_image("Unsupported local image type."));
    };
    let metadata = match fs::metadata(&image_path) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(blocked_local_image("Local image is not available.")),
    };
    if metadata.len() > LOCAL_IMAGE_MAX_BYTES {
        return Ok(blocked_local_image("Local image is too large."));
    }

    let bytes = match fs::read(&image_path) {
        Ok(bytes) => bytes,
        Err(_) => return Ok(blocked_local_image("Local image is not available.")),
    };
    resolved_local_image_from_bytes(bytes, media_type, &image_path)
}

pub(crate) fn resolve_git_diff_local_image_from_source(
    source: &str,
    document_path: &str,
    repository_root: &str,
    resource_source: &GitDiffResourceSource,
    roots: &AllowedRoots,
    context: Option<&LocalImageResolveContext>,
) -> Result<LocalImageResult, String> {
    let requested_repository_root = normalize_path(PathBuf::from(repository_root));
    ensure_path_allowed(&requested_repository_root, roots)?;
    let repository_root = resolve_existing_directory_path(&requested_repository_root)
        .map_err(|_| "Git diff resource repository is not available.".to_string())?;
    let requested_document_path = normalize_path(PathBuf::from(document_path));
    let Ok(document_relative_path) =
        requested_document_path.strip_prefix(&requested_repository_root)
    else {
        return Ok(blocked_local_image(
            "Git diff image is outside the current repository.",
        ));
    };
    let document_path = normalize_path(repository_root.join(document_relative_path));
    let Some(candidates) = resolve_local_image_candidates(source, &document_path, context, roots)
    else {
        return Ok(blocked_local_image("Local image URL is not allowed."));
    };
    for candidate in candidates {
        let candidate = normalize_path(candidate);
        let Ok(relative_path) = candidate.strip_prefix(&repository_root) else {
            continue;
        };
        if relative_path.as_os_str().is_empty() {
            continue;
        }
        let Some(media_type) = local_image_media_type(&candidate) else {
            continue;
        };
        let Some(bytes) = git_resource_bytes(&repository_root, relative_path, resource_source)?
        else {
            continue;
        };
        if bytes.len() as u64 > LOCAL_IMAGE_MAX_BYTES {
            return Ok(blocked_local_image("Local image is too large."));
        }
        return resolved_local_image_from_bytes(bytes, media_type, &candidate);
    }
    Ok(blocked_local_image("Local image is not available."))
}

fn resolved_local_image_from_bytes(
    bytes: Vec<u8>,
    media_type: &str,
    resolved_path: &Path,
) -> Result<LocalImageResult, String> {
    let (content, encoding) = if media_type == "image/svg+xml" {
        match String::from_utf8(bytes) {
            Ok(source) => (source, "utf8"),
            Err(_) => return Ok(blocked_local_image("Local SVG image is not valid UTF-8.")),
        }
    } else {
        (general_purpose::STANDARD.encode(bytes), "base64")
    };

    Ok(LocalImageResult {
        status: "resolved".to_string(),
        media_type: Some(media_type.to_string()),
        content: Some(content),
        encoding: Some(encoding.to_string()),
        placeholder_text: None,
        resolved_path: Some(path_to_ui_string(resolved_path)),
    })
}

fn trusted_local_image_context(
    document_path: &Path,
    roots: &AllowedRoots,
    caller_context: Option<&LocalImageResolveContext>,
) -> LocalImageResolveContext {
    let resource_context = build_document_resource_context(document_path, Some(roots));
    let mut trusted_context = LocalImageResolveContext::from(&resource_context);

    let Some(caller_context) = caller_context else {
        return trusted_context;
    };
    if !caller_context_matches_trusted_context(caller_context, &trusted_context) {
        return trusted_context;
    }

    trusted_context.attributes = caller_context.attributes.clone();
    if caller_context
        .base_dir
        .as_ref()
        .is_some_and(|base_dir| context_contains_path(&trusted_context, base_dir))
    {
        trusted_context.base_dir = caller_context.base_dir.clone();
    }
    trusted_context
}

pub(crate) fn resolve_local_image_candidates(
    source: &str,
    document_path: &Path,
    context: Option<&LocalImageResolveContext>,
    roots: &AllowedRoots,
) -> Option<Vec<PathBuf>> {
    let mut candidates = Vec::new();
    if let Some(candidate) = resolve_local_image_candidate(source, document_path) {
        push_candidate(&mut candidates, candidate);
    }
    if let Some(context) = context {
        for candidate in resolve_context_image_candidates(source, context) {
            push_candidate(&mut candidates, candidate);
        }
    }
    for candidate in resolve_root_relative_image_candidates(source, context, roots, document_path) {
        push_candidate(&mut candidates, candidate);
    }
    if let Some(candidate) = resolve_antora_module_image_candidate(source, document_path) {
        push_candidate(&mut candidates, candidate);
    }
    (!candidates.is_empty()).then_some(candidates)
}

pub(crate) fn push_candidate(candidates: &mut Vec<PathBuf>, candidate: PathBuf) {
    if !candidates.iter().any(|existing| existing == &candidate) {
        candidates.push(candidate);
    }
}

pub(crate) fn resolve_context_image_candidates(
    source: &str,
    context: &LocalImageResolveContext,
) -> Vec<PathBuf> {
    if has_unsupported_local_image_scheme(source) {
        return Vec::new();
    }
    let source = percent_decode_path_source(source.trim());
    if has_root_relative_local_asset_prefix(&source) {
        return Vec::new();
    }
    let source_path = PathBuf::from(source.as_ref());
    if source_path.is_absolute() {
        return vec![source_path];
    }

    let mut candidates = Vec::new();
    if let Some(base_dir) = &context.base_dir {
        push_candidate(
            &mut candidates,
            normalize_path(PathBuf::from(base_dir).join(&source_path)),
        );
    }
    if let Some(imagesdir) = context.attributes.get("imagesdir") {
        if !imagesdir.trim().is_empty() {
            push_candidate(
                &mut candidates,
                normalize_path(
                    PathBuf::from(&context.document_dir)
                        .join(imagesdir)
                        .join(&source_path),
                ),
            );
            push_candidate(
                &mut candidates,
                normalize_path(
                    context
                        .base_dir
                        .as_ref()
                        .map(PathBuf::from)
                        .unwrap_or_else(|| PathBuf::from(&context.workspace_root))
                        .join(imagesdir)
                        .join(source_path),
                ),
            );
        }
    }
    candidates
}

pub(crate) fn resolve_local_image_candidate(source: &str, document_path: &Path) -> Option<PathBuf> {
    if has_unsupported_local_image_scheme(source) {
        return None;
    }
    let source = percent_decode_path_source(source.trim());
    if has_root_relative_local_asset_prefix(&source) {
        return None;
    }
    let source_path = PathBuf::from(source.as_ref());
    if source_path.is_absolute() {
        return Some(source_path);
    }
    let parent = document_path.parent()?;
    Some(normalize_path(parent.join(source_path)))
}

pub(crate) fn resolve_antora_module_image_candidate(
    source: &str,
    document_path: &Path,
) -> Option<PathBuf> {
    if has_unsupported_local_image_scheme(source) {
        return None;
    }
    let source = percent_decode_path_source(source.trim());
    if has_root_relative_local_asset_prefix(&source) {
        return None;
    }
    let source_path = PathBuf::from(source.as_ref());
    if source_path.is_absolute() || source_path.components().count() != 1 {
        return None;
    }
    let module_root = antora_module_root_for_page(document_path)?;
    Some(normalize_path(module_root.join("images").join(source_path)))
}

pub(crate) fn resolve_root_relative_image_candidates(
    source: &str,
    context: Option<&LocalImageResolveContext>,
    roots: &AllowedRoots,
    document_path: &Path,
) -> Vec<PathBuf> {
    let source = percent_decode_path_source(source.trim());
    let Some(relative_path) = root_relative_local_asset_path(&source) else {
        return Vec::new();
    };
    let mut candidates = Vec::new();

    if let Some(context) = context {
        push_candidate(
            &mut candidates,
            normalize_path(PathBuf::from(&context.workspace_root).join(&relative_path)),
        );
        for root in &context.resource_roots {
            push_candidate(
                &mut candidates,
                normalize_path(PathBuf::from(root).join(&relative_path)),
            );
        }
    }

    for root in allowed_roots_snapshot(roots) {
        push_candidate(&mut candidates, normalize_path(root.join(&relative_path)));
    }

    if let Some(parent) = document_path.parent() {
        push_candidate(&mut candidates, normalize_path(parent.join(relative_path)));
    }

    candidates
}

fn allowed_roots_snapshot(roots: &AllowedRoots) -> Vec<PathBuf> {
    roots
        .0
        .lock()
        .map(|guard| guard.iter().cloned().collect())
        .unwrap_or_default()
}

fn context_allows_image_path(context: &LocalImageResolveContext, image_path: &Path) -> bool {
    let checked_image_path = image_path
        .canonicalize()
        .unwrap_or_else(|_| image_path.to_path_buf());
    context
        .resource_roots
        .iter()
        .chain(std::iter::once(&context.workspace_root))
        .map(PathBuf::from)
        .any(|root| {
            root.canonicalize()
                .map(|canonical_root| checked_image_path.starts_with(canonical_root))
                .unwrap_or(false)
        })
}

fn root_relative_local_asset_path(source: &str) -> Option<PathBuf> {
    let trimmed = source.trim();
    if !trimmed.starts_with('/') || trimmed.starts_with("//") {
        return None;
    }
    let without_slash = trimmed.strip_prefix('/')?;
    let mut segments = without_slash.split('/');
    let first = segments.next()?;
    if !is_safe_root_relative_asset_segment(first)
        || !ROOT_RELATIVE_LOCAL_ASSET_PREFIXES.contains(&first)
    {
        return None;
    }

    let mut path = PathBuf::from(first);
    for segment in segments {
        if !is_safe_root_relative_asset_segment(segment) {
            return None;
        }
        path.push(segment);
    }
    Some(path)
}

pub(crate) fn is_root_relative_local_asset(source: &str) -> bool {
    root_relative_local_asset_path(source).is_some()
}

const ROOT_RELATIVE_LOCAL_ASSET_PREFIXES: [&str; 4] = ["images", "assets", "img", "static"];

fn has_root_relative_local_asset_prefix(source: &str) -> bool {
    let trimmed = source.trim();
    if !trimmed.starts_with('/') || trimmed.starts_with("//") {
        return false;
    }
    let without_slash = trimmed.trim_start_matches('/');
    ROOT_RELATIVE_LOCAL_ASSET_PREFIXES.iter().any(|prefix| {
        without_slash == *prefix
            || without_slash
                .strip_prefix(prefix)
                .is_some_and(|suffix| suffix.starts_with('/') || suffix.starts_with('\\'))
    })
}

fn is_safe_root_relative_asset_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment != "."
        && segment != ".."
        && !segment.contains('\\')
        && !segment.contains(':')
}

fn caller_context_matches_trusted_context(
    caller_context: &LocalImageResolveContext,
    trusted_context: &LocalImageResolveContext,
) -> bool {
    canonical_path_eq(
        &caller_context.workspace_root,
        &trusted_context.workspace_root,
    ) && canonical_path_eq(&caller_context.document_dir, &trusted_context.document_dir)
        && caller_context
            .resource_roots
            .iter()
            .all(|root| context_contains_path(trusted_context, root))
}

fn canonical_path_eq(left: &str, right: &str) -> bool {
    let Some(left) = canonical_path(left) else {
        return false;
    };
    let Some(right) = canonical_path(right) else {
        return false;
    };
    left == right
}

fn context_contains_path(context: &LocalImageResolveContext, path: &str) -> bool {
    let Some(path) = canonical_path(path) else {
        return false;
    };
    context
        .resource_roots
        .iter()
        .chain(std::iter::once(&context.workspace_root))
        .filter_map(|root| canonical_path(root))
        .any(|root| root == path)
}

fn canonical_path(path: &str) -> Option<PathBuf> {
    PathBuf::from(path).canonicalize().ok()
}

pub(crate) fn percent_decode_path_source(source: &str) -> std::borrow::Cow<'_, str> {
    if !source.as_bytes().contains(&b'%') {
        return std::borrow::Cow::Borrowed(source);
    }
    let bytes = source.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = hex_value(bytes[index + 1]);
            let low = hex_value(bytes[index + 2]);
            if let (Some(high), Some(low)) = (high, low) {
                decoded.push((high << 4) | low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    std::borrow::Cow::Owned(String::from_utf8_lossy(&decoded).into_owned())
}

pub(crate) fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

pub(crate) fn has_unsupported_local_image_scheme(source: &str) -> bool {
    let trimmed = source.trim();
    let Some(colon_index) = trimmed.find(':') else {
        return false;
    };
    if colon_index == 1
        && trimmed
            .as_bytes()
            .first()
            .map_or(false, |byte| byte.is_ascii_alphabetic())
    {
        return false;
    }
    let before_slash = trimmed
        .find('/')
        .map_or(true, |slash_index| colon_index < slash_index);
    let before_backslash = trimmed
        .find('\\')
        .map_or(true, |slash_index| colon_index < slash_index);
    before_slash && before_backslash
}

pub(crate) fn blocked_local_image(message: &str) -> LocalImageResult {
    LocalImageResult {
        status: "blocked".to_string(),
        media_type: None,
        content: None,
        encoding: None,
        placeholder_text: Some(message.to_string()),
        resolved_path: None,
    }
}

pub(crate) fn local_image_media_type(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("svg") => Some("image/svg+xml"),
        Some("png") => Some("image/png"),
        Some("jpg" | "jpeg") => Some("image/jpeg"),
        Some("gif") => Some("image/gif"),
        Some("webp") => Some("image/webp"),
        _ => None,
    }
}
