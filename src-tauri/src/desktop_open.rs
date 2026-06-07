use std::{
    path::{Path, PathBuf},
    process::Command,
};

use crate::document_io::is_supported_document_file;
use crate::path_policy::{display_safe_path, resolve_existing_file_path};

pub(crate) fn normalize_editor_document_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    let normalized = resolve_existing_file_path(&raw_path)?;

    if !is_supported_document_file(&normalized) {
        return Err("only supported markup documents can be opened in an editor".to_string());
    }

    if !normalized.is_file() {
        return Err(format!(
            "document does not exist or is not a file: {}",
            display_safe_path(&normalized)
        ));
    }

    Ok(normalized)
}

pub(crate) fn normalize_dropped_document_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path);
    let normalized = resolve_existing_file_path(&raw_path).map_err(|_| {
        format!(
            "Dropped item is not a file: {}",
            display_safe_path(&raw_path)
        )
    })?;

    if !is_supported_document_file(&normalized) {
        return Err("File compare is available for markup documents only.".to_string());
    }

    Ok(normalized)
}

pub(crate) fn editor_open_command(path: &Path) -> Command {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(path);
        command
    }

    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("start").arg("").arg(path);
        command
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    }
}

pub(crate) fn open_editor_path(path: &Path) -> Result<(), String> {
    let output = editor_open_command(path)
        .output()
        .map_err(|error| format!("failed to launch editor: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!(
            "editor exited with status {}",
            output
                .status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        ))
    } else {
        Err(format!("editor failed to open {}", display_safe_path(path)))
    }
}
