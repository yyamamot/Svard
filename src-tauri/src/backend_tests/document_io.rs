use super::shared::create_security_path_fixture;
use super::*;

#[test]
fn open_document_reads_asciidoc_source() {
    let mut file = tempfile::Builder::new()
        .suffix(".adoc")
        .tempfile()
        .expect("temp file");
    writeln!(file, "= Test").expect("write fixture");
    let payload = open_document_from_path(&file.path().to_string_lossy()).expect("payload");

    assert!(payload.source.contains("= Test"));
    assert_eq!(payload.format, "asciidoc");
    assert_eq!(
        payload.base_path,
        path_to_ui_string(
            file.path()
                .canonicalize()
                .expect("canonical path")
                .parent()
                .expect("parent")
        )
    );
}

#[test]
fn open_document_returns_canonical_document_path() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("sample.adoc");
    fs::write(&file_path, "= Canonical\n").expect("write fixture");
    let dotted_path = dir.path().join(".").join("sample.adoc");
    let payload = open_document_from_path(&dotted_path.to_string_lossy()).expect("payload");

    assert_eq!(
        payload.path,
        path_to_ui_string(&file_path.canonicalize().expect("canonical path"))
    );
}

#[test]
fn open_document_rejects_missing_workspace_fixture_path() {
    let result = open_document_from_path("/workspace/docs/mvp-guide.adoc");

    assert!(result.is_err());
    assert!(result
        .expect_err("missing fixture path should fail")
        .contains("failed to resolve document"));
}

#[test]
fn list_directory_reads_real_temp_directory_only() {
    let dir = tempdir().expect("temp dir");
    let docs_dir = dir.path().join("docs");
    let adoc = dir.path().join("guide.adoc");
    let markdown = dir.path().join("notes.md");
    let unsupported = dir.path().join("private.txt");
    fs::create_dir(&docs_dir).expect("create docs dir");
    fs::write(&adoc, "= Guide\n").expect("write adoc");
    fs::write(&markdown, "# Notes\n").expect("write markdown");
    fs::write(&unsupported, "ignore\n").expect("write unsupported");

    let entries = list_directory_from_path(&dir.path().to_string_lossy()).expect("entries");

    let docs_dir_path = path_to_ui_string(&docs_dir.canonicalize().unwrap());
    let adoc_path = path_to_ui_string(&adoc.canonicalize().unwrap());
    let markdown_path = path_to_ui_string(&markdown.canonicalize().unwrap());
    let unsupported_path = path_to_ui_string(&unsupported.canonicalize().unwrap());

    assert!(entries.iter().any(|entry| entry.path == docs_dir_path));
    assert!(entries.iter().any(|entry| entry.path == adoc_path));
    assert!(entries.iter().any(|entry| entry.path == markdown_path));
    assert!(!entries.iter().any(|entry| entry.path == unsupported_path));
}

