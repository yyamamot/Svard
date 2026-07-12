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

image::assets/diff-same-path-image.svg[Revision-specific local SVG]

image::assets/diff-oversized-image.svg[Oversized local SVG]

image::assets/missing-diff-image.png[Missing local image]
`;
    const rightText = `= Git Rendered Local Image Diff Fixture

The rendered diff should hydrate local images.

image::assets/svard-sample.svg[Stable local SVG]

image::assets/diff-same-path-image.svg[Revision-specific local SVG]

image::assets/diff-oversized-image.svg[Oversized local SVG]

image::assets/diff-local-image.png[Working tree PNG]

image::assets/missing-diff-image.png[Missing local image]
`;
    return {
      repositoryRoot: "/workspace",
      relativePath,
      leftPath: path,
      rightPath: path,
      leftRelativePath: relativePath,
      rightRelativePath: relativePath,
      leftResourceSource: { kind: "commit", revision: "fixture-head" },
      rightResourceSource: { kind: "worktree" },
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: diffHunksFromText(leftText, rightText),
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
