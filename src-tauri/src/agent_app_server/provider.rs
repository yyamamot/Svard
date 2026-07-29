use super::*;

pub(super) fn bounded_command_output(
    mut command: Command,
    timeout: Duration,
) -> Result<std::process::Output, std::io::Error> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let started = std::time::Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            return child.wait_with_output();
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            return child.wait_with_output();
        }
        thread::sleep(Duration::from_millis(20));
    }
}

pub(super) fn schema_directory_contains(path: &Path, needle: &str) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if schema_directory_contains(&entry_path, needle) {
                return true;
            }
            continue;
        }
        if fs::read_to_string(&entry_path)
            .map(|source| source.contains(needle))
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}

pub(super) fn schema_named_file_contains(path: &Path, name: &str, needle: &str) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if schema_named_file_contains(&entry_path, name, needle) {
                return true;
            }
        } else if entry_path.file_name().and_then(|value| value.to_str()) == Some(name)
            && fs::read_to_string(&entry_path)
                .map(|source| source.contains(needle))
                .unwrap_or(false)
        {
            return true;
        }
    }
    false
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(super) struct ProtocolCapabilities {
    pub(super) image_input: bool,
    pub(super) turn_steering: bool,
    pub(super) context_usage: bool,
    pub(super) token_usage_diagnostics: bool,
    pub(super) manual_compaction: bool,
    pub(super) focused_context: bool,
}

pub(super) fn schema_supports_token_usage_diagnostics(output_directory: &Path) -> bool {
    [
        "\"last\"",
        "\"total\"",
        "\"inputTokens\"",
        "\"cachedInputTokens\"",
        "\"outputTokens\"",
        "\"reasoningOutputTokens\"",
        "\"totalTokens\"",
    ]
    .iter()
    .all(|needle| {
        schema_named_file_contains(
            output_directory,
            "ThreadTokenUsageUpdatedNotification.json",
            needle,
        )
    })
}

pub(super) fn apply_focused_process_overrides(command: &mut Command) {
    for override_value in [
        "features.memories=false",
        "memories.use_memories=false",
        "memories.generate_memories=false",
        "features.plugins=false",
        "features.apps=false",
        "apps._default.enabled=false",
        "include_apps_instructions=false",
    ] {
        command.args(["-c", override_value]);
    }
}

pub(super) fn focused_thread_config(skill_names: &[String], web_search: bool) -> Value {
    json!({
        "web_search": if web_search { "live" } else { "disabled" },
        "features": {
            "memories": false,
            "plugins": false,
            "apps": false,
        },
        "memories": {
            "use_memories": false,
            "generate_memories": false,
        },
        "apps": {
            "_default": {
                "enabled": false,
            },
        },
        "include_apps_instructions": false,
        "skills": {
            "config": skill_names.iter().map(|name| json!({
                "name": name,
                "enabled": false,
            })).collect::<Vec<_>>(),
        },
    })
}

pub(super) fn focused_skill_names(response: &Value) -> Result<Vec<String>, String> {
    let entries = response
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "Focused context is unavailable.".to_string())?;
    let mut names = std::collections::BTreeSet::new();
    for entry in entries {
        let errors = entry
            .get("errors")
            .and_then(Value::as_array)
            .ok_or_else(|| "Focused context is unavailable.".to_string())?;
        if !errors.is_empty() {
            return Err("Focused context is unavailable.".to_string());
        }
        let skills = entry
            .get("skills")
            .and_then(Value::as_array)
            .ok_or_else(|| "Focused context is unavailable.".to_string())?;
        for skill in skills {
            let name = skill
                .get("name")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|name| {
                    !name.is_empty()
                        && name.chars().count() <= 128
                        && !name.chars().any(char::is_control)
                })
                .ok_or_else(|| "Focused context is unavailable.".to_string())?;
            names.insert(name.to_string());
        }
    }
    Ok(names.into_iter().collect())
}

