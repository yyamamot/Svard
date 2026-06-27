use super::*;

#[test]
fn open_document_merges_antora_static_attributes_into_render_context() {
    let dir = tempdir().expect("temp dir");
    let project = dir.path().join("project");
    let content_root = project.join("docs-site");
    let pages = content_root.join("modules/ROOT/pages");
    let partials = content_root.join("modules/ROOT/partials");
    fs::create_dir_all(&pages).expect("create pages");
    fs::create_dir_all(&partials).expect("create partials");
    fs::write(
        project.join("antora-playbook.yml"),
        r#"
content:
  sources:
    - url: ./docs-site
asciidoc:
  attributes:
    partialsdir: ../partials
    product-name: Playbook Product
    playbook-only: 42
    preview-enabled: true
    ignored-list:
      - hidden
"#,
    )
    .expect("write playbook");
    fs::write(
        content_root.join("antora.yml"),
        r#"
name: docs
title: Docs
version: ~
asciidoc:
  attributes:
    product-name: Component Product
    component-only: component value
    imagesdir: ../images
"#,
    )
    .expect("write component descriptor");
    fs::write(
        partials.join("intro.adoc"),
        "= Attribute Partial\n\n{product-name} / {component-only} / {playbook-only}\n",
    )
    .expect("write partial");
    let document = pages.join("index.adoc");
    fs::write(
        &document,
        "= Antora Attributes\n:product-name: Document Product\n\nifdef::preview-enabled[]\ninclude::{partialsdir}/intro.adoc[]\nendif::[]\n",
    )
    .expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&project.canonicalize().unwrap(), &roots).expect("register root");

    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");
    let context = payload.asciidoc_context.expect("asciidoc context");

    assert_eq!(
        context.attributes.get("product-name").map(String::as_str),
        Some("Document Product")
    );
    assert_eq!(
        context.attributes.get("component-only").map(String::as_str),
        Some("component value")
    );
    assert_eq!(
        context.attributes.get("playbook-only").map(String::as_str),
        Some("42")
    );
    assert_eq!(
        context.attributes.get("imagesdir").map(String::as_str),
        Some("../images")
    );
    assert_eq!(
        context
            .attributes
            .get("preview-enabled")
            .map(String::as_str),
        Some("")
    );
    assert!(!context.attributes.contains_key("ignored-list"));
    assert!(payload.include_files.iter().any(|file| {
        file.path == path_to_ui_string(&partials.join("intro.adoc").canonicalize().unwrap())
    }));
    assert!(payload.include_graph.as_ref().is_some_and(|graph| {
        graph
            .nodes
            .iter()
            .any(|node| node.display_path == "intro.adoc" && node.status == "active")
    }));
}

#[test]
fn open_document_applies_component_attributes_without_playbook_for_antora_page() {
    let dir = tempdir().expect("temp dir");
    let content_root = dir.path().join("content");
    let pages = content_root.join("modules/ROOT/pages");
    let partials = content_root.join("modules/ROOT/partials");
    fs::create_dir_all(&pages).expect("create pages");
    fs::create_dir_all(&partials).expect("create partials");
    fs::write(
        content_root.join("antora.yml"),
        r#"
name: content
asciidoc:
  attributes:
    partialsdir: ../partials
    component-flag: enabled
"#,
    )
    .expect("write component descriptor");
    fs::write(partials.join("intro.adoc"), "= Component Partial\n").expect("write partial");
    let document = pages.join("index.adoc");
    fs::write(
        &document,
        "= Component Attributes\n\nifdef::component-flag[]\ninclude::{partialsdir}/intro.adoc[]\nendif::[]\n",
    )
    .expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&content_root.canonicalize().unwrap(), &roots).expect("register root");

    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");

    assert_eq!(
        payload
            .asciidoc_context
            .as_ref()
            .and_then(|context| context.attributes.get("component-flag"))
            .map(String::as_str),
        Some("enabled")
    );
    assert!(payload.include_files.iter().any(|file| {
        file.path == path_to_ui_string(&partials.join("intro.adoc").canonicalize().unwrap())
    }));
}

#[test]
fn open_document_does_not_apply_antora_attributes_outside_module_pages() {
    let dir = tempdir().expect("temp dir");
    let content_root = dir.path().join("content");
    fs::create_dir_all(content_root.join("modules/ROOT/pages")).expect("create pages");
    fs::write(
        content_root.join("antora.yml"),
        r#"
name: content
asciidoc:
  attributes:
    component-flag: enabled
"#,
    )
    .expect("write component descriptor");
    let document = content_root.join("README.adoc");
    fs::write(&document, "= Outside\n").expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&content_root.canonicalize().unwrap(), &roots).expect("register root");

    let payload = open_document_from_canonical_path_with_roots(
        &document.canonicalize().unwrap(),
        Some(&roots),
    )
    .expect("open document");

    assert!(!payload
        .asciidoc_context
        .expect("asciidoc context")
        .attributes
        .contains_key("component-flag"));
}
