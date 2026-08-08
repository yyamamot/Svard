use super::*;

pub(super) fn context_file_kind(
    path: &Path,
) -> Result<(&'static str, &'static str), CodexCommandError> {
    let basename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();

    let allowed_env = matches!(
        basename.as_str(),
        ".env.example" | ".env.sample" | ".env.template"
    );
    let denied_env = basename.starts_with(".env") && !allowed_env;
    let denied_sensitive_name = CONTEXT_DENIED_BASENAMES.contains(&basename.as_str())
        || basename.contains("credential")
        || basename.contains("secret");
    if denied_env
        || denied_sensitive_name
        || CONTEXT_DENIED_EXTENSIONS.contains(&extension.as_str())
    {
        return Err(CodexCommandError::new(
            "sensitiveContext",
            "This file is blocked because it may contain credentials or secrets.",
        ));
    }

    if !CONTEXT_ALLOWED_BASENAMES.contains(&basename.as_str())
        && !CONTEXT_ALLOWED_EXTENSIONS.contains(&extension.as_str())
        && !allowed_env
    {
        return Err(CodexCommandError::new(
            "unsupportedContext",
            "This file type is not supported as Codex context.",
        ));
    }

    let kind = if basename == "dockerfile" {
        ("config", "dockerfile")
    } else if basename == "makefile" {
        ("config", "makefile")
    } else if basename == "cmakelists.txt" {
        ("config", "cmake")
    } else if allowed_env {
        ("config", "dotenv")
    } else {
        match extension.as_str() {
            "md" | "markdown" => ("markdown", "markdown"),
            "adoc" | "asciidoc" | "asc" => ("asciidoc", "asciidoc"),
            "json" | "jsonc" => ("config", "json"),
            "yaml" | "yml" => ("config", "yaml"),
            "toml" => ("config", "toml"),
            "xml" => ("config", "xml"),
            "ini" => ("config", "ini"),
            "cfg" => ("config", "cfg"),
            "conf" => ("config", "conf"),
            "properties" => ("config", "properties"),
            "txt" => ("text", "plaintext"),
            "c" | "h" => ("code", "c"),
            "cc" | "cpp" | "cxx" | "hh" | "hpp" => ("code", "cpp"),
            "py" | "pyi" => ("code", "python"),
            "js" | "jsx" | "mjs" | "cjs" => ("code", "javascript"),
            "ts" | "tsx" => ("code", "typescript"),
            "kt" | "kts" => ("code", "kotlin"),
            "sh" | "bash" | "zsh" | "fish" => ("code", "shell"),
            "html" | "htm" => ("code", "html"),
            "css" | "scss" | "less" => ("code", "css"),
            "rs" => ("code", "rust"),
            "go" => ("code", "go"),
            "java" => ("code", "java"),
            "swift" => ("code", "swift"),
            "rb" => ("code", "ruby"),
            "php" => ("code", "php"),
            "cs" => ("code", "csharp"),
            "sql" => ("code", "sql"),
            "proto" => ("code", "protobuf"),
            "vue" => ("code", "vue"),
            "svelte" => ("code", "svelte"),
            _ => ("code", "plaintext"),
        }
    };
    Ok(kind)
}

pub(super) fn validate_context_id(context_id: &str) -> Result<(), CodexCommandError> {
    if context_id.is_empty()
        || context_id.len() > 64
        || !context_id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_'))
    {
        return Err(CodexCommandError::new(
            "invalidContextId",
            "The Codex context identifier is invalid.",
        ));
    }
    Ok(())
}

pub(super) fn validate_display_label(label: &str) -> Result<(), CodexCommandError> {
    let path = Path::new(label);
    if label.is_empty()
        || label.len() > CONTEXT_LABEL_LIMIT
        || label
            .chars()
            .any(|value| value.is_control() || value == '|')
        || path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(CodexCommandError::new(
            "invalidContextLabel",
            "The Codex context display label is invalid.",
        ));
    }
    Ok(())
}

