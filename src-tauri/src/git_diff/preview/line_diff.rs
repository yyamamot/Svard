use super::*;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(in crate::git_diff) struct LineDiffCommonEdges {
    pub(in crate::git_diff) prefix_lines: usize,
    pub(in crate::git_diff) suffix_lines: usize,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(in crate::git_diff) struct LineDiffCoreMetrics {
    pub(in crate::git_diff) peak_scratch_entries: u64,
    pub(in crate::git_diff) work_units: u64,
}

pub(in crate::git_diff) const LINEAR_DIFF_SCRATCH_COEFFICIENT: usize = 2;
pub(in crate::git_diff) const LINE_DIFF_WORK_BUDGET: u64 = 25_000_000;
pub(in crate::git_diff) const LINE_DIFF_WORK_BUDGET_MESSAGE: &str = "Highlighted diff is unavailable because this comparison exceeds the safe work limit. Both source versions remain available.";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(in crate::git_diff) struct LineDiffWorkBudgetExceeded;

pub(super) struct LineDiffCoreState {
    metrics: LineDiffCoreMetrics,
    remaining_work_units: u64,
}

impl LineDiffCoreState {
    fn new(work_budget: u64) -> Self {
        Self {
            metrics: LineDiffCoreMetrics::default(),
            remaining_work_units: work_budget,
        }
    }

    fn reserve_work(&mut self, requested: usize) -> usize {
        let requested = u64::try_from(requested).expect("line diff work reservation");
        let allowed = requested.min(self.remaining_work_units);
        self.remaining_work_units -= allowed;
        self.metrics.work_units = self
            .metrics
            .work_units
            .checked_add(allowed)
            .expect("line diff work units");
        usize::try_from(allowed).expect("line diff allowed work")
    }

    fn refund_work(&mut self, unused: usize) {
        let unused = u64::try_from(unused).expect("line diff work refund");
        self.remaining_work_units = self
            .remaining_work_units
            .checked_add(unused)
            .expect("line diff remaining work units");
        self.metrics.work_units = self
            .metrics
            .work_units
            .checked_sub(unused)
            .expect("line diff recorded work units");
    }

    fn record_scratch<const MEASURE: bool>(&mut self, entries: usize) {
        if MEASURE {
            self.metrics.peak_scratch_entries = self
                .metrics
                .peak_scratch_entries
                .max(u64::try_from(entries).expect("line diff scratch entries"));
        }
    }
}

pub(in crate::git_diff) fn line_diff_common_edges(
    left_lines: &[&str],
    right_lines: &[&str],
) -> LineDiffCommonEdges {
    let prefix_lines = left_lines
        .iter()
        .zip(right_lines)
        .take_while(|(left, right)| left == right)
        .count();
    let remaining_left = left_lines.len() - prefix_lines;
    let remaining_right = right_lines.len() - prefix_lines;
    let maximal_suffix_lines = (0..remaining_left.min(remaining_right))
        .take_while(|offset| {
            left_lines[left_lines.len() - offset - 1] == right_lines[right_lines.len() - offset - 1]
        })
        .count();
    if maximal_suffix_lines == 0 {
        return LineDiffCommonEdges {
            prefix_lines,
            suffix_lines: 0,
        };
    }

    let left_middle_end = left_lines.len() - maximal_suffix_lines;
    let right_middle_end = right_lines.len() - maximal_suffix_lines;
    let suffix_boundary = left_lines[left_middle_end];
    let suffix_boundary_repeats = left_lines[prefix_lines..left_middle_end]
        .contains(&suffix_boundary)
        || right_lines[prefix_lines..right_middle_end].contains(&suffix_boundary);

    LineDiffCommonEdges {
        prefix_lines,
        suffix_lines: if suffix_boundary_repeats {
            0
        } else {
            maximal_suffix_lines
        },
    }
}

#[cfg(test)]
pub(in crate::git_diff) fn line_diff_hunks(left: &str, right: &str) -> Vec<GitDiffHunk> {
    line_diff_hunks_bounded(left, right).expect("test fixture must fit the line diff work budget")
}

#[cfg(test)]
pub(in crate::git_diff) fn line_diff_hunks_with_metrics_for_test(
    left: &str,
    right: &str,
) -> (Vec<GitDiffHunk>, LineDiffCoreMetrics) {
    let (result, metrics) = line_diff_hunks_linear::<true>(left, right, LINE_DIFF_WORK_BUDGET);
    (
        result.expect("test fixture must fit the line diff work budget"),
        metrics,
    )
}

#[cfg(test)]
pub(in crate::git_diff) fn line_diff_hunks_with_budget_for_test(
    left: &str,
    right: &str,
    work_budget: u64,
) -> (
    Result<Vec<GitDiffHunk>, LineDiffWorkBudgetExceeded>,
    LineDiffCoreMetrics,
) {
    line_diff_hunks_linear::<true>(left, right, work_budget)
}

pub(super) fn line_diff_hunks_bounded(
    left: &str,
    right: &str,
) -> Result<Vec<GitDiffHunk>, LineDiffWorkBudgetExceeded> {
    line_diff_hunks_linear::<false>(left, right, LINE_DIFF_WORK_BUDGET).0
}

fn line_diff_hunks_linear<const MEASURE: bool>(
    left: &str,
    right: &str,
    work_budget: u64,
) -> (
    Result<Vec<GitDiffHunk>, LineDiffWorkBudgetExceeded>,
    LineDiffCoreMetrics,
) {
    let mut state = LineDiffCoreState::new(work_budget);
    if left == right {
        return (Ok(Vec::new()), state.metrics);
    }
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let common_edges = line_diff_common_edges(&left_lines, &right_lines);
    let left_middle_end = left_lines.len() - common_edges.suffix_lines;
    let right_middle_end = right_lines.len() - common_edges.suffix_lines;
    let left_middle = &left_lines[common_edges.prefix_lines..left_middle_end];
    let right_middle = &right_lines[common_edges.prefix_lines..right_middle_end];
    let mut lines = Vec::with_capacity(left_lines.len() + right_lines.len());
    for index in 0..common_edges.prefix_lines {
        lines.push(GitDiffLine {
            kind: GitDiffLineKind::Context,
            old_line: Some(index + 1),
            new_line: Some(index + 1),
            text: left_lines[index].to_string(),
        });
    }
    let result = append_linear_diff::<MEASURE>(
        left_middle,
        right_middle,
        common_edges.prefix_lines,
        common_edges.prefix_lines,
        &mut lines,
        &mut state,
    );
    if let Err(error) = result {
        return (Err(error), state.metrics);
    }
    for offset in 0..common_edges.suffix_lines {
        let left_index = left_middle_end + offset;
        let right_index = right_middle_end + offset;
        lines.push(GitDiffLine {
            kind: GitDiffLineKind::Context,
            old_line: Some(left_index + 1),
            new_line: Some(right_index + 1),
            text: left_lines[left_index].to_string(),
        });
    }

    (
        Ok(finalize_line_diff_hunks(
            left_lines.len(),
            right_lines.len(),
            lines,
        )),
        state.metrics,
    )
}

pub(super) fn finalize_line_diff_hunks(
    left_line_count: usize,
    right_line_count: usize,
    lines: Vec<GitDiffLine>,
) -> Vec<GitDiffHunk> {
    if lines
        .iter()
        .all(|line| line.kind == GitDiffLineKind::Context)
    {
        return Vec::new();
    }

    vec![GitDiffHunk {
        old_start: 1,
        old_lines: left_line_count,
        new_start: 1,
        new_lines: right_line_count,
        lines,
    }]
}

fn append_linear_diff<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    state: &mut LineDiffCoreState,
) -> Result<(), LineDiffWorkBudgetExceeded> {
    if append_linear_diff_base_case::<MEASURE>(left, right, old_offset, new_offset, output, state)?
    {
        return Ok(());
    }
    // With an empty LCS, the frozen full-matrix path follows right-on-tie successors:
    // every right line is Added before every left line is Removed. Detecting that exact
    // case avoids allocating workspace without changing the edit script.
    if !linear_diff_has_common_line(left, right, state)? {
        append_added_lines(right, new_offset, output);
        append_removed_lines(left, old_offset, output);
        return Ok(());
    }

    let workspace_len = right.len() + 1;
    state.record_scratch::<MEASURE>(
        LINEAR_DIFF_SCRATCH_COEFFICIENT
            .checked_mul(workspace_len)
            .expect("line diff scratch size"),
    );
    let mut scores = vec![0usize; workspace_len];
    let mut crossings = vec![0usize; workspace_len];
    append_canonical_diff::<MEASURE>(
        left,
        right,
        old_offset,
        new_offset,
        output,
        &mut scores,
        &mut crossings,
        state,
    )
}