pub(super) fn schema_capabilities(executable: &CodexExecutable) -> ProtocolCapabilities {
    let Ok(root) = create_scratch_directory() else {
        return ProtocolCapabilities::default();
    };
    let output_directory = root.join("schema");
    let mut command = executable.command();
    command.args([
        "app-server",
        "generate-json-schema",
        "--experimental",
        "--out",
    ]);
    command.arg(&output_directory);
    let generated = bounded_command_output(command, Duration::from_secs(4))
        .ok()
        .filter(|output| output.status.success())
        .is_some();
    let capabilities = if generated {
        ProtocolCapabilities {
            image_input: schema_directory_contains(&output_directory, "\"localImage\""),
            turn_steering: schema_directory_contains(&output_directory, "\"turn/steer\""),
            context_usage: schema_directory_contains(
                &output_directory,
                "\"thread/tokenUsage/updated\"",
            ) && schema_directory_contains(
                &output_directory,
                "\"modelContextWindow\"",
            ) && schema_directory_contains(&output_directory, "\"totalTokens\""),
            token_usage_diagnostics: schema_supports_token_usage_diagnostics(&output_directory),
            manual_compaction: schema_directory_contains(
                &output_directory,
                "\"thread/compact/start\"",
            ) && schema_directory_contains(
                &output_directory,
                "\"contextCompaction\"",
            ),
            focused_context: schema_directory_contains(&output_directory, "\"thread/start\"")
                && schema_directory_contains(&output_directory, "\"thread/resume\"")
                && schema_directory_contains(&output_directory, "\"skills/list\"")
                && schema_named_file_contains(
                    &output_directory,
                    "ThreadStartParams.json",
                    "\"config\"",
                )
                && schema_named_file_contains(
                    &output_directory,
                    "ThreadResumeParams.json",
                    "\"config\"",
                )
                && schema_named_file_contains(
                    &output_directory,
                    "SkillsListParams.json",
                    "\"cwds\"",
                )
                && schema_named_file_contains(
                    &output_directory,
                    "SkillsListResponse.json",
                    "\"data\"",
                ),
        }
    } else {
        ProtocolCapabilities::default()
    };
    let _ = fs::remove_dir_all(root);
    capabilities
}

pub(super) fn probe_focused_context(executable: &CodexExecutable) -> bool {
    let Ok(scratch_directory) = create_scratch_directory() else {
        return false;
    };
    let mut command = executable.command();
    apply_focused_process_overrides(&mut command);
    command
        .args(["app-server", "--stdio"])
        .current_dir(&scratch_directory)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let Ok(mut child) = command.spawn() else {
        let _ = fs::remove_dir_all(&scratch_directory);
        return false;
    };
    let result = (|| -> Result<(), String> {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Focused context is unavailable.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Focused context is unavailable.".to_string())?;
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if sender.send(line).is_err() {
                    break;
                }
            }
        });
        transient_management_request(
            &mut stdin,
            &receiver,
            1,
            "initialize",
            json!({
                "clientInfo": {
                    "name": "svard",
                    "title": "Svard",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                    "requestAttestation": false,
                },
            }),
        )?;
        serde_json::to_writer(&mut stdin, &json!({ "method": "initialized" }))
            .map_err(|_| "Focused context is unavailable.".to_string())?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| "Focused context is unavailable.".to_string())?;
        let skills = transient_management_request(
            &mut stdin,
            &receiver,
            2,
            "skills/list",
            json!({
                "cwds": [scratch_directory.to_string_lossy()],
                "forceReload": true,
            }),
        )?;
        let skill_names = focused_skill_names(&skills)?;
        let config = focused_thread_config(&skill_names, false);
        transient_management_request(
            &mut stdin,
            &receiver,
            3,
            "thread/start",
            json!({
                "cwd": scratch_directory.to_string_lossy(),
                "runtimeWorkspaceRoots": [scratch_directory.to_string_lossy()],
                "approvalPolicy": "never",
                "sandbox": "read-only",
                "ephemeral": true,
                "experimentalRawEvents": false,
                "config": config,
            }),
        )?;
        // Codex does not create a resumable rollout until the first model turn.
        // Requiring thread/resume here would therefore disable Focused for every
        // fresh installation unless this capability probe executed a model turn.
        // Resume config support is checked separately in the generated schema,
        // and the session lifecycle reapplies the same config when resuming.
        Ok(())
    })();
    let _ = child.kill();
    let _ = child.wait();
    let _ = fs::remove_dir_all(&scratch_directory);
    result.is_ok()
}

pub(super) fn bounded_string(value: Option<&str>, limit: usize) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        return None;
    }
    Some(value.chars().take(limit).collect())
}

