use super::*;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigSchemaPersistenceContract {
    schema_version: u8,
    paths: Vec<String>,
}

#[test]
fn default_config_keeps_kroki_disabled() {
    let config = default_config();

    assert_eq!(config.diagram.mermaid_renderer, "local");
    assert_eq!(config.diagram.plantuml_renderer, "local");
    assert_eq!(config.diagram.plantuml_timeout_ms, 10_000);
    assert_eq!(config.diagram.graphviz_renderer, "local");
    assert_eq!(config.diagram.graphviz_timeout_ms, 10_000);
    assert_eq!(config.layout.left_sidebar_width, 260);
    assert_eq!(config.layout.right_sidebar_width, 320);
    assert_eq!(config.layout.open_files_height, 144);
    assert!(!config.layout.open_files_collapsed);
    assert_eq!(config.reader.asciidoc_theme, "antora");
    assert!(!config.zoom_with_mouse_wheel);
    assert!(config.workspace.last_directory.is_none());
    assert!(config.workspace.open_tabs.is_empty());
    assert!(config.workspace.active_path.is_none());
    assert!(config.workspace.expanded_directories.is_empty());
    assert_eq!(config.workspace.sidebar_tab, "files");
    assert_eq!(config.workspace.source_control_view, "changes");
    assert_eq!(config.workspace.source_control_graph_scope, "repository");
    assert!(config
        .workspace
        .source_control_branch_diff_base_ref
        .is_none());
    assert!(config.workspace.bookmarks.is_empty());
    assert!(config.workspace.window_sessions.is_empty());
    assert!(config.workspace.restorable_window_session_ids.is_empty());
    assert_eq!(config.kroki.mode, "disabled");
    assert_eq!(config.kroki.output_format, "svg");
    assert!(config.kroki.cache_enabled);
    assert!(config.kroki.require_remote_confirmation);
    assert_eq!(config.network.http_proxy.mode, "disabled");
    assert!(config.network.http_proxy.url.is_none());
    assert!(!config.remote_providers.github.enabled);
    assert_eq!(
        config.remote_providers.github.host_url,
        "https://github.com"
    );
    assert!(!config.remote_providers.github.token_stored);
    assert!(!config.remote_providers.gitlab.enabled);
    assert_eq!(
        config.remote_providers.gitlab.host_url,
        "https://gitlab.com"
    );
    assert!(!config.remote_providers.gitlab.token_stored);
    assert!(config.security.allow_local_images);
    assert!(!config.security.show_external_images);
    assert!(config.security.confirm_external_links);
    assert_eq!(config.keybindings.preset, "native");
    assert!(config.keybindings.mappings.is_empty());
    assert!(!config.mouse_gestures.enabled);
    assert_eq!(config.mouse_gestures.trigger, "rightButton");
    assert!(config.mouse_gestures.show_trail);
    assert_eq!(config.mouse_gestures.min_distance_px, 32);
    assert!(config.mouse_gestures.mappings.is_empty());
}

#[test]
fn default_config_matches_persistence_contract_paths() {
    let contract = load_config_schema_persistence_contract();
    let value = serde_json::to_value(default_config()).expect("serialize config");

    assert_eq!(contract.schema_version, 1);
    for path in contract.paths {
        assert!(json_has_path(&value, &path), "missing config path: {path}");
    }
}