pub(super) fn safe_display_label(path: &Path, workspace_root: Option<&Path>) -> String {
    let candidate = workspace_root
        .and_then(|root| path.strip_prefix(root).ok())
        .filter(|relative| !relative.as_os_str().is_empty())
        .unwrap_or_else(|| {
            path.file_name()
                .map(Path::new)
                .unwrap_or_else(|| Path::new("context"))
        });
    let label = path_to_ui_string(candidate);
    #[cfg(windows)]
    let label = label.replace('\\', "/");
    label
        .chars()
        .map(|value| {
            if value.is_control() || value == '|' {
                '_'
            } else {
                value
            }
        })
        .take(CONTEXT_LABEL_LIMIT)
        .collect()
}

pub(super) fn load_context_file(
    input: CodexContextFileInput,
    roots: Option<&AllowedRoots>,
) -> Result<CodexContextFile, CodexCommandError> {
    validate_context_id(&input.context_id)?;
    let requested_path = PathBuf::from(&input.path);
    if !requested_path.is_absolute() {
        return Err(CodexCommandError::new(
            "invalidContextPath",
            "Codex context requires an absolute local file path.",
        ));
    }
    let path = resolve_existing_file_path(&requested_path).map_err(|_| {
        CodexCommandError::new(
            "invalidContextPath",
            "The Codex context file is unavailable.",
        )
    })?;
    if roots
        .map(|allowed| ensure_path_allowed(&path, allowed).is_err())
        .unwrap_or(false)
    {
        return Err(CodexCommandError::new(
            "unauthorizedContext",
            "The Codex context file has not been explicitly authorized.",
        ));
    }
    let workspace_root = input
        .workspace_root
        .as_deref()
        .map(Path::new)
        .map(resolve_existing_directory_path)
        .transpose()
        .map_err(|_| {
            CodexCommandError::new(
                "invalidWorkspace",
                "The Codex context workspace is unavailable.",
            )
        })?;
    if let Some(root) = workspace_root.as_deref() {
        if !path.starts_with(root) {
            return Err(CodexCommandError::new(
                "contextOutsideWorkspace",
                "The Codex context file is outside the selected workspace.",
            ));
        }
    }
    let (format, language) = context_file_kind(&path)?;
    let metadata = fs::metadata(&path).map_err(|_| {
        CodexCommandError::new(
            "invalidContextPath",
            "The Codex context file is unavailable.",
        )
    })?;
    if metadata.len() > CONTEXT_FILE_LIMIT as u64 {
        return Err(CodexCommandError::new(
            "contextTooLarge",
            "The Codex context file exceeds the 256 KiB limit.",
        ));
    }
    let bytes = fs::read(&path).map_err(|_| {
        CodexCommandError::new(
            "contextReadFailed",
            "The Codex context file could not be read.",
        )
    })?;
    if bytes.len() > CONTEXT_FILE_LIMIT {
        return Err(CodexCommandError::new(
            "contextTooLarge",
            "The Codex context file exceeds the 256 KiB limit.",
        ));
    }
    if bytes.contains(&0) {
        return Err(CodexCommandError::new(
            "binaryContext",
            "Binary files cannot be used as Codex context.",
        ));
    }
    let source = String::from_utf8(bytes).map_err(|_| {
        CodexCommandError::new(
            "binaryContext",
            "Codex context files must be valid UTF-8 text.",
        )
    })?;
    let display_label = safe_display_label(&path, workspace_root.as_deref());
    validate_display_label(&display_label)?;
    let updated_at = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    Ok(CodexContextFile {
        context_id: input.context_id,
        path: path_to_ui_string(&path),
        display_label,
        format: format.to_string(),
        language: language.to_string(),
        byte_length: source.len(),
        source,
        updated_at,
    })
}

#[tauri::command]
pub fn load_codex_context_file(
    input: CodexContextFileInput,
    roots: State<'_, AllowedRoots>,
) -> Result<CodexContextFile, CodexCommandError> {
    load_context_file(input, Some(&roots))
}

#[tauri::command]
pub fn resolve_dropped_codex_context_path(
    path: String,
    roots: State<'_, AllowedRoots>,
) -> Result<String, CodexCommandError> {
    resolve_dropped_codex_context_path_inner(&path, &roots)
}