pub(super) fn parse_model_descriptor(value: &Value) -> Option<AgentModelDescriptor> {
    if value
        .get("hidden")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return None;
    }
    let id = bounded_string(value.get("id").and_then(Value::as_str), 128)?;
    let model = bounded_string(value.get("model").and_then(Value::as_str), 128)?;
    let display_name = bounded_string(value.get("displayName").and_then(Value::as_str), 120)?;
    let description =
        bounded_string(value.get("description").and_then(Value::as_str), 500).unwrap_or_default();
    let supported_reasoning_efforts = value
        .get("supportedReasoningEfforts")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(|effort| {
            Some(AgentReasoningEffortDescriptor {
                value: bounded_string(effort.get("reasoningEffort")?.as_str(), 64)?,
                description: bounded_string(effort.get("description").and_then(Value::as_str), 300),
            })
        })
        .collect::<Vec<_>>();
    let default_reasoning_effort = Some(bounded_string(
        value.get("defaultReasoningEffort").and_then(Value::as_str),
        64,
    )?);
    let mut input_modalities = value
        .get("inputModalities")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .filter(|value| matches!(*value, "text" | "image"))
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| vec!["text".to_string()]);
    input_modalities.sort();
    input_modalities.dedup();
    Some(AgentModelDescriptor {
        id,
        model,
        display_name,
        description,
        is_default: value
            .get("isDefault")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        default_reasoning_effort,
        supported_reasoning_efforts,
        supports_personality: value
            .get("supportsPersonality")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        input_modalities,
    })
}

pub(super) fn load_model_catalog_with(
    mut request: impl FnMut(Value) -> Result<Value, String>,
) -> Result<AgentModelCatalog, String> {
    let mut models = Vec::new();
    let mut cursor: Option<String> = None;
    let mut seen_cursors = std::collections::HashSet::new();
    let mut seen_models = std::collections::HashSet::new();
    let mut seen_ids = std::collections::HashSet::new();
    let mut default_seen = false;
    for _ in 0..5 {
        let result = request(json!({
            "cursor": cursor,
            "includeHidden": false,
            "limit": 100,
        }))?;
        let page = result
            .get("data")
            .and_then(Value::as_array)
            .ok_or_else(|| "Codex returned an invalid model catalog.".to_string())?;
        for value in page {
            if models.len() >= 500 {
                break;
            }
            if let Some(mut model) = parse_model_descriptor(value) {
                if seen_models.insert(model.model.clone()) && seen_ids.insert(model.id.clone()) {
                    if model.is_default {
                        if default_seen {
                            model.is_default = false;
                        } else {
                            default_seen = true;
                        }
                    }
                    models.push(model);
                }
            }
        }
        let next = result
            .get("nextCursor")
            .and_then(Value::as_str)
            .and_then(|value| bounded_string(Some(value), 256));
        let Some(next) = next else {
            break;
        };
        if !seen_cursors.insert(next.clone()) {
            return Err("Codex returned an invalid model catalog cursor.".to_string());
        }
        cursor = Some(next);
    }
    Ok(AgentModelCatalog {
        provider_id: "codex-app-server",
        models,
    })
}

pub(super) fn unavailable_probe(state: &'static str, source: Option<&'static str>) -> AgentProbe {
    AgentProbe {
        provider_id: "codex-app-server",
        state,
        source,
        version: None,
        capabilities: AgentCapabilities::default(),
    }
}

pub(super) fn probe_executable(executable: &CodexExecutable) -> AgentProbe {
    let unavailable_capabilities = AgentCapabilities::default();
    let source = Some(executable.source().id());
    let mut version = executable.command();
    version.arg("--version");
    let version_output = match bounded_command_output(version, Duration::from_secs(2)) {
        Ok(output) if output.status.success() => output,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return AgentProbe {
                provider_id: "codex-app-server",
                state: "notFound",
                source: None,
                version: None,
                capabilities: unavailable_capabilities,
            };
        }
        _ => {
            return AgentProbe {
                provider_id: "codex-app-server",
                state: "broken",
                source,
                version: None,
                capabilities: unavailable_capabilities,
            };
        }
    };
    let version_text = String::from_utf8_lossy(&version_output.stdout)
        .trim()
        .chars()
        .take(80)
        .collect::<String>();
    let mut help = executable.command();
    help.args(["app-server", "--help"]);
    let help_output = bounded_command_output(help, Duration::from_secs(2));
    let supported = help_output
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            let text = String::from_utf8_lossy(&output.stdout);
            text.contains("--stdio") && text.contains("generate-ts")
        })
        .unwrap_or(false);
    let protocol = if supported {
        schema_capabilities(&executable)
    } else {
        ProtocolCapabilities::default()
    };
    let focused_context = protocol.focused_context && probe_focused_context(&executable);
    let capabilities = AgentCapabilities::with_protocol_features(
        protocol.image_input,
        protocol.turn_steering,
        protocol.context_usage,
        protocol.token_usage_diagnostics,
        protocol.manual_compaction,
        focused_context,
    );
    AgentProbe {
        provider_id: "codex-app-server",
        state: if supported {
            "ready"
        } else {
            "unsupportedVersion"
        },
        source,
        version: Some(version_text),
        capabilities,
    }
}