#[cfg(unix)]
#[test]
fn list_directory_with_roots_skips_symlink_escape_entries() {
    let fixture = create_security_path_fixture();
    let link = fixture.docs.join("linked-secret.adoc");
    std::os::unix::fs::symlink(&fixture.outside_document, &link).expect("create symlink");
    let roots = AllowedRoots::default();
    register_allowed_root(&fixture.workspace, &roots).expect("register workspace");

    let entries = list_directory_from_canonical_path_with_roots(
        &fixture.docs.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("list directory");

    assert!(entries.iter().any(|entry| {
        entry.path == path_to_ui_string(&fixture.document.canonicalize().unwrap())
    }));
    assert!(!entries.iter().any(|entry| {
        entry.path == path_to_ui_string(&fixture.outside_document.canonicalize().unwrap())
    }));
}

#[cfg(unix)]
#[test]
fn search_workspace_with_roots_skips_symlink_escape_directories() {
    let fixture = create_security_path_fixture();
    let linked_outside = fixture.workspace.join("linked-outside");
    std::os::unix::fs::symlink(fixture.outside_document.parent().unwrap(), &linked_outside)
        .expect("create symlink");
    let roots = AllowedRoots::default();
    register_allowed_root(&fixture.workspace, &roots).expect("register workspace");

    let result = crate::document_io::search_workspace(
        WorkspaceSearchInput {
            root_path: fixture.workspace.to_string_lossy().to_string(),
            query: "needle".to_string(),
            max_files: 20,
            max_matches: 20,
            max_bytes_per_file: 1_048_576,
        },
        Some(&roots),
    )
    .expect("search workspace");

    assert_eq!(result.total_matches, 1);
    assert!(result
        .results
        .iter()
        .all(|item| item.path
            != path_to_ui_string(&fixture.outside_document.canonicalize().unwrap())));
    assert!(result.skipped_files >= 1);
}

#[test]
fn search_workspace_respects_max_files_cap() {
    let fixture = create_security_path_fixture();

    let result = crate::document_io::search_workspace(
        WorkspaceSearchInput {
            root_path: fixture.workspace.to_string_lossy().to_string(),
            query: "needle".to_string(),
            max_files: 1,
            max_matches: 20,
            max_bytes_per_file: 1_048_576,
        },
        None,
    )
    .expect("search workspace");

    assert!(result.capped);
    assert_eq!(result.searched_files, 1);
}

#[test]
fn open_document_accepts_budgeted_large_source_and_rejects_oversize_source() {
    let dir = tempdir().expect("temp dir");
    let budgeted = dir.path().join("budgeted.md");
    let oversize = dir.path().join("oversize.md");
    fs::write(
        &budgeted,
        format!("# Budgeted\n\n{}", "a".repeat(20 * 1_048_576)),
    )
    .expect("write budgeted");
    fs::write(
        &oversize,
        format!("# Oversize\n\n{}", "a".repeat(33 * 1_048_576)),
    )
    .expect("write oversize");

    let payload = open_document_from_path(&budgeted.to_string_lossy()).expect("open budgeted");
    assert_eq!(payload.format, "markdown");
    assert!(payload.source.len() > 20 * 1_048_576);

    let error = open_document_from_path(&oversize.to_string_lossy())
        .expect_err("oversize document should be rejected");
    assert!(error.contains("document is too large"));
}

#[test]
fn open_document_caps_include_count_and_total_bytes() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let partials = project.join("partials");
    let document = docs.join("index.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&partials).expect("create partials");
    let mut source = String::from("= Many Includes\n\n");
    for index in 0..70 {
        let name = format!("partial-{index:02}.adoc");
        source.push_str(&format!("include::../partials/{name}[]\n"));
        fs::write(partials.join(name), format!("== Partial {index}\n\nbody\n"))
            .expect("write partial");
    }
    fs::write(&document, source).expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");

    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");

    assert_eq!(payload.include_files.len(), 64);
}

#[test]
fn open_document_caps_include_total_bytes() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let partials = project.join("partials");
    let document = docs.join("index.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&partials).expect("create partials");
    let mut source = String::from("= Large Includes\n\n");
    for index in 0..6 {
        let name = format!("large-{index}.adoc");
        source.push_str(&format!("include::../partials/{name}[]\n"));
        fs::write(
            partials.join(name),
            format!("== Large {index}\n\n{}", "a".repeat(900_000)),
        )
        .expect("write partial");
    }
    fs::write(&document, source).expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");

    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");

    assert_eq!(payload.include_files.len(), 4);
    assert!(
        payload
            .include_files
            .iter()
            .map(|file| file.source.len())
            .sum::<usize>()
            <= 4 * 1_048_576
    );
}

#[test]
fn search_workspace_caps_total_scanned_entries() {
    let dir = tempdir().expect("temp dir");
    let workspace = dir.path().join("workspace");
    fs::create_dir_all(&workspace).expect("create workspace");
    fs::write(workspace.join("guide.md"), "# Guide\n\nneedle\n").expect("write guide");
    for index in 0..250 {
        fs::write(
            workspace.join(format!("ignored-{index:03}.txt")),
            "ignored\n",
        )
        .expect("write ignored");
    }

    let result = crate::document_io::search_workspace(
        WorkspaceSearchInput {
            root_path: workspace.to_string_lossy().to_string(),
            query: "needle".to_string(),
            max_files: 0,
            max_matches: 20,
            max_bytes_per_file: 1_048_576,
        },
        None,
    )
    .expect("search workspace");

    assert!(result.capped);
    assert_eq!(result.searched_files, 0);
}

#[test]
fn open_document_collects_include_and_resolves_drawio_image_from_real_files() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("index.adoc");
    let partials = project.join("partials");
    let assets = project.join("images");
    let partial = partials.join("partial.adoc");
    let image = assets.join("diagram.drawio.svg");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&partials).expect("create partials");
    fs::create_dir_all(&assets).expect("create assets");
    fs::write(
        &document,
        "= Main\n\ninclude::../partials/partial.adoc[]\n\nimage::../images/diagram.drawio.svg[]\n",
    )
    .expect("write document");
    fs::write(&partial, "== Included\n\nIncluded body.\n").expect("write partial");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Drawio</text></svg>"#,
    )
    .expect("write drawio image");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");
    let image_result =
        resolve_local_image_from_path("../images/diagram.drawio.svg", &payload.path, &roots)
            .expect("resolve image");

    assert_eq!(payload.include_files.len(), 1);
    assert_eq!(
        payload.include_files[0].path,
        path_to_ui_string(&partial.canonicalize().unwrap())
    );
    assert!(payload.include_files[0].source.contains("Included body."));
    assert_eq!(image_result.status, "resolved");
    assert_eq!(image_result.media_type.as_deref(), Some("image/svg+xml"));
    assert!(image_result.content.unwrap().contains("Drawio"));
}

