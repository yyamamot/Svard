import type { GitDiffPreview } from "../../../core/types";

export function getBasicGitDiffPreview(
  path: string,
  relativePath: string,
): GitDiffPreview {
  if (path.endsWith("/git-clean.md")) {
    return {
      repositoryRoot: null,
      relativePath,
      status: "clean",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [],
      message: "No working tree changes for this document.",
      leftText: null,
      rightText: null,
    };
  }
  if (path.endsWith("/git-untracked.md")) {
    return {
      repositoryRoot: null,
      relativePath,
      status: "untracked",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [
        {
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 4,
          lines: [
            { kind: "added", oldLine: null, newLine: 1, text: "# Draft" },
            { kind: "added", oldLine: null, newLine: 2, text: "" },
            {
              kind: "added",
              oldLine: null,
              newLine: 3,
              text: "This file is not tracked by HEAD yet.",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 4,
              text: "The preview shows worktree-only lines.",
            },
          ],
        },
      ],
      message: null,
      leftText: "",
      rightText:
        "# Draft\n\nThis file is not tracked by HEAD yet.\nThe preview shows worktree-only lines.",
    };
  }
  const leftText = `# Git Diff

The document says the viewer is file-only.
Source comparison stays local.
`;
  const rightText = `# Git Diff

The document now explains two-pane Git diff preview.
Source comparison stays local.
No Git operation is performed from the preview.
`;
  return {
    repositoryRoot: null,
    relativePath,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 1,
        oldLines: 5,
        newStart: 1,
        newLines: 6,
        lines: [
          { kind: "context", oldLine: 1, newLine: 1, text: "# Git Diff" },
          { kind: "context", oldLine: 2, newLine: 2, text: "" },
          {
            kind: "removed",
            oldLine: 3,
            newLine: null,
            text: "The document says the viewer is file-only.",
          },
          {
            kind: "added",
            oldLine: null,
            newLine: 3,
            text: "The document now explains two-pane Git diff preview.",
          },
          {
            kind: "context",
            oldLine: 4,
            newLine: 4,
            text: "Source comparison stays local.",
          },
          {
            kind: "added",
            oldLine: null,
            newLine: 5,
            text: "No Git operation is performed from the preview.",
          },
          { kind: "context", oldLine: 5, newLine: 6, text: "" },
        ],
      },
    ],
    message: null,
    leftText,
    rightText,
  };
}