pub(super) fn transient_rpc_request(
    stdin: &mut ChildStdin,
    lines: &mpsc::Receiver<String>,
    id: u64,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    serde_json::to_writer(
        &mut *stdin,
        &json!({ "id": id, "method": method, "params": params }),
    )
    .map_err(|_| "Could not encode the Codex request.".to_string())?;
    stdin
        .write_all(b"\n")
        .and_then(|_| stdin.flush())
        .map_err(|_| "Codex app-server disconnected.".to_string())?;
    let deadline = std::time::Instant::now() + REQUEST_TIMEOUT;
    loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        let line = lines
            .recv_timeout(remaining)
            .map_err(|_| format!("Codex app-server did not respond to {method}."))?;
        let message: Value = serde_json::from_str(&line)
            .map_err(|_| "Codex returned an invalid protocol message.".to_string())?;
        if message.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if message.get("error").is_some() {
            return Err("Codex model list is unavailable.".to_string());
        }
        return message
            .get("result")
            .cloned()
            .ok_or_else(|| "Codex returned an invalid model catalog.".to_string());
    }
}

pub(super) fn transient_management_request(
    stdin: &mut ChildStdin,
    lines: &mpsc::Receiver<String>,
    id: u64,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    serde_json::to_writer(
        &mut *stdin,
        &json!({ "id": id, "method": method, "params": params }),
    )
    .map_err(|_| "Could not encode the Codex request.".to_string())?;
    stdin
        .write_all(b"\n")
        .and_then(|_| stdin.flush())
        .map_err(|_| "Codex app-server disconnected.".to_string())?;
    let deadline = std::time::Instant::now() + REQUEST_TIMEOUT;
    loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        let line = lines
            .recv_timeout(remaining)
            .map_err(|_| format!("Codex app-server did not respond to {method}."))?;
        let message: Value = serde_json::from_str(&line)
            .map_err(|_| "Codex returned an invalid protocol message.".to_string())?;
        if message.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if let Some(error) = message.get("error") {
            return Err(error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Codex request failed.")
                .to_string());
        }
        return Ok(message.get("result").cloned().unwrap_or(Value::Null));
    }
}

pub(super) fn load_agent_provider_runtime(
    provider_id: &str,
    preference: &CodexExecutablePreference,
) -> Result<CachedAgentProviderRuntime, String> {
    if provider_id != "codex-app-server" {
        return Err("This agent provider is not supported.".to_string());
    }
    let candidates = match executable_candidates(preference) {
        Ok(candidates) => candidates,
        Err(message) => {
            return Ok(CachedAgentProviderRuntime {
                snapshot: AgentProviderRuntimeSnapshot {
                    provider_id: "codex-app-server",
                    probe: unavailable_probe(
                        "broken",
                        (preference.mode == CodexExecutableMode::Custom).then_some("custom"),
                    ),
                    installation: None,
                    catalog: None,
                    issue: Some(AgentProviderRuntimeIssue {
                        code: "providerUnavailable",
                        message,
                    }),
                },
                executable: None,
            });
        }
    };
    if candidates.is_empty() {
        return Ok(CachedAgentProviderRuntime {
            snapshot: AgentProviderRuntimeSnapshot {
                provider_id: "codex-app-server",
                probe: unavailable_probe("notFound", None),
                installation: None,
                catalog: None,
                issue: Some(AgentProviderRuntimeIssue {
                    code: "providerUnavailable",
                    message: "Codex was not found. Choose an executable in AI Providers."
                        .to_string(),
                }),
            },
            executable: None,
        });
    }
    let mut selected = None;
    let mut first_failure = None;
    for candidate in candidates {
        let probe = probe_executable(&candidate);
        if probe.state == "ready" {
            selected = Some((candidate, probe));
            break;
        }
        if first_failure.is_none() {
            first_failure = Some((candidate, probe));
        }
        if preference.mode == CodexExecutableMode::Custom {
            break;
        }
    }
    let (executable, probe) = selected
        .or(first_failure)
        .ok_or_else(|| "Codex was not found.".to_string())?;
    let installation = probe
        .version
        .as_ref()
        .map(|version| AgentInstallationDescriptor {
            source: executable.source().id(),
            display_name: executable.source().display_name(),
            version: version.clone(),
        });
    let (catalog, issue) = if probe.state == "ready" {
        match list_agent_models_with_executable(executable.clone()) {
            Ok(catalog) => (Some(catalog), None),
            Err(message) => (
                None,
                Some(AgentProviderRuntimeIssue {
                    code: "catalogUnavailable",
                    message,
                }),
            ),
        }
    } else {
        (None, None)
    };
    let ready_executable = (probe.state == "ready").then_some(executable);
    Ok(CachedAgentProviderRuntime {
        snapshot: AgentProviderRuntimeSnapshot {
            provider_id: "codex-app-server",
            probe,
            installation,
            catalog,
            issue,
        },
        executable: ready_executable,
    })
}