#[test]
fn open_document_collects_conditional_and_attribute_substituted_includes() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let partials = project.join("partials");
    let nested = partials.join("nested");
    let document = docs.join("index.adoc");
    let enabled = partials.join("enabled.adoc");
    let prod = partials.join("prod.adoc");
    let seed = partials.join("attribute-seed.adoc");
    let propagated = nested.join("propagated.adoc");
    let disabled = partials.join("disabled.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&partials).expect("create partials");
    fs::create_dir_all(&nested).expect("create nested");
    fs::write(
        &document,
        "= Main\n:feature:\n:env: prod\n:partialsdir: ../partials\n\nifdef::feature[]\ninclude::{partialsdir}/enabled.adoc[]\nendif::[]\n\nifndef::feature[]\ninclude::{partialsdir}/disabled.adoc[]\nendif::[]\n\nifeval::[\"{env}\" == \"prod\"]\ninclude::{partialsdir}/prod.adoc[]\nendif::[]\n\ninclude::{partialsdir}/attribute-seed.adoc[]\ninclude::{propagated-partial}/propagated.adoc[]\n",
    )
    .expect("write document");
    fs::write(&enabled, "== Enabled\n").expect("write enabled");
    fs::write(&prod, "== Production\n").expect("write prod");
    fs::write(&seed, ":propagated-partial: ../partials/nested\n").expect("write seed");
    fs::write(&propagated, "== Propagated\n").expect("write propagated");
    fs::write(&disabled, "== Disabled\n").expect("write disabled");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");

    let include_paths: Vec<_> = payload
        .include_files
        .iter()
        .map(|file| file.path.as_str())
        .collect();
    assert_eq!(
        include_paths,
        vec![
            path_to_ui_string(&enabled.canonicalize().unwrap()),
            path_to_ui_string(&prod.canonicalize().unwrap()),
            path_to_ui_string(&seed.canonicalize().unwrap()),
            path_to_ui_string(&propagated.canonicalize().unwrap()),
        ]
    );
    let include_graph = payload.include_graph.expect("include graph");
    let active_count = include_graph
        .nodes
        .iter()
        .filter(|node| node.kind == "include" && node.status == "active")
        .count();
    let skipped_nodes: Vec<_> = include_graph
        .nodes
        .iter()
        .filter(|node| node.status == "skipped")
        .collect();
    assert_eq!(active_count, 4);
    assert_eq!(skipped_nodes.len(), 1);
    assert_eq!(skipped_nodes[0].display_path, "disabled.adoc");
    assert_eq!(skipped_nodes[0].reason.as_deref(), Some("conditional"));
    let graph_json = serde_json::to_string(&include_graph).expect("serialize include graph");
    assert!(!graph_json.contains("== Enabled"));
    assert!(!graph_json.contains("== Disabled"));
}

