use super::*;

#[test]
fn editor_open_path_accepts_supported_existing_documents() {
    let file = tempfile::Builder::new()
        .suffix(".adoc")
        .tempfile()
        .expect("temp file");
    fs::write(file.path(), "= Editable\n").expect("write fixture");

    let normalized =
        normalize_editor_document_path(&file.path().to_string_lossy()).expect("editor path");

    assert!(normalized.ends_with(file.path().file_name().expect("name")));
}

#[test]
fn editor_open_path_rejects_unsupported_or_missing_paths() {
    let dir = tempdir().expect("temp dir");
    let unsupported = dir.path().join("private.txt");
    fs::write(&unsupported, "ignore\n").expect("write unsupported");

    assert!(normalize_editor_document_path(&unsupported.to_string_lossy()).is_err());
    assert!(normalize_editor_document_path(&dir.path().to_string_lossy()).is_err());
    assert!(
        normalize_editor_document_path(&dir.path().join("missing.adoc").to_string_lossy()).is_err()
    );
}

#[test]
fn dropped_document_path_accepts_supported_existing_documents() {
    let file = tempfile::Builder::new()
        .suffix(".md")
        .tempfile()
        .expect("temp file");
    fs::write(file.path(), "# Dropped\n").expect("write fixture");

    let normalized =
        normalize_dropped_document_path(&file.path().to_string_lossy()).expect("drop path");

    assert_eq!(
        normalized,
        path_to_ui_path(&file.path().canonicalize().unwrap())
    );
}

#[test]
fn dropped_document_path_rejects_directory_missing_and_unsupported() {
    let dir = tempdir().expect("temp dir");
    let unsupported = dir.path().join("private.txt");
    let missing = dir.path().join("missing.md");
    fs::write(&unsupported, "ignore\n").expect("write unsupported");

    assert!(normalize_dropped_document_path(&dir.path().to_string_lossy()).is_err());
    assert!(normalize_dropped_document_path(&missing.to_string_lossy()).is_err());
    assert!(normalize_dropped_document_path(&unsupported.to_string_lossy()).is_err());
}

#[test]
fn desktop_open_request_normalizes_supported_paths() {
    let dir = tempdir().expect("temp dir");
    let adoc = dir.path().join("guide.adoc");
    let markdown = dir.path().join("notes.md");
    let unsupported = dir.path().join("private.txt");
    fs::write(&adoc, "= Guide\n").expect("write adoc");
    fs::write(&markdown, "# Notes\n").expect("write markdown");
    fs::write(&unsupported, "ignore\n").expect("write unsupported");

    let request = normalize_desktop_open_request(
        vec![
            "guide.adoc".to_string(),
            "notes.md".to_string(),
            "private.txt".to_string(),
            ".".to_string(),
            "guide.adoc".to_string(),
        ],
        Some(dir.path().to_path_buf()),
        "initial",
    )
    .expect("request");

    assert_eq!(request.source, "initial");
    assert_eq!(request.cwd, Some(dir.path().to_string_lossy().to_string()));
    assert_eq!(
        request.paths,
        vec![
            path_to_ui_string(&adoc.canonicalize().unwrap()),
            path_to_ui_string(&markdown.canonicalize().unwrap()),
            path_to_ui_string(&dir.path().canonicalize().unwrap()),
        ]
    );
    assert_eq!(request.diagnostics.len(), 1);
    assert!(request.diagnostics[0].contains("private.txt"));
    assert!(!request.diagnostics[0].contains(dir.path().to_string_lossy().as_ref()));
}

#[test]
fn desktop_open_request_ignores_empty_and_flag_args() {
    let request = normalize_desktop_open_request(
        vec![
            "".to_string(),
            "--help".to_string(),
            "--new-window=/Users/private/project".to_string(),
        ],
        None,
        "single-instance",
    )
    .expect("diagnostic request");

    assert!(request.paths.is_empty());
    assert_eq!(
        request.diagnostics,
        vec![
            "Unsupported desktop open option ignored: --help".to_string(),
            "Unsupported desktop open option ignored: --new-window".to_string(),
        ]
    );
}

#[test]
fn desktop_open_request_ignores_empty_args_without_diagnostic() {
    let request = normalize_desktop_open_request(vec!["".to_string()], None, "initial");

    assert!(request.is_none());
}

#[test]
fn desktop_open_request_reports_missing_paths_without_absolute_directory() {
    let dir = tempdir().expect("temp dir");
    let missing = dir.path().join("missing.adoc");

    let request = normalize_desktop_open_request(
        vec!["missing.adoc".to_string()],
        Some(dir.path().to_path_buf()),
        "initial",
    )
    .expect("diagnostic request");

    assert!(request.paths.is_empty());
    assert_eq!(request.diagnostics.len(), 1);
    assert!(request.diagnostics[0].contains("missing.adoc"));
    assert!(!request.diagnostics[0].contains(dir.path().to_string_lossy().as_ref()));
    assert!(!request.diagnostics[0].contains(missing.to_string_lossy().as_ref()));
}

#[test]
fn pending_open_requests_are_drained_once() {
    let file = tempfile::Builder::new()
        .suffix(".adoc")
        .tempfile()
        .expect("temp file");
    fs::write(file.path(), "= Pending\n").expect("write fixture");
    let file_path = file
        .path()
        .canonicalize()
        .expect("canonical path")
        .to_string_lossy()
        .to_string();
    let pending = PendingOpenRequests(Mutex::new(vec![DesktopOpenRequest {
        paths: vec![file_path.clone()],
        cwd: None,
        source: "initial".to_string(),
        diagnostics: Vec::new(),
    }]));

    let first = {
        let mut guard = pending.0.lock().expect("lock");
        guard.drain(..).collect::<Vec<_>>()
    };
    let second = {
        let mut guard = pending.0.lock().expect("lock");
        guard.drain(..).collect::<Vec<_>>()
    };

    assert_eq!(first.len(), 1);
    assert_eq!(first[0].paths, vec![file_path]);
    assert!(second.is_empty());
}

