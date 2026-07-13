use super::shared::git;
use super::*;

#[test]
fn local_image_resolver_reads_registered_root_images_only() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("guide.adoc");
    let image = project.join("images").join("sample.svg");
    let drawio_image = project.join("images").join("diagram.drawio.svg");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(image.parent().unwrap()).expect("create assets");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Safe</text></svg>"#,
    )
    .expect("write image");
    fs::write(
        &drawio_image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Drawio</text></svg>"#,
    )
    .expect("write drawio image");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");

    let result =
        resolve_local_image_from_path("../images/sample.svg", &document.to_string_lossy(), &roots)
            .expect("local image");
    let drawio_result = resolve_local_image_from_path(
        "../images/diagram.drawio.svg",
        &document.to_string_lossy(),
        &roots,
    )
    .expect("drawio image");

    assert_eq!(result.status, "resolved");
    assert_eq!(result.media_type.as_deref(), Some("image/svg+xml"));
    assert_eq!(result.encoding.as_deref(), Some("utf8"));
    let expected_image_path = image.canonicalize().expect("canonical image path");
    assert_eq!(
        result.resolved_path.as_deref(),
        Some(expected_image_path.to_string_lossy().as_ref())
    );
    assert!(result.content.unwrap().contains("Safe"));
    assert_eq!(drawio_result.status, "resolved");
    assert_eq!(drawio_result.media_type.as_deref(), Some("image/svg+xml"));
    assert!(drawio_result.content.unwrap().contains("Drawio"));
}

#[test]
fn local_image_resolver_blocks_outside_unsupported_and_oversize_images() {
    let dir = tempdir().expect("temp dir");
    let document = dir.path().join("guide.adoc");
    let unsupported = dir.path().join("notes.txt");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(&unsupported, "plain\n").expect("write unsupported");
    let outside = tempfile::Builder::new()
        .suffix(".svg")
        .tempfile()
        .expect("outside image");
    fs::write(outside.path(), "<svg />").expect("write outside image");
    let large = dir.path().join("large.png");
    fs::write(&large, vec![0_u8; LOCAL_IMAGE_MAX_BYTES as usize + 1]).expect("write large image");
    let roots = AllowedRoots::default();
    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register root");

    let outside_result = resolve_local_image_from_path(
        &outside.path().to_string_lossy(),
        &document.to_string_lossy(),
        &roots,
    )
    .expect("outside image");
    let unsupported_result = resolve_local_image_from_path(
        &unsupported.to_string_lossy(),
        &document.to_string_lossy(),
        &roots,
    )
    .expect("unsupported image");
    let large_result = resolve_local_image_from_path(
        &large.to_string_lossy(),
        &document.to_string_lossy(),
        &roots,
    )
    .expect("large image");
    let file_url_result = resolve_local_image_from_path(
        "file:///tmp/sample.svg",
        &document.to_string_lossy(),
        &roots,
    )
    .expect("file URL image");
    let asset_url_result = resolve_local_image_from_path(
        "asset://localhost/sample.svg",
        &document.to_string_lossy(),
        &roots,
    )
    .expect("asset URL image");

    assert_eq!(outside_result.status, "blocked");
    assert_eq!(unsupported_result.status, "blocked");
    assert_eq!(large_result.status, "blocked");
    assert_eq!(file_url_result.status, "blocked");
    assert_eq!(asset_url_result.status, "blocked");
    assert!(outside_result.resolved_path.is_none());
    assert!(unsupported_result.resolved_path.is_none());
    assert!(large_result.resolved_path.is_none());
    assert!(file_url_result.resolved_path.is_none());
    assert!(asset_url_result.resolved_path.is_none());
}

#[test]
fn local_image_resolver_decodes_percent_encoded_relative_paths() {
    let dir = tempdir().expect("temp dir");
    let document = dir.path().join("guide.adoc");
    let image = dir.path().join("image space.drawio.svg");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Encoded</text></svg>"#,
    )
    .expect("write image");
    let roots = AllowedRoots::default();
    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register root");

    let result = resolve_local_image_from_path(
        "image%20space.drawio.svg",
        &document.to_string_lossy(),
        &roots,
    )
    .expect("encoded image");

    assert_eq!(result.status, "resolved");
    assert!(result.content.unwrap().contains("Encoded"));
}

