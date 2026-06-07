use super::*;

#[test]
fn workspace_path_resolver_filters_stale_directories_and_adds_ancestors() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let nested = docs.join("nested");
    let other = dir.path().join("other");
    let document = nested.join("guide.md");
    fs::create_dir_all(&nested).expect("create nested docs");
    fs::create_dir_all(&other).expect("create other");
    fs::write(&document, "# Guide\n").expect("write document");

    let result = resolve_workspace_paths_inner(WorkspacePathResolutionInput {
        document_path: Some(document.to_string_lossy().to_string()),
        base_path: Some(nested.to_string_lossy().to_string()),
        last_directory: Some(other.to_string_lossy().to_string()),
        recent_directories: vec![project.to_string_lossy().to_string()],
        expanded_directories: vec![
            docs.to_string_lossy().to_string(),
            other.to_string_lossy().to_string(),
        ],
    });

    assert_eq!(
        result.initial_directory.as_deref(),
        Some(path_to_ui_string(&project.canonicalize().unwrap()).as_str())
    );
    assert!(result
        .expanded_directories
        .contains(&path_to_ui_string(&docs.canonicalize().unwrap())));
    assert!(result
        .expanded_directories
        .contains(&path_to_ui_string(&nested.canonicalize().unwrap())));
    assert!(!result
        .expanded_directories
        .contains(&path_to_ui_string(&other.canonicalize().unwrap())));
}

#[test]
fn workspace_path_resolver_uses_antora_module_root_for_direct_page_open() {
    let dir = tempdir().expect("temp dir");
    let module = dir.path().join("project").join("modules").join("fwupdate");
    let pages = module.join("pages");
    let document = pages.join("index.adoc");
    fs::create_dir_all(&pages).expect("create pages");
    fs::create_dir_all(module.join("images")).expect("create images");
    fs::create_dir_all(module.join("partials")).expect("create partials");
    fs::write(&document, "= Index\n").expect("write document");

    let result = resolve_workspace_paths_inner(WorkspacePathResolutionInput {
        document_path: Some(document.to_string_lossy().to_string()),
        base_path: Some(pages.to_string_lossy().to_string()),
        last_directory: None,
        recent_directories: vec![],
        expanded_directories: vec![],
    });

    assert_eq!(
        result.initial_directory.as_deref(),
        Some(path_to_ui_string(&module.canonicalize().unwrap()).as_str())
    );
    assert!(result
        .expanded_directories
        .contains(&path_to_ui_string(&pages.canonicalize().unwrap())));
}

#[cfg(windows)]
#[test]
fn workspace_environment_marks_wsl_unc_as_mitigated_without_private_details() {
    let environment =
        workspace_environment_for_path(Path::new(r"\\wsl.localhost\Ubuntu\home\user\repo"));

    assert_eq!(environment.location_kind, WorkspaceLocationKind::WslUnc);
    assert_eq!(
        environment.performance_mode,
        WorkspacePerformanceMode::WslMitigated
    );
    let serialized = serde_json::to_string(&environment).expect("serialize environment");
    assert_eq!(
        serialized,
        r#"{"locationKind":"wsl-unc","performanceMode":"wsl-mitigated"}"#
    );
    assert!(!serialized.contains("Ubuntu"));
    assert!(!serialized.contains("home"));
    assert!(!serialized.contains("repo"));
}

#[cfg(windows)]
#[test]
fn workspace_environment_keeps_network_unc_in_normal_mode() {
    let environment = workspace_environment_for_path(Path::new(r"\\server\share\repo"));

    assert_eq!(environment.location_kind, WorkspaceLocationKind::NetworkUnc);
    assert_eq!(
        environment.performance_mode,
        WorkspacePerformanceMode::Normal
    );
}