#[test]
fn config_round_trips_to_json() {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join(CONFIG_FILE_NAME);
    let mut config = default_config();
    config.theme = ConfigTheme::Dark;
    config.zoom = 125;
    config.zoom_with_mouse_wheel = true;
    config.reader.asciidoc_theme = AsciiDocTheme::Antora;
    config.zen_mode.center_layout = false;
    config.zen_mode.max_content_width = 1040;
    config.zen_mode.hide_topbar = false;
    config.zen_mode.hide_tabs = false;
    config.zen_mode.hide_left_sidebar = false;
    config.zen_mode.hide_right_sidebar = false;
    config.zen_mode.hide_status_bar = false;
    config.zen_mode.full_screen = true;
    config.zen_mode.exit_on_escape = false;
    config.zen_mode.restore_previous_layout = false;
    config.zen_mode.apply_to_diff_preview = true;
    config.network.http_proxy.mode = HttpProxyMode::Custom;
    config.network.http_proxy.url = Some("http://proxy.local:8080".to_string());
    config.remote_providers.github.enabled = true;
    config.remote_providers.github.host_url = "https://github.example.test".to_string();
    config.remote_providers.github.token_stored = true;
    config.remote_providers.github.last_test_status = Some(RemoteProviderTestStatus {
        status: "ok".to_string(),
        message: Some("GitHub connection succeeded.".to_string()),
    });
    config.security.show_external_images = true;
    config.security.allow_local_images = false;
    config.security.confirm_external_links = false;
    config.keybindings.mappings = vec![KeybindingMappingConfig {
        keys: "Mod+K".to_string(),
        command_id: "search.focus".to_string(),
        context: Some("viewer".to_string()),
        built_in: false,
    }];
    config.mouse_gestures.mappings = vec![MouseGestureMappingConfig {
        pattern: "Left".to_string(),
        command_id: "navigation.back".to_string(),
        built_in: true,
    }];
    config.layout.left_sidebar_width = 340;
    config.layout.right_sidebar_width = 280;
    config.layout.open_files_height = 188;
    config.layout.open_files_collapsed = true;
    config.workspace.expanded_directories = vec!["/workspace/docs".to_string()];
    config.workspace.sidebar_tab = WorkspaceSidebarTab::Bookmarks;
    config.workspace.source_control_view = SourceControlView::Graph;
    config.workspace.source_control_graph_scope = SourceControlGraphScope::File;
    config.workspace.source_control_branch_diff_base_ref = Some("origin/main".to_string());
    config.workspace.bookmarks = vec![BookmarkEntry {
        path: "/workspace/docs".to_string(),
        kind: BookmarkKind::Directory,
        name: Some("docs".to_string()),
    }];
    config.workspace.recent_documents = vec![RecentDocumentEntry {
        path: "/workspace/docs/mvp-guide.adoc".to_string(),
        name: Some("mvp-guide.adoc".to_string()),
        format: Some("asciidoc".to_string()),
        last_opened_at: "2026-05-14T00:00:00.000Z".to_string(),
    }];
    config.workspace.recent_directories = vec![RecentDirectoryEntry {
        path: "/workspace/docs".to_string(),
        name: Some("docs".to_string()),
        last_opened_at: "2026-05-14T00:00:00.000Z".to_string(),
    }];
    config.workspace.pinned_tabs = vec!["/workspace/docs/mvp-guide.adoc".to_string()];
    config
        .workspace
        .scroll_positions
        .insert("/workspace/docs/mvp-guide.adoc".to_string(), 240);
    config.workspace.active_heading_by_path.insert(
        "/workspace/docs/mvp-guide.adoc".to_string(),
        "reader-workflow".to_string(),
    );
    config.workspace.split_session = Some(SplitSessionState {
        enabled: true,
        focused_pane_id: "right".to_string(),
        split_ratio: 0.5,
        pane_paths: SplitPanePaths {
            left: Some("/workspace/docs/mvp-guide.adoc".to_string()),
            right: Some("/workspace/docs/preferences.adoc".to_string()),
        },
    });
    config.workspace.window_sessions.insert(
        "viewer-1".to_string(),
        WorkspaceWindowSession {
            last_directory: Some("/workspace/docs".to_string()),
            open_tabs: vec!["/workspace/docs/mvp-guide.adoc".to_string()],
            active_path: Some("/workspace/docs/mvp-guide.adoc".to_string()),
            pinned_search: None,
            expanded_directories: vec!["/workspace/docs".to_string()],
            sidebar_tab: WorkspaceSidebarTab::Files,
            source_control_view: SourceControlView::Changes,
            source_control_graph_scope: SourceControlGraphScope::Repository,
            source_control_branch_diff_base_ref: None,
            recent_directories: Vec::new(),
            recent_tabs: Vec::new(),
            pinned_tabs: Vec::new(),
            scroll_positions: std::collections::BTreeMap::new(),
            active_heading_by_path: std::collections::BTreeMap::new(),
            split_session: None,
        },
    );
    config.workspace.restorable_window_session_ids = vec!["viewer-1".to_string()];

    save_config_to_path(&path, &config).expect("save config");
    let loaded = load_config_from_path(&path).expect("load config");

    assert_eq!(loaded.theme, "dark");
    assert_eq!(loaded.zoom, 125);
    assert!(loaded.zoom_with_mouse_wheel);
    assert_eq!(loaded.reader.asciidoc_theme, "antora");
    assert!(!loaded.zen_mode.center_layout);
    assert_eq!(loaded.zen_mode.max_content_width, 1040);
    assert!(!loaded.zen_mode.hide_topbar);
    assert!(!loaded.zen_mode.hide_tabs);
    assert!(!loaded.zen_mode.hide_left_sidebar);
    assert!(!loaded.zen_mode.hide_right_sidebar);
    assert!(!loaded.zen_mode.hide_status_bar);
    assert!(loaded.zen_mode.full_screen);
    assert!(!loaded.zen_mode.exit_on_escape);
    assert!(!loaded.zen_mode.restore_previous_layout);
    assert!(loaded.zen_mode.apply_to_diff_preview);
    assert_eq!(loaded.network.http_proxy.mode, "custom");
    assert_eq!(
        loaded.network.http_proxy.url.as_deref(),
        Some("http://proxy.local:8080")
    );
    assert!(loaded.remote_providers.github.enabled);
    assert_eq!(
        loaded.remote_providers.github.host_url,
        "https://github.example.test"
    );
    assert!(loaded.remote_providers.github.token_stored);
    assert_eq!(
        loaded
            .remote_providers
            .github
            .last_test_status
            .as_ref()
            .map(|status| status.status.as_str()),
        Some("ok")
    );
    assert!(!loaded.security.allow_local_images);
    assert!(loaded.security.show_external_images);
    assert!(!loaded.security.confirm_external_links);
    assert_eq!(loaded.keybindings.mappings.len(), 1);
    assert_eq!(loaded.keybindings.mappings[0].keys, "Mod+K");
    assert_eq!(loaded.keybindings.mappings[0].command_id, "search.focus");
    assert_eq!(
        loaded.keybindings.mappings[0].context.as_deref(),
        Some("viewer")
    );
    assert!(!loaded.keybindings.mappings[0].built_in);
    assert_eq!(loaded.mouse_gestures.mappings.len(), 1);
    assert_eq!(loaded.mouse_gestures.mappings[0].pattern, "Left");
    assert_eq!(
        loaded.mouse_gestures.mappings[0].command_id,
        "navigation.back"
    );
    assert!(loaded.mouse_gestures.mappings[0].built_in);
    assert_eq!(loaded.layout.left_sidebar_width, 340);
    assert_eq!(loaded.layout.right_sidebar_width, 280);
    assert_eq!(loaded.layout.open_files_height, 188);
    assert!(loaded.layout.open_files_collapsed);
    assert_eq!(loaded.diagram.mermaid_renderer, "local");
    assert_eq!(loaded.diagram.plantuml_renderer, "local");
    assert_eq!(loaded.diagram.graphviz_renderer, "local");
    assert_eq!(
        loaded.workspace.expanded_directories,
        vec!["/workspace/docs".to_string()]
    );
    assert_eq!(loaded.workspace.sidebar_tab, "bookmarks");
    assert_eq!(loaded.workspace.source_control_view, "graph");
    assert_eq!(loaded.workspace.source_control_graph_scope, "file");
    assert_eq!(
        loaded
            .workspace
            .source_control_branch_diff_base_ref
            .as_deref(),
        Some("origin/main")
    );
    assert_eq!(loaded.workspace.bookmarks.len(), 1);
    assert_eq!(loaded.workspace.bookmarks[0].kind, "directory");
    assert_eq!(loaded.workspace.recent_documents.len(), 1);
    assert_eq!(loaded.workspace.recent_directories.len(), 1);
    assert_eq!(loaded.workspace.pinned_tabs.len(), 1);
    assert_eq!(
        loaded
            .workspace
            .scroll_positions
            .get("/workspace/docs/mvp-guide.adoc"),
        Some(&240)
    );
    assert_eq!(
        loaded
            .workspace
            .active_heading_by_path
            .get("/workspace/docs/mvp-guide.adoc")
            .map(String::as_str),
        Some("reader-workflow")
    );
    assert_eq!(
        loaded
            .workspace
            .split_session
            .as_ref()
            .map(|item| item.focused_pane_id.as_str()),
        Some("right")
    );
    assert_eq!(
        loaded
            .workspace
            .window_sessions
            .get("viewer-1")
            .and_then(|session| session.active_path.as_deref()),
        Some("/workspace/docs/mvp-guide.adoc")
    );
    assert_eq!(
        loaded.workspace.restorable_window_session_ids,
        vec!["viewer-1".to_string()]
    );
}