fn append_canonical_diff<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    scores: &mut [usize],
    crossings: &mut [usize],
    state: &mut LineDiffCoreState,
) -> Result<(), LineDiffWorkBudgetExceeded> {
    if append_linear_diff_base_case::<MEASURE>(left, right, old_offset, new_offset, output, state)?
    {
        return Ok(());
    }

    let left_split = left.len() / 2;
    let right_split = canonical_diff_crossing(left, right, left_split, scores, crossings, state)?;
    append_canonical_diff::<MEASURE>(
        &left[..left_split],
        &right[..right_split],
        old_offset,
        new_offset,
        output,
        scores,
        crossings,
        state,
    )?;
    append_canonical_diff::<MEASURE>(
        &left[left_split..],
        &right[right_split..],
        old_offset + left_split,
        new_offset + right_split,
        output,
        scores,
        crossings,
        state,
    )
}

pub(super) fn canonical_diff_crossing(
    left: &[&str],
    right: &[&str],
    left_split: usize,
    scores: &mut [usize],
    crossings: &mut [usize],
    state: &mut LineDiffCoreState,
) -> Result<usize, LineDiffWorkBudgetExceeded> {
    // Propagate the column where the frozen full-LCS successor path crosses left_split.
    // The mismatch branch intentionally selects the right successor on equal scores so
    // the reconstructed edit script preserves the existing Added-first tie behavior.
    let right_len = right.len();
    let scores = &mut scores[..=right_len];
    let crossings = &mut crossings[..=right_len];
    scores.fill(0);

    for left_index in (left_split..left.len()).rev() {
        let mut diagonal_score = scores[right_len];
        let allowed = state.reserve_work(right_len);
        for right_index in (0..right_len).rev().take(allowed) {
            let down_score = scores[right_index];
            scores[right_index] = if left[left_index] == right[right_index] {
                diagonal_score + 1
            } else {
                down_score.max(scores[right_index + 1])
            };
            diagonal_score = down_score;
        }
        if allowed < right_len {
            return Err(LineDiffWorkBudgetExceeded);
        }
    }

    for (right_index, crossing) in crossings.iter_mut().enumerate() {
        *crossing = right_index;
    }
    for left_index in (0..left_split).rev() {
        let mut diagonal_score = scores[right_len];
        let mut diagonal_crossing = crossings[right_len];
        let allowed = state.reserve_work(right_len);
        for right_index in (0..right_len).rev().take(allowed) {
            let down_score = scores[right_index];
            let down_crossing = crossings[right_index];
            let right_score = scores[right_index + 1];
            let right_crossing = crossings[right_index + 1];
            if left[left_index] == right[right_index] {
                scores[right_index] = diagonal_score + 1;
                crossings[right_index] = diagonal_crossing;
            } else if right_score >= down_score {
                scores[right_index] = right_score;
                crossings[right_index] = right_crossing;
            } else {
                scores[right_index] = down_score;
                crossings[right_index] = down_crossing;
            }
            diagonal_score = down_score;
            diagonal_crossing = down_crossing;
        }
        if allowed < right_len {
            return Err(LineDiffWorkBudgetExceeded);
        }
    }
    Ok(crossings[0])
}