#[test]
fn direct_antora_page_open_collects_module_partials_and_images() {
    let dir = tempdir().expect("temp dir");
    let module = dir.path().join("project").join("modules").join("fwupdate");
    let pages = module.join("pages");
    let partials = module.join("partials");
    let examples = module.join("examples");
    let images = module.join("images");
    let document = pages.join("index.adoc");
    let header = partials.join("header.adoc");
    let service = examples.join("service-unit.service");
    let image = images.join("active_backup.drawio.svg");
    let outside = dir
        .path()
        .join("project")
        .join("modules")
        .join("secret.adoc");
    fs::create_dir_all(&pages).expect("create pages");
    fs::create_dir_all(&partials).expect("create partials");
    fs::create_dir_all(&examples).expect("create examples");
    fs::create_dir_all(&images).expect("create images");
    fs::write(
        &document,
        "= Main\n\ninclude::../partials/header.adoc[]\n\ninclude::../../secret.adoc[]\n\n[source,systemd]\n----\ninclude::../examples/service-unit.service[]\n----\n\nimage:active_backup.drawio.svg[]\n",
    )
    .expect("write document");
    fs::write(
        &header,
        ":imagesdir: ../images\n\n== Included Header\n\nHeader body.\n",
    )
    .expect("write header");
    fs::write(&service, "[Service]\nExecStart=/usr/bin/example\n").expect("write service");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Active Backup</text></svg>"#,
    )
    .expect("write image");
    fs::write(&outside, "= Outside\n").expect("write outside");
    let roots = AllowedRoots::default();
    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register antora module root");

    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");
    let image_result =
        resolve_local_image_from_path("../images/active_backup.drawio.svg", &payload.path, &roots)
            .expect("resolve image");

    assert_eq!(payload.include_files.len(), 2);
    assert_eq!(
        payload.include_files[0].path,
        path_to_ui_string(&header.canonicalize().unwrap())
    );
    assert_eq!(
        payload.include_files[1].path,
        path_to_ui_string(&service.canonicalize().unwrap())
    );
    assert!(payload.include_files[0]
        .source
        .contains(":imagesdir: ../images"));
    assert!(payload.include_files[1].source.contains("ExecStart"));
    assert_eq!(image_result.status, "resolved");
    assert_eq!(image_result.media_type.as_deref(), Some("image/svg+xml"));
    assert!(image_result.content.unwrap().contains("Active Backup"));
}

#[test]
fn open_document_collects_text_include_files_without_extension_allowlist() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let examples = project.join("examples");
    let scripts = project.join("scripts");
    let snippets = project.join("snippets");
    let document = docs.join("index.adoc");
    let service = examples.join("service-unit.service");
    let script = scripts.join("start-helper.sh");
    let env = snippets.join("config.env");
    let nested = scripts.join("nested.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&examples).expect("create examples");
    fs::create_dir_all(&scripts).expect("create scripts");
    fs::create_dir_all(&snippets).expect("create snippets");
    fs::write(
        &document,
        "= Text Includes\n\n[source,systemd]\n----\ninclude::../examples/service-unit.service[]\n----\n\n[source,bash]\n----\ninclude::../scripts/start-helper.sh[]\n----\n\n[source,dotenv]\n----\ninclude::../snippets/config.env[]\n----\n",
    )
    .expect("write document");
    fs::write(&service, "[Service]\nExecStart=/usr/bin/example\n").expect("write service");
    fs::write(
        &script,
        "#!/usr/bin/env bash\ninclude::nested.adoc[]\necho ready\n",
    )
    .expect("write script");
    fs::write(&env, "FEATURE_FLAG=true\n").expect("write env");
    fs::write(&nested, "== Nested\n\nThis should not be collected.\n").expect("write nested");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    let include_paths: Vec<_> = payload
        .include_files
        .iter()
        .map(|file| file.path.as_str())
        .collect();
    assert_eq!(
        include_paths,
        vec![
            path_to_ui_string(&service.canonicalize().unwrap()),
            path_to_ui_string(&script.canonicalize().unwrap()),
            path_to_ui_string(&env.canonicalize().unwrap()),
        ]
    );
    assert!(payload.include_files[0].source.contains("ExecStart"));
    assert!(payload.include_files[1].source.contains("echo ready"));
    assert!(payload.include_files[2].source.contains("FEATURE_FLAG"));
    assert!(payload
        .include_files
        .iter()
        .all(|file| file.path != path_to_ui_string(&nested.canonicalize().unwrap())));
}

