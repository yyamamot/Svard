import { diffHunksFromText } from "../../../core/documentDiff";
import type { GitDiffPreview } from "../../../core/types";

function buildLargeMarkdownScrollTail(count = 120): string {
  return Array.from(
    { length: count },
    (_, index) => `## Stable Review Note ${String(index + 1).padStart(3, "0")}

This unchanged review note keeps the full preview tall enough to exercise manual scrolling.

- Stable checklist item A
- Stable checklist item B
`,
  ).join("\n");
}

export function getRenderedDocumentGitDiffPreview(
  path: string,
  relativePath: string,
): GitDiffPreview | null {
  if (path.endsWith("/git-safe-html-blocks.md")) {
    const leftText = `# Safe HTML Block Diff

<div><p>HEAD block is pending.</p></div>

<table><tbody><tr><th>Status</th><td>Pending</td></tr></tbody></table>
`;
    const rightText = `# Safe HTML Block Diff

<div><p>Working tree block is ready.</p></div>

<hr>

<table><tbody><tr><th>Status</th><td>Stable</td></tr></tbody></table>
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-markdown.md")) {
    const leftText = `# Git Rendered Markdown Diff Fixture

This rendered Markdown paragraph was stable in HEAD.

- Existing item

> [!NOTE]
> Rendered alerts are compared as blocks.

\`\`\`ts
const label = "stable";
export function readLabel() {
  return label;
}
\`\`\`
`;
    const rightText = `# Git Rendered Markdown Diff Fixture

This rendered Markdown paragraph changed in the working tree.

- Existing item
- Added working-tree item

> [!NOTE]
> Rendered alerts are compared as blocks.

\`\`\`ts
const label = "changed";
export function readLabel() {
  return label;
}
\`\`\`
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
          oldLines: 7,
          newStart: 1,
          newLines: 8,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "# Git Rendered Markdown Diff Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            {
              kind: "removed",
              oldLine: 3,
              newLine: null,
              text: "This rendered Markdown paragraph was stable in HEAD.",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 3,
              text: "This rendered Markdown paragraph changed in the working tree.",
            },
            { kind: "context", oldLine: 4, newLine: 4, text: "" },
            {
              kind: "context",
              oldLine: 5,
              newLine: 5,
              text: "- Existing item",
            },
            {
              kind: "added",
              oldLine: null,
              newLine: 6,
              text: "- Added working-tree item",
            },
            { kind: "context", oldLine: 6, newLine: 7, text: "" },
            { kind: "context", oldLine: 7, newLine: 8, text: "> [!NOTE]" },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-list-reorder.md")) {
    const leftText = `# Git Rendered List Reorder Fixture

- Alpha stable item
- Beta stable item
`;
    const rightText = `# Git Rendered List Reorder Fixture

- Beta stable item
- Alpha stable item
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-list-deletion.md")) {
    const leftText = `# Git Rendered List Deletion Fixture

- Stable item
- Removed item
`;
    const rightText = `# Git Rendered List Deletion Fixture

- Stable item
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-large-markdown-scroll.md")) {
    const tail = buildLargeMarkdownScrollTail();
    const leftText = `# Large Markdown Scroll Return Fixture

This synthetic fixture mirrors a long implementation-history style document without copying private source.

## Early Changed Block

The HEAD version keeps the first changed block near the top of the document.

- Existing review checkpoint
- Existing navigation checkpoint

## Secondary Changed Block

This paragraph existed in HEAD before the large unchanged tail.

${tail}
`;
    const rightText = `# Large Markdown Scroll Return Fixture

This synthetic fixture mirrors a long implementation-history style document without copying private source.

## Early Changed Block

The working tree version keeps the first changed block near the top of the document.

- Existing review checkpoint
- Existing navigation checkpoint
- Added scroll return checkpoint

## Secondary Changed Block

This paragraph changed in the working tree before the large unchanged tail.

${tail}
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-math.adoc")) {
    const leftText = `= Git Rendered Math Diff Fixture
:stem:

Inline stem should render correctly: stem:[E = mc^2].

[stem]
++++
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
++++

[stem]
++++
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
++++

[mermaid]
----
flowchart TD
  A["\`Stable math $E = mc^2$\`"] --> B["Rendered"]
----
`;
    const rightText = `= Git Rendered Math Diff Fixture
:stem:

Inline stem should render in diff: stem:[E = mc^2].

[stem]
++++
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} + 0
++++

[stem]
++++
\\begin{bmatrix}
1 & 2 \\\\
3 & 5
\\end{bmatrix}
++++

[mermaid]
----
flowchart TD
  A["\`Diff math $E = mc^2$\`"] --> B["Rendered"]
----
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-backlog-resync.md")) {
    const leftText = `# Backlog Resync Diff Fixture

## IMP-095: Content cursor for technical documents

- Status: Done
- Goal: Content cursor
- Future gates: content cursor target extraction unit tests

## IMP-096: Lightweight action feedback

- Status: Backlog
- Goal: Lightweight feedback
- Future gates: feedback state unit tests

## IMP-097: Pinned search color model polish

- Status: Backlog
- Goal: Search polish
- Future gates: pinned search color unit tests
`;
    const rightText = `# Backlog Resync Diff Fixture

## IMP-096: Lightweight action feedback

- Status: Backlog
- Goal: Lightweight feedback
- Future gates: feedback state unit tests

## IMP-097: Pinned search color model polish

- Status: Backlog
- Goal: Search polish
- Future gates: pinned search color unit tests
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
          oldLines: 18,
          newStart: 1,
          newLines: 12,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "# Backlog Resync Diff Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            {
              kind: "removed",
              oldLine: 3,
              newLine: null,
              text: "## IMP-095: Content cursor for technical documents",
            },
            { kind: "removed", oldLine: 4, newLine: null, text: "" },
            {
              kind: "removed",
              oldLine: 5,
              newLine: null,
              text: "- Status: Done",
            },
            {
              kind: "removed",
              oldLine: 6,
              newLine: null,
              text: "- Goal: Content cursor",
            },
            {
              kind: "removed",
              oldLine: 7,
              newLine: null,
              text: "- Future gates: content cursor target extraction unit tests",
            },
            { kind: "removed", oldLine: 8, newLine: null, text: "" },
            {
              kind: "context",
              oldLine: 9,
              newLine: 3,
              text: "## IMP-096: Lightweight action feedback",
            },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-asciidoc.adoc")) {
    const leftText = `= Git Rendered AsciiDoc Diff Fixture

This rendered AsciiDoc paragraph was stable in HEAD.

NOTE: Rendered admonitions are compared as blocks.

== Structured targets

Review Mode:: HEAD reviewers inspect changed structured blocks directly.
Stable Term:: Stable definition context stays readable.

NOTE: HEAD structured admonition content is focused without highlighting the marker.

== Structured fallback

Ambiguous:: First HEAD duplicate description.
Ambiguous:: Second HEAD duplicate description.

|===
|Item |Status

|AsciiDoc
|Rendered
|===
`;
    const rightText = `= Git Rendered AsciiDoc Diff Fixture

This rendered AsciiDoc paragraph changed in the working tree.

NOTE: Rendered admonitions are compared as blocks.

== Structured targets

Review Mode:: Working tree reviewers inspect changed structured blocks directly.
Stable Term:: Stable definition context stays readable.

NOTE: Working tree structured admonition content is focused without highlighting the marker.

== Structured fallback

Ambiguous:: First working-tree duplicate description.
Ambiguous:: Second HEAD duplicate description.

|===
|Item |Status

|AsciiDoc
|Changed
|===
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  return null;
}