#[test]
fn local_image_resolver_reads_root_relative_workspace_assets() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("articles");
    let document = docs.join("article.md");
    let image = project
        .join("images")
        .join("article")
        .join("sample space.png");
    let assets_image = project.join("assets").join("logo.svg");
    let img_image = project.join("img").join("cover.webp");
    let static_image = project.join("static").join("badge.gif");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(image.parent().unwrap()).expect("create images");
    fs::create_dir_all(assets_image.parent().unwrap()).expect("create assets");
    fs::create_dir_all(img_image.parent().unwrap()).expect("create img");
    fs::create_dir_all(static_image.parent().unwrap()).expect("create static");
    fs::write(&document, "# Article\n").expect("write document");
    fs::write(&image, [137, 80, 78, 71]).expect("write png");
    fs::write(
        &assets_image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Logo</text></svg>"#,
    )
    .expect("write svg");
    fs::write(&img_image, "webp").expect("write webp");
    fs::write(&static_image, "gif").expect("write gif");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");

    let image_result = resolve_local_image_from_path(
        "/images/article/sample%20space.png",
        &document.to_string_lossy(),
        &roots,
    )
    .expect("root-relative png");
    let assets_result =
        resolve_local_image_from_path("/assets/logo.svg", &document.to_string_lossy(), &roots)
            .expect("root-relative svg");
    let img_result =
        resolve_local_image_from_path("/img/cover.webp", &document.to_string_lossy(), &roots)
            .expect("root-relative webp");
    let static_result =
        resolve_local_image_from_path("/static/badge.gif", &document.to_string_lossy(), &roots)
            .expect("root-relative gif");

    assert_eq!(image_result.status, "resolved");
    assert_eq!(image_result.media_type.as_deref(), Some("image/png"));
    assert_eq!(assets_result.status, "resolved");
    assert!(assets_result.content.unwrap().contains("Logo"));
    assert_eq!(img_result.media_type.as_deref(), Some("image/webp"));
    assert_eq!(static_result.media_type.as_deref(), Some("image/gif"));
}

#[test]
fn markdown_resource_context_keeps_root_relative_images_stable_after_reload() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let articles = project.join("articles");
    let document = articles.join("post.md");
    let image = project.join("images").join("post").join("hero.svg");
    fs::create_dir_all(&articles).expect("create articles");
    fs::create_dir_all(image.parent().unwrap()).expect("create images");
    fs::write(&document, "# Post\n\n![Hero](/images/post/hero.svg)\n").expect("write document");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Hero</text></svg>"#,
    )
    .expect("write image");

    let roots = AllowedRoots::default();
    register_allowed_root(&articles.canonicalize().unwrap(), &roots)
        .expect("register document parent");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open markdown document");

    let result = resolve_local_image_from_path_with_resource_context(
        "/images/post/hero.svg",
        &payload.path,
        &roots,
        Some(&payload.resource_context),
    )
    .expect("root-relative image");

    assert_eq!(
        payload.resource_context.workspace_root,
        path_to_ui_string(&project.canonicalize().unwrap())
    );
    assert_eq!(result.status, "resolved");
    assert_eq!(result.media_type.as_deref(), Some("image/svg+xml"));
    assert!(result.content.unwrap().contains("Hero"));
}

#[test]
fn local_image_resolver_ignores_forged_root_relative_resource_context() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let articles = project.join("articles");
    let document = articles.join("post.md");
    let outside = dir.path().join("outside");
    let outside_image = outside.join("images").join("secret.svg");
    fs::create_dir_all(&articles).expect("create articles");
    fs::create_dir_all(outside_image.parent().unwrap()).expect("create outside images");
    fs::write(&document, "# Post\n").expect("write document");
    fs::write(
        &outside_image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Outside</text></svg>"#,
    )
    .expect("write outside image");

    let roots = AllowedRoots::default();
    register_allowed_root(&articles.canonicalize().unwrap(), &roots)
        .expect("register document parent");
    let forged_context = DocumentResourceContext {
        workspace_root: path_to_ui_string(&outside.canonicalize().unwrap()),
        document_dir: path_to_ui_string(&articles.canonicalize().unwrap()),
        resource_roots: vec![path_to_ui_string(&outside.canonicalize().unwrap())],
    };

    let result = resolve_local_image_from_path_with_resource_context(
        "/images/secret.svg",
        &document.to_string_lossy(),
        &roots,
        Some(&forged_context),
    )
    .expect("forged context image");

    assert_eq!(result.status, "blocked");
    assert!(result.content.is_none());
    assert_eq!(
        result.placeholder_text.as_deref(),
        Some("Local image is not available.")
    );
}

#[test]
fn local_image_resolver_ignores_forged_imagesdir_context() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("guide.adoc");
    let outside = dir.path().join("outside");
    let outside_image = outside.join("assets").join("secret.svg");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(outside_image.parent().unwrap()).expect("create outside assets");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(
        &outside_image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Outside imagesdir</text></svg>"#,
    )
    .expect("write outside image");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");
    let mut attributes = std::collections::BTreeMap::new();
    attributes.insert("imagesdir".to_string(), "assets".to_string());
    let forged_context = AsciiDocRenderContext {
        base_dir: path_to_ui_string(&outside.canonicalize().unwrap()),
        workspace_root: path_to_ui_string(&outside.canonicalize().unwrap()),
        document_dir: path_to_ui_string(&docs.canonicalize().unwrap()),
        attributes,
        resource_roots: vec![path_to_ui_string(&outside.canonicalize().unwrap())],
    };

    let result = resolve_local_image_from_path_with_context(
        "secret.svg",
        &document.to_string_lossy(),
        &roots,
        Some(&forged_context),
    )
    .expect("forged imagesdir context image");

    assert_eq!(result.status, "blocked");
    assert!(result.content.is_none());
    assert_eq!(
        result.placeholder_text.as_deref(),
        Some("Local image is not available.")
    );
}

