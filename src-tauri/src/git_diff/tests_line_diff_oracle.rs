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

fn generated_documents(alphabet: &[&str], max_lines: usize) -> Vec<String> {
    let mut documents = vec![String::new()];
    for line_count in 1..=max_lines {
        for encoded in 0..alphabet.len().pow(line_count as u32) {
            let mut remaining = encoded;
            let mut lines = Vec::with_capacity(line_count);
            for _ in 0..line_count {
                lines.push(alphabet[remaining % alphabet.len()]);
                remaining /= alphabet.len();
            }
            documents.push(lines.join("\n") + "\n");
        }
    }
    documents
}

#[test]
fn line_diff_linear_memory_matches_full_lcs_for_short_sequences() {
    let documents = generated_documents(&["A", "B", "C"], 6);
    for (left_index, left) in documents.iter().enumerate() {
        for (right_index, right) in documents.iter().enumerate() {
            assert_eq!(
                line_diff_hunks(left, right),
                line_diff_hunks_full_lcs_for_test(left, right),
                "linear-memory LCS differs for generated fixture {left_index}/{right_index}"
            );
        }
    }
}

fn next_deterministic_value(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    *state
}

fn deterministic_document(state: &mut u64, max_lines: usize) -> String {
    const ALPHABET: [&str; 5] = ["A", "B", "C", "D", "E"];
    let line_count = usize::try_from(
        next_deterministic_value(state)
            % u64::try_from(max_lines + 1).expect("deterministic maximum line count"),
    )
    .expect("deterministic line count");
    let lines = (0..line_count)
        .map(|_| {
            let index = usize::try_from(
                next_deterministic_value(state)
                    % u64::try_from(ALPHABET.len()).expect("deterministic alphabet length"),
            )
            .expect("deterministic alphabet index");
            ALPHABET[index]
        })
        .collect::<Vec<_>>();
    if lines.is_empty() {
        String::new()
    } else {
        lines.join("\n") + "\n"
    }
}

#[test]
fn line_diff_linear_memory_matches_full_lcs_for_longer_deterministic_sequences() {
    let mut state = 0x41_73_76_61_72_u64;
    for case_index in 0..20_000 {
        let left = deterministic_document(&mut state, 29);
        let right = deterministic_document(&mut state, 29);
        assert_eq!(
            line_diff_hunks(&left, &right),
            line_diff_hunks_full_lcs_for_test(&left, &right),
            "linear-memory LCS differs for deterministic fixture {case_index}"
        );
    }
}

#[test]
fn line_diff_common_edge_plan_uses_guarded_suffix_fallback() {
    let edges =
        |left: &str, right: &str| line_diff_common_edges(&split_lines(left), &split_lines(right));

    assert_eq!(
        edges("a\nb\nc\nd\ne\n", "a\nb\nx\nd\ne\n"),
        LineDiffCommonEdges {
            prefix_lines: 2,
            suffix_lines: 2,
        }
    );
    assert_eq!(
        edges("A\nA\n", "X\nA\n"),
        LineDiffCommonEdges {
            prefix_lines: 0,
            suffix_lines: 0,
        }
    );
    assert_eq!(
        edges("X\nA\n", "A\nA\n"),
        LineDiffCommonEdges {
            prefix_lines: 0,
            suffix_lines: 0,
        }
    );
    assert_eq!(
        edges("a\nb\nc\n", "a\nx\nb\nc\n"),
        LineDiffCommonEdges {
            prefix_lines: 1,
            suffix_lines: 2,
        }
    );
    assert_eq!(
        edges("same\r\ntext\r\n", "same\ntext\n"),
        LineDiffCommonEdges {
            prefix_lines: 2,
            suffix_lines: 0,
        }
    );
}

#[test]
fn line_diff_linear_memory_reports_core_owned_scratch() {
    let left_lines = (0..201)
        .map(|index| format!("line-{index:03}"))
        .collect::<Vec<_>>();
    let right_lines = left_lines[101..]
        .iter()
        .chain(&left_lines[..101])
        .cloned()
        .collect::<Vec<_>>();
    let left = left_lines.join("\n") + "\n";
    let right = right_lines.join("\n") + "\n";
    let (actual, metrics) = line_diff_hunks_with_metrics_for_test(&left, &right);

    assert_eq!(actual, line_diff_hunks_full_lcs_for_test(&left, &right));
    assert_eq!(
        metrics.peak_scratch_entries,
        u64::try_from(LINEAR_DIFF_SCRATCH_COEFFICIENT * (right_lines.len() + 1))
            .expect("scratch entries")
    );
    assert!(metrics.work_units > 0);
    assert!(metrics.peak_scratch_entries < 202 * 202);
}