#[test]
fn open_document_rejects_non_text_or_unsafe_include_files() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let outside_root = dir.path().join("outside");
    let docs = project.join("docs");
    let inputs = project.join("inputs");
    let document = docs.join("index.adoc");
    let binary = inputs.join("binary.dat");
    let nul = inputs.join("nul.txt");
    let large = inputs.join("large.conf");
    let directory = inputs.join("directory-candidate");
    let outside = outside_root.join("outside.service");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&inputs).expect("create inputs");
    fs::create_dir_all(&directory).expect("create directory include candidate");
    fs::create_dir_all(&outside_root).expect("create outside");
    fs::write(
        &document,
        "= Rejected Includes\n\ninclude::../inputs/binary.dat[]\ninclude::../inputs/nul.txt[]\ninclude::../inputs/large.conf[]\ninclude::../inputs/directory-candidate[]\ninclude::../../outside/outside.service[]\ninclude::https://example.invalid/source.txt[]\n",
    )
    .expect("write document");
    fs::write(&binary, [0xff, 0xfe, 0xfd]).expect("write binary");
    fs::write(&nul, "prefix\0suffix").expect("write nul text");
    fs::write(&large, vec![b'a'; 1_048_577]).expect("write large file");
    fs::write(&outside, "[Service]\nExecStart=/usr/bin/outside\n").expect("write outside");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    assert!(payload.include_files.is_empty());
    let include_graph = payload.include_graph.expect("include graph");
    let statuses: Vec<_> = include_graph
        .nodes
        .iter()
        .filter(|node| node.kind == "include")
        .map(|node| (node.status.as_str(), node.reason.as_deref()))
        .collect();
    assert!(
        statuses.contains(&("blocked", Some("binary")))
            || statuses.contains(&("blocked", Some("unreadable")))
    );
    assert!(statuses.contains(&("blocked", Some("too-large"))));
    assert!(statuses.contains(&("blocked", Some("outside-root"))));
    assert!(statuses.contains(&("blocked", Some("unsafe"))));
}

#[test]
fn open_document_blocks_protocol_and_absolute_include_targets_as_unsafe() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("index.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::write(
        &document,
        "= Unsafe Targets\n\ninclude::file:../secrets.adoc[]\ninclude::asset:source.adoc[]\ninclude::https://example.invalid/source.adoc[]\ninclude::C:\\\\Users\\\\name\\\\secret.adoc[]\ninclude::\\\\\\\\server\\\\share\\\\secret.adoc[]\ninclude::/private/secret.adoc[]\ninclude::bad\u{0}target.adoc[]\n",
    )
    .expect("write document");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    assert!(payload.include_files.is_empty());
    let include_graph = payload.include_graph.expect("include graph");
    let include_nodes: Vec<_> = include_graph
        .nodes
        .iter()
        .filter(|node| node.kind == "include")
        .collect();
    assert_eq!(include_nodes.len(), 7);
    assert!(include_nodes
        .iter()
        .all(|node| node.status == "blocked" && node.reason.as_deref() == Some("unsafe")));
    let graph_json = serde_json::to_string(&include_graph).expect("serialize include graph");
    assert!(!graph_json.contains("https://example.invalid"));
    assert!(!graph_json.contains("/private/secret"));
    assert!(!graph_json.contains("C:\\"));
    assert!(!graph_json.contains("\\\\server"));
}

#[test]
fn skipped_conditional_include_does_not_read_target_or_leak_source() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let partials = project.join("partials");
    let document = docs.join("index.adoc");
    let skipped = partials.join("disabled.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&partials).expect("create partials");
    fs::write(
        &document,
        "= Conditional\n\nifdef::disabled[]\ninclude::../partials/disabled.adoc[]\nendif::[]\n",
    )
    .expect("write document");
    fs::write(&skipped, "== Disabled\n\nDo not read this source body.\n").expect("write skipped");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    assert!(payload.include_files.is_empty());
    let include_graph = payload.include_graph.expect("include graph");
    let graph_json = serde_json::to_string(&include_graph).expect("serialize include graph");
    assert!(graph_json.contains("\"status\":\"skipped\""));
    assert!(graph_json.contains("\"reason\":\"conditional\""));
    assert!(!graph_json.contains("Do not read this source body"));
    assert!(!graph_json.contains(&path_to_ui_string(&skipped.canonicalize().unwrap())));
}