pub(super) fn provider_runtime_key(
    provider_id: &str,
    preference: &CodexExecutablePreference,
) -> String {
    format!(
        "{provider_id}:{}:{}",
        match preference.mode {
            CodexExecutableMode::Auto => "auto",
            CodexExecutableMode::Custom => "custom",
        },
        preference.path.as_deref().unwrap_or_default()
    )
}

pub(super) fn agent_provider_runtime(
    state: &AgentAppServerState,
    provider_id: &str,
    preference: &CodexExecutablePreference,
    refresh: bool,
) -> Result<CachedAgentProviderRuntime, String> {
    if provider_id != "codex-app-server" {
        return Err("This agent provider is not supported.".to_string());
    }
    let key = provider_runtime_key(provider_id, preference);
    agent_provider_runtime_with(state, &key, refresh, || {
        load_agent_provider_runtime(provider_id, preference)
    })
}

pub(super) fn agent_provider_runtime_with(
    state: &AgentAppServerState,
    key: &str,
    refresh: bool,
    load: impl FnOnce() -> Result<CachedAgentProviderRuntime, String>,
) -> Result<CachedAgentProviderRuntime, String> {
    let mut cache = state
        .provider_runtime
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let mut waited_for_inflight = false;
    loop {
        if cache.loading.contains(key) {
            cache = state
                .provider_runtime_ready
                .wait(cache)
                .unwrap_or_else(|error| error.into_inner());
            waited_for_inflight = true;
            continue;
        }
        if !refresh || waited_for_inflight {
            if let Some(runtime) = cache.values.get(key).cloned() {
                return Ok(runtime);
            }
        }
        cache.loading.insert(key.to_string());
        if refresh {
            cache.values.remove(key);
        }
        break;
    }
    drop(cache);

    let loaded = load();
    let mut cache = state
        .provider_runtime
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if let Ok(runtime) = &loaded {
        cache.values.insert(key.to_string(), runtime.clone());
    }
    cache.loading.remove(key);
    state.provider_runtime_ready.notify_all();
    loaded
}

#[tauri::command]
pub fn get_agent_provider_runtime(
    provider_id: String,
    executable_preference: CodexExecutablePreference,
    refresh: bool,
    state: State<'_, AgentAppServerState>,
) -> Result<AgentProviderRuntimeSnapshot, String> {
    agent_provider_runtime(&state, &provider_id, &executable_preference, refresh)
        .map(|runtime| runtime.snapshot)
}

pub(super) fn list_agent_models_with_executable(
    executable: CodexExecutable,
) -> Result<AgentModelCatalog, String> {
    let scratch_directory = create_scratch_directory()?;
    let mut command = executable.command();
    command
        .args(["app-server", "--stdio"])
        .current_dir(&scratch_directory)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(_) => {
            let _ = fs::remove_dir_all(&scratch_directory);
            return Err("Codex app-server could not start.".to_string());
        }
    };
    let result = (|| {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Codex app-server stdin is unavailable.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Codex app-server stdout is unavailable.".to_string())?;
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if sender.send(line).is_err() {
                    break;
                }
            }
        });
        transient_rpc_request(
            &mut stdin,
            &receiver,
            1,
            "initialize",
            json!({
                "clientInfo": {
                    "name": "svard",
                    "title": "Svard",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                    "requestAttestation": false,
                },
            }),
        )?;
        serde_json::to_writer(&mut stdin, &json!({ "method": "initialized" }))
            .map_err(|_| "Could not encode the Codex request.".to_string())?;
        stdin
            .write_all(b"\n")
            .and_then(|_| stdin.flush())
            .map_err(|_| "Codex app-server disconnected.".to_string())?;
        let mut request_id = 1_u64;
        load_model_catalog_with(|params| {
            request_id += 1;
            transient_rpc_request(&mut stdin, &receiver, request_id, "model/list", params)
        })
    })();
    let _ = child.kill();
    let _ = child.wait();
    let _ = fs::remove_dir_all(&scratch_directory);
    result
}
