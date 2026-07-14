use super::*;

type ExpectedLine<'a> = (GitDiffLineKind, Option<usize>, Option<usize>, &'a str);

fn expected_line(value: &ExpectedLine<'_>) -> GitDiffLine {
    GitDiffLine {
        kind: value.0.clone(),
        old_line: value.1,
        new_line: value.2,
        text: value.3.to_string(),
    }
}

fn assert_changed_oracle(left: &str, right: &str, expected: &[ExpectedLine<'_>]) {
    let hunks = line_diff_hunks(left, right);
    assert_eq!(
        hunks.len(),
        1,
        "changed oracle must remain a single full hunk"
    );

    let hunk = &hunks[0];
    assert_eq!(hunk.old_start, 1);
    assert_eq!(hunk.new_start, 1);
    assert_eq!(hunk.old_lines, split_lines(left).len());
    assert_eq!(hunk.new_lines, split_lines(right).len());
    assert_eq!(
        hunk.lines,
        expected.iter().map(expected_line).collect::<Vec<_>>()
    );

    let mut previous_old = 0usize;
    let mut previous_new = 0usize;
    for line in &hunk.lines {
        if let Some(old_line) = line.old_line {
            assert!(
                old_line > previous_old,
                "old line numbers must be monotonic"
            );
            previous_old = old_line;
        }
        if let Some(new_line) = line.new_line {
            assert!(
                new_line > previous_new,
                "new line numbers must be monotonic"
            );
            previous_new = new_line;
        }
    }

    let reconstructed_right = hunk
        .lines
        .iter()
        .filter(|line| line.kind != GitDiffLineKind::Removed)
        .map(|line| line.text.as_str())
        .collect::<Vec<_>>();
    assert_eq!(reconstructed_right, split_lines(right));
    let reconstructed_left = hunk
        .lines
        .iter()
        .filter(|line| line.kind != GitDiffLineKind::Added)
        .map(|line| line.text.as_str())
        .collect::<Vec<_>>();
    assert_eq!(reconstructed_left, split_lines(left));
}

#[test]
fn line_diff_oracle_freezes_equal_and_line_boundary_semantics() {
    assert!(line_diff_hunks("same\ntext\n", "same\ntext\n").is_empty());
    assert!(line_diff_hunks("same\ntext", "same\ntext\n").is_empty());
    assert!(line_diff_hunks("same\r\ntext\r\n", "same\ntext\n").is_empty());
    assert!(line_diff_hunks("", "").is_empty());
}

#[test]
fn line_diff_oracle_freezes_insert_delete_replace_and_empty_sides() {
    assert_changed_oracle(
        "alpha\ngamma\n",
        "alpha\nbeta\ngamma\n",
        &[
            (GitDiffLineKind::Context, Some(1), Some(1), "alpha"),
            (GitDiffLineKind::Added, None, Some(2), "beta"),
            (GitDiffLineKind::Context, Some(2), Some(3), "gamma"),
        ],
    );
    assert_changed_oracle(
        "alpha\nbeta\ngamma\n",
        "alpha\ngamma\n",
        &[
            (GitDiffLineKind::Context, Some(1), Some(1), "alpha"),
            (GitDiffLineKind::Removed, Some(2), None, "beta"),
            (GitDiffLineKind::Context, Some(3), Some(2), "gamma"),
        ],
    );
    assert_changed_oracle(
        "old\n",
        "new\n",
        &[
            (GitDiffLineKind::Added, None, Some(1), "new"),
            (GitDiffLineKind::Removed, Some(1), None, "old"),
        ],
    );
    assert_changed_oracle(
        "",
        "first\nsecond\n",
        &[
            (GitDiffLineKind::Added, None, Some(1), "first"),
            (GitDiffLineKind::Added, None, Some(2), "second"),
        ],
    );
    assert_changed_oracle("", "\n", &[(GitDiffLineKind::Added, None, Some(1), "")]);
    assert_changed_oracle(
        "first\nsecond\n",
        "",
        &[
            (GitDiffLineKind::Removed, Some(1), None, "first"),
            (GitDiffLineKind::Removed, Some(2), None, "second"),
        ],
    );
}

#[test]
fn line_diff_oracle_freezes_added_first_lcs_ties_and_reordering() {
    assert_changed_oracle(
        "A\nA\n",
        "X\nA\n",
        &[
            (GitDiffLineKind::Added, None, Some(1), "X"),
            (GitDiffLineKind::Context, Some(1), Some(2), "A"),
            (GitDiffLineKind::Removed, Some(2), None, "A"),
        ],
    );
    assert_changed_oracle(
        "A\nB\nA\n",
        "A\nA\nB\n",
        &[
            (GitDiffLineKind::Context, Some(1), Some(1), "A"),
            (GitDiffLineKind::Added, None, Some(2), "A"),
            (GitDiffLineKind::Context, Some(2), Some(3), "B"),
            (GitDiffLineKind::Removed, Some(3), None, "A"),
        ],
    );
    assert_changed_oracle(
        "x\ny\nx\ny\n",
        "x\nx\ny\ny\n",
        &[
            (GitDiffLineKind::Context, Some(1), Some(1), "x"),
            (GitDiffLineKind::Added, None, Some(2), "x"),
            (GitDiffLineKind::Context, Some(2), Some(3), "y"),
            (GitDiffLineKind::Removed, Some(3), None, "x"),
            (GitDiffLineKind::Context, Some(4), Some(4), "y"),
        ],
    );
    assert_changed_oracle(
        "a\nb\nc\n",
        "c\na\nb\n",
        &[
            (GitDiffLineKind::Added, None, Some(1), "c"),
            (GitDiffLineKind::Context, Some(1), Some(2), "a"),
            (GitDiffLineKind::Context, Some(2), Some(3), "b"),
            (GitDiffLineKind::Removed, Some(3), None, "c"),
        ],
    );
}

#[test]
fn line_diff_oracle_freezes_utf8_text_without_byte_based_line_offsets() {
    assert_changed_oracle(
        "見出し\n古い本文\n終わり\n",
        "見出し\n新しい本文\n終わり\n",
        &[
            (GitDiffLineKind::Context, Some(1), Some(1), "見出し"),
            (GitDiffLineKind::Added, None, Some(2), "新しい本文"),
            (GitDiffLineKind::Removed, Some(2), None, "古い本文"),
            (GitDiffLineKind::Context, Some(3), Some(3), "終わり"),
        ],
    );
}
