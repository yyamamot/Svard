use std::path::{Path, PathBuf};

use serde_norway::{Mapping, Value};

use crate::{
    backend_types::{DocumentOrderResult, DocumentOrderSource},
    path_policy::{display_safe_path, path_for_policy},
};

pub(crate) fn none_result(message: Option<String>) -> DocumentOrderResult {
    DocumentOrderResult {
        source: DocumentOrderSource::None,
        nodes: Vec::new(),
        message,
    }
}

pub(crate) fn mapping_get<'a>(mapping: &'a Mapping, key: &str) -> Option<&'a Value> {
    mapping.get(&Value::String(key.to_string()))
}

pub(crate) fn normalize_document_order_target_path(path: &Path) -> PathBuf {
    path.canonicalize()
        .map(|canonical| path_for_policy(&canonical))
        .unwrap_or_else(|_| {
            path.parent()
                .and_then(|parent| parent.canonicalize().ok())
                .map(|parent| path_for_policy(&parent).join(path.file_name().unwrap_or_default()))
                .unwrap_or_else(|| path_for_policy(path))
        })
}

pub(crate) fn is_external_or_absolute_target(target: &str) -> bool {
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("//")
        || target.starts_with('/')
        || Path::new(target).is_absolute()
        || target.contains('\\')
        || looks_like_windows_drive_path(target)
        || target.contains("://")
}

fn looks_like_windows_drive_path(target: &str) -> bool {
    let bytes = target.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

pub(crate) fn display_title_from_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| display_safe_path(Path::new(path)))
}
