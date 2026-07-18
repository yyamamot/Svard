use super::*;

#[test]
fn git_preview_batch_task_preserves_successful_results() {
    let result = tauri::async_runtime::block_on(run_git_preview_batch_task(
        "Git diff preview batch",
        || Ok(Vec::new()),
    ));

    assert_eq!(result, Ok(Vec::new()));
}

#[test]
fn git_preview_batch_task_uses_the_route_label_for_join_failures() {
    let error = tauri::async_runtime::block_on(run_git_preview_batch_task(
        "Git commit preview batch",
        || panic!("fixture task failure"),
    ))
    .expect_err("panicking task should fail");

    assert!(error.starts_with("Git commit preview batch task failed:"));
}