pub(super) fn resolve_dropped_codex_context_path_inner(
    path: &str,
    roots: &AllowedRoots,
) -> Result<String, CodexCommandError> {
    let requested_path = PathBuf::from(path);
    if !requested_path.is_absolute() {
        return Err(CodexCommandError::new(
            "invalidContextPath",
            "Codex context requires an absolute local file path.",
        ));
    }
    let path = resolve_existing_file_path(&requested_path).map_err(|_| {
        CodexCommandError::new(
            "invalidContextPath",
            "The dropped Codex context file is unavailable.",
        )
    })?;
    context_file_kind(&path)?;
    register_allowed_root_for_file(&path, roots).map_err(|_| {
        CodexCommandError::new(
            "unauthorizedContext",
            "The dropped Codex context file could not be authorized.",
        )
    })?;
    Ok(path_to_ui_string(&path))
}

pub(super) fn collect_context_search_items(
    root: &Path,
    query: &str,
    limit: usize,
    roots: Option<&AllowedRoots>,
) -> Result<Vec<CodexContextSearchItem>, CodexCommandError> {
    if roots
        .map(|allowed| ensure_path_allowed(root, allowed).is_err())
        .unwrap_or(false)
    {
        return Err(CodexCommandError::new(
            "invalidWorkspace",
            "The Codex context workspace is not authorized.",
        ));
    }
    let query = query.to_lowercase();
    let mut directories = vec![root.to_path_buf()];
    let mut visited = BTreeSet::from([path_to_ui_string(root)]);
    let mut scanned = 0usize;
    let mut items = Vec::new();
    while let Some(directory) = directories.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            scanned += 1;
            if scanned > CONTEXT_SEARCH_ENTRY_LIMIT {
                break;
            }
            let path = entry.path();
            let symlink_metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if symlink_metadata.file_type().is_symlink() {
                continue;
            }
            if symlink_metadata.is_dir() {
                let basename = path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("");
                if CONTEXT_SEARCH_EXCLUDED_DIRS.contains(&basename) {
                    continue;
                }
                let canonical = match resolve_existing_directory_path(&path) {
                    Ok(path) if path.starts_with(root) => path,
                    _ => continue,
                };
                if visited.insert(path_to_ui_string(&canonical)) {
                    directories.push(canonical);
                }
                continue;
            }
            if !symlink_metadata.is_file() {
                continue;
            }
            let canonical = match resolve_existing_file_path(&path) {
                Ok(path) if path.starts_with(root) => path,
                _ => continue,
            };
            let Ok((format, language)) = context_file_kind(&canonical) else {
                continue;
            };
            let display_label = safe_display_label(&canonical, Some(root));
            if !query.is_empty() && !display_label.to_lowercase().contains(&query) {
                continue;
            }
            items.push(CodexContextSearchItem {
                path: path_to_ui_string(&canonical),
                display_label,
                format: format.to_string(),
                language: language.to_string(),
                byte_length: symlink_metadata.len().min(usize::MAX as u64) as usize,
            });
        }
        if scanned > CONTEXT_SEARCH_ENTRY_LIMIT {
            break;
        }
    }
    items.sort_by(|left, right| left.display_label.cmp(&right.display_label));
    items.truncate(limit.min(CONTEXT_SEARCH_RESULT_LIMIT));
    Ok(items)
}

#[tauri::command]
pub fn search_codex_context_files(
    input: CodexContextSearchInput,
    roots: State<'_, AllowedRoots>,
) -> Result<Vec<CodexContextSearchItem>, CodexCommandError> {
    let root = resolve_existing_directory_path(Path::new(&input.workspace_root)).map_err(|_| {
        CodexCommandError::new(
            "invalidWorkspace",
            "The Codex context workspace is unavailable.",
        )
    })?;
    collect_context_search_items(
        &root,
        &input.query,
        input.limit.unwrap_or(CONTEXT_SEARCH_RESULT_LIMIT),
        Some(&roots),
    )
}
