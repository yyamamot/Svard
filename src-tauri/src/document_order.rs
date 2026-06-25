use std::path::Path;

use crate::{
    antora_order::load_antora_order_from_roots,
    antora_playbook::discover_antora_playbook_content_roots,
    backend_types::{AllowedRoots, DocumentOrderCatalog, DocumentOrderSource},
    document_order_common::normalize_document_order_target_path,
    mkdocs_order::load_mkdocs_order_from_root,
    path_policy::{ensure_path_allowed, resolve_existing_directory_path},
    vitepress_order::load_vitepress_order_from_root,
};

pub(crate) fn load_document_order_from_root(
    root_directory: &str,
    roots: &AllowedRoots,
) -> Result<DocumentOrderCatalog, String> {
    let root = resolve_existing_directory_path(Path::new(root_directory))?;
    ensure_path_allowed(&root, roots)?;
    Ok(DocumentOrderCatalog {
        orders: [
            load_mkdocs_order_from_root(&root, roots),
            load_antora_order_from_roots(&antora_content_roots(&root, roots), roots),
            load_vitepress_order_from_root(&root, roots),
        ]
        .into_iter()
        .filter(|order| order.source != DocumentOrderSource::None)
        .collect(),
    })
}

fn antora_content_roots(root: &Path, roots: &AllowedRoots) -> Vec<std::path::PathBuf> {
    let mut content_roots = Vec::new();
    if root.join("antora.yml").is_file() {
        push_unique_content_root(&mut content_roots, root);
    }
    for content_root in discover_antora_playbook_content_roots(root, roots) {
        push_unique_content_root(&mut content_roots, &content_root);
    }
    content_roots
}