fn append_linear_diff_base_case<const MEASURE: bool>(
    left: &[&str],
    right: &[&str],
    old_offset: usize,
    new_offset: usize,
    output: &mut Vec<GitDiffLine>,
    state: &mut LineDiffCoreState,
) -> Result<bool, LineDiffWorkBudgetExceeded> {
    if left.is_empty() {
        append_added_lines(right, new_offset, output);
        return Ok(true);
    }
    if right.is_empty() {
        append_removed_lines(left, old_offset, output);
        return Ok(true);
    }
    if left.len() == 1 {
        let allowed = state.reserve_work(right.len());
        let match_index = find_line_match(left[0], &right[..allowed]);
        if let Some(match_index) = match_index {
            state.refund_work(allowed - match_index - 1);
            append_added_lines(&right[..match_index], new_offset, output);
            output.push(GitDiffLine {
                kind: GitDiffLineKind::Context,
                old_line: Some(old_offset + 1),
                new_line: Some(new_offset + match_index + 1),
                text: left[0].to_string(),
            });
            append_added_lines(
                &right[match_index + 1..],
                new_offset + match_index + 1,
                output,
            );
        } else if allowed < right.len() {
            return Err(LineDiffWorkBudgetExceeded);
        } else {
            append_added_lines(right, new_offset, output);
            append_removed_lines(left, old_offset, output);
        }
        return Ok(true);
    }
    if right.len() == 1 {
        let allowed = state.reserve_work(left.len());
        let match_index = find_line_match(right[0], &left[..allowed]);
        if let Some(match_index) = match_index {
            state.refund_work(allowed - match_index - 1);
            append_removed_lines(&left[..match_index], old_offset, output);
            output.push(GitDiffLine {
                kind: GitDiffLineKind::Context,
                old_line: Some(old_offset + match_index + 1),
                new_line: Some(new_offset + 1),
                text: right[0].to_string(),
            });
            append_removed_lines(
                &left[match_index + 1..],
                old_offset + match_index + 1,
                output,
            );
        } else if allowed < left.len() {
            return Err(LineDiffWorkBudgetExceeded);
        } else {
            append_added_lines(right, new_offset, output);
            append_removed_lines(left, old_offset, output);
        }
        return Ok(true);
    }
    Ok(false)
}