#[test]
fn local_image_resolver_blocks_root_relative_traversal_segments() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("guide.md");
    let private_image = project.join("private").join("secret.svg");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(private_image.parent().unwrap()).expect("create private");
    fs::write(&document, "# Guide\n").expect("write document");
    fs::write(
        &private_image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Secret</text></svg>"#,
    )
    .expect("write private image");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");

    for source in [
        "/images/../private/secret.svg",
        "/images/%2e%2e/private/secret.svg",
        "/images/..%2fprivate/secret.svg",
        "/images\\..\\private\\secret.svg",
    ] {
        let result = resolve_local_image_from_path(source, &document.to_string_lossy(), &roots)
            .expect("blocked traversal source");
        assert_eq!(result.status, "blocked", "{source}");
        assert!(result.content.is_none(), "{source}");
    }
}

#[test]
fn local_image_resolver_blocks_non_asset_root_relative_paths() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("guide.md");
    fs::create_dir_all(&docs).expect("create docs");
    fs::write(&document, "# Guide\n").expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");

    for source in [
        "/etc/passwd",
        "/Users/name/file.png",
        "/private/tmp/image.svg",
    ] {
        let result = resolve_local_image_from_path(source, &document.to_string_lossy(), &roots)
            .expect("blocked root-relative source");
        assert_eq!(result.status, "blocked");
    }
}

#[test]
fn local_image_resolver_reports_missing_root_relative_workspace_asset() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let document = docs.join("guide.md");
    fs::create_dir_all(&docs).expect("create docs");
    fs::write(&document, "# Guide\n").expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");

    let result =
        resolve_local_image_from_path("/images/missing.png", &document.to_string_lossy(), &roots)
            .expect("missing root-relative image");

    assert_eq!(result.status, "blocked");
    assert_eq!(
        result.placeholder_text.as_deref(),
        Some("Local image is not available.")
    );
}

#[test]
fn antora_page_image_resolver_falls_back_to_module_images_for_plain_name() {
    let dir = tempdir().expect("temp dir");
    let module = dir.path().join("project").join("modules").join("module-a");
    let pages = module.join("pages");
    let images = module.join("images");
    let document = pages.join("index.adoc");
    let image = images.join("state.drawio.svg");
    fs::create_dir_all(&pages).expect("create pages");
    fs::create_dir_all(&images).expect("create images");
    fs::write(&document, "= Guide\n\nimage:state.drawio.svg[]\n").expect("write document");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Module image</text></svg>"#,
    )
    .expect("write image");
    let roots = AllowedRoots::default();
    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register module root");

    let result =
        resolve_local_image_from_path("state.drawio.svg", &document.to_string_lossy(), &roots)
            .expect("module image");

    assert_eq!(result.status, "resolved");
    assert_eq!(result.media_type.as_deref(), Some("image/svg+xml"));
    assert!(result.content.unwrap().contains("Module image"));
}

#[test]
fn local_image_resolver_uses_asciidoc_context_base_dir_for_section_files() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let sections = project.join("book").join("07-git-tools").join("sections");
    let images = project.join("images");
    let document = sections.join("advanced-merging.adoc");
    let image = images.join("undomerge-start.png");
    fs::create_dir_all(&sections).expect("create sections");
    fs::create_dir_all(&images).expect("create images");
    fs::write(
        &document,
        "= Advanced Merging\n\nimage::images/undomerge-start.png[]\n",
    )
    .expect("write document");
    fs::write(&image, [137, 80, 78, 71]).expect("write image");
    git(&project, &["init"]);

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register project root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");
    let context = payload.asciidoc_context.as_ref().expect("asciidoc context");
    let result = resolve_local_image_from_path_with_context(
        "images/undomerge-start.png",
        &payload.path,
        &roots,
        Some(context),
    )
    .expect("project image");

    assert_eq!(
        context.base_dir,
        path_to_ui_string(&project.canonicalize().unwrap())
    );
    assert_eq!(result.status, "resolved");
    assert_eq!(result.media_type.as_deref(), Some("image/png"));
}

