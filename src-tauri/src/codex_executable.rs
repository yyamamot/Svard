use serde::Deserialize;
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecutablePreference {
    pub mode: CodexExecutableMode,
    #[serde(default)]
    pub path: Option<String>,
}

impl Default for CodexExecutablePreference {
    fn default() -> Self {
        Self {
            mode: CodexExecutableMode::Auto,
            path: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum CodexExecutableMode {
    Auto,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CodexInstallationSource {
    Custom,
    Path,
    Standalone,
    Common,
    ChatgptApp,
}

impl CodexInstallationSource {
    pub fn id(self) -> &'static str {
        match self {
            Self::Custom => "custom",
            Self::Path => "path",
            Self::Standalone => "standalone",
            Self::Common => "common",
            Self::ChatgptApp => "chatgptApp",
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::Custom => "Custom executable",
            Self::Path => "PATH installation",
            Self::Standalone => "Standalone installation",
            Self::Common => "System installation",
            Self::ChatgptApp => "ChatGPT compatibility fallback",
        }
    }
}

#[derive(Debug, Clone)]
pub struct CodexExecutable {
    path: PathBuf,
    source: CodexInstallationSource,
}

impl CodexExecutable {
    pub fn command(&self) -> Command {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;

            let mut command = Command::new(&self.path);
            command.creation_flags(CREATE_NO_WINDOW);
            command
        }
        #[cfg(not(windows))]
        Command::new(&self.path)
    }

    pub fn source(&self) -> CodexInstallationSource {
        self.source
    }

    #[cfg(test)]
    pub fn custom_for_test(path: PathBuf) -> Self {
        Self {
            path,
            source: CodexInstallationSource::Custom,
        }
    }
}

pub fn executable_candidates(
    preference: &CodexExecutablePreference,
) -> Result<Vec<CodexExecutable>, String> {
    if preference.mode == CodexExecutableMode::Custom {
        let configured = preference
            .path
            .as_deref()
            .map(str::trim)
            .filter(|path| !path.is_empty())
            .ok_or_else(|| "Choose a Codex executable or reset to Automatic.".to_string())?;
        let path = PathBuf::from(configured);
        if !path.is_absolute() {
            return Err("The selected Codex executable is invalid.".to_string());
        }
        let path = validate_candidate(&path)
            .ok_or_else(|| "The selected Codex executable is unavailable.".to_string())?;
        return Ok(vec![CodexExecutable {
            path,
            source: CodexInstallationSource::Custom,
        }]);
    }

    let path_directories = env::var_os("PATH")
        .map(|value| env::split_paths(&value).collect())
        .unwrap_or_default();
    let home = env::var_os("HOME").map(PathBuf::from);
    let local_app_data = env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let mut raw = automatic_candidate_paths(path_directories, home.clone(), local_app_data);
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = home {
            raw.push((
                home.join("Applications")
                    .join("ChatGPT.app")
                    .join("Contents")
                    .join("Resources")
                    .join("codex"),
                CodexInstallationSource::ChatgptApp,
            ));
        }
    }

    let mut seen = HashSet::new();
    let candidates = raw
        .into_iter()
        .filter_map(|(path, source)| {
            let canonical = validate_candidate(&path)?;
            if !seen.insert(canonical.clone()) {
                return None;
            }
            Some(CodexExecutable {
                path: canonical,
                source,
            })
        })
        .collect::<Vec<_>>();
    Ok(candidates)
}

fn automatic_candidate_paths(
    path_directories: Vec<PathBuf>,
    home: Option<PathBuf>,
    local_app_data: Option<PathBuf>,
) -> Vec<(PathBuf, CodexInstallationSource)> {
    let mut candidates = path_directories
        .into_iter()
        .filter(|directory| directory.is_absolute())
        .map(|directory| {
            (
                directory.join(executable_name()),
                CodexInstallationSource::Path,
            )
        })
        .collect::<Vec<_>>();
    #[cfg(not(target_os = "windows"))]
    if let Some(home) = home {
        candidates.push((
            home.join(".local").join("bin").join(executable_name()),
            CodexInstallationSource::Standalone,
        ));
    }
    #[cfg(target_os = "windows")]
    {
        let _ = home;
        if let Some(local_app_data) = local_app_data {
            candidates.push((
                local_app_data
                    .join("Programs")
                    .join("OpenAI")
                    .join("Codex")
                    .join("bin")
                    .join(executable_name()),
                CodexInstallationSource::Standalone,
            ));
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = local_app_data;
    #[cfg(not(target_os = "windows"))]
    {
        candidates.push((
            PathBuf::from("/opt/homebrew/bin").join(executable_name()),
            CodexInstallationSource::Common,
        ));
        candidates.push((
            PathBuf::from("/usr/local/bin").join(executable_name()),
            CodexInstallationSource::Common,
        ));
    }
    #[cfg(target_os = "macos")]
    candidates.push((
        PathBuf::from("/Applications/ChatGPT.app/Contents/Resources/codex"),
        CodexInstallationSource::ChatgptApp,
    ));
    candidates
}

fn executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "codex.exe"
    } else {
        "codex"
    }
}

fn validate_candidate(path: &Path) -> Option<PathBuf> {
    let canonical = fs::canonicalize(path).ok()?;
    let metadata = fs::metadata(&canonical).ok()?;
    if !metadata.is_file() {
        return None;
    }
    #[cfg(unix)]
    if metadata.permissions().mode() & 0o111 == 0 {
        return None;
    }
    Some(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn custom_never_falls_back_to_automatic_candidates() {
        let preference = CodexExecutablePreference {
            mode: CodexExecutableMode::Custom,
            path: Some("/path/that/does/not/exist/codex".to_string()),
        };
        assert!(executable_candidates(&preference)
            .unwrap_err()
            .contains("selected Codex executable"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn automatic_candidates_follow_the_fixed_priority_order() {
        let candidates = automatic_candidate_paths(
            vec![PathBuf::from("/mock/path/bin")],
            Some(PathBuf::from("/mock/home")),
            None,
        );
        assert_eq!(
            candidates
                .iter()
                .map(|(_, source)| *source)
                .collect::<Vec<_>>(),
            vec![
                CodexInstallationSource::Path,
                CodexInstallationSource::Standalone,
                CodexInstallationSource::Common,
                CodexInstallationSource::Common,
                CodexInstallationSource::ChatgptApp,
            ]
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn automatic_candidates_use_exe_and_follow_windows_priority_order() {
        let candidates = automatic_candidate_paths(
            vec![
                PathBuf::from(r"C:\Path\First"),
                PathBuf::from(r"D:\Path\Second"),
            ],
            None,
            Some(PathBuf::from(r"C:\Users\person\AppData\Local")),
        );
        assert_eq!(
            candidates,
            vec![
                (
                    PathBuf::from(r"C:\Path\First\codex.exe"),
                    CodexInstallationSource::Path,
                ),
                (
                    PathBuf::from(r"D:\Path\Second\codex.exe"),
                    CodexInstallationSource::Path,
                ),
                (
                    PathBuf::from(
                        r"C:\Users\person\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe",
                    ),
                    CodexInstallationSource::Standalone,
                ),
            ]
        );
    }

    #[cfg(unix)]
    #[test]
    fn custom_requires_an_executable_regular_file() {
        let root =
            std::env::temp_dir().join(format!("svard-codex-resolver-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("codex");
        fs::write(&path, b"#!/bin/sh\n").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        let preference = CodexExecutablePreference {
            mode: CodexExecutableMode::Custom,
            path: Some(path.to_string_lossy().into_owned()),
        };
        assert!(executable_candidates(&preference).is_err());
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        let candidates = executable_candidates(&preference).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source(), CodexInstallationSource::Custom);
        let _ = fs::remove_dir_all(&root);
    }
}
