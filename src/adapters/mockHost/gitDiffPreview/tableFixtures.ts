import type { GitDiffPreview } from "../../../core/types";

export function getTableGitDiffPreview(
  path: string,
  relativePath: string,
): GitDiffPreview | null {
  if (path.endsWith("/git-table.md")) {
    const leftText = `# Git Table Diff Fixture

| Plan | Price | Status |
| --- | --- | --- |
| Basic | $10 | Beta |
| Pro | $20 | Stable |
`;
    const rightText = `# Git Table Diff Fixture

| Plan | Price | Status |
| --- | --- | --- |
| Basic | $12 | Stable |
| Pro | $20 | Stable |
| Enterprise | $50 | New |
`;
    return {
      repositoryRoot: null,
      relativePath,
      leftPath: path,
      rightPath: path,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [
        {
          oldStart: 1,
          oldLines: 6,
          newStart: 1,
          newLines: 7,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "# Git Table Diff Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            {
              kind: "context",
              oldLine: 3,
              newLine: 3,
              text: "| Plan | Price | Status |",
            },
            {
              kind: "context",
              oldLine: 4,
              newLine: 4,
              text: "| --- | --- | --- |",
            },
            {
              kind: "removed",
              oldLine: 5,
              newLine: null,
              text: "| Basic | $10 | Beta |",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 5,
              text: "| Basic | $12 | Stable |",
            },
            {
              kind: "context",
              oldLine: 6,
              newLine: 6,
              text: "| Pro | $20 | Stable |",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 7,
              text: "| Enterprise | $50 | New |",
            },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-table-cells.md")) {
    const leftText = `# Git Markdown Table Cell Fixture

| Feature | Owner | Status |
| --- | --- | --- |
| Search | Docs | Draft |
| Diff | Docs | Ready |
`;
    const rightText = `# Git Markdown Table Cell Fixture

| Feature | Owner | Status |
| --- | --- | --- |
| Search | Docs | Reviewed |
| Diff | Docs | Ready |
`;
    return {
      repositoryRoot: null,
      relativePath,
      leftPath: path,
      rightPath: path,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [
        {
          oldStart: 1,
          oldLines: 6,
          newStart: 1,
          newLines: 6,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "# Git Markdown Table Cell Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            {
              kind: "context",
              oldLine: 3,
              newLine: 3,
              text: "| Feature | Owner | Status |",
            },
            {
              kind: "context",
              oldLine: 4,
              newLine: 4,
              text: "| --- | --- | --- |",
            },
            {
              kind: "removed",
              oldLine: 5,
              newLine: null,
              text: "| Search | Docs | Draft |",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 5,
              text: "| Search | Docs | Reviewed |",
            },
            {
              kind: "context",
              oldLine: 6,
              newLine: 6,
              text: "| Diff | Docs | Ready |",
            },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-table-untracked.md")) {
    const rightText = `# Git Markdown Table Untracked Fixture

| Feature | Owner | Status |
| --- | --- | --- |
| Manual | Docs | Draft |
| Screenshots | Docs | Planned |
`;
    return {
      repositoryRoot: null,
      relativePath,
      leftPath: null,
      rightPath: path,
      status: "untracked",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [
        {
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 6,
          lines: rightText
            .trimEnd()
            .split("\n")
            .map((text, index) => ({
              kind: "added" as const,
              oldLine: null,
              newLine: index + 1,
              text,
            })),
        },
      ],
      message: null,
      leftText: "",
      rightText,
    };
  }
  if (path.endsWith("/git-asciidoc-table.adoc")) {
    const leftText = `= Git AsciiDoc Table Diff Fixture

.Release matrix
[%header]
|===
|Item |Owner |Platform |Status |Review signal |Long context column

|AsciiDoc |Docs |Desktop |Rendered |Header context should remain visible |StableWideContextForHorizontalTableReviewStableWideContextForHorizontalTableReviewStableWideContext

|Diagram |Docs |Desktop |Local-first |Stable signal |Stable wide context
|===
`;
    const rightText = `= Git AsciiDoc Table Diff Fixture

.Release matrix
[%header]
|===
|Item |Owner |Platform |Status |Review signal |Long context column

|AsciiDoc |Docs |Desktop |Changed |Header context should remain visible |ChangedWideContextForHorizontalTableReviewChangedWideContextForHorizontalTableReviewChangedWideContext

|Diagram |Docs |Desktop |Local-first |Stable signal |Stable wide context
|===
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
          oldLines: 9,
          newStart: 1,
          newLines: 9,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "= Git AsciiDoc Table Diff Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            {
              kind: "context",
              oldLine: 3,
              newLine: 3,
              text: ".Release matrix",
            },
            { kind: "context", oldLine: 4, newLine: 4, text: "[%header]" },
            { kind: "context", oldLine: 5, newLine: 5, text: "|===" },
            {
              kind: "context",
              oldLine: 6,
              newLine: 6,
              text: "|Item |Owner |Platform |Status |Review signal |Long context column",
            },
            {
              kind: "removed",
              oldLine: 7,
              newLine: null,
              text: "|AsciiDoc |Docs |Desktop |Rendered |Header context should remain visible |StableWideContextForHorizontalTableReviewStableWideContextForHorizontalTableReviewStableWideContext",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 7,
              text: "|AsciiDoc |Docs |Desktop |Changed |Header context should remain visible |ChangedWideContextForHorizontalTableReviewChangedWideContextForHorizontalTableReviewChangedWideContext",
            },
            {
              kind: "context",
              oldLine: 8,
              newLine: 8,
              text: "|Diagram |Docs |Desktop |Local-first |Stable signal |Stable wide context",
            },
            { kind: "context", oldLine: 9, newLine: 9, text: "|===" },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-asciidoc-table-complex.adoc")) {
    const leftText = `= Git AsciiDoc Complex Table Diff Fixture

|===
|Item |Status

2+|AsciiDoc

|Diagram
|Rendered
|===
`;
    const rightText = `= Git AsciiDoc Complex Table Diff Fixture

|===
|Item |Status

2+|AsciiDoc

|Diagram
|Changed
|===
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
          oldLines: 10,
          newStart: 1,
          newLines: 10,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "= Git AsciiDoc Complex Table Diff Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            { kind: "context", oldLine: 3, newLine: 3, text: "|===" },
            {
              kind: "context",
              oldLine: 4,
              newLine: 4,
              text: "|Item |Status",
            },
            { kind: "context", oldLine: 5, newLine: 5, text: "" },
            { kind: "context", oldLine: 6, newLine: 6, text: "2+|AsciiDoc" },
            { kind: "context", oldLine: 7, newLine: 7, text: "" },
            { kind: "context", oldLine: 8, newLine: 8, text: "|Diagram" },
            {
              kind: "removed",
              oldLine: 9,
              newLine: null,
              text: "|Rendered",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 9,
              text: "|Changed",
            },
            { kind: "context", oldLine: 10, newLine: 10, text: "|===" },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  return null;
}
