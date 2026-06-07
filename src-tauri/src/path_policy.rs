use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::backend_types::AllowedRoots;
use crate::document_io::is_supported_document_file;

pub(crate) fn path_to_ui_string(path: &Path) -> String {
    path_to_ui_path(path).to_string_lossy().into_owned()
}

pub(crate) fn path_to_ui_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};

        let mut components = path.components();
        if let Some(Component::Prefix(prefix)) = components.next() {
            match prefix.kind() {
                Prefix::VerbatimDisk(disk) => {
                    let mut normalized = PathBuf::from(format!("{}:\\", disk as char));
                    normalized.extend(components);
                    return normalized;
                }
                Prefix::VerbatimUNC(server, share) => {
                    let mut normalized = PathBuf::from(format!(
                        "\\\\{}\\{}",
                        server.to_string_lossy(),
                        share.to_string_lossy()
                    ));
                    normalized.extend(components);
                    return normalized;
                }
                _ => {}
            }
        }
    }
    path.to_path_buf()
}

pub(crate) fn normalize_path(path: PathBuf) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                result.pop();
            }
            other => result.push(other.as_os_str()),
        }
    }
    result
}

pub(crate) fn resolve_existing_file_path(path: &Path) -> Result<PathBuf, String> {
    resolve_existing_path(path, ExistingPathKind::File)
}

pub(crate) fn resolve_existing_directory_path(path: &Path) -> Result<PathBuf, String> {
    resolve_existing_path(path, ExistingPathKind::Directory)
}

pub(crate) fn resolve_existing_path(
    path: &Path,
    kind: ExistingPathKind,
) -> Result<PathBuf, String> {
    let resolved = match path.canonicalize() {
        Ok(canonical) => path_to_ui_path(&canonical),
        Err(error) => {
            if should_use_lexical_wsl_unc_fallback(path) {
                normalize_path(path_to_ui_path(path))
            } else {
                return Err(format!(
                    "failed to resolve {} {}: {error}",
                    kind.label(),
                    display_safe_path(path)
                ));
            }
        }
    };

    match (kind, fs::metadata(&resolved)) {
        (ExistingPathKind::File, Ok(metadata)) if metadata.is_file() => Ok(resolved),
        (ExistingPathKind::Directory, Ok(metadata)) if metadata.is_dir() => Ok(resolved),
        (ExistingPathKind::Any, Ok(_)) => Ok(resolved),
        (ExistingPathKind::File, _) => Err(format!(
            "document does not exist or is not a file: {}",
            display_safe_path(&resolved)
        )),
        (ExistingPathKind::Directory, _) => Err(format!(
            "directory does not exist or is not a directory: {}",
            display_safe_path(&resolved)
        )),
        (ExistingPathKind::Any, _) => Err(format!(
            "path does not exist or is not available: {}",
            display_safe_path(&resolved)
        )),
    }
}

#[derive(Clone, Copy)]
pub(crate) enum ExistingPathKind {
    Any,
    Directory,
    File,
}

impl ExistingPathKind {
    fn label(self) -> &'static str {
        match self {
            ExistingPathKind::Any => "path",
            ExistingPathKind::Directory => "directory",
            ExistingPathKind::File => "document",
        }
    }
}

pub(crate) fn path_for_policy(path: &Path) -> PathBuf {
    path.canonicalize()
        .map(|canonical| path_to_ui_path(&canonical))
        .unwrap_or_else(|_| normalize_path(path_to_ui_path(path)))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub(crate) enum PathLocationKind {
    Local,
    WslUnc,
    NetworkUnc,
    Unknown,
}

pub(crate) fn path_location_kind(path: &Path) -> PathLocationKind {
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};

        let mut components = path.components();
        let Some(Component::Prefix(prefix)) = components.next() else {
            return if path.is_absolute() {
                PathLocationKind::Local
            } else {
                PathLocationKind::Unknown
            };
        };
        return match prefix.kind() {
            Prefix::UNC(server, _) | Prefix::VerbatimUNC(server, _) => {
                let server = server.to_string_lossy();
                if server.eq_ignore_ascii_case("wsl.localhost")
                    || server.eq_ignore_ascii_case("wsl$")
                {
                    PathLocationKind::WslUnc
                } else {
                    PathLocationKind::NetworkUnc
                }
            }
            Prefix::Disk(_) | Prefix::VerbatimDisk(_) => PathLocationKind::Local,
            _ => PathLocationKind::Unknown,
        };
    }

    #[cfg(not(windows))]
    {
        let _ = path;
        PathLocationKind::Local
    }
}

#[cfg(windows)]
fn should_use_lexical_wsl_unc_fallback(path: &Path) -> bool {
    path_location_kind(path) == PathLocationKind::WslUnc
}

#[cfg(not(windows))]
fn should_use_lexical_wsl_unc_fallback(_path: &Path) -> bool {
    false
}

#[cfg(all(windows, test))]
fn is_wsl_unc_path(path: &Path) -> bool {
    path_location_kind(path) == PathLocationKind::WslUnc
}

