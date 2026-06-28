use super::*;

#[test]
fn document_io_search_workspace_uses_ordered_paths_before_path_sorted_fallback() {
    let dir = tempdir().expect("temp dir");
    let workspace = dir.path().join("workspace");
    fs::create_dir_all(workspace.join("docs")).expect("create docs");
    let part_1 = workspace.join("docs/part-1.md");
    let part_2 = workspace.join("docs/part-2.md");
    let appendix = workspace.join("docs/appendix.md");
    fs::write(&part_1, "# One\nneedle early\nneedle late\n").expect("write part 1");
    fs::write(&part_2, "# Two\nneedle second\n").expect("write part 2");
    fs::write(&appendix, "# Appendix\nneedle fallback\n").expect("write appendix");

    let result = crate::document_io::search_workspace(
        WorkspaceSearchInput {
            root_path: workspace.to_string_lossy().to_string(),
            query: "needle".to_string(),
            max_files: 20,
            max_matches: 20,
            max_bytes_per_file: 1_048_576,
            ordered_paths: vec![
                canonical_ui_path(&part_2),
                canonical_ui_path(&part_1),
                canonical_ui_path(&part_2),
            ],
        },
        None,
    )
    .expect("search workspace");

    let references = result
        .results
        .iter()
        .map(|item| item.source_reference.clone())
        .collect::<Vec<_>>();
    assert_eq!(
        references,
        vec![
            format!("{}:2", canonical_ui_path(&part_2)),
            format!("{}:2", canonical_ui_path(&part_1)),
            format!("{}:3", canonical_ui_path(&part_1)),
            format!("{}:2", canonical_ui_path(&appendix)),
        ]
    );
}

#[test]
fn document_io_search_workspace_uses_path_sorted_order_without_ordered_paths() {
    let dir = tempdir().expect("temp dir");
    let workspace = dir.path().join("workspace");
    fs::create_dir_all(&workspace).expect("create workspace");
    let second = workspace.join("b.md");
    let first = workspace.join("a.md");
    fs::write(&second, "needle\n").expect("write second");
    fs::write(&first, "needle\n").expect("write first");

    let result = crate::document_io::search_workspace(
        WorkspaceSearchInput {
            root_path: workspace.to_string_lossy().to_string(),
            query: "needle".to_string(),
            max_files: 20,
            max_matches: 20,
            max_bytes_per_file: 1_048_576,
            ordered_paths: Vec::new(),
        },
        None,
    )
    .expect("search workspace");

    assert_eq!(
        result
            .results
            .iter()
            .map(|item| item.path.clone())
            .collect::<Vec<_>>(),
        vec![canonical_ui_path(&first), canonical_ui_path(&second)]
    );
}

#[test]
fn document_io_search_workspace_caps_in_ordered_path_order() {
    let dir = tempdir().expect("temp dir");
    let workspace = dir.path().join("workspace");
    fs::create_dir_all(&workspace).expect("create workspace");
    let first = workspace.join("b.md");
    let second = workspace.join("a.md");
    fs::write(&first, "needle\n").expect("write first");
    fs::write(&second, "needle\n").expect("write second");

    let result = crate::document_io::search_workspace(
        WorkspaceSearchInput {
            root_path: workspace.to_string_lossy().to_string(),
            query: "needle".to_string(),
            max_files: 20,
            max_matches: 1,
            max_bytes_per_file: 1_048_576,
            ordered_paths: vec![canonical_ui_path(&first), canonical_ui_path(&second)],
        },
        None,
    )
    .expect("search workspace");

    assert!(result.capped);
    assert_eq!(result.results.len(), 1);
    assert_eq!(result.results[0].path, canonical_ui_path(&first));
}

fn canonical_ui_path(path: &Path) -> String {
    path_to_ui_string(&path.canonicalize().expect("canonical path"))
}
