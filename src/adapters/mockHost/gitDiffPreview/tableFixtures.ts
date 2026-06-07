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
  if (path.endsWith("/git-asciidoc-table.adoc")) {
    const leftText = `= Git AsciiDoc Table Diff Fixture

|===
|Item |Status

|AsciiDoc
|Rendered

|Diagram
|Local-first
|===
`;
    const rightText = `= Git AsciiDoc Table Diff Fixture

|===
|Item |Status

|AsciiDoc
|Changed

|Diagram
|Local-first
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
          oldLines: 11,
          newStart: 1,
          newLines: 11,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "= Git AsciiDoc Table Diff Fixture",
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
            { kind: "context", oldLine: 6, newLine: 6, text: "|AsciiDoc" },
            {
              kind: "removed",
              oldLine: 7,
              newLine: null,
              text: "|Rendered",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 7,
              text: "|Changed",
            },
            { kind: "context", oldLine: 8, newLine: 8, text: "" },
            { kind: "context", oldLine: 9, newLine: 9, text: "|Diagram" },
            {
              kind: "context",
              oldLine: 10,
              newLine: 10,
              text: "|Local-first",
            },
            { kind: "context", oldLine: 11, newLine: 11, text: "|===" },
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
