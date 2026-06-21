use super::shared::create_security_path_fixture;
use super::*;

#[test]
fn allowed_roots_allow_registered_children_and_reject_outside_paths() {
    let dir = tempdir().expect("temp dir");
    let document = dir.path().join("guide.adoc");
    let image = dir.path().join("image.svg");
    let outside = tempfile::Builder::new()
        .suffix(".adoc")
        .tempfile()
        .expect("outside file");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(&image, "<svg />").expect("write image");
    fs::write(outside.path(), "= Outside\n").expect("write outside");
    let roots = AllowedRoots::default();

    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register root");

    assert!(ensure_path_allowed(&image.canonicalize().unwrap(), &roots).is_ok());
    assert!(ensure_path_allowed(&outside.path().canonicalize().unwrap(), &roots).is_err());
}

#[cfg(unix)]
#[test]
fn allowed_roots_reject_symlink_that_resolves_outside_root() {
    let dir = tempdir().expect("temp dir");
    let root = dir.path().join("workspace");
    let links = root.join("links");
    let outside = dir.path().join("outside.adoc");
    let symlink = links.join("outside.adoc");
    fs::create_dir_all(&links).expect("create links");
    fs::write(&outside, "= Outside\n").expect("write outside");
    std::os::unix::fs::symlink(&outside, &symlink).expect("create symlink");
    let roots = AllowedRoots::default();
    register_allowed_root(&root, &roots).expect("register root");

    assert!(ensure_path_allowed(&symlink, &roots).is_err());
}

#[cfg(unix)]
#[test]
fn document_open_authorization_rejects_symlink_escape_from_registered_root() {
    let fixture = create_security_path_fixture();
    let link = fixture.docs.join("linked-secret.adoc");
    std::os::unix::fs::symlink(&fixture.outside_document, &link).expect("create symlink");
    let roots = AllowedRoots::default();
    register_allowed_root(&fixture.workspace, &roots).expect("register workspace");

    let result = authorize_document_path_for_open(
        &link,
        &fixture.outside_document.canonicalize().unwrap(),
        &roots,
    );

    assert!(result.is_err());
    assert!(ensure_path_allowed(&fixture.outside_document, &roots).is_err());
}

#[test]
fn document_open_authorization_registers_explicit_external_open() {
    let fixture = create_security_path_fixture();
    let roots = AllowedRoots::default();
    register_allowed_root(&fixture.workspace, &roots).expect("register workspace");

    authorize_document_path_for_open(
        &fixture.outside_document,
        &fixture.outside_document.canonicalize().unwrap(),
        &roots,
    )
    .expect("authorize explicit external open");

    assert!(ensure_path_allowed(&fixture.outside_document, &roots).is_ok());
}

#[test]
fn direct_plain_file_open_registers_parent_root_only() {
    let dir = tempdir().expect("temp dir");
    let docs = dir.path().join("workspace").join("docs");
    let sibling = dir.path().join("workspace").join("sibling");
    let document = docs.join("guide.adoc");
    let sibling_document = sibling.join("other.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::create_dir_all(&sibling).expect("create sibling");
    fs::write(&document, "= Guide\n").expect("write document");
    fs::write(&sibling_document, "= Other\n").expect("write sibling");
    let roots = AllowedRoots::default();

    authorize_document_path_for_open(&document, &document.canonicalize().unwrap(), &roots)
        .expect("authorize open");

    assert_eq!(
        allowed_root_paths(&roots),
        vec![path_for_policy(&docs.canonicalize().unwrap())]
    );
    assert!(ensure_path_allowed(&document, &roots).is_ok());
    assert!(ensure_path_allowed(&sibling_document, &roots).is_err());
}

#[test]
fn direct_git_file_open_does_not_register_worktree_root() {
    let repo = super::shared::create_git_fixture_repo();
    let docs = repo.path().join("docs");
    let document = docs.join("sample.md");
    let root_document = repo.path().join("root.adoc");
    fs::write(&root_document, "= Root\n").expect("write root document");
    let roots = AllowedRoots::default();

    authorize_document_path_for_open(&document, &document.canonicalize().unwrap(), &roots)
        .expect("authorize open");

    assert_eq!(
        allowed_root_paths(&roots),
        vec![path_for_policy(&docs.canonicalize().unwrap())]
    );
    assert!(ensure_path_allowed(&document, &roots).is_ok());
    assert!(ensure_path_allowed(&root_document, &roots).is_err());
}

#[test]
fn file_root_registration_uses_antora_module_root_for_pages_documents() {
    let dir = tempdir().expect("temp dir");
    let module = dir.path().join("project").join("modules").join("fwupdate");
    let pages = module.join("pages");
    let document = pages.join("index.adoc");
    let image = module.join("images").join("diagram.drawio.svg");
    let outside = dir.path().join("project").join("secret.svg");
    fs::create_dir_all(&pages).expect("create pages");
    fs::create_dir_all(image.parent().unwrap()).expect("create images");
    fs::write(&document, "= Index\n").expect("write document");
    fs::write(&image, "<svg />").expect("write image");
    fs::write(&outside, "<svg />").expect("write outside");
    let roots = AllowedRoots::default();

    register_allowed_root_for_file(&document.canonicalize().unwrap(), &roots)
        .expect("register root");

    assert!(ensure_path_allowed(&image.canonicalize().unwrap(), &roots).is_ok());
    assert!(ensure_path_allowed(&outside.canonicalize().unwrap(), &roots).is_err());
}

#[test]
fn asciidoc_context_prefers_most_specific_allowed_root() {
    let dir = tempdir().expect("temp dir");
    let broad_root = dir.path().join("workspace");
    let project_root = broad_root.join("project");
    let docs = project_root.join("docs");
    let document = docs.join("guide.adoc");
    fs::create_dir_all(&docs).expect("create docs");
    fs::write(&document, "= Guide\n").expect("write document");
    let roots = AllowedRoots::default();
    register_allowed_root(&broad_root, &roots).expect("register broad root");
    register_allowed_root(&project_root, &roots).expect("register project root");

    let resource_context = build_document_resource_context(
        &document.canonicalize().expect("canonical document"),
        Some(&roots),
    );
    let context = build_asciidoc_render_context("= Guide\n", &resource_context);

    assert_eq!(
        context.workspace_root,
        path_to_ui_string(&project_root.canonicalize().unwrap()),
    );
}