#[test]
fn config_fixed_value_enums_serialize_as_existing_strings() {
    let mut config = default_config();
    config.theme = ConfigTheme::Dark;
    config.reader.asciidoc_theme = AsciiDocTheme::Asciidoctor;
    config.workspace.sidebar_tab = WorkspaceSidebarTab::SourceControl;
    config.workspace.source_control_view = SourceControlView::BranchDiff;
    config.workspace.source_control_graph_scope = SourceControlGraphScope::File;
    config.diagram.mermaid_renderer = DiagramRenderer::Kroki;
    config.kroki.mode = KrokiMode::Public;
    config.kroki.output_format = KrokiOutputFormat::Png;
    config.network.http_proxy.mode = HttpProxyMode::Custom;
    config.workspace.bookmarks = vec![BookmarkEntry {
        path: "/workspace/docs".to_string(),
        kind: BookmarkKind::Directory,
        name: None,
    }];

    let value = serde_json::to_value(config).expect("serialize config");

    assert_eq!(value["theme"], "dark");
    assert_eq!(value["reader"]["asciidocTheme"], "asciidoctor");
    assert_eq!(value["workspace"]["sidebarTab"], "sourceControl");
    assert_eq!(value["workspace"]["sourceControlView"], "branchDiff");
    assert_eq!(value["workspace"]["sourceControlGraphScope"], "file");
    assert_eq!(value["diagram"]["mermaidRenderer"], "kroki");
    assert_eq!(value["kroki"]["mode"], "public");
    assert_eq!(value["kroki"]["outputFormat"], "png");
    assert_eq!(value["network"]["httpProxy"]["mode"], "custom");
    assert_eq!(value["workspace"]["bookmarks"][0]["kind"], "directory");
}

