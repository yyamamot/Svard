use std::path::Path;

use crate::{
    antora_order::load_antora_order_from_root,
    backend_types::{AllowedRoots, DocumentOrderCatalog, DocumentOrderSource},
    mkdocs_order::load_mkdocs_order_from_root,
    path_policy::{ensure_path_allowed, resolve_existing_directory_path},
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
            load_antora_order_from_root(&root, roots),
        ]
        .into_iter()
        .filter(|order| order.source != DocumentOrderSource::None)
        .collect(),
    })
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

    #[test]
    fn load_document_order_returns_mkdocs_and_antora_catalog() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        let root_module = dir.path().join("modules").join("ROOT");
        fs::create_dir_all(&docs).expect("docs");
        fs::create_dir_all(root_module.join("pages")).expect("pages");
        fs::write(docs.join("index.md"), "# Home").expect("mkdocs page");
        fs::write(root_module.join("pages").join("index.adoc"), "= Home").expect("antora page");
        fs::write(dir.path().join("mkdocs.yml"), "nav:\n  - Home: index.md\n").expect("mkdocs");
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

        assert_eq!(catalog.orders.len(), 2);
        assert!(
            catalog
                .orders
                .iter()
                .any(|order| order.source == DocumentOrderSource::Mkdocs)
        );
        assert!(
            catalog
                .orders
                .iter()
                .any(|order| order.source == DocumentOrderSource::Antora)
        );
    }
}
