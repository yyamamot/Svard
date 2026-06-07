import { buildFileDocumentDiffPreview } from "../../../core/documentDiff";
import type { GitDiffPreview } from "../../../core/types";

export function getRegressionGalleryGitDiffPreview(
  path: string,
  relativePath: string,
): GitDiffPreview | null {
  if (path.endsWith("/diff-regression-gallery.md")) {
    const leftText = `# Diff Preview Regression Gallery

This paragraph was stable in HEAD and should keep visible inline highlight.

This paragraph exists only in HEAD and should be removed as a whole block.

## Product Principles

- Local-first rendering:
  - AsciiDoc / Markdown parsing stays local.
  - Common diagrams remain readable offline.
- Kroki as fallback:
  - Send diagram source only after confirmation.
- Browser-like viewer:
  - Tabs, history, quick open, split view, and find match browser expectations.
- Desktop-safe boundary:
  - File IO and cache stay behind HostAdapter.

Use **bold rendered text** with emphasis markers.

日本語の差分プレビューを確認します。

| Area | Status |
| --- | --- |
| Preview | Stable |
| Table | Rendered |

\`\`\`mermaid
flowchart TD
A[Start] --> B[Done]
\`\`\`

The legacy footer note belongs only to HEAD.

## Scroll Check Region

This shared section makes the rendered diff preview tall enough for mouse gesture scroll checks.

### Shared Detail 1

The first shared detail is unchanged and remains available in both panes.

### Shared Detail 2

The second shared detail is unchanged and remains available in both panes.

### Shared Detail 3

The third shared detail is unchanged and remains available in both panes.

### Shared Detail 4

The fourth shared detail is unchanged and remains available in both panes.

### Shared Detail 5

The fifth shared detail is unchanged and remains available in both panes.

### Shared Detail 6

The sixth shared detail is unchanged and remains available in both panes.

### Shared Detail 7

The seventh shared detail is unchanged and remains available in both panes.

### Shared Detail 8

The eighth shared detail is unchanged and remains available in both panes.
`;
    const rightText = `# Diff Preview Regression Gallery

This paragraph changed in the working tree and should keep visible inline highlight.

This paragraph exists only in the working tree and should be added as a whole block.

## Heading Boundary

This paragraph was inserted before the next heading to guard against heading misalignment.

## Product Principles

- Local-first rendering:
  - AsciiDoc / Markdown parsing stays local.
  - Common diagrams remain readable offline.
- Kroki as fallback:
  - Send diagram source only after confirmation.
- Browser-like viewer:
  - Tabs, history, quick open, split view, and find match browser expectations.
- Preview-based diff:
  - Rendered preview is the primary comparison surface.
  - Diagram source is not shown in review artifacts.
- Desktop-safe boundary:
  - File IO and cache stay behind HostAdapter.

Use bold rendered text without emphasis markers.

日本語の差分表示を確認します。

| Area | Status |
| --- | --- |
| Preview | Stable |
| Table | Changed |

\`\`\`mermaid
flowchart TD
A[Start] --> B[Changed]
\`\`\`

A fresh working tree closing note describes a different topic.

## Scroll Check Region

This shared section makes the rendered diff preview tall enough for mouse gesture scroll checks.

### Shared Detail 1

The first shared detail is unchanged and remains available in both panes.

### Shared Detail 2

The second shared detail is unchanged and remains available in both panes.

### Shared Detail 3

The third shared detail is unchanged and remains available in both panes.

### Shared Detail 4

The fourth shared detail is unchanged and remains available in both panes.

### Shared Detail 5

The fifth shared detail is unchanged and remains available in both panes.

### Shared Detail 6

The sixth shared detail is unchanged and remains available in both panes.

### Shared Detail 7

The seventh shared detail is unchanged and remains available in both panes.

### Shared Detail 8

The eighth shared detail is unchanged and remains available in both panes.
`;
    const preview = buildFileDocumentDiffPreview({
      leftPath: "/workspace/docs/diff-regression-gallery.head.md",
      leftText,
      rightPath: path,
      rightText,
    });
    return {
      ...preview,
      source: "git",
      relativePath,
      leftPath: null,
      rightPath: path,
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
    };
  }
  return null;
}