#[test]
fn config_fixed_value_enums_fallback_unknown_values_to_defaults() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value["theme"] = serde_json::Value::String("sepia".to_string());
    value["workspace"]["sidebarTab"] = serde_json::Value::String("timeline".to_string());
    value["workspace"]["sourceControlView"] = serde_json::Value::String("history".to_string());
    value["workspace"]["sourceControlGraphScope"] = serde_json::Value::String("all".to_string());
    value["diagram"]["graphvizRenderer"] = serde_json::Value::String("remote".to_string());
    value["kroki"]["outputFormat"] = serde_json::Value::String("pdf".to_string());
    value["workspace"]["bookmarks"] = serde_json::json!([
        { "path": "/workspace/docs", "kind": "project" }
    ]);

    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert_eq!(config.theme, "light");
    assert_eq!(config.workspace.sidebar_tab, "files");
    assert_eq!(config.workspace.source_control_view, "changes");
    assert_eq!(config.workspace.source_control_graph_scope, "repository");
    assert_eq!(config.diagram.graphviz_renderer, "local");
    assert_eq!(config.kroki.output_format, "svg");
    assert_eq!(config.workspace.bookmarks[0].kind, "file");
}

#[test]
fn config_defaults_missing_show_external_images_to_false() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value
        .get_mut("security")
        .and_then(serde_json::Value::as_object_mut)
        .expect("security object")
        .remove("showExternalImages");
    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert!(!config.security.show_external_images);
}

#[test]
fn config_preserves_experimental_search_hit_ruler() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value["experimental"]["searchHitRuler"] = serde_json::Value::Bool(true);
    value["experimental"]["restoreAdditionalWindowsOnStartup"] = serde_json::Value::Bool(true);
    value["experimental"]["diagramPlaceholderRendering"] = serde_json::Value::Bool(true);
    value["experimental"]["postDiffGitMarkers"] = serde_json::Value::Bool(true);

    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert!(config.experimental.search_hit_ruler);
    assert!(config.experimental.restore_additional_windows_on_startup);
    assert!(config.experimental.diagram_placeholder_rendering);
    assert!(config.experimental.post_diff_git_markers);
}

#[test]
fn config_defaults_missing_experimental_to_disabled_features() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value
        .as_object_mut()
        .expect("config object")
        .remove("experimental");

    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert!(!config.experimental.search_hit_ruler);
    assert!(!config.experimental.restore_additional_windows_on_startup);
    assert!(!config.experimental.diagram_placeholder_rendering);
    assert!(!config.experimental.post_diff_git_markers);
}