pub(super) fn linear_diff_has_common_line(
    left: &[&str],
    right: &[&str],
    state: &mut LineDiffCoreState,
) -> Result<bool, LineDiffWorkBudgetExceeded> {
    if let Some(total_work) = left.len().checked_mul(right.len()) {
        let total_work_u64 = u64::try_from(total_work).expect("line diff common-line work");
        if total_work_u64 <= state.remaining_work_units {
            state.reserve_work(total_work);
            for left_line in left {
                if let Some(right_index) = find_line_match(left_line, right) {
                    let left_index = find_slice_element_position(left, left_line);
                    let completed_work = left_index
                        .checked_mul(right.len())
                        .and_then(|value| value.checked_add(right_index + 1))
                        .expect("line diff completed common-line work");
                    state.refund_work(total_work - completed_work);
                    return Ok(true);
                }
            }
            return Ok(false);
        }
    }

    for left_line in left {
        let allowed = state.reserve_work(right.len());
        if let Some(right_index) = find_line_match(left_line, &right[..allowed]) {
            state.refund_work(allowed - right_index - 1);
            return Ok(true);
        }
        if allowed < right.len() {
            return Err(LineDiffWorkBudgetExceeded);
        }
    }
    Ok(false)
}

pub(super) fn find_line_match(line: &str, candidates: &[&str]) -> Option<usize> {
    for candidate in candidates {
        if line == *candidate {
            return Some(find_slice_element_position(candidates, candidate));
        }
    }
    None
}

pub(super) fn find_slice_element_position(candidates: &[&str], target: &&str) -> usize {
    candidates
        .iter()
        .position(|candidate| std::ptr::eq(candidate, target))
        .expect("line diff slice element")
}

pub(super) fn append_added_lines(right: &[&str], new_offset: usize, output: &mut Vec<GitDiffLine>) {
    for (index, text) in right.iter().enumerate() {
        output.push(GitDiffLine {
            kind: GitDiffLineKind::Added,
            old_line: None,
            new_line: Some(new_offset + index + 1),
            text: (*text).to_string(),
        });
    }
}

pub(super) fn append_removed_lines(
    left: &[&str],
    old_offset: usize,
    output: &mut Vec<GitDiffLine>,
) {
    for (index, text) in left.iter().enumerate() {
        output.push(GitDiffLine {
            kind: GitDiffLineKind::Removed,
            old_line: Some(old_offset + index + 1),
            new_line: None,
            text: (*text).to_string(),
        });
    }
}

#[cfg(test)]
pub(in crate::git_diff) fn line_diff_hunks_full_lcs_for_test(
    left: &str,
    right: &str,
) -> Vec<GitDiffHunk> {
    if left == right {
        return Vec::new();
    }
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);
    let mut rows = vec![vec![0usize; right_lines.len() + 1]; left_lines.len() + 1];
    for left_index in (0..left_lines.len()).rev() {
        for right_index in (0..right_lines.len()).rev() {
            rows[left_index][right_index] = if left_lines[left_index] == right_lines[right_index] {
                rows[left_index + 1][right_index + 1] + 1
            } else {
                rows[left_index + 1][right_index].max(rows[left_index][right_index + 1])
            };
        }
    }

    let mut lines = Vec::with_capacity(left_lines.len() + right_lines.len());
    let mut left_index = 0usize;
    let mut right_index = 0usize;
    while left_index < left_lines.len() || right_index < right_lines.len() {
        if left_index < left_lines.len()
            && right_index < right_lines.len()
            && left_lines[left_index] == right_lines[right_index]
        {
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Context,
                old_line: Some(left_index + 1),
                new_line: Some(right_index + 1),
                text: left_lines[left_index].to_string(),
            });
            left_index += 1;
            right_index += 1;
        } else if right_index < right_lines.len()
            && (left_index == left_lines.len()
                || rows[left_index][right_index + 1] >= rows[left_index + 1][right_index])
        {
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Added,
                old_line: None,
                new_line: Some(right_index + 1),
                text: right_lines[right_index].to_string(),
            });
            right_index += 1;
        } else if left_index < left_lines.len() {
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Removed,
                old_line: Some(left_index + 1),
                new_line: None,
                text: left_lines[left_index].to_string(),
            });
            left_index += 1;
        }
    }
    finalize_line_diff_hunks(left_lines.len(), right_lines.len(), lines)
}

pub(in crate::git_diff) fn split_lines(value: &str) -> Vec<&str> {
    if value.is_empty() {
        Vec::new()
    } else {
        value.lines().collect()
    }
}

pub(in crate::git_diff) fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().any(|byte| *byte == 0)
}
