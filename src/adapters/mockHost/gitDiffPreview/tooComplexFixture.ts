import type { GitDiffPreview } from "../../../core/types";

const scenarioId = "viewer-git-diff-too-complex-source-fallback";

export function getTooComplexGitDiffPreview(
  path: string,
  relativePath: string,
): GitDiffPreview | null {
  if (
    typeof window === "undefined" ||
    (new URLSearchParams(window.location.search).get("scenario") !==
      scenarioId &&
      !(
        window as unknown as {
          __SVARD_TOO_COMPLEX_GIT_DIFF_FIXTURE__?: boolean;
        }
      ).__SVARD_TOO_COMPLEX_GIT_DIFF_FIXTURE__) ||
    !path.endsWith("/git-modified.md")
  ) {
    return null;
  }
  const target = window as unknown as {
    __SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__?: number;
  };
  target.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ =
    (target.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ ?? 0) + 1;
  return {
    repositoryRoot: null,
    relativePath,
    leftPath: path,
    rightPath: path,
    status: "modified",
    lineDiffAvailability: "too-complex",
    lineDiffFallbackReason: "work-budget-exceeded",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [],
    message:
      "Highlighted diff is unavailable because this comparison exceeds the safe work limit. Both source versions remain available.",
    leftText: "# Previous guidance\n\nOriginal source remains readable.",
    rightText: "# Current guidance\n\nUpdated source remains readable.",
  };
}