fn push_unique_content_root(content_roots: &mut Vec<std::path::PathBuf>, root: &Path) {
    let root = normalize_document_order_target_path(root);
    if !content_roots.iter().any(|current| current == &root) {
        content_roots.push(root);
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path, sync::Mutex};

    use tempfile::tempdir;

    use super::*;
    use crate::path_policy::path_for_policy;

    fn roots_for(path: &Path) -> AllowedRoots {
        AllowedRoots(Mutex::new([path_for_policy(path)].into_iter().collect()))
    }

    fn write_antora_content_root(root: &Path, title: &str, page_title: &str) {
        let module = root.join("modules").join("module-a");
        fs::create_dir_all(module.join("pages")).expect("pages");
        fs::write(
            module.join("pages").join("index.adoc"),
            format!("= {page_title}"),
        )
        .expect("page");
        fs::write(module.join("nav.adoc"), ".Guide\n* xref:index.adoc[]\n").expect("nav");
        fs::write(
            root.join("antora.yml"),
            format!(
                "name: {}\ntitle: {title}\nnav:\n  - modules/module-a/nav.adoc\n",
                title.to_lowercase().replace(' ', "-")
            ),
        )
        .expect("descriptor");
    }

    fn antora_order(catalog: &DocumentOrderCatalog) -> &crate::backend_types::DocumentOrderResult {
        catalog
            .orders
            .iter()
            .find(|order| order.source == DocumentOrderSource::Antora)
            .expect("antora order")
    }

    #[test]
    fn load_document_order_returns_static_site_order_catalog() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(&docs).expect("docs");
        fs::create_dir_all(docs.join(".vitepress")).expect("vitepress config dir");
        fs::create_dir_all(root_module.join("pages")).expect("pages");
        fs::write(docs.join("index.md"), "# Home").expect("mkdocs page");
        fs::write(docs.join("guide.md"), "# Guide").expect("vitepress page");
        fs::write(root_module.join("pages").join("index.adoc"), "= Home").expect("antora page");
        fs::write(dir.path().join("mkdocs.yml"), "nav:\n  - Home: index.md\n").expect("mkdocs");
        fs::write(
            docs.join(".vitepress").join("config.ts"),
            "export default { themeConfig: { sidebar: [{ text: 'Guide', link: '/guide' }] } }",
        )
        .expect("vitepress");
        fs::write(
            root_module.join("nav.adoc"),
            ".Product\n* xref:index.adoc[]\n",
        )
        .expect("nav");
        fs::write(
            dir.path().join("antora.yml"),
            "name: product\nnav:\n  - modules/ROOT/nav.adoc\n",
        )
        .expect("descriptor");

        let catalog = load_document_order_from_root(
            dir.path().to_str().expect("path"),
            &roots_for(dir.path()),
        )
        .expect("catalog");

        assert_eq!(catalog.orders.len(), 3);
        assert!(catalog
            .orders
            .iter()
            .any(|order| order.source == DocumentOrderSource::Mkdocs));
        assert!(catalog
            .orders
            .iter()
            .any(|order| order.source == DocumentOrderSource::Antora));
        assert!(catalog
            .orders
            .iter()
            .any(|order| order.source == DocumentOrderSource::Vitepress));
    }

    #[test]
    fn load_document_order_detects_antora_content_root_from_standard_playbook() {
        let dir = tempdir().expect("tempdir");
        let content_root = dir.path().join("docs").join("component-a");
        fs::create_dir_all(&content_root).expect("content root");
        write_antora_content_root(&content_root, "Component A", "Guide Home");
        fs::write(
            dir.path().join("antora-playbook.yml"),
            "content:\n  sources:\n    - url: ./docs/component-a\n",
        )
        .expect("playbook");

        let catalog = load_document_order_from_root(
            dir.path().to_str().expect("path"),
            &roots_for(dir.path()),
        )
        .expect("catalog");
        let order = antora_order(&catalog);
        let serialized = serde_json::to_string(order).expect("serialize");

        assert_eq!(order.nodes.len(), 1);
        assert!(serialized.contains("Guide Home"));
        assert!(!serialized.contains("antora-playbook"));
    }

    #[test]
    fn load_document_order_expands_local_playbook_start_paths_in_order() {
        let dir = tempdir().expect("tempdir");
        for (relative_path, title) in [
            ("docs/component-a", "Component A"),
            ("docs/component-b", "Component B"),
            ("packages/component-c", "Component C"),
        ] {
            let content_root = dir.path().join(relative_path);
            fs::create_dir_all(&content_root).expect("content root");
            write_antora_content_root(&content_root, title, "Guide Home");
        }
        fs::write(
            dir.path().join("antora-playbook.yml"),
            "content:\n  sources:\n    - url: ./\n      start_paths: [docs/*, packages/*]\n",
        )
        .expect("playbook");

        let catalog = load_document_order_from_root(
            dir.path().to_str().expect("path"),
            &roots_for(dir.path()),
        )
        .expect("catalog");
        let order = antora_order(&catalog);

        assert_eq!(order.nodes.len(), 3);
        let titles = order
            .nodes
            .iter()
            .map(|node| match node {
                crate::backend_types::DocumentOrderNode::Section { title, .. } => title.as_str(),
                _ => "",
            })
            .collect::<Vec<_>>();
        assert_eq!(titles, ["Component A", "Component B", "Component C"]);
    }

    #[test]
    fn load_document_order_uses_remote_playbook_start_paths_as_local_checkout_hints() {
        let dir = tempdir().expect("tempdir");
        for (relative_path, title) in [
            ("docs/component-a", "Component A"),
            ("docs/component-b", "Component B"),
        ] {
            let content_root = dir.path().join(relative_path);
            fs::create_dir_all(&content_root).expect("content root");
            write_antora_content_root(&content_root, title, "Guide Home");
        }
        fs::write(
            dir.path().join("antora-playbook.yml"),
            "content:\n  sources:\n    - url: https://example.invalid/repository.git\n      start_paths: [docs/*]\n",
        )
        .expect("playbook");

        let catalog = load_document_order_from_root(
            dir.path().to_str().expect("path"),
            &roots_for(dir.path()),
        )
        .expect("catalog");
        let order = antora_order(&catalog);
        let serialized = serde_json::to_string(order).expect("serialize");

        assert_eq!(order.nodes.len(), 2);
        assert!(serialized.contains("Component A"));
        assert!(serialized.contains("Component B"));
        assert!(!serialized.contains("example.invalid"));
        assert!(!serialized.contains("repository.git"));
    }

    #[test]
    fn load_document_order_splits_comma_separated_playbook_start_paths() {
        let dir = tempdir().expect("tempdir");
        for (relative_path, title) in [
            ("docs/component-a", "Component A"),
            ("docs/component-b", "Component B"),
        ] {
            let content_root = dir.path().join(relative_path);
            fs::create_dir_all(&content_root).expect("content root");
            write_antora_content_root(&content_root, title, "Guide Home");
        }
        fs::write(
            dir.path().join("antora-playbook.yml"),
            "content:\n  sources:\n    - url: ./\n      start_paths: docs/component-a, docs/component-b\n",
        )
        .expect("playbook");

        let catalog = load_document_order_from_root(
            dir.path().to_str().expect("path"),
            &roots_for(dir.path()),
        )
        .expect("catalog");
        let order = antora_order(&catalog);

        assert_eq!(order.nodes.len(), 2);
    }

    #[test]
    fn load_document_order_ignores_remote_outside_and_nonstandard_playbooks() {
        let dir = tempdir().expect("tempdir");
        let outside = tempdir().expect("outside");
        let outside_root = outside.path().join("component-a");
        fs::create_dir_all(&outside_root).expect("outside root");
        write_antora_content_root(&outside_root, "Outside Component", "Outside Home");
        let valid_root = dir.path().join("docs").join("component-a");
        fs::create_dir_all(&valid_root).expect("valid root");
        write_antora_content_root(&valid_root, "Component A", "Guide Home");
        fs::write(
            dir.path().join("custom-playbook.yml"),
            "content:\n  sources:\n    - url: ./docs/component-a\n",
        )
        .expect("nonstandard playbook");
        fs::write(
            dir.path().join("antora-playbook.yml"),
            format!(
                "content:\n  sources:\n    - url: https://example.invalid/repo.git\n    - url: git@example.invalid:repo.git\n    - url: {}\n",
                outside_root.display()
            ),
        )
        .expect("playbook");

        let catalog = load_document_order_from_root(
            dir.path().to_str().expect("path"),
            &roots_for(dir.path()),
        )
        .expect("catalog");
        let serialized = serde_json::to_string(&catalog).expect("serialize");

        assert!(
            !catalog
                .orders
                .iter()
                .any(|order| order.source == DocumentOrderSource::Antora)
        );
        assert!(!serialized.contains("example.invalid"));
        assert!(!serialized.contains("Outside Component"));
        assert!(!serialized.contains("Guide Home"));
        assert!(!serialized.contains(&outside_root.display().to_string()));
    }
}