#[test]
fn document_link_resolver_uses_document_parent_and_allowed_root() {
    let dir = tempdir().expect("temp dir");
    let document = dir.path().join("docs").join("guide.adoc");
    let target = dir.path().join("docs").join("next.md");
    fs::create_dir_all(document.parent().unwrap()).expect("create docs");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(&target, "# Next\n").expect("write target");
    let roots = AllowedRoots::default();
    register_allowed_root(&dir.path().canonicalize().unwrap(), &roots).expect("register root");

    let result = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "next.md#heading".to_string(),
            kind: None,
            target: None,
            label: None,
        },
        &roots,
        &ObsidianVaultCacheState::default(),
    );

    assert_eq!(result.status, "resolved");
    assert_eq!(
        result.path.as_deref(),
        Some(path_to_ui_string(&target.canonicalize().unwrap()).as_str())
    );
    assert_eq!(result.hash.as_deref(), Some("heading"));
}

#[test]
fn document_link_resolver_blocks_missing_unsupported_and_outside_paths() {
    let dir = tempdir().expect("temp dir");
    let document = dir.path().join("guide.adoc");
    let unsupported = dir.path().join("private.txt");
    let outside = tempfile::Builder::new()
        .suffix(".md")
        .tempfile()
        .expect("outside doc");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(&unsupported, "plain\n").expect("write unsupported");
    fs::write(outside.path(), "# Outside\n").expect("write outside");
    let roots = AllowedRoots::default();
    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register root");

    for href in [
        "missing.md",
        "private.txt",
        &outside.path().to_string_lossy(),
        "file:///tmp/secret.md",
        "asset://localhost/secret.md",
    ] {
        let result = resolve_document_link_inner(
            DocumentLinkResolutionInput {
                document_path: document.to_string_lossy().to_string(),
                href: href.to_string(),
                kind: None,
                target: None,
                label: None,
            },
            &roots,
            &ObsidianVaultCacheState::default(),
        );
        assert_eq!(result.status, "blocked", "{href}");
    }
}

#[test]
fn obsidian_wikilink_resolves_note_jump_inside_vault_only() {
    let dir = tempdir().expect("temp dir");
    let vault = dir.path().join("vault");
    let folder = vault.join("folder");
    fs::create_dir_all(vault.join(".obsidian")).expect("create obsidian config dir");
    fs::create_dir_all(&folder).expect("create folder");
    let document = vault.join("index.md");
    let guide = vault.join("Guide.md");
    let nested_guide = folder.join("Nested.md");
    fs::write(&document, "[[Guide]]\n").expect("write document");
    fs::write(&guide, "# Guide\n").expect("write guide");
    fs::write(&nested_guide, "# Nested guide\n").expect("write nested guide");
    let roots = AllowedRoots::default();
    register_allowed_root(&vault.canonicalize().unwrap(), &roots).expect("register vault");
    let cache = ObsidianVaultCacheState::default();

    let guide_result = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide#Intro".to_string()),
            label: Some("Alias".to_string()),
        },
        &roots,
        &cache,
    );
    assert_eq!(guide_result.status, "resolved");
    assert_eq!(
        guide_result.path.as_deref(),
        Some(path_to_ui_string(&guide.canonicalize().unwrap()).as_str())
    );
    assert_eq!(guide_result.hash.as_deref(), Some("Intro"));

    let folder_result = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:folder%2FNested".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("folder/Nested".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(folder_result.status, "resolved");
    assert_eq!(
        folder_result.path.as_deref(),
        Some(path_to_ui_string(&nested_guide.canonicalize().unwrap()).as_str())
    );
    assert_eq!(
        guide_result
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("miss")
    );
    assert_eq!(
        folder_result
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("direct")
    );
}

