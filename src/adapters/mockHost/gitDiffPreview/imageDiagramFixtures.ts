import { diffHunksFromText } from "../../../core/documentDiff";
import type { GitDiffPreview } from "../../../core/types";

export function getImageDiagramGitDiffPreview(
  path: string,
  relativePath: string,
): GitDiffPreview | null {
  if (path.endsWith("/git-rendered-images.adoc")) {
    const leftText = `= Git Rendered Local Image Diff Fixture

The rendered diff should hydrate local images.

image::assets/svard-sample.svg[Stable local SVG]

image::assets/diff-oversized-image.svg[Oversized local SVG]

image::assets/missing-diff-image.png[Missing local image]
`;
    const rightText = `= Git Rendered Local Image Diff Fixture

The rendered diff should hydrate local images.

image::assets/svard-sample.svg[Stable local SVG]

image::assets/diff-oversized-image.svg[Oversized local SVG]

image::assets/diff-local-image.png[Working tree PNG]

image::assets/missing-diff-image.png[Missing local image]
`;
    return {
      repositoryRoot: "/workspace",
      relativePath,
      leftPath: path,
      rightPath: path,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [
        {
          oldStart: 1,
          oldLines: 9,
          newStart: 1,
          newLines: 11,
          lines: [
            {
              kind: "context",
              oldLine: 1,
              newLine: 1,
              text: "= Git Rendered Local Image Diff Fixture",
            },
            { kind: "context", oldLine: 2, newLine: 2, text: "" },
            {
              kind: "context",
              oldLine: 3,
              newLine: 3,
              text: "The rendered diff should hydrate local images.",
            },
            { kind: "context", oldLine: 4, newLine: 4, text: "" },
            {
              kind: "context",
              oldLine: 5,
              newLine: 5,
              text: "image::assets/svard-sample.svg[Stable local SVG]",
            },
            { kind: "context", oldLine: 6, newLine: 6, text: "" },
            {
              kind: "context",
              oldLine: 7,
              newLine: 7,
              text: "image::assets/diff-oversized-image.svg[Oversized local SVG]",
            },
            { kind: "context", oldLine: 8, newLine: 8, text: "" },
            {
              kind: "added",
              oldLine: null,
              newLine: 9,
              text: "image::assets/diff-local-image.png[Working tree PNG]",
            },
            { kind: "added", oldLine: null, newLine: 10, text: "" },
            {
              kind: "context",
              oldLine: 9,
              newLine: 11,
              text: "image::assets/missing-diff-image.png[Missing local image]",
            },
          ],
        },
      ],
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-diagram-image-diff.adoc")) {
    const leftText = `= Diagram Image Diff Fixture

[mermaid]
----
flowchart TD
A[Start] --> B[Done]
----

image::assets/svard-sample.svg[Stable image]
`;
    const rightText = `= Diagram Image Diff Fixture

[mermaid]
----
flowchart TD
A[Start] --> B[Done]
----

image::assets/svard-sample.svg[Stable image]

image::assets/diff-local-image.png[Added image]
`;
    return {
      repositoryRoot: "/workspace",
      relativePath,
      leftPath: path,
      rightPath: path,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-image-placeholder-source-change.adoc")) {
    const leftText = `= Image Placeholder Source Diff Fixture

Remote images follow the Security setting in rendered diff.

image::https://example.test/old-remote-image.png[Shared remote image]
`;
    const rightText = `= Image Placeholder Source Diff Fixture

Remote images follow the Security setting in rendered diff.

image::https://example.test/new-remote-image.png[Shared remote image]
`;
    return {
      repositoryRoot: "/workspace",
      relativePath,
      leftPath: path,
      rightPath: path,
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-diagram.adoc")) {
    const leftText = `= Git Rendered Diagram Diff Fixture

[mermaid]
----
flowchart TD
A[Start] --> B[Done]
----

[plantuml]
----
actor User
User -> Viewer: Open
----

[graphviz]
----
digraph G { Start -> Done }
----
`;
    const rightText = `= Git Rendered Diagram Diff Fixture

[mermaid]
----
flowchart TD
A[Start] --> B[Changed]
----

[plantuml]
----
actor User
User -> Viewer: Review
----

[graphviz]
----
digraph G { Start -> Changed }
----
`;
    return {
      repositoryRoot: null,
      relativePath,
      status: "modified",
      leftPath: path,
      rightPath: path,
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-unsupported-diagram.adoc")) {
    const leftText = `= Git Rendered Unsupported Diagram Diff Fixture

[c4plantuml]
----
Person(user, "User")
System(app, "Viewer")
Rel(user, app, "Opens")
----
`;
    const rightText = `= Git Rendered Unsupported Diagram Diff Fixture

[c4plantuml]
----
Person(user, "User")
System(app, "Viewer")
Rel(user, app, "Reviews")
----
`;
    return {
      repositoryRoot: "/workspace",
      relativePath,
      status: "modified",
      leftPath: path,
      rightPath: path,
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
      message: null,
      leftText,
      rightText,
    };
  }
  if (path.endsWith("/git-rendered-rich-asciidoc.adoc")) {
    const leftText = `= Git Rendered Rich AsciiDoc Diff Fixture

NOTE: Rich AsciiDoc blocks should keep their rendered structure.

.Feature matrix
[cols="1,1,1",options="header"]
|===
|Area |Status |Owner

|Rendering
|Stable
|Viewer

|Security
2+|Local first
|===

[source,js]
----
const status = "stable";
----
`;
    const rightText = `= Git Rendered Rich AsciiDoc Diff Fixture

NOTE: Rich AsciiDoc blocks should keep their rendered structure.

.Feature matrix
[cols="1,1,1",options="header"]
|===
|Area |Status |Owner

|Rendering
|Changed
|Viewer

|Security
2+|Local first
|===

[source,js]
----
const status = "changed";
----
`;
    return {
      repositoryRoot: "/workspace",
      relativePath,
      status: "modified",
      leftPath: path,
      rightPath: path,
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
