use std::fs;

use super::tests_support::*;
use super::*;

fn numbered_lines(prefix: &str, count: usize) -> String {
    (0..count)
        .map(|index| format!("{prefix}-{index:05}"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}

fn late_common_lines(count: usize) -> (String, String) {
    let mut left = (0..count)
        .map(|index| format!("left-{index:05}"))
        .collect::<Vec<_>>();
    let mut right = (0..count)
        .map(|index| format!("right-{index:05}"))
        .collect::<Vec<_>>();
    left[count / 2] = "shared".to_string();
    left[count - 1] = "shared".to_string();
    right[count - 1] = "shared".to_string();
    (left.join("\n") + "\n", right.join("\n") + "\n")
}

#[test]
fn line_diff_budget_is_inclusive_at_b_minus_one_b_and_b_plus_one() {
    let left = "left\n";

    let (below, below_metrics) = line_diff_hunks_with_budget_for_test(left, "r1\nr2\nr3\nr4\n", 5);
    assert!(below.is_ok());
    assert_eq!(below_metrics.work_units, 4);

    let (exact, exact_metrics) =
        line_diff_hunks_with_budget_for_test(left, "r1\nr2\nr3\nr4\nr5\n", 5);
    assert!(exact.is_ok());
    assert_eq!(exact_metrics.work_units, 5);

    let (over, over_metrics) =
        line_diff_hunks_with_budget_for_test(left, "r1\nr2\nr3\nr4\nr5\nr6\n", 5);
    assert_eq!(over, Err(LineDiffWorkBudgetExceeded));
    assert_eq!(over_metrics.work_units, 5);
}

#[test]
fn line_diff_budget_resets_for_each_attempt() {
    let left = "left\n";
    let right = "r1\nr2\nr3\nr4\nr5\nr6\n";
    for _ in 0..2 {
        let (result, metrics) = line_diff_hunks_with_budget_for_test(left, right, 5);
        assert_eq!(result, Err(LineDiffWorkBudgetExceeded));
        assert_eq!(metrics.work_units, 5);
    }
}

#[test]
fn disjoint_five_thousand_lines_complete_at_the_exact_production_budget() {
    let left = numbered_lines("left", 5_000);
    let right = numbered_lines("right", 5_000);

    let (result, metrics) =
        line_diff_hunks_with_budget_for_test(&left, &right, LINE_DIFF_WORK_BUDGET);
    let hunks = result.expect("exactly 25 million work units must complete");

    assert_eq!(metrics.work_units, LINE_DIFF_WORK_BUDGET);
    assert_eq!(hunks.len(), 1);
    assert_eq!(hunks[0].old_lines, 5_000);
    assert_eq!(hunks[0].new_lines, 5_000);
    assert_eq!(hunks[0].lines.len(), 10_000);
}

#[test]
fn repeated_and_late_common_inputs_stop_without_exceeding_the_budget() {
    let repeated_left = (0..1_000)
        .map(|index| if index % 2 == 0 { "A" } else { "B" })
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    let repeated_right = (0..1_000)
        .map(|index| if index % 2 == 0 { "B" } else { "A" })
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    let (repeated, repeated_metrics) =
        line_diff_hunks_with_budget_for_test(&repeated_left, &repeated_right, 1_000);
    assert_eq!(repeated, Err(LineDiffWorkBudgetExceeded));
    assert_eq!(repeated_metrics.work_units, 1_000);

    let (late_left, late_right) = late_common_lines(5_000);
    let (late, late_metrics) =
        line_diff_hunks_with_budget_for_test(&late_left, &late_right, LINE_DIFF_WORK_BUDGET);
    assert_eq!(late, Err(LineDiffWorkBudgetExceeded));
    assert_eq!(late_metrics.work_units, LINE_DIFF_WORK_BUDGET);
}

#[test]
fn too_complex_preview_discards_partial_hunks_and_preserves_sources_and_metadata() {
    let repo = create_fixture_repo();
    let document = repo.path().join("docs").join("large.md");
    let (left, right) = late_common_lines(5_000);
    fs::write(&document, &left).expect("write baseline document");
    git(repo.path(), &["add", "docs/large.md"]);
    git(repo.path(), &["commit", "-m", "large baseline"]);
    fs::write(&document, &right).expect("write changed document");

    let preview = git_diff_preview_for_path(&document.to_string_lossy()).expect("preview");

    assert_eq!(preview.status, GitDiffStatus::Modified);
    assert_eq!(
        preview.line_diff_availability,
        LineDiffAvailability::TooComplex
    );
    assert_eq!(
        preview.line_diff_fallback_reason,
        Some(LineDiffFallbackReason::WorkBudgetExceeded)
    );
    assert!(preview.hunks.is_empty());
    assert_eq!(preview.left_text.as_deref(), Some(left.as_str()));
    assert_eq!(preview.right_text.as_deref(), Some(right.as_str()));
    assert_eq!(preview.left_label, "HEAD");
    assert_eq!(preview.right_label, "Working Tree");
    assert_eq!(preview.relative_path.as_deref(), Some("docs/large.md"));
    assert!(preview.repository_root.is_some());
    assert_eq!(
        preview.right_resource_source,
        Some(GitDiffResourceSource::Worktree)
    );
    assert!(matches!(
        preview.left_resource_source,
        Some(GitDiffResourceSource::Commit { .. })
    ));
    assert_eq!(
        preview.message.as_deref(),
        Some(LINE_DIFF_WORK_BUDGET_MESSAGE)
    );

    let serialized = serde_json::to_value(&preview).expect("serialize preview");
    assert_eq!(serialized["lineDiffAvailability"], "too-complex");
    assert_eq!(serialized["lineDiffFallbackReason"], "work-budget-exceeded");
}

#[test]
fn binary_and_oversize_precedence_remains_unchanged() {
    let oversize = build_text_preview_with_labels(
        Some("root".to_string()),
        "docs/large.md".to_string(),
        GitDiffStatus::Modified,
        "left".to_string(),
        "right".to_string(),
        vec![b'a'; MAX_TEXT_DIFF_BYTES + 1],
        vec![0],
    )
    .expect("oversize preview");
    assert_eq!(oversize.status, GitDiffStatus::Binary);
    assert_eq!(
        oversize.line_diff_availability,
        LineDiffAvailability::Available
    );
    assert_eq!(oversize.line_diff_fallback_reason, None);
    assert_eq!(
        oversize.message.as_deref(),
        Some("Document is too large for inline diff preview.")
    );
    assert!(oversize.left_text.is_none());
    assert!(oversize.right_text.is_none());

    let binary = build_text_preview_with_labels(
        None,
        "docs/binary.md".to_string(),
        GitDiffStatus::Modified,
        "left".to_string(),
        "right".to_string(),
        b"text".to_vec(),
        b"\0binary".to_vec(),
    )
    .expect("binary preview");
    assert_eq!(binary.status, GitDiffStatus::Binary);
    assert_eq!(
        binary.line_diff_availability,
        LineDiffAvailability::Available
    );
    assert_eq!(binary.line_diff_fallback_reason, None);
    assert_eq!(
        binary.message.as_deref(),
        Some("Binary document diff preview is not supported.")
    );
}

#[test]
fn available_preview_serializes_explicit_availability_without_a_reason() {
    let preview = build_text_preview(
        None,
        "docs/sample.md".to_string(),
        GitDiffStatus::Modified,
        b"before\n".to_vec(),
        b"after\n".to_vec(),
    )
    .expect("preview");
    assert_eq!(
        preview.line_diff_availability,
        LineDiffAvailability::Available
    );
    assert_eq!(preview.line_diff_fallback_reason, None);
    assert_eq!(
        preview.hunks,
        line_diff_hunks_full_lcs_for_test("before\n", "after\n")
    );

    let serialized = serde_json::to_value(&preview).expect("serialize preview");
    assert_eq!(serialized["lineDiffAvailability"], "available");
    assert!(serialized.get("lineDiffFallbackReason").is_none());

    let mut missing_availability = serialized;
    missing_availability
        .as_object_mut()
        .expect("preview object")
        .remove("lineDiffAvailability");
    assert!(serde_json::from_value::<GitDiffPreview>(missing_availability).is_err());
}