#[test]
fn config_defaults_missing_zen_mode_to_reader_focused_defaults() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value
        .as_object_mut()
        .expect("config object")
        .remove("zenMode");
    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert!(config.zen_mode.center_layout);
    assert_eq!(config.zen_mode.max_content_width, 960);
    assert!(config.zen_mode.hide_topbar);
    assert!(config.zen_mode.hide_tabs);
    assert!(config.zen_mode.hide_left_sidebar);
    assert!(config.zen_mode.hide_right_sidebar);
    assert!(config.zen_mode.hide_status_bar);
    assert!(!config.zen_mode.full_screen);
    assert!(config.zen_mode.exit_on_escape);
    assert!(config.zen_mode.restore_previous_layout);
    assert!(!config.zen_mode.apply_to_diff_preview);
}

#[test]
fn config_migrates_legacy_local_kroki_mode_to_remote() {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join(CONFIG_FILE_NAME);
    let mut config = default_config();
    config.kroki.mode = KrokiMode::Local;
    config.kroki.endpoint_url = Some("http://127.0.0.1:8000".to_string());
    save_config_to_path(&path, &config).expect("save config");

    let loaded = load_config_from_path(&path).expect("load config");

    assert_eq!(loaded.kroki.mode, "remote");
    assert_eq!(
        loaded.kroki.endpoint_url.as_deref(),
        Some("http://127.0.0.1:8000")
    );
}

#[test]
fn config_defaults_missing_reader_to_antora_theme() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value
        .as_object_mut()
        .expect("config object")
        .remove("reader");
    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert_eq!(config.reader.asciidoc_theme, "antora");
}

#[test]
fn config_normalizes_invalid_reader_theme_to_antora() {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join(CONFIG_FILE_NAME);
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value["reader"]["asciidocTheme"] = serde_json::Value::String("legacy".to_string());
    fs::write(&path, serde_json::to_string_pretty(&value).unwrap()).expect("write config");

    let loaded = load_config_from_path(&path).expect("load config");

    assert_eq!(loaded.reader.asciidoc_theme, "antora");
}

#[test]
fn config_keeps_explicit_asciidoctor_reader_theme() {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join(CONFIG_FILE_NAME);
    let mut config = default_config();
    config.reader.asciidoc_theme = AsciiDocTheme::Asciidoctor;
    save_config_to_path(&path, &config).expect("save config");

    let loaded = load_config_from_path(&path).expect("load config");

    assert_eq!(loaded.reader.asciidoc_theme, "asciidoctor");
}

#[test]
fn config_defaults_missing_network_to_disabled_http_proxy() {
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value
        .as_object_mut()
        .expect("config object")
        .remove("network");
    let config: AppConfig = serde_json::from_value(value).expect("deserialize config");

    assert_eq!(config.network.http_proxy.mode, "disabled");
    assert!(config.network.http_proxy.url.is_none());
}

#[test]
fn config_normalizes_invalid_http_proxy_to_disabled_and_trims_url() {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join(CONFIG_FILE_NAME);
    let mut value = serde_json::to_value(default_config()).expect("serialize config");
    value["network"]["httpProxy"]["mode"] = serde_json::Value::String("legacy".to_string());
    value["network"]["httpProxy"]["url"] =
        serde_json::Value::String("  http://proxy.local:8080  ".to_string());
    fs::write(&path, serde_json::to_string_pretty(&value).unwrap()).expect("write config");

    let loaded = load_config_from_path(&path).expect("load config");

    assert_eq!(loaded.network.http_proxy.mode, "disabled");
    assert_eq!(
        loaded.network.http_proxy.url.as_deref(),
        Some("http://proxy.local:8080")
    );
}

fn load_config_schema_persistence_contract() -> ConfigSchemaPersistenceContract {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("contracts")
        .join("config-schema-persistence.json");
    let source = fs::read_to_string(path).expect("read config persistence contract");
    serde_json::from_str(&source).expect("parse config persistence contract")
}

fn json_has_path(value: &serde_json::Value, path: &str) -> bool {
    path.split('.')
        .try_fold(value, |current, segment| current.get(segment))
        .is_some()
}