#[test]
fn viewer_window_open_requests_are_drained_once() {
    let pending =
        PendingViewerWindowOpenRequests(Mutex::new(std::collections::BTreeMap::from([(
            "request-1".to_string(),
            ViewerWindowOpenRequest {
                session_id: Some("request-1".to_string()),
                path: Some("/workspace/docs/a.md".to_string()),
                active_path: Some("/workspace/docs/a.md".to_string()),
                open_tabs: vec![
                    "/workspace/docs/a.md".to_string(),
                    "/workspace/docs/b.md".to_string(),
                ],
                pinned_tabs: vec!["/workspace/docs/a.md".to_string()],
                recent_tabs: vec![
                    "/workspace/docs/a.md".to_string(),
                    "/workspace/docs/b.md".to_string(),
                ],
                scroll_positions: std::collections::BTreeMap::from([(
                    "/workspace/docs/a.md".to_string(),
                    240,
                )]),
                active_heading_by_path: std::collections::BTreeMap::from([(
                    "/workspace/docs/a.md".to_string(),
                    "overview".to_string(),
                )]),
                split_session: None,
                root_directory: Some("/workspace".to_string()),
                expanded_directories: vec!["/workspace/docs".to_string()],
                sidebar_tab: WorkspaceSidebarTab::Bookmarks,
                sidebar_visible: None,
                right_sidebar_visible: None,
                layout: None,
                pinned: true,
                bookmarks: vec![BookmarkEntry {
                    path: "/workspace/docs/a.md".to_string(),
                    kind: BookmarkKind::File,
                    name: None,
                }],
            },
        )])));

    let first = take_viewer_window_open_request_inner(&pending, "request-1").expect("first drain");
    let second =
        take_viewer_window_open_request_inner(&pending, "request-1").expect("second drain");

    assert_eq!(
        first,
        Some(ViewerWindowOpenRequest {
            session_id: Some("request-1".to_string()),
            path: Some("/workspace/docs/a.md".to_string()),
            active_path: Some("/workspace/docs/a.md".to_string()),
            open_tabs: vec![
                "/workspace/docs/a.md".to_string(),
                "/workspace/docs/b.md".to_string(),
            ],
            pinned_tabs: vec!["/workspace/docs/a.md".to_string()],
            recent_tabs: vec![
                "/workspace/docs/a.md".to_string(),
                "/workspace/docs/b.md".to_string(),
            ],
            scroll_positions: std::collections::BTreeMap::from([(
                "/workspace/docs/a.md".to_string(),
                240,
            )]),
            active_heading_by_path: std::collections::BTreeMap::from([(
                "/workspace/docs/a.md".to_string(),
                "overview".to_string(),
            )]),
            split_session: None,
            root_directory: Some("/workspace".to_string()),
            expanded_directories: vec!["/workspace/docs".to_string()],
            sidebar_tab: WorkspaceSidebarTab::Bookmarks,
            sidebar_visible: None,
            right_sidebar_visible: None,
            layout: None,
            pinned: true,
            bookmarks: vec![BookmarkEntry {
                path: "/workspace/docs/a.md".to_string(),
                kind: BookmarkKind::File,
                name: None,
            }],
        })
    );
    assert_eq!(second, None);
}

#[test]
fn viewer_window_request_id_preserves_safe_restore_session_id() {
    let mut request = ViewerWindowOpenRequest {
        session_id: Some("viewer_restore-1".to_string()),
        path: None,
        active_path: None,
        open_tabs: Vec::new(),
        pinned_tabs: Vec::new(),
        recent_tabs: Vec::new(),
        scroll_positions: std::collections::BTreeMap::new(),
        active_heading_by_path: std::collections::BTreeMap::new(),
        split_session: None,
        root_directory: None,
        expanded_directories: Vec::new(),
        sidebar_tab: WorkspaceSidebarTab::Files,
        sidebar_visible: None,
        right_sidebar_visible: None,
        layout: None,
        pinned: false,
        bookmarks: Vec::new(),
    };

    let request_id = viewer_window_request_id(&mut request);

    assert_eq!(request_id, "viewer_restore-1");
    assert_eq!(request.session_id.as_deref(), Some("viewer_restore-1"));
}

#[test]
fn viewer_window_request_id_rejects_unsafe_restore_session_id() {
    let mut request = ViewerWindowOpenRequest {
        session_id: Some("../private".to_string()),
        path: None,
        active_path: None,
        open_tabs: Vec::new(),
        pinned_tabs: Vec::new(),
        recent_tabs: Vec::new(),
        scroll_positions: std::collections::BTreeMap::new(),
        active_heading_by_path: std::collections::BTreeMap::new(),
        split_session: None,
        root_directory: None,
        expanded_directories: Vec::new(),
        sidebar_tab: WorkspaceSidebarTab::Files,
        sidebar_visible: None,
        right_sidebar_visible: None,
        layout: None,
        pinned: false,
        bookmarks: Vec::new(),
    };

    let request_id = viewer_window_request_id(&mut request);

    assert_ne!(request_id, "../private");
    assert_eq!(request.session_id.as_deref(), Some(request_id.as_str()));
}