#[cfg(unix)]
#[test]
fn open_document_blocks_symlink_escape_include_as_outside_root() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let partials = project.join("partials");
    let outside = dir.path().join("outside");
    let document = docs.join("index.adoc");
    let outside_secret = outside.join("secret.adoc");
    let symlink = partials.join("linked-secret.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&partials).expect("create partials");
    fs::create_dir_all(&outside).expect("create outside");
    fs::write(
        &document,
        "= Symlink\n\ninclude::../partials/linked-secret.adoc[]\n",
    )
    .expect("write document");
    fs::write(
        &outside_secret,
        "== Outside\n\nOutside body must not render.\n",
    )
    .expect("write outside");
    std::os::unix::fs::symlink(&outside_secret, &symlink).expect("create symlink");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    assert!(payload.include_files.is_empty());
    let include_graph = payload.include_graph.expect("include graph");
    let statuses: Vec<_> = include_graph
        .nodes
        .iter()
        .filter(|node| node.kind == "include")
        .map(|node| (node.status.as_str(), node.reason.as_deref()))
        .collect();
    assert_eq!(statuses, vec![("blocked", Some("outside-root"))]);
    let graph_json = serde_json::to_string(&include_graph).expect("serialize include graph");
    assert!(!graph_json.contains("Outside body must not render"));
    assert!(!graph_json.contains(&path_to_ui_string(&outside_secret.canonicalize().unwrap())));
}

#[test]
fn open_document_collects_proto_include_inside_source_block() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let examples = project.join("examples");
    let document = docs.join("index.adoc");
    let proto = examples.join("service.proto");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&examples).expect("create examples");
    fs::write(
        &document,
        "= API Reference\n\n[source]\n----\ninclude::../examples/service.proto[service.proto]\n----\n",
    )
    .expect("write document");
    fs::write(
        &proto,
        "syntax = \"proto3\";\n\nmessage RenderRequest {\n  string document_path = 1;\n}\n",
    )
    .expect("write proto");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    assert_eq!(payload.include_files.len(), 1);
    assert_eq!(
        payload.include_files[0].path,
        path_to_ui_string(&proto.canonicalize().unwrap())
    );
    assert!(payload.include_files[0]
        .source
        .contains("message RenderRequest"));
}

#[test]
fn open_document_collects_extensionless_utf8_include_as_literal() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let scripts = project.join("scripts");
    let nested = scripts.join("nested.adoc");
    let document = docs.join("index.adoc");
    let helper = scripts.join("git-helper");
    let binary = scripts.join("binary-helper");
    let directory = scripts.join("directory-helper");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&scripts).expect("create scripts");
    fs::create_dir_all(&directory).expect("create directory include candidate");
    fs::write(
        &document,
        "= Helper\n\n[source,ruby]\n----\ninclude::../scripts/git-helper[]\ninclude::../scripts/binary-helper[]\ninclude::../scripts/directory-helper[]\n----\n",
    )
    .expect("write document");
    fs::write(&helper, "puts 'helper'\ninclude::nested.adoc[]\n")
        .expect("write extensionless helper");
    fs::write(
        &nested,
        "== Nested\n\nThis must not be recursively collected.\n",
    )
    .expect("write nested document");
    fs::write(&binary, [0xff, 0xfe, 0xfd]).expect("write non utf8 helper");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");

    assert_eq!(payload.include_files.len(), 1);
    assert_eq!(
        payload.include_files[0].path,
        path_to_ui_string(&helper.canonicalize().unwrap())
    );
    assert!(payload.include_files[0].source.contains("puts 'helper'"));
    assert!(payload
        .include_files
        .iter()
        .all(|file| file.path != path_to_ui_string(&nested.canonicalize().unwrap())));
}