pub(crate) fn register_allowed_root_for_file(
    path: &Path,
    roots: &AllowedRoots,
) -> Result<(), String> {
    let root = fallback_allowed_root_for_file(path)
        .ok_or_else(|| "document path has no parent directory".to_string())?;
    register_allowed_root(&root, roots)
}

pub(crate) fn authorize_document_path_for_open(
    requested_path: &Path,
    document_path: &Path,
    roots: &AllowedRoots,
) -> Result<(), String> {
    if is_path_allowed(document_path, roots)? {
        return Ok(());
    }
    if is_path_lexically_inside_allowed_root(requested_path, roots)? {
        return Err(format!(
            "path is outside the current workspace: {}",
            display_safe_path(document_path)
        ));
    }
    register_allowed_root_for_file(document_path, roots)
}

pub(crate) fn register_allowed_root(path: &Path, roots: &AllowedRoots) -> Result<(), String> {
    let canonical = resolve_existing_directory_path(path).map_err(|error| {
        format!(
            "failed to resolve allowed root {}: {error}",
            display_safe_path(path)
        )
    })?;
    let mut guard = roots
        .0
        .lock()
        .map_err(|_| "failed to lock allowed roots".to_string())?;
    guard.insert(canonical);
    Ok(())
}

pub(crate) fn fallback_allowed_root_for_file(path: &Path) -> Option<PathBuf> {
    antora_module_root_for_page(path).or_else(|| path.parent().map(Path::to_path_buf))
}

pub(crate) fn antora_module_root_for_page(path: &Path) -> Option<PathBuf> {
    let parent = path.parent()?;
    if parent.file_name()?.to_string_lossy() != "pages" {
        return None;
    }
    let module_root = parent.parent()?;
    let modules_dir = module_root.parent()?;
    if modules_dir.file_name()?.to_string_lossy() != "modules" {
        return None;
    }
    Some(module_root.to_path_buf())
}

pub(crate) fn ensure_path_allowed(path: &Path, roots: &AllowedRoots) -> Result<(), String> {
    if is_path_allowed(path, roots)? {
        return Ok(());
    }
    Err(format!(
        "path is outside the current workspace: {}",
        display_safe_path(path)
    ))
}

#[cfg(test)]
pub(crate) fn allowed_root_paths(roots: &AllowedRoots) -> Vec<PathBuf> {
    roots
        .0
        .lock()
        .expect("lock allowed roots")
        .iter()
        .cloned()
        .collect()
}

pub(crate) fn is_path_allowed(path: &Path, roots: &AllowedRoots) -> Result<bool, String> {
    let checked_path = path_for_policy(path);
    let guard = roots
        .0
        .lock()
        .map_err(|_| "failed to lock allowed roots".to_string())?;
    Ok(guard
        .iter()
        .any(|root| checked_path == *root || checked_path.starts_with(root)))
}

pub(crate) fn is_path_lexically_inside_allowed_root(
    path: &Path,
    roots: &AllowedRoots,
) -> Result<bool, String> {
    let checked_path = path_for_lexical_policy(path);
    let guard = roots
        .0
        .lock()
        .map_err(|_| "failed to lock allowed roots".to_string())?;
    Ok(guard
        .iter()
        .any(|root| checked_path == *root || checked_path.starts_with(root)))
}

fn path_for_lexical_policy(path: &Path) -> PathBuf {
    if let (Some(parent), Some(file_name)) = (path.parent(), path.file_name()) {
        if let Ok(parent) = parent.canonicalize() {
            return path_to_ui_path(&parent).join(file_name);
        }
    }
    normalize_path(path_to_ui_path(path))
}

pub(crate) fn is_openable_desktop_path(path: &Path) -> bool {
    path.is_dir() || (path.is_file() && is_supported_document_file(path))
}

pub(crate) fn display_safe_path(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn ui_path_removes_verbatim_disk_prefix() {
        assert_eq!(
            path_to_ui_string(Path::new(r"\\?\C:\Users\me\docs\a.md")),
            r"C:\Users\me\docs\a.md"
        );
    }

    #[test]
    fn ui_path_removes_verbatim_unc_prefix() {
        assert_eq!(
            path_to_ui_string(Path::new(r"\\?\UNC\server\share\docs\a.md")),
            r"\\server\share\docs\a.md"
        );
    }

    #[test]
    fn ui_path_removes_verbatim_wsl_unc_prefix() {
        assert_eq!(
            path_to_ui_string(Path::new(
                r"\\?\UNC\wsl.localhost\Ubuntu\home\developer\repo"
            )),
            r"\\wsl.localhost\Ubuntu\home\developer\repo"
        );
    }

    #[test]
    fn recognizes_wsl_unc_hosts_for_lexical_fallback() {
        assert!(is_wsl_unc_path(Path::new(
            r"\\wsl.localhost\Ubuntu\home\developer\repo"
        )));
        assert!(is_wsl_unc_path(Path::new(
            r"\\wsl$\Ubuntu\home\developer\repo"
        )));
        assert!(!is_wsl_unc_path(Path::new(
            r"\\server\share\home\developer\repo"
        )));
    }
}