#[test]
fn local_image_resolver_uses_document_imagesdir_for_manual_pages() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let manual = project.join("docs").join("samples").join("manual");
    let assets = manual.join("assets");
    let document = manual.join("index.adoc");
    let image = assets.join("oversized-diagram.svg");
    fs::create_dir_all(&assets).expect("create assets");
    fs::write(
        &document,
        "= Manual\n:imagesdir: assets\n\nimage::oversized-diagram.svg[]\n",
    )
    .expect("write document");
    fs::write(
        &image,
        r#"<svg xmlns="http://www.w3.org/2000/svg"><text>Oversized SVG</text></svg>"#,
    )
    .expect("write image");
    git(&project, &["init"]);

    let roots = AllowedRoots::default();
    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register git worktree root");
    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    )
    .expect("open document");
    let context = payload.asciidoc_context.as_ref().expect("asciidoc context");
    let source_result = resolve_local_image_from_path_with_context(
        "oversized-diagram.svg",
        &payload.path,
        &roots,
        Some(context),
    )
    .expect("manual image");
    let rendered_src_result = resolve_local_image_from_path_with_context(
        "assets/oversized-diagram.svg",
        &payload.path,
        &roots,
        Some(context),
    )
    .expect("manual rendered src image");
    let missing_result = resolve_local_image_from_path_with_context(
        "assets/missing-manual-image.png",
        &payload.path,
        &roots,
        Some(context),
    )
    .expect("manual missing image");

    assert_eq!(
        context.attributes.get("imagesdir").map(String::as_str),
        Some("assets")
    );
    assert_eq!(source_result.status, "resolved");
    assert_eq!(source_result.media_type.as_deref(), Some("image/svg+xml"));
    assert!(source_result.content.unwrap().contains("Oversized SVG"));
    assert_eq!(rendered_src_result.status, "resolved");
    assert_eq!(
        rendered_src_result.media_type.as_deref(),
        Some("image/svg+xml")
    );
    assert_eq!(missing_result.status, "blocked");
    assert_eq!(
        missing_result.placeholder_text.as_deref(),
        Some("Local image is not available.")
    );
}

#[test]
fn git_diff_local_image_resolver_reads_commit_and_worktree_versions_separately() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let docs = project.join("docs");
    let images = project.join("images");
    let document = docs.join("guide.md");
    let image = images.join("diagram.svg");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&images).expect("create images");
    fs::write(&document, "# Guide\n\n![Diagram](/images/diagram.svg)\n").expect("write document");
    fs::write(&image, "<svg><text>before</text></svg>").expect("write image");
    git(&project, &["init"]);
    git(&project, &["config", "user.email", "fixture@example.com"]);
    git(&project, &["config", "user.name", "Fixture"]);
    git(&project, &["add", "."]);
    git(&project, &["commit", "-m", "initial"]);
    let revision = "HEAD".to_string();
    fs::write(&image, "<svg><text>after</text></svg>").expect("update image");

    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");
    let commit = resolve_git_diff_local_image_from_source(
        "/images/diagram.svg",
        &document.to_string_lossy(),
        &project.to_string_lossy(),
        &GitDiffResourceSource::Commit { revision },
        &roots,
        None,
    )
    .expect("commit image");
    let worktree = resolve_git_diff_local_image_from_source(
        "/images/diagram.svg",
        &document.to_string_lossy(),
        &project.to_string_lossy(),
        &GitDiffResourceSource::Worktree,
        &roots,
        None,
    )
    .expect("worktree image");
    git(&project, &["add", "images/diagram.svg"]);
    fs::write(&image, "<svg><text>latest</text></svg>").expect("update image again");
    let index = resolve_git_diff_local_image_from_source(
        "/images/diagram.svg",
        &document.to_string_lossy(),
        &project.to_string_lossy(),
        &GitDiffResourceSource::Index,
        &roots,
        None,
    )
    .expect("index image");
    let latest_worktree = resolve_git_diff_local_image_from_source(
        "/images/diagram.svg",
        &document.to_string_lossy(),
        &project.to_string_lossy(),
        &GitDiffResourceSource::Worktree,
        &roots,
        None,
    )
    .expect("latest worktree image");

    assert_eq!(commit.status, "resolved", "{commit:?}");
    let expected_path = image.canonicalize().expect("canonical image path");
    assert_eq!(
        commit.resolved_path.as_deref(),
        Some(expected_path.to_string_lossy().as_ref())
    );
    assert_eq!(worktree.resolved_path, commit.resolved_path);
    assert!(commit
        .content
        .as_deref()
        .is_some_and(|value| value.contains("before")));
    assert!(worktree
        .content
        .as_deref()
        .is_some_and(|value| value.contains("after")));
    assert_ne!(commit.content, worktree.content);
    assert!(index
        .content
        .as_deref()
        .is_some_and(|value| value.contains("after")));
    assert!(latest_worktree
        .content
        .as_deref()
        .is_some_and(|value| value.contains("latest")));
}
