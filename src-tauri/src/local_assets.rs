use base64::{engine::general_purpose, Engine as _};
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::backend_types::{AllowedRoots, AsciiDocRenderContext, LocalImageResult};
use crate::path_policy::{
    antora_module_root_for_page, ensure_path_allowed, normalize_path, resolve_existing_file_path,
};

pub(crate) const LOCAL_IMAGE_MAX_BYTES: u64 = 5 * 1024 * 1024;

#[cfg(test)]
pub(crate) fn resolve_local_image_from_path(
    source: &str,
    document_path: &str,
    roots: &AllowedRoots,
) -> Result<LocalImageResult, String> {
    resolve_local_image_from_path_with_context(source, document_path, roots, None)
}

pub(crate) fn resolve_local_image_from_path_with_context(
    source: &str,
    document_path: &str,
    roots: &AllowedRoots,
    context: Option<&AsciiDocRenderContext>,
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
    let image_path = match resolve_local_image_candidates(source, &document_path, context) {
        Some(candidates) => match candidates
            .into_iter()
            .find_map(|candidate| resolve_existing_file_path(&candidate).ok())
        {
            Some(path) => path,
            None => return Ok(blocked_local_image("Local image is not available.")),
        },
        None => return Ok(blocked_local_image("Local image URL is not allowed.")),
    };
    if !image_path.is_file() || ensure_path_allowed(&image_path, roots).is_err() {
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
    })
}

pub(crate) fn resolve_local_image_candidates(
    source: &str,
    document_path: &Path,
    context: Option<&AsciiDocRenderContext>,
) -> Option<Vec<PathBuf>> {
    let mut candidates = Vec::new();
    push_candidate(
        &mut candidates,
        resolve_local_image_candidate(source, document_path)?,
    );
    if let Some(context) = context {
        for candidate in resolve_context_image_candidates(source, context) {
            push_candidate(&mut candidates, candidate);
        }
    }
    if let Some(candidate) = resolve_antora_module_image_candidate(source, document_path) {
        push_candidate(&mut candidates, candidate);
    }
    Some(candidates)
}

pub(crate) fn push_candidate(candidates: &mut Vec<PathBuf>, candidate: PathBuf) {
    if !candidates.iter().any(|existing| existing == &candidate) {
        candidates.push(candidate);
    }
}

pub(crate) fn resolve_context_image_candidates(
    source: &str,
    context: &AsciiDocRenderContext,
) -> Vec<PathBuf> {
    if has_unsupported_local_image_scheme(source) {
        return Vec::new();
    }
    let source = percent_decode_path_source(source.trim());
    let source_path = PathBuf::from(source.as_ref());
    if source_path.is_absolute() {
        return vec![source_path];
    }

    let mut candidates = Vec::new();
    let base_dir = PathBuf::from(&context.base_dir);
    push_candidate(&mut candidates, normalize_path(base_dir.join(&source_path)));
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
                    PathBuf::from(&context.base_dir)
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
    let source_path = PathBuf::from(source.as_ref());
    if source_path.is_absolute() || source_path.components().count() != 1 {
        return None;
    }
    let module_root = antora_module_root_for_page(document_path)?;
    Some(normalize_path(module_root.join("images").join(source_path)))
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