#[test]
fn obsidian_wikilink_blocks_missing_duplicate_and_non_vault_notes() {
    let dir = tempdir().expect("temp dir");
    let vault = dir.path().join("vault");
    let nested = vault.join("nested");
    fs::create_dir_all(vault.join(".obsidian")).expect("create obsidian config dir");
    fs::create_dir_all(&nested).expect("create nested");
    let document = vault.join("index.md");
    fs::write(&document, "[[Guide]]\n").expect("write document");
    fs::write(vault.join("Guide.md"), "# Guide\n").expect("write guide");
    fs::write(nested.join("Guide.md"), "# Nested guide\n").expect("write duplicate");
    let roots = AllowedRoots::default();
    register_allowed_root(&vault.canonicalize().unwrap(), &roots).expect("register vault");
    let cache = ObsidianVaultCacheState::default();

    let duplicate = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(duplicate.status, "blocked");
    assert_eq!(duplicate.path, None);

    let missing = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Missing".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Missing".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(missing.status, "blocked");

    let non_vault = dir.path().join("plain").join("index.md");
    fs::create_dir_all(non_vault.parent().unwrap()).expect("create plain dir");
    fs::write(&non_vault, "[[Guide]]\n").expect("write plain doc");
    register_allowed_root(non_vault.parent().unwrap(), &roots).expect("register plain");
    let disabled = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: non_vault.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(disabled.status, "blocked");
}

#[test]
fn obsidian_wikilink_cache_hits_and_can_be_cleared_without_stale_resolution() {
    let dir = tempdir().expect("temp dir");
    let vault = dir.path().join("vault");
    fs::create_dir_all(vault.join(".obsidian")).expect("create obsidian config dir");
    let document = vault.join("index.md");
    let guide = vault.join("Guide.md");
    fs::write(&document, "[[Guide]]\n").expect("write document");
    fs::write(&guide, "# Guide\n").expect("write guide");
    let roots = AllowedRoots::default();
    register_allowed_root(&vault.canonicalize().unwrap(), &roots).expect("register vault");
    let cache = ObsidianVaultCacheState::default();

    let first = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(first.status, "resolved");
    assert_eq!(
        first
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("miss")
    );

    let second = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(second.status, "resolved");
    assert_eq!(
        second
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.cache_status.as_deref()),
        Some("hit")
    );

    fs::remove_file(&guide).expect("remove guide");
    let stale = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(stale.status, "blocked");
    assert_eq!(
        stale
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.reason.as_deref()),
        Some("stale-cache")
    );

    assert!(cache
        .clear_for_path(&guide, &roots)
        .expect("clear vault cache from deleted note path"));

    assert!(!cache
        .clear_for_path(&document.canonicalize().unwrap(), &roots)
        .expect("clear vault cache"));
    let after_clear = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Guide".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Guide".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(after_clear.status, "blocked");
    assert_eq!(
        after_clear
            .metrics
            .as_ref()
            .and_then(|metrics| metrics.reason.as_deref()),
        Some("missing")
    );
}

#[test]
fn obsidian_wikilink_metrics_are_privacy_safe_for_large_vault() {
    let dir = tempdir().expect("temp dir");
    let vault = dir.path().join("vault");
    fs::create_dir_all(vault.join(".obsidian")).expect("create obsidian config dir");
    let document = vault.join("index.md");
    fs::write(&document, "[[Note119]]\n").expect("write document");
    for index in 0..120 {
        fs::write(vault.join(format!("Note{index}.md")), "# Note\n").expect("write note");
    }
    let roots = AllowedRoots::default();
    register_allowed_root(&vault.canonicalize().unwrap(), &roots).expect("register vault");
    let cache = ObsidianVaultCacheState::default();

    let result = resolve_document_link_inner(
        DocumentLinkResolutionInput {
            document_path: document.to_string_lossy().to_string(),
            href: "svard-wikilink:Note119".to_string(),
            kind: Some("wikilink".to_string()),
            target: Some("Note119".to_string()),
            label: None,
        },
        &roots,
        &cache,
    );
    assert_eq!(result.status, "resolved");
    let metrics_json = serde_json::to_string(&result.metrics).expect("metrics json");
    assert!(metrics_json.contains("noteCount"));
    assert!(metrics_json.contains("scannedDirs"));
    assert!(!metrics_json.contains("Note119"));
    assert!(!metrics_json.contains("vault"));
    assert!(!metrics_json.contains(&dir.path().to_string_lossy().to_string()));
}
