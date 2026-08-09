import type { AsciiDocIncludeGraph, DirectoryEntry } from "./types";

export const fixturePath = "/workspace/docs/mvp-guide.adoc";

export const fixtureEntriesByDirectory: Record<string, DirectoryEntry[]> = {
  "/workspace": [
    { name: "book", path: "/workspace/book", kind: "directory" },
    { name: "docs", path: "/workspace/docs", kind: "directory" },
    { name: "images", path: "/workspace/images", kind: "directory" },
    { name: "modules", path: "/workspace/modules", kind: "directory" },
    { name: "partials", path: "/workspace/partials", kind: "directory" },
    { name: "archive", path: "/workspace/archive", kind: "directory" },
    {
      name: "obsidian-vault",
      path: "/workspace/obsidian-vault",
      kind: "directory",
    },
    { name: "mvp-guide.adoc", path: fixturePath, kind: "file" },
  ],
  "/workspace/obsidian-vault": [
    {
      name: ".obsidian",
      path: "/workspace/obsidian-vault/.obsidian",
      kind: "directory",
    },
    {
      name: "index.md",
      path: "/workspace/obsidian-vault/index.md",
      kind: "file",
    },
    {
      name: "Guide.md",
      path: "/workspace/obsidian-vault/Guide.md",
      kind: "file",
    },
    {
      name: "folder",
      path: "/workspace/obsidian-vault/folder",
      kind: "directory",
    },
  ],
  "/workspace/obsidian-vault/.obsidian": [],
  "/workspace/obsidian-vault/folder": [
    {
      name: "Nested.md",
      path: "/workspace/obsidian-vault/folder/Nested.md",
      kind: "file",
    },
  ],
  "/workspace/book": [
    { name: "sections", path: "/workspace/book/sections", kind: "directory" },
  ],
  "/workspace/book/sections": [
    {
      name: "project-context-assets.adoc",
      path: "/workspace/book/sections/project-context-assets.adoc",
      kind: "file",
    },
  ],
  "/workspace/docs": [
    { name: "guides", path: "/workspace/docs/guides", kind: "directory" },
    { name: "diagrams", path: "/workspace/docs/diagrams", kind: "directory" },
    { name: "mvp-guide.adoc", path: fixturePath, kind: "file" },
    {
      name: "kroki-sample.adoc",
      path: "/workspace/docs/kroki-sample.adoc",
      kind: "file",
    },
    {
      name: "kroki-c4-scale.adoc",
      path: "/workspace/docs/kroki-c4-scale.adoc",
      kind: "file",
    },
    {
      name: "preferences.adoc",
      path: "/workspace/docs/preferences.adoc",
      kind: "file",
    },
    {
      name: "copy-actions.adoc",
      path: "/workspace/docs/copy-actions.adoc",
      kind: "file",
    },
    {
      name: "render-fixtures.adoc",
      path: "/workspace/docs/render-fixtures.adoc",
      kind: "file",
    },
    {
      name: "asciidoc-standard-theme.adoc",
      path: "/workspace/docs/asciidoc-standard-theme.adoc",
      kind: "file",
    },
    {
      name: "include-main.adoc",
      path: "/workspace/docs/include-main.adoc",
      kind: "file",
    },
    {
      name: "include-text-files.adoc",
      path: "/workspace/docs/include-text-files.adoc",
      kind: "file",
    },
    {
      name: "conditional-include.adoc",
      path: "/workspace/docs/conditional-include.adoc",
      kind: "file",
    },
    {
      name: "cross-platform-local-assets.adoc",
      path: "/workspace/docs/cross-platform-local-assets.adoc",
      kind: "file",
    },
    {
      name: "include-diagnostics.adoc",
      path: "/workspace/docs/include-diagnostics.adoc",
      kind: "file",
    },
    {
      name: "math-rendering.adoc",
      path: "/workspace/docs/math-rendering.adoc",
      kind: "file",
    },
    {
      name: "math-rendering.md",
      path: "/workspace/docs/math-rendering.md",
      kind: "file",
    },
    {
      name: "markdown-math-edge-cases.md",
      path: "/workspace/docs/markdown-math-edge-cases.md",
      kind: "file",
    },
    {
      name: "external-images.md",
      path: "/workspace/docs/external-images.md",
      kind: "file",
    },
    {
      name: "asciidoc-comprehensive-visual.adoc",
      path: "/workspace/docs/asciidoc-comprehensive-visual.adoc",
      kind: "file",
    },
    {
      name: "markdown-sample.md",
      path: "/workspace/docs/markdown-sample.md",
      kind: "file",
    },
    {
      name: "markdown-code.md",
      path: "/workspace/docs/markdown-code.md",
      kind: "file",
    },
    {
      name: "markdown-github.md",
      path: "/workspace/docs/markdown-github.md",
      kind: "file",
    },
    {
      name: "markdown-footnotes-admonitions.md",
      path: "/workspace/docs/markdown-footnotes-admonitions.md",
      kind: "file",
    },
    {
      name: "markdown-details.md",
      path: "/workspace/docs/markdown-details.md",
      kind: "file",
    },
    {
      name: "git-modified.md",
      path: "/workspace/docs/git-modified.md",
      kind: "file",
    },
    {
      name: "git-clean.md",
      path: "/workspace/docs/git-clean.md",
      kind: "file",
    },
    {
      name: "git-untracked.md",
      path: "/workspace/docs/git-untracked.md",
      kind: "file",
    },
    {
      name: "git-table.md",
      path: "/workspace/docs/git-table.md",
      kind: "file",
    },
    {
      name: "git-table-cells.md",
      path: "/workspace/docs/git-table-cells.md",
      kind: "file",
    },
    {
      name: "git-table-untracked.md",
      path: "/workspace/docs/git-table-untracked.md",
      kind: "file",
    },
    {
      name: "git-asciidoc-table.adoc",
      path: "/workspace/docs/git-asciidoc-table.adoc",
      kind: "file",
    },
    {
      name: "git-asciidoc-table-complex.adoc",
      path: "/workspace/docs/git-asciidoc-table-complex.adoc",
      kind: "file",
    },
    {
      name: "git-rendered-markdown.md",
      path: "/workspace/docs/git-rendered-markdown.md",
      kind: "file",
    },
    {
      name: "git-rendered-list-reorder.md",
      path: "/workspace/docs/git-rendered-list-reorder.md",
      kind: "file",
    },
    {
      name: "git-rendered-list-deletion.md",
      path: "/workspace/docs/git-rendered-list-deletion.md",
      kind: "file",
    },
    {
      name: "git-large-markdown-scroll.md",
      path: "/workspace/docs/git-large-markdown-scroll.md",
      kind: "file",
    },
    {
      name: "git-rendered-asciidoc.adoc",
      path: "/workspace/docs/git-rendered-asciidoc.adoc",
      kind: "file",
    },
    {
      name: "git-rendered-diagram.adoc",
      path: "/workspace/docs/git-rendered-diagram.adoc",
      kind: "file",
    },
    {
      name: "git-rendered-unsupported-diagram.adoc",
      path: "/workspace/docs/git-rendered-unsupported-diagram.adoc",
      kind: "file",
    },
    {
      name: "git-rendered-rich-asciidoc.adoc",
      path: "/workspace/docs/git-rendered-rich-asciidoc.adoc",
      kind: "file",
    },
    {
      name: "git-rendered-math.adoc",
      path: "/workspace/docs/git-rendered-math.adoc",
      kind: "file",
    },
    {
      name: "git-rendered-images.adoc",
      path: "/workspace/docs/git-rendered-images.adoc",
      kind: "file",
    },
    {
      name: "git-diagram-image-diff.adoc",
      path: "/workspace/docs/git-diagram-image-diff.adoc",
      kind: "file",
    },
    {
      name: "git-image-placeholder-source-change.adoc",
      path: "/workspace/docs/git-image-placeholder-source-change.adoc",
      kind: "file",
    },
    {
      name: "git-backlog-resync.md",
      path: "/workspace/docs/git-backlog-resync.md",
      kind: "file",
    },
    {
      name: "diff-regression-gallery.md",
      path: "/workspace/docs/diff-regression-gallery.md",
      kind: "file",
    },
    {
      name: "file-diff-left.md",
      path: "/workspace/docs/file-diff-left.md",
      kind: "file",
    },
    {
      name: "file-diff-right.md",
      path: "/workspace/docs/file-diff-right.md",
      kind: "file",
    },
    {
      name: "file-diff-left.adoc",
      path: "/workspace/docs/file-diff-left.adoc",
      kind: "file",
    },
    {
      name: "file-diff-right.adoc",
      path: "/workspace/docs/file-diff-right.adoc",
      kind: "file",
    },
    {
      name: "file-diff-table-left.md",
      path: "/workspace/docs/file-diff-table-left.md",
      kind: "file",
    },
    {
      name: "file-diff-table-right.md",
      path: "/workspace/docs/file-diff-table-right.md",
      kind: "file",
    },
    {
      name: "markdown-diagrams.md",
      path: "/workspace/docs/markdown-diagrams.md",
      kind: "file",
    },
    {
      name: "markdown-japanese.md",
      path: "/workspace/docs/markdown-japanese.md",
      kind: "file",
    },
    {
      name: "obsidian-wikilink-disabled.md",
      path: "/workspace/docs/obsidian-wikilink-disabled.md",
      kind: "file",
    },
    {
      name: "plantuml-large.adoc",
      path: "/workspace/docs/plantuml-large.adoc",
      kind: "file",
    },
    {
      name: "plantuml-concurrency.adoc",
      path: "/workspace/docs/plantuml-concurrency.adoc",
      kind: "file",
    },
    {
      name: "plantuml-marker-compat.adoc",
      path: "/workspace/docs/plantuml-marker-compat.adoc",
      kind: "file",
    },
    {
      name: "plantuml-marker-compat.md",
      path: "/workspace/docs/plantuml-marker-compat.md",
      kind: "file",
    },
    {
      name: "graphviz-diagnostic.adoc",
      path: "/workspace/docs/graphviz-diagnostic.adoc",
      kind: "file",
    },
    {
      name: "asciidoc-diagram-attributes.adoc",
      path: "/workspace/docs/asciidoc-diagram-attributes.adoc",
      kind: "file",
    },
    {
      name: "plantuml-japanese.adoc",
      path: "/workspace/docs/plantuml-japanese.adoc",
      kind: "file",
    },
    {
      name: "plantuml-japanese-long-text.adoc",
      path: "/workspace/docs/plantuml-japanese-long-text.adoc",
      kind: "file",
    },
    {
      name: "plantuml-multiline.adoc",
      path: "/workspace/docs/plantuml-multiline.adoc",
      kind: "file",
    },
  ],
  "/workspace/docs/guides": [
    {
      name: "quick-start.adoc",
      path: "/workspace/docs/guides/quick-start.adoc",
      kind: "file",
    },
  ],
  "/workspace/docs/diagrams": [
    {
      name: "mermaid-japanese-flow.adoc",
      path: "/workspace/docs/diagrams/mermaid-japanese-flow.adoc",
      kind: "file",
    },
    {
      name: "plantuml-japanese-combined.adoc",
      path: "/workspace/docs/diagrams/plantuml-japanese-combined.adoc",
      kind: "file",
    },
    {
      name: "diagrams-mixed-long-ja.adoc",
      path: "/workspace/docs/diagrams/diagrams-mixed-long-ja.adoc",
      kind: "file",
    },
    {
      name: "graphviz-overview.adoc",
      path: "/workspace/docs/diagrams/graphviz-overview.adoc",
      kind: "file",
    },
  ],
  "/workspace/images": [
    { name: "test.svg", path: "/workspace/images/test.svg", kind: "file" },
  ],
  "/workspace/modules": [
    {
      name: "module-a",
      path: "/workspace/modules/module-a",
      kind: "directory",
    },
  ],
  "/workspace/modules/module-a": [
    {
      name: "images",
      path: "/workspace/modules/module-a/images",
      kind: "directory",
    },
    {
      name: "pages",
      path: "/workspace/modules/module-a/pages",
      kind: "directory",
    },
    {
      name: "partials",
      path: "/workspace/modules/module-a/partials",
      kind: "directory",
    },
  ],
  "/workspace/modules/module-a/images": [
    {
      name: "diagram.drawio.svg",
      path: "/workspace/modules/module-a/images/diagram.drawio.svg",
      kind: "file",
    },
  ],
  "/workspace/modules/module-a/pages": [
    {
      name: "index.adoc",
      path: "/workspace/modules/module-a/pages/index.adoc",
      kind: "file",
    },
    {
      name: "static-attributes.adoc",
      path: "/workspace/modules/module-a/pages/static-attributes.adoc",
      kind: "file",
    },
  ],
  "/workspace/modules/module-a/partials": [
    {
      name: "header.adoc",
      path: "/workspace/modules/module-a/partials/header.adoc",
      kind: "file",
    },
    {
      name: "static-intro.adoc",
      path: "/workspace/modules/module-a/partials/static-intro.adoc",
      kind: "file",
    },
  ],
  "/workspace/partials": [
    {
      name: "cross-platform-partial.adoc",
      path: "/workspace/partials/cross-platform-partial.adoc",
      kind: "file",
    },
  ],
  "/workspace/archive": [
    {
      name: "old-notes.adoc",
      path: "/workspace/archive/old-notes.adoc",
      kind: "file",
    },
  ],
};

export const fixtureEntries: DirectoryEntry[] = [
  { name: "docs", path: "/workspace/docs", kind: "directory" },
  { name: "mvp-guide.adoc", path: fixturePath, kind: "file" },
  {
    name: "kroki-sample.adoc",
    path: "/workspace/docs/kroki-sample.adoc",
    kind: "file",
  },
  {
    name: "kroki-c4-scale.adoc",
    path: "/workspace/docs/kroki-c4-scale.adoc",
    kind: "file",
  },
  {
    name: "preferences.adoc",
    path: "/workspace/docs/preferences.adoc",
    kind: "file",
  },
  {
    name: "copy-actions.adoc",
    path: "/workspace/docs/copy-actions.adoc",
    kind: "file",
  },
  {
    name: "render-fixtures.adoc",
    path: "/workspace/docs/render-fixtures.adoc",
    kind: "file",
  },
  {
    name: "math-rendering.adoc",
    path: "/workspace/docs/math-rendering.adoc",
    kind: "file",
  },
  {
    name: "math-rendering.md",
    path: "/workspace/docs/math-rendering.md",
    kind: "file",
  },
  {
    name: "markdown-math-edge-cases.md",
    path: "/workspace/docs/markdown-math-edge-cases.md",
    kind: "file",
  },
  {
    name: "asciidoc-comprehensive-visual.adoc",
    path: "/workspace/docs/asciidoc-comprehensive-visual.adoc",
    kind: "file",
  },
  {
    name: "markdown-sample.md",
    path: "/workspace/docs/markdown-sample.md",
    kind: "file",
  },
  {
    name: "markdown-code.md",
    path: "/workspace/docs/markdown-code.md",
    kind: "file",
  },
  {
    name: "markdown-github.md",
    path: "/workspace/docs/markdown-github.md",
    kind: "file",
  },
  {
    name: "markdown-footnotes-admonitions.md",
    path: "/workspace/docs/markdown-footnotes-admonitions.md",
    kind: "file",
  },
  {
    name: "markdown-details.md",
    path: "/workspace/docs/markdown-details.md",
    kind: "file",
  },
  {
    name: "git-modified.md",
    path: "/workspace/docs/git-modified.md",
    kind: "file",
  },
  {
    name: "git-clean.md",
    path: "/workspace/docs/git-clean.md",
    kind: "file",
  },
  {
    name: "git-untracked.md",
    path: "/workspace/docs/git-untracked.md",
    kind: "file",
  },
  {
    name: "git-table.md",
    path: "/workspace/docs/git-table.md",
    kind: "file",
  },
  {
    name: "git-table-cells.md",
    path: "/workspace/docs/git-table-cells.md",
    kind: "file",
  },
  {
    name: "git-table-untracked.md",
    path: "/workspace/docs/git-table-untracked.md",
    kind: "file",
  },
  {
    name: "git-asciidoc-table.adoc",
    path: "/workspace/docs/git-asciidoc-table.adoc",
    kind: "file",
  },
  {
    name: "git-asciidoc-table-complex.adoc",
    path: "/workspace/docs/git-asciidoc-table-complex.adoc",
    kind: "file",
  },
  {
    name: "git-rendered-markdown.md",
    path: "/workspace/docs/git-rendered-markdown.md",
    kind: "file",
  },
  {
    name: "git-rendered-list-reorder.md",
    path: "/workspace/docs/git-rendered-list-reorder.md",
    kind: "file",
  },
  {
    name: "git-rendered-list-deletion.md",
    path: "/workspace/docs/git-rendered-list-deletion.md",
    kind: "file",
  },
  {
    name: "git-large-markdown-scroll.md",
    path: "/workspace/docs/git-large-markdown-scroll.md",
    kind: "file",
  },
  {
    name: "git-rendered-asciidoc.adoc",
    path: "/workspace/docs/git-rendered-asciidoc.adoc",
    kind: "file",
  },
  {
    name: "git-rendered-diagram.adoc",
    path: "/workspace/docs/git-rendered-diagram.adoc",
    kind: "file",
  },
  {
    name: "git-rendered-unsupported-diagram.adoc",
    path: "/workspace/docs/git-rendered-unsupported-diagram.adoc",
    kind: "file",
  },
  {
    name: "git-rendered-rich-asciidoc.adoc",
    path: "/workspace/docs/git-rendered-rich-asciidoc.adoc",
    kind: "file",
  },
  {
    name: "git-rendered-math.adoc",
    path: "/workspace/docs/git-rendered-math.adoc",
    kind: "file",
  },
  {
    name: "git-rendered-images.adoc",
    path: "/workspace/docs/git-rendered-images.adoc",
    kind: "file",
  },
  {
    name: "git-diagram-image-diff.adoc",
    path: "/workspace/docs/git-diagram-image-diff.adoc",
    kind: "file",
  },
  {
    name: "git-image-placeholder-source-change.adoc",
    path: "/workspace/docs/git-image-placeholder-source-change.adoc",
    kind: "file",
  },
  {
    name: "git-backlog-resync.md",
    path: "/workspace/docs/git-backlog-resync.md",
    kind: "file",
  },
  {
    name: "file-diff-left.md",
    path: "/workspace/docs/file-diff-left.md",
    kind: "file",
  },
  {
    name: "file-diff-right.md",
    path: "/workspace/docs/file-diff-right.md",
    kind: "file",
  },
  {
    name: "file-diff-left.adoc",
    path: "/workspace/docs/file-diff-left.adoc",
    kind: "file",
  },
  {
    name: "file-diff-right.adoc",
    path: "/workspace/docs/file-diff-right.adoc",
    kind: "file",
  },
  {
    name: "file-diff-table-left.md",
    path: "/workspace/docs/file-diff-table-left.md",
    kind: "file",
  },
  {
    name: "file-diff-table-right.md",
    path: "/workspace/docs/file-diff-table-right.md",
    kind: "file",
  },
  {
    name: "markdown-diagrams.md",
    path: "/workspace/docs/markdown-diagrams.md",
    kind: "file",
  },
  {
    name: "markdown-japanese.md",
    path: "/workspace/docs/markdown-japanese.md",
    kind: "file",
  },
  {
    name: "plantuml-large.adoc",
    path: "/workspace/docs/plantuml-large.adoc",
    kind: "file",
  },
  {
    name: "plantuml-concurrency.adoc",
    path: "/workspace/docs/plantuml-concurrency.adoc",
    kind: "file",
  },
  {
    name: "plantuml-marker-compat.adoc",
    path: "/workspace/docs/plantuml-marker-compat.adoc",
    kind: "file",
  },
  {
    name: "plantuml-marker-compat.md",
    path: "/workspace/docs/plantuml-marker-compat.md",
    kind: "file",
  },
  {
    name: "graphviz-diagnostic.adoc",
    path: "/workspace/docs/graphviz-diagnostic.adoc",
    kind: "file",
  },
  {
    name: "plantuml-japanese.adoc",
    path: "/workspace/docs/plantuml-japanese.adoc",
    kind: "file",
  },
  {
    name: "plantuml-japanese-long-text.adoc",
    path: "/workspace/docs/plantuml-japanese-long-text.adoc",
    kind: "file",
  },
  {
    name: "plantuml-multiline.adoc",
    path: "/workspace/docs/plantuml-multiline.adoc",
    kind: "file",
  },
];

export const comprehensiveVisualSample = `= AsciiDoc Comprehensive Visual Sample
:toc:
:sectnums:

This sample is for human visual review of AsciiDoc rendering, source-location copy, local diagrams, links, and dense technical reading layout.

== Reading Structure

The viewer should expose stable heading anchors, a readable table of contents, and source-location aware heading copy for this section.

=== Nested Heading

Nested headings should remain readable in the document body and visible in the Contents sidebar.

== Source Blocks

[source,ts]
----
export type ViewerMode = "read" | "review";

export const product = {
  name: "Svard",
  localFirst: true,
};
----

[source]
----
plain source block without language
----

[source,rust,linenums]
----
fn main() {
    println!("Svard");
}
----

== Admonitions

NOTE: Local render keeps private documents on this machine.

TIP: Use source reference copy when reviewing design documents.

WARNING: Remote diagram rendering must stay explicit and privacy-gated.

== Table

|===
|Area |Expected visual behavior |Review point

|Headings
|Stable anchors and TOC entries
|Heading reference copy

|Source blocks
|Readable monospace blocks with copy controls
|Block body copy and source reference copy

|Diagrams
|Inline SVG with no constant metadata chrome
|Local Mermaid and PlantUML render
|===

== Image

image::assets/svard-sample.svg[Svard local image]

== Links and Xrefs

https://example.com[External link]

link:render-fixtures.adoc[Local fixture document]

See <<xref-target,explicit xref target>>.

[[xref-target]]
=== Explicit Xref Target

The xref should jump to this section without leaving the current document.

== Mermaid Flowchart

[mermaid]
----
flowchart LR
  source["AsciiDoc source"] --> parse["Render contract"]
  parse --> html["Viewer HTML"]
  parse --> map["Source locations"]
  html --> review["Human visual review"]
  map --> review
----

== Mermaid Sequence

[mermaid]
----
sequenceDiagram
  participant User
  participant Viewer
  participant Renderer
  User->>Viewer: Open sample
  Viewer->>Renderer: Render Mermaid locally
  Renderer-->>Viewer: SVG
  Viewer-->>User: Inline diagram
----

== Mermaid Gantt

[mermaid]
----
gantt
  title Implementation Review
  dateFormat  YYYY-MM-DD
  section Docs
  Contract review     :a1, 2026-05-01, 2d
  Visual sample       :a2, after a1, 2d
  section Verification
  UI scenario         :b1, after a2, 1d
  Full verify         :b2, after b1, 1d
----

== Mermaid Class Diagram

[mermaid]
----
classDiagram
  class RenderResult {
    +string html
    +Heading[] headings
    +SourceBlock[] sourceBlocks
  }
  class Heading {
    +string id
    +number line
  }
  RenderResult "1" --> "*" Heading
----

== Mermaid State Diagram

[mermaid]
----
stateDiagram-v2
  [*] --> Loaded
  Loaded --> Rendered: local render
  Rendered --> Reviewing: open scenario
  Reviewing --> [*]
----

== Mermaid ER Diagram

[mermaid]
----
erDiagram
  DOCUMENT ||--o{ HEADING : contains
  DOCUMENT ||--o{ SOURCE_BLOCK : contains
  DOCUMENT ||--o{ DIAGNOSTIC : reports
  HEADING {
    string id
    int line
  }
----

== Mermaid Pie Chart

[mermaid]
----
pie title Review Surface
  "AsciiDoc structure" : 35
  "Diagrams" : 35
  "Copy controls" : 20
  "Links and images" : 10
----

== Mermaid User Journey

[mermaid]
----
journey
  title Visual review flow
  section Open
    Choose sample: 5: Reviewer
    Wait for local render: 4: Reviewer
  section Inspect
    Check diagrams: 5: Reviewer
    Copy references: 4: Reviewer
----

== PlantUML Sequence

[plantuml]
----
@startuml
actor Reviewer
participant "Svard" as Viewer
participant "Local PlantUML" as PlantUML
Reviewer -> Viewer: Open comprehensive sample
Viewer -> PlantUML: Render diagram locally
PlantUML --> Viewer: SVG
Viewer --> Reviewer: Inline result
@enduml
----

== PlantUML Component

[plantuml]
----
@startuml
package "Viewer" {
  [Document Pane]
  [Contents]
  [Search]
}
package "Core" {
  [AsciiDoc Render]
  [Source Map]
  [Diagram Extractor]
}
[Document Pane] --> [AsciiDoc Render]
[AsciiDoc Render] --> [Source Map]
[AsciiDoc Render] --> [Diagram Extractor]
@enduml
----

== PlantUML Class

[plantuml]
----
@startuml
class RenderResult {
  +html
  +headings
  +sourceBlocks
  +diagnostics
}
class Heading {
  +id
  +level
  +text
  +sourceLocation
}
class SourceBlock {
  +id
  +language
  +sourceLocation
}
RenderResult "1" o-- "*" Heading
RenderResult "1" o-- "*" SourceBlock
@enduml
----

== PlantUML Activity

[plantuml]
----
@startuml
start
:Open AsciiDoc sample;
if (Diagrams available?) then (yes)
  :Render locally;
else (no)
  :Show diagnostic;
endif
:Review source references;
stop
@enduml
----

== PlantUML Use Case

[plantuml]
----
@startuml
left to right direction
actor Reviewer
rectangle "Svard" {
  usecase "Open document" as Open
  usecase "Inspect diagram" as Inspect
  usecase "Copy source reference" as CopyRef
}
Reviewer --> Open
Reviewer --> Inspect
Reviewer --> CopyRef
@enduml
----

== PlantUML State

[plantuml]
----
@startuml
[*] --> Loaded
Loaded --> Rendered : local render
Rendered --> Diagnostic : unsupported diagram
Rendered --> Reviewed : human check
Diagnostic --> Reviewed
Reviewed --> [*]
@enduml
----

== PlantUML Object

[plantuml]
----
@startuml
object "Document" as document {
  path = /workspace/docs/asciidoc-comprehensive-visual.adoc
}
object "SourceBlock" as sourceBlock {
  language = plantuml
  line = stable
}
document --> sourceBlock
@enduml
----

== Unsupported Diagram Diagnostic

[blockdiag]
----
A -> B
----

== C4 PlantUML Diagnostic (Unsupported Locally)

[c4plantuml]
----
@startuml
!include <C4/C4_Context>
Person(reviewer, "Reviewer")
System(viewer, "Svard")
Rel(reviewer, viewer, "opens local technical documents")
@enduml
----
`;

function buildPlantUmlConcurrencySample(count = 100): string {
  const sections = [];
  for (let index = 1; index <= count; index += 1) {
    const id = String(index).padStart(3, "0");
    sections.push(`== Diagram ${id}

[plantuml]
----
@startuml
participant "Reader ${id}" as Reader
participant "Svard ${id}" as Viewer
Reader -> Viewer: Open document ${id}
Viewer --> Reader: Rendered SVG ${id}
@enduml
----`);
  }

  return `= PlantUML Concurrency Stress

This synthetic document contains ${count} local PlantUML diagrams for deterministic concurrency review.

${sections.join("\n\n")}
`;
}

function buildLargeMarkdownScrollDocument(count = 120): string {
  const sections = Array.from(
    { length: count },
    (_, index) => `## Stable Review Note ${String(index + 1).padStart(3, "0")}

This unchanged review note keeps the rendered preview tall enough for scroll return review.

- Stable checklist item A
- Stable checklist item B
`,
  ).join("\n");

  return `# Large Markdown Scroll Return Fixture

This synthetic fixture mirrors a long implementation-history style document without copying private source.

## Early Changed Block

The working tree version keeps the first changed block near the top of the document.

- Existing review checkpoint
- Existing navigation checkpoint
- Added scroll return checkpoint

## Secondary Changed Block

This paragraph changed in the working tree before the large unchanged tail.

${sections}
`;
}

export const fixtureDocuments: Record<string, string> = {
  "/workspace/obsidian-vault/index.md": `# Obsidian Index

Open [[Guide]], [[folder/Nested]], [[Guide#Details]], and [[Guide|the guide]].
`,
  "/workspace/obsidian-vault/Guide.md": `# Guide

## Details

This is a synthetic Obsidian-style note.
`,
  "/workspace/obsidian-vault/folder/Nested.md": `# Nested

Nested note.
`,
  "/workspace/docs/conditional-include.adoc": `= Conditional Include Compatibility Sample
:toc:
:feature-preview:
:target-env: prod
:partialsdir: partials/conditional

== Expected Visible Content

The rendered document should include active ifdef, ifndef, ifeval, and propagated attribute include branches.

== ifdef Include

ifdef::feature-preview[]
include::{partialsdir}/feature-preview.adoc[leveloffset=+1]
endif::[]

ifndef::feature-preview[]
include::{partialsdir}/feature-disabled.adoc[leveloffset=+1]
endif::[]

== ifndef Include

ifndef::legacy-mode[]
include::{partialsdir}/modern-mode.adoc[leveloffset=+1]
endif::[]

ifdef::legacy-mode[]
include::{partialsdir}/legacy-mode.adoc[leveloffset=+1]
endif::[]

== ifeval Include

ifeval::["{target-env}" == "prod"]
include::{partialsdir}/prod-target.adoc[leveloffset=+1]
endif::[]

ifeval::["{target-env}" == "dev"]
include::{partialsdir}/dev-target.adoc[leveloffset=+1]
endif::[]

== Attribute Propagation From Include

include::{partialsdir}/attribute-seed.adoc[]
include::{propagated-partial}/propagated-content.adoc[leveloffset=+1]
`,
  "/workspace/docs/partials/conditional/feature-preview.adoc": `= Feature Preview Branch

This section is included because feature-preview is defined.
`,
  "/workspace/docs/partials/conditional/feature-disabled.adoc": `= Feature Disabled Branch

This content should stay hidden.
`,
  "/workspace/docs/partials/conditional/modern-mode.adoc": `= Modern Mode Branch

This section is included because legacy-mode is not defined.
`,
  "/workspace/docs/partials/conditional/legacy-mode.adoc": `= Legacy Mode Branch

This content should stay hidden.
`,
  "/workspace/docs/partials/conditional/prod-target.adoc": `= Production Target Branch

This section is included because target-env is prod.
`,
  "/workspace/docs/partials/conditional/dev-target.adoc": `= Development Target Branch

This content should stay hidden.
`,
  "/workspace/docs/partials/conditional/attribute-seed.adoc": `:propagated-partial: partials/conditional/nested

The include above defines propagated-partial.
`,
  "/workspace/docs/partials/conditional/nested/propagated-content.adoc": `= Propagated Attribute Include

This section proves that an attribute defined inside an included file can select a later include target.
`,
  "/workspace/docs/obsidian-wikilink-disabled.md": `# Wikilink Disabled

This non-vault Markdown keeps [[Guide]] as readable text.
`,
  [fixturePath]: `= Svard MVP Guide
:toc:

Svard is a local-first desktop viewer for reading AsciiDoc files with navigation, search, preferences, and safe diagram handling.

== Reader Workflow

Open an AsciiDoc document from the file explorer, inspect the rendered content, and use the table of contents to move between sections.

== Search

Use the search field to highlight matching content in the current document. Pinned search is saved as a viewer preference.

== Mermaid Diagram

[mermaid]
----
flowchart LR
  A[AsciiDoc] --> B[Local Mermaid]
  B --> C[SVG]
----

Mermaid diagrams render locally by default so frequent diagrams do not require Kroki or external network access.

== Graphviz Diagram

[graphviz]
----
digraph G { A -> B }
----

Graphviz / DOT diagrams render locally by default with Viz.js. Kroki remains available for unsupported diagrams and explicit fallback.

== PlantUML Diagram

[plantuml]
----
@startuml
Alice -> Bob: hello
@enduml
----

PlantUML renders locally by default with TeaVM and Viz.js. Diagram source is never sent to a remote endpoint without explicit configuration.

== Preferences

The Preferences panel exposes a compact set of reader defaults: theme, diagrams, files, cache, and security.
`,
  "/workspace/docs/kroki-sample.adoc": `= Kroki Safety Sample

== Disabled by Default

[mermaid]
----
flowchart LR
  A[AsciiDoc] --> B[Tauri Backend]
  B --> C[Kroki]
----

[plantuml]
----
@startuml
Alice -> Bob: local render
@enduml
----

This sample should show local PlantUML rendering while Kroki mode is disabled.
`,
  "/workspace/docs/kroki-c4-scale.adoc": `= Kroki C4 Scale Sample
:toc:

This sample verifies that Kroki SVG output keeps a natural aspect ratio in the viewer.

== C4 Context

[c4plantuml]
----
@startuml
!include <C4/C4_Context>
Person(reviewer, "Reviewer")
System(viewer, "Svard")
Rel(reviewer, viewer, "opens local technical documents")
@enduml
----
`,
  "/workspace/docs/plantuml-concurrency.adoc":
    buildPlantUmlConcurrencySample(100),
  "/workspace/docs/plantuml-marker-compat.adoc": `= PlantUML Marker Compatibility

== AsciiDoc Markerless Block

[plantuml]
....
actor User
participant Renderer
User -> Renderer: Render
Renderer --> User: SVG
....

The Markdown fixture with the same filename stem verifies the same local renderer payload rule for fenced code.
`,
  "/workspace/docs/plantuml-marker-compat.md": `# PlantUML Marker Compatibility

## Markdown Markerless Fence

\`\`\`plantuml
actor User
participant Renderer
User -> Renderer: Render
Renderer --> User: SVG
\`\`\`
`,
  "/workspace/docs/graphviz-diagnostic.adoc": `= Graphviz Diagnostic

== Invalid DOT

[graphviz]
----
digraph G { A -> }
----
`,
  "/workspace/docs/copy-actions.adoc": `= Copy Actions

== Code

[source,ts]
----
const product = "Svard";
----

A *source* paragraph for copy actions.

Each path includes:

* Deployable Helm charts and Kustomize manifests
* Primary settings for performance tuning
* Sample workloads and baseline comparisons
* Monitoring and observability configuration

image::diagram.svg[]

https://example.com[External link]

link:#code[Same document code link]

link:./render-fixtures.adoc[Local document link]
`,
  "/workspace/docs/render-fixtures.adoc": `= Render Fixtures
:toc:

== Source Block

[source,ts]
----
export const product = "Svard";
----

[source]
----
plain source block without language
----

== Admonition

NOTE: Local-first rendering keeps private documents on this machine.

== Table

|===
|Item |Status

|AsciiDoc
|Rendered

|Diagram
|Local-first
|===

== Image

image::diagram.svg[]

== Links

https://example.com[External link]

link:copy-actions.adoc[Local document link]

[[internal-target]]
== Xref Target

See <<internal-target>>.
`,
  "/workspace/docs/asciidoc-standard-theme.adoc": `= AsciiDoc Standard Theme Sample
:toc:

This fixture confirms the Asciidoctor-compatible document theme layer without loading remote fonts or stylesheets. The paragraph is intentionally long enough to exercise reader width, line height, and font selection in a realistic document preview. A comfortable reading measure matters because technical prose often combines explanatory sentences, inline references, and short terms that become tiring when the line length stretches across the full application pane.

== Admonition Icons

NOTE: A note should show a local circular icon and readable content.

TIP: A tip should use a distinct local icon without external font loading.

IMPORTANT: Important guidance should remain visually distinct.

WARNING: Warning guidance should keep enough contrast in light and dark themes.

CAUTION: Caution guidance should remain visible without changing the source text.

== Lists And Terms

Nested lists should keep the same readable rhythm as the surrounding prose:

* Reader typography
  ** keeps line length predictable
  ** preserves nested indentation
* Document blocks
  ** keep captions close to their content
  ** avoid remote styling dependencies

AsciiDoc theme::
  Applies to AsciiDoc generated HTML only.
Markdown theme::
  Keeps the existing GitHub-style reader behavior.

== Captioned Table

.Table Caption Example
|===
|Column |Description

|Reader
|Uses local rendering for AsciiDoc and Markdown.

|Theme
|Provides offline-compatible Asciidoctor styling.
|===

.Grouped Table Caption Example
[%autowidth.stretch]
|===
|Group |Item

.3+|Renderer
|AsciiDoc table cells
|Rowspan groups
|Theme boundaries

.2+|Review
|Geometry checks
|Readable grid lines
|===

== Block Titles

.Example Block Caption
====
Example block content should keep a standard block title and surface.
====

.Sidebar Block Caption
****
Sidebar content should remain compact and readable.
****

== Quote And Verse

[quote,Technical Writer]
____
Readable technical documents need spacing that lets the eye return to the next line without searching.
____

[verse]
____
Local files stay local.
Rendered previews stay readable.
Format-specific typography stays intentional.
____

== Image Block

.Local Theme Image
image::assets/svard-sample.svg[Theme sample image]
`,
  "/workspace/docs/include-main.adoc": `= Include Main
:toc:

Parent introduction before includes.

include::partials/antora-partial.adoc[leveloffset=+1]

:leveloffset: +1
include::partials/scoped-partial.adoc[]
:leveloffset: -1

== Parent After Include

Parent content after include.
`,
  "/workspace/docs/include-text-files.adoc": `= Text Include Files
:toc:

This synthetic fixture verifies text include files without extension-specific allowlisting.

== Service Unit

[source,systemd]
----
include::../examples/service-unit.service[]
----

== Shell Helper

[source,bash]
----
include::../scripts/start-helper.sh[]
----

== Environment Config

[source,dotenv]
----
include::../snippets/config.env[]
----
`,
  "/workspace/examples/service-unit.service": `[Unit]
Description=Synthetic Svard service

[Service]
ExecStart=/usr/bin/svard-example
`,
  "/workspace/scripts/start-helper.sh": `#!/usr/bin/env bash
echo "start helper"
include::nested.adoc[]
`,
  "/workspace/scripts/nested.adoc": `== Nested Script Include

This fixture should not be collected from a non-AsciiDoc text include.
`,
  "/workspace/snippets/config.env": `FEATURE_FLAG=true
RENDER_MODE=local
`,
  "/workspace/docs/cross-platform-local-assets.adoc": `= Cross-platform Local Assets
:toc:

This fixture keeps the document under docs while sibling assets live under the workspace root.

include::../partials/cross-platform-partial.adoc[]

== Local Workspace Image

image::../images/test.svg[Workspace image]
`,
  "/workspace/partials/cross-platform-partial.adoc": `== Sibling Include

This partial lives outside docs but inside the workspace root.
`,
  "/workspace/images/test.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="160" viewBox="0 0 420 160" role="img" aria-label="Workspace image fixture">
  <rect width="420" height="160" fill="#f4f7f8"/>
  <rect x="18" y="18" width="384" height="124" fill="#ffffff" stroke="#2b6777" stroke-width="4"/>
  <text x="42" y="88" fill="#12343b" font-family="Arial, sans-serif" font-size="30">Workspace image</text>
</svg>
`,
  "/workspace/book/sections/project-context-assets.adoc": `= Project Context Assets
:toc:

This section-style document lives below the workspace root but refers to root-level images.

== Root Image

image::images/project-context.svg[Project context image]
`,
  "/workspace/images/project-context.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="190" viewBox="0 0 520 190" role="img" aria-label="Project context image fixture">
  <rect width="520" height="190" fill="#f4f7f8"/>
  <rect x="22" y="28" width="476" height="124" fill="#ffffff" stroke="#287466" stroke-width="5"/>
  <text x="50" y="103" fill="#12343b" font-family="Arial, sans-serif" font-size="34">Project root image</text>
</svg>
`,
  "/workspace/modules/module-a/pages/index.adoc": `= Antora Module Local Assets
:toc:

include::../partials/header.adoc[]

== Primary / Secondary Diagram

image:diagram.drawio.svg[Primary secondary diagram]
`,
  "/workspace/modules/module-a/pages/static-attributes.adoc": `= Antora Static Attribute Context
:product-name: Document Product

ifdef::static-preview[]
include::{partialsdir}/static-intro.adoc[]
endif::[]

== Static Image

image::{imagesdir}/diagram.drawio.svg[Static attribute image]
`,
  "/workspace/modules/module-a/partials/header.adoc": `:imagesdir: ../images

== Module Header

This partial defines an imagesdir that points to the module image folder.
`,
  "/workspace/modules/module-a/partials/static-intro.adoc": `== Static Attribute Partial

{product-name} uses {component-only} and {playbook-only}.
`,
  "/workspace/modules/module-a/images/diagram.drawio.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="720" viewBox="0 0 1600 720" role="img" aria-label="Antora module image fixture">
  <rect width="1600" height="720" fill="#f7fafb"/>
  <rect x="80" y="120" width="520" height="260" rx="18" fill="#ffffff" stroke="#2b6777" stroke-width="10"/>
  <rect x="1000" y="120" width="520" height="260" rx="18" fill="#ffffff" stroke="#287466" stroke-width="10"/>
  <path d="M600 250 H1000" stroke="#173f39" stroke-width="12" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#173f39"/></marker></defs>
  <text x="190" y="270" fill="#12343b" font-family="Arial, sans-serif" font-size="76">Primary</text>
  <text x="1110" y="270" fill="#12343b" font-family="Arial, sans-serif" font-size="76">Secondary&#160;State</text>
  <text x="86" y="620" fill="#52656d" font-family="Arial, sans-serif" font-size="48">Antora module imagesdir fixture</text>
</svg>
`,
  "/workspace/docs/include-diagnostics.adoc": `= Include Diagnostics
:toc:

== Missing

include::partials/missing.adoc[]

== Unsafe

include::../private.adoc[]

== Standalone Title Without Level Offset

include::partials/unadjusted-title.adoc[]
`,
  "/workspace/docs/partials/antora-partial.adoc": `= Antora Partial Title

Included paragraph from Antora-style partial.

== Included Source

[source,ts]
----
export const included = true;
----

== Included Diagram

[plantuml]
----
@startuml
Alice -> Bob: included
@enduml
----
`,
  "/workspace/docs/partials/scoped-partial.adoc": `= Scoped Partial Title

Scoped include content.

== Scoped Child

Nested section after scoped leveloffset.
`,
  "/workspace/docs/partials/unadjusted-title.adoc": `= Unadjusted Standalone Title

This standalone title is intentionally included without leveloffset.
`,
  "/workspace/docs/git-modified.md": `# Git Diff Modified Fixture

This document is used by the browser harness to show a modified working tree diff.

Source comparison stays local.
`,
  "/workspace/docs/git-clean.md": `# Git Diff Clean Fixture

This document has no working tree changes in the browser harness.
`,
  "/workspace/docs/git-untracked.md": `# Git Diff Untracked Fixture

This document is treated as untracked in the browser harness.
`,
  "/workspace/docs/git-table.md": `# Git Table Diff Fixture

| Plan | Price | Status |
| --- | --- | --- |
| Basic | $12 | Stable |
| Pro | $20 | Stable |
| Enterprise | $50 | New |
`,
  "/workspace/docs/git-table-cells.md": `# Git Markdown Table Cell Fixture

| Feature | Owner | Status |
| --- | --- | --- |
| Search | Docs | Reviewed |
| Diff | Docs | Ready |
`,
  "/workspace/docs/git-table-untracked.md": `# Git Markdown Table Untracked Fixture

| Feature | Owner | Status |
| --- | --- | --- |
| Manual | Docs | Draft |
| Screenshots | Docs | Planned |
`,
  "/workspace/docs/git-asciidoc-table.adoc": `= Git AsciiDoc Table Diff Fixture

.Release matrix
[%header]
|===
|Item |Owner |Platform |Status |Review signal |Long context column

|AsciiDoc |Docs |Desktop |Changed |Header context should remain visible |ChangedWideContextForHorizontalTableReviewChangedWideContextForHorizontalTableReviewChangedWideContext

|Diagram |Docs |Desktop |Local-first |Stable signal |Stable wide context
|===
`,
  "/workspace/docs/git-asciidoc-table-complex.adoc": `= Git AsciiDoc Complex Table Diff Fixture

|===
|Item |Status

2+|AsciiDoc

|Diagram
|Changed
|===
`,
  "/workspace/docs/git-rendered-markdown.md": `# Git Rendered Markdown Diff Fixture

This rendered Markdown paragraph changed in the working tree.

- Existing item
- Added working-tree item

> [!NOTE]
> Rendered alerts are compared as blocks.
`,
  "/workspace/docs/git-rendered-list-reorder.md": `# Git Rendered List Reorder Fixture

- Beta stable item
- Alpha stable item
`,
  "/workspace/docs/git-rendered-list-deletion.md": `# Git Rendered List Deletion Fixture

- Stable item
`,
  "/workspace/docs/git-large-markdown-scroll.md":
    buildLargeMarkdownScrollDocument(),
  "/workspace/docs/git-rendered-asciidoc.adoc": `= Git Rendered AsciiDoc Diff Fixture

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
`,
  "/workspace/docs/git-rendered-diagram.adoc": `= Git Rendered Diagram Diff Fixture

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
`,
  "/workspace/docs/git-rendered-unsupported-diagram.adoc": `= Git Rendered Unsupported Diagram Diff Fixture

[c4plantuml]
----
Person(user, "User")
System(app, "Viewer")
Rel(user, app, "Reviews")
----
`,
  "/workspace/docs/git-rendered-rich-asciidoc.adoc": `= Git Rendered Rich AsciiDoc Diff Fixture

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
`,
  "/workspace/docs/git-rendered-math.adoc": `= Git Rendered Math Diff Fixture
:stem:

Inline stem should render: stem:[E = mc^2].

[stem]
++++
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
++++

[mermaid]
----
flowchart TD
  A["\`Mermaid math $E = mc^2$\`"] --> B["Rendered"]
----
`,
  "/workspace/docs/git-rendered-images.adoc": `= Git Rendered Local Image Diff Fixture

The rendered diff should hydrate local images.

image::assets/svard-sample.svg[Stable local SVG]

image::assets/diff-oversized-image.svg[Oversized local SVG]

image::assets/diff-local-image.png[Working tree PNG]

image::assets/missing-diff-image.png[Missing local image]
`,
  "/workspace/docs/git-diagram-image-diff.adoc": `= Diagram Image Diff Fixture

[mermaid]
----
flowchart TD
A[Start] --> B[Done]
----

image::assets/svard-sample.svg[Stable image]

image::assets/diff-local-image.png[Added image]
`,
  "/workspace/docs/git-image-placeholder-source-change.adoc": `= Image Placeholder Source Diff Fixture

Remote images follow the Security setting in rendered diff.

image::https://example.test/new-remote-image.png[Shared remote image]
`,
  "/workspace/docs/git-backlog-resync.md": `# Backlog Resync Diff Fixture

## IMP-096: Lightweight action feedback

- Status: Backlog
- Goal: Lightweight feedback
- Future gates: feedback state unit tests

## IMP-097: Pinned search color model polish

- Status: Backlog
- Goal: Search polish
- Future gates: pinned search color unit tests
`,
  "/workspace/docs/diff-regression-gallery.md": `# Diff Preview Regression Gallery

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

## Structured Blocks

<dl>
<dt>Review Mode</dt>
<dd>Current reviewers inspect changed structured blocks directly.</dd>
<dt>Stable Term</dt>
<dd>Stable definition context stays readable.</dd>
</dl>

> [!NOTE]
> Current structured admonition content is focused without highlighting the marker.

<dl>
<dt>Ambiguous</dt>
<dd>First current duplicate description.</dd>
<dt>Ambiguous</dt>
<dd>Second current duplicate description.</dd>
</dl>

\`\`\`mermaid
flowchart TD
  A[Start] --> B[Changed]
\`\`\`

A fresh working tree closing note describes a different topic.
`,
  "/workspace/docs/file-diff-left.md": `# File Diff Markdown Fixture

This paragraph is from the left document.

- Shared item
- Left-only item
`,
  "/workspace/docs/file-diff-right.md": `# File Diff Markdown Fixture

This paragraph is from the right document.

- Shared item
- Right-only item
- Added item
`,
  "/workspace/docs/file-diff-left.adoc": `= File Diff AsciiDoc Fixture

This AsciiDoc paragraph is from the left document.

NOTE: Left side admonition text.

== Details

The rendered view should compare blocks.
`,
  "/workspace/docs/file-diff-right.adoc": `= File Diff AsciiDoc Fixture

This AsciiDoc paragraph is from the right document.

NOTE: Right side admonition text.

== Details

The rendered view should compare changed blocks.
`,
  "/workspace/docs/file-diff-table-left.md": `# File Diff Table Fixture

| Plan | Price | Status |
| --- | --- | --- |
| Basic | $10 | Beta |
| Pro | $20 | Stable |
`,
  "/workspace/docs/file-diff-table-right.md": `# File Diff Table Fixture

| Plan | Price | Status |
| --- | --- | --- |
| Basic | $12 | Stable |
| Pro | $20 | Stable |
| Team | $30 | New |
`,
  "/workspace/docs/math-rendering.adoc": `= Math Rendering Sample
:toc:
:stem:

This sample confirms local math rendering for AsciiDoc \`stem\` content.

== Inline Stem

Inline stem works in normal prose: stem:[E = mc^2] and stem:[a^2 + b^2 = c^2].

Japanese prose should stay readable around math: 半径 stem:[r] の円の面積は stem:[A = \\pi r^2] です。

== Block Stem

[stem]
++++
\\int_0^1 x^2 dx = \\frac{1}{3}
++++

== Matrix

[stem]
++++
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
\\begin{bmatrix}
x \\\\
y
\\end{bmatrix}
=
\\begin{bmatrix}
1x + 2y \\\\
3x + 4y
\\end{bmatrix}
++++

== Invalid Math Fallback

Invalid math should not blank the document: stem:[\\frac{1}{].

== Source Block Safety

[source,tex]
----
stem:[this should stay source text]
$$
not rendered inside source
$$
----
`,
  "/workspace/docs/asciidoc-comprehensive-visual.adoc":
    comprehensiveVisualSample,
  "/workspace/docs/math-rendering.md": `# Markdown Math Rendering Sample

This sample confirms local math rendering for Markdown documents.

## Inline Math

Inline math works in prose: $E = mc^2$ and $a^2 + b^2 = c^2$.

Japanese prose should stay readable around math: 半径 $r$ の円の面積は $A = \\pi r^2$ です。

## Block Math

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

## Matrix

$$
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
\\begin{bmatrix}
x \\\\
y
\\end{bmatrix}
=
\\begin{bmatrix}
1x + 2y \\\\
3x + 4y
\\end{bmatrix}
$$

## Invalid Math Fallback

Invalid math should not blank the document: $\\frac{1}{$.

## Code Fence Safety

\`\`\`tex
$this should stay source text$
$$
not rendered inside source
$$
\`\`\`
`,
  "/workspace/docs/markdown-math-edge-cases.md": `# Markdown Math Edge Cases

This sample keeps ambiguous dollar text readable while rendering explicit math.

## Valid Math

Inline math works here: $E = mc^2$.

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

## Non-ASCII Boundaries

予測値と正解$t$の差を、二乗誤差で測る。

- $x$と$t$：学習データ。optimizerは更新しない
- $w$と$b$：学習可能なパラメータ。optimizerが更新する
- $wx$、$\\hat{y}$、$L$：入力と現在のパラメータから一時的に計算される値
- $x$が1変化すると、$u$は$\\dfrac{du}{dx}$だけ変化する
- $u$が1変化すると、$y$は$\\dfrac{dy}{du}$だけ変化する

## Currency And Escapes

Costs stay readable: $12.00, USD $5, and price is $5 and $6.

Escaped dollars stay readable: \\$escaped\\$.

## Numeric Table Math

| Query | Key | Before $R[i,j]$ | After $S[i,j]$ |
| --- | --- | --- | --- |
| Fish | Fish | $1$ | $1 / \\sqrt{3} \\approx 0.5774$ |
| Fish | Eats | $1$ | $1 / \\sqrt{3} \\approx 0.5774$ |
| Object | Object | $2$ | $2 / \\sqrt{3} \\approx 1.1547$ |
| Eats | Eats | $2$ | $2 / \\sqrt{3} \\approx 1.1547$ |
| Decimal | Decimal | $0.5774$ | $0.5774$ |

## Table Pipes

| Item | Formula | Notes |
| --- | --- | --- |
| Valid | $a + b$ | rendered in one cell |
| Broken | $a | b$ | pipe crossing stays text |

## Code Safety

Inline code keeps \`$not math$\` as source text.

\`\`\`tex
$not rendered in source$
$$
not rendered inside source
$$
\`\`\`

## Invalid Fallback

Invalid inline math should stay local: $\\frac{1}{$.

$$
\\frac{1}{
$$

After invalid math remains visible.
`,
  "/workspace/docs/external-images.md": `# External Images Security Fixture

Remote images should follow the Security setting.

![Rust Logo](https://www.rust-lang.org/static/images/rust-logo-blk.svg)
`,
  "/workspace/docs/markdown-sample.md": `# Markdown Sample

Svard can open Markdown documents alongside AsciiDoc while keeping the same TOC, search, and safe diagram rendering flow.

## Reader Workflow

Open a Markdown document from the file tree, inspect the rendered content, and use the table of contents to move between sections.

## Code Fence

\`\`\`ts
export const product = "Svard";
\`\`\`

## Table

| Item | Status |
| --- | --- |
| Markdown | Rendered |
| Diagrams | Local-first |

## Links

[External link](https://example.com)
`,
  "/workspace/docs/markdown-code.md": `# Markdown Code Sample

## TypeScript

\`\`\`ts
type Product = {
  name: string;
  formats: Array<"asciidoc" | "markdown">;
};


export const product: Product = {
  name: "Svard",
  formats: ["asciidoc", "markdown"],
};
\`\`\`

## Rust

\`\`\`rust
fn main() {
    println!("Svard");
}
\`\`\`

## Python

\`\`\`python
def fibonacci(n):
    values = []
    a, b = 0, 1
    for _ in range(n):
        values.append(a)
        a, b = b, a + b
    return values
\`\`\`

## Go

\`\`\`go
package main

import "fmt"

func main() {
    fmt.Println("Svard")
}
\`\`\`

## SQL

\`\`\`sql
select path, format
from documents
where format in ('asciidoc', 'markdown');
\`\`\`

## Unknown Language

\`\`\`customlang
this stays readable without syntax highlight
\`\`\`
`,
  "/workspace/docs/markdown-github.md": `---
title: Markdown GitHub Sample
owner: Svard
draft: false
version: 1.0
tags:
  - markdown
  - frontmatter
settings:
  theme: dark
  sidebar: true
empty_value:
---

# Markdown GitHub Sample

> [!NOTE]
> GitHub style alert blocks are rendered as compact reader callouts.

> [!WARNING]
> Remote diagram rendering still requires explicit confirmation.

[TIP]
Use simple admonitions when importing short notes from Markdown-first projects.

## Tasks

- [x] Render Markdown with GitHub style typography
- [ ] Review long documents in the full-width reader
- [ ] Keep raw HTML disabled

## Footnotes

Footnote references stay local and readable.[^local]

Repeated references point back to the same note.[^local]

[^local]: Footnotes are rendered at the end of the Markdown document.

## Table

| Feature | Status |
| --- | --- |
| Alerts | Rendered |
| Simple admonitions | Rendered |
| Footnotes | Rendered |
| Task lists | Rendered |
| Frontmatter | Collapsible |
`,
  "/workspace/docs/markdown-footnotes-admonitions.md": `# Markdown Footnotes And Admonitions Sample

This sample confirms Markdown footnotes, GitHub Alerts, simple admonitions, task lists, and code block safety.

## GitHub Alerts

> [!NOTE]
> GitHub style alert blocks keep their existing rendering.

> [!WARNING]
> Remote diagram rendering still requires explicit confirmation.

## Simple Admonitions

[NOTE]
Use simple admonitions for short notes imported from Markdown-first projects.

[TIP]
Keep the marker on its own line, then write the body directly below it.

[IMPORTANT]
Simple admonitions use the same visual language as GitHub Alerts.

[WARNING]
An empty line ends the admonition block.

[CAUTION]
Do not use this syntax for private data that should not appear in screenshots.

## MkDocs Admonitions

!!! note "MkDocs note"
    MkDocs style admonitions render with the same alert visual language.

!!! warning "MkDocs warning"
    Indented Markdown body content stays readable.

## Footnotes

Footnote references render as superscript links.[^local]

Repeated references point to the same note.[^local]

Missing definitions stay readable instead of breaking the document.[^missing]

[^local]: Footnotes are rendered at the end of the Markdown document and include a back reference.

## Lists And Tables

- [x] Render GitHub Alerts
- [x] Render simple admonitions
- [x] Render footnotes
- [ ] Review the visual layout

| Feature | Expected |
| --- | --- |
| GitHub Alerts | rendered callout |
| Simple admonitions | rendered callout |
| Footnotes | document-end notes |
| Missing definition | readable text |

## Code Block Safety

\`\`\`md
[NOTE]
This stays inside the source block.

!!! note "MkDocs source sample"
    This also stays inside the source block.

Footnote-looking text also stays literal.[^code]
\`\`\`
`,
  "/workspace/docs/markdown-details.md": `# Markdown Details Sample

This sample confirms minimal GitHub-style details support while raw HTML remains disabled.

<details>
<summary>Click to expand: Installation Instructions</summary>

### Prerequisites

- Rust 1.70 or higher
- Node.js 18 or higher
- Git

\`\`\`python
print("inside details")
\`\`\`

</details>

<details open>
<summary>Open by default **summary**</summary>

Inline math $E = mc^2$ renders inside a safe details body.

> [!NOTE]
> Alerts inside details use the same Markdown renderer.

\`\`\`python
print("visible inside open details")
\`\`\`

</details>

<details onclick="window.__SVARD_UNSAFE_DETAILS__ = true">
<summary>Unsafe attributes stay escaped</summary>

<script>window.__SVARD_UNSAFE_DETAILS__ = true</script>
</details>
`,
  "/workspace/docs/markdown-diagrams.md": `# Markdown Diagram Sample

## Mermaid

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B[Local Mermaid]
  B --> C[SVG]
\`\`\`

## Mermaid Gantt

\`\`\`mermaid
gantt
  title Project Timeline
  dateFormat  YYYY-MM-DD
  section Planning
  Requirements    :a1, 2024-01-01, 7d
  Design          :a2, after a1, 5d
  section Development
  Implementation  :a3, after a2, 14d
  Testing         :a4, after a3, 7d
  section Deployment
  Release         :a5, after a4, 2d
\`\`\`

## PlantUML

\`\`\`plantuml
@startuml
participant "利用者" as User
participant "Svard" as Viewer
User -> Viewer: Markdown の図を確認する
Viewer --> User: SVG を本文中に表示する
@enduml
\`\`\`

## Graphviz

\`\`\`dot
digraph G {
  rankdir=LR;
  Markdown -> Graphviz -> SVG;
}
\`\`\`
`,
  "/workspace/docs/markdown-japanese.md": `# Markdown 日本語確認

## 日本語の見出し

本文の中に日本語、句読点、全角記号「」と半角英数字 abc123 を混在させても、検索と TOC が期待どおり動くことを確認する。

## 改行を含む長文

長い日本語の文章を複数行に分けて配置する。
Markdown の段落、リンク、コードブロック、図表が同じ viewer shell の中で扱えることを確認する。

\`\`\`mermaid
flowchart TD
  start["Markdown 文書を開く"] --> parse["markdown-it で解析する"]
  parse --> render["本文中に図表を画像として表示する"]
  render --> done["日本語と長文の表示を確認する"]
\`\`\`

## Raw HTML Safety

<script>window.__svardUnsafe = true</script>
`,
  "/workspace/docs/guides/quick-start.adoc": `= Quick Start

== Open

Use the tree view to open nested AsciiDoc files.
`,
  "/workspace/docs/diagrams/graphviz-overview.adoc": `= Graphviz Overview

== DOT

[graphviz]
----
digraph G { Tree -> Viewer }
----
`,
  "/workspace/docs/asciidoc-diagram-attributes.adoc": `= AsciiDoc Diagram Attributes
:toc:

== Mermaid With Attributes

[mermaid,format=svg]
----
flowchart LR
  open["Open attributed block"] --> parse["Parse first positional attribute"]
  parse --> render["Render Mermaid locally"]
----

== PlantUML With Attributes

[plantuml,id=sequence-a]
----
@startuml
Alice -> Bob: attributed PlantUML
Bob --> Alice: rendered locally
@enduml
----

== Graphviz With Attributes

[graphviz,opts=inline]
----
digraph G {
  rankdir=LR;
  attribute -> parser -> graphviz;
}
----

== Unsupported Kroki Attribute

[blockdiag,id=unsupported]
----
A -> B
----

== Source Block Boundary

[source,plantuml]
----
source block stays source
@startuml
Alice -> Bob: do not render
@enduml
----
`,
  "/workspace/docs/diagrams/mermaid-japanese-flow.adoc": `= Mermaid Japanese Flow Sample
:toc:

== 日本語フロー

[mermaid]
----
flowchart TD
  start["文書を開く"] --> parse["AsciiDoc を解析する"]
  parse --> diagrams{"図表ブロックを検出"}
  diagrams --> mermaid["Mermaid はローカル描画"]
  diagrams --> plantuml["PlantUML は TeaVM + Viz.js"]
  diagrams --> graphviz["Graphviz / DOT は Viz.js"]
  mermaid --> review["表示結果を確認する"]
  plantuml --> review
  graphviz --> review
  review --> done["読みやすいビューア体験"]

  subgraph safety["安全性の確認"]
    local["ローカルで完結"]
    confirm["外部送信は確認必須"]
    cache["キャッシュ状態を表示"]
  end

  review --> safety
----

== 長文ノード

[mermaid]
----
flowchart LR
  a["長い日本語ラベルを含むノードです。句読点、全角記号「」と半角英数字 abc123 を混在させても欠落せず表示されることを確認します。"] --> b["折り返しや余白が極端に崩れないかを見る"]
  b --> c["画面幅が狭い場合でも図表パネルが壊れない"]
----
`,
  "/workspace/docs/diagrams/plantuml-japanese-combined.adoc": `= PlantUML Japanese Combined Sample
:toc:

== Sequence

[plantuml]
----
@startuml
participant "利用者" as User
participant "Svard\\nビューア" as Viewer
participant "ローカル描画エンジン" as Renderer

User -> Viewer: AsciiDoc 文書を開く
Viewer -> Renderer: PlantUML ブロックを渡す
Renderer --> Viewer: SVG を返す
Viewer --> User: 図表を本文中に表示する

note right of Viewer
日本語の複数行 note。
長い説明文が入った場合でも、
ビューア全体が崩れないことを確認する。
end note
@enduml
----

== Class

[plantuml]
----
@startuml
class "文書ビューア" as Viewer {
  +文書を開く()
  +検索する()
  +図表を描画する()
}

class "設定画面\\nPreferences" as Preferences {
  +テーマを切り替える()
  +Kroki endpoint を設定する()
}

class "ローカル図表レンダラ" as LocalRenderer {
  +Mermaid を描画する()
  +PlantUML を描画する()
  +Graphviz を描画する()
}

Viewer --> Preferences : 設定値を読む
Viewer --> LocalRenderer : 図表ブロックを渡す
@enduml
----

== 長文ラベル

[plantuml]
----
@startuml
actor "非エンジニアの利用者" as User
rectangle "長い日本語ラベルを含む処理です。句読点、全角記号「」と半角英数字 abc123 を混在させても、文字が欠落せず図表パネル内で確認できることを期待します。" as LongProcess
User --> LongProcess : 確認する
@enduml
----
`,
  "/workspace/docs/diagrams/diagrams-mixed-long-ja.adoc": `= Mixed Diagram Japanese Sample
:toc:

== Mermaid + PlantUML + Graphviz

複数種類の図を1つの文書に入れた確認用サンプル。

=== Mermaid: 状態遷移

[mermaid]
----
stateDiagram-v2
  state "起動中" as Boot
  state "文書選択" as Select
  state "表示中" as Viewing
  state "検索中" as Searching
  [*] --> Boot
  Boot --> Select: file open
  Select --> Viewing: render success
  Viewing --> Searching: search
  Searching --> Viewing: clear
  Viewing --> [*]
----

=== PlantUML: コンポーネント

[plantuml]
----
@startuml
component "React UI\\nTree / Tabs / Viewer" as UI
component "HostAdapter\\nMock / Tauri" as Host
component "Rust backend\\nfile / config / Kroki" as Backend
component "Local renderers\\nMermaid / PlantUML / Graphviz" as Renderers

UI --> Host : file / config / fallback
Host --> Backend : Tauri command
UI --> Renderers : local diagram source
@enduml
----

=== Graphviz: 依存関係

[graphviz]
----
digraph G {
  rankdir=LR;
  node [shape=box, style="rounded,filled", fillcolor="#e7f0ef"];
  source [label="AsciiDoc 文書"];
  worker [label="Web Worker\\nAsciidoctor.js"];
  ui [label="Viewer UI"];
  local [label="Local diagram renderers"];
  kroki [label="Kroki fallback\\n確認後のみ"];

  source -> worker -> ui;
  source -> local -> ui;
  source -> kroki -> ui;
}
----

== 長い説明文

このサンプルは、図表が複数続く文書で、右サイドバーの TOC、検索、左 Tree View、中央 viewer の余白や密度が破綻しないことを確認するために使う。
`,
  "/workspace/archive/old-notes.adoc": `= Old Notes

Archived fixture content.
`,
  "/workspace/docs/preferences.adoc": `= Preferences Defaults

== Kroki

Mermaid renderer is local by default. PlantUML renderer is local by default. Kroki default mode is disabled, output format is SVG, cache is enabled, and self-managed remote endpoints are explicit trusted settings. Public kroki.io is a separate explicit mode and requires confirmation.

== Security

Local images are allowed by default. External links require confirmation.
`,
  "/workspace/docs/plantuml-large.adoc": `= Large PlantUML Diagnostic

== Oversized PlantUML

[plantuml]
----
@startuml
class Node1
class Node2
Node1 --> Node2
class Node3
Node2 --> Node3
class Node4
Node3 --> Node4
class Node5
Node4 --> Node5
class Node6
Node5 --> Node6
class Node7
Node6 --> Node7
class Node8
Node7 --> Node8
class Node9
Node8 --> Node9
class Node10
Node9 --> Node10
class Node11
Node10 --> Node11
class Node12
Node11 --> Node12
class Node13
Node12 --> Node13
class Node14
Node13 --> Node14
class Node15
Node14 --> Node15
class Node16
Node15 --> Node16
class Node17
Node16 --> Node17
class Node18
Node17 --> Node18
class Node19
Node18 --> Node19
class Node20
Node19 --> Node20
class Node21
Node20 --> Node21
class Node22
Node21 --> Node22
class Node23
Node22 --> Node23
class Node24
Node23 --> Node24
class Node25
Node24 --> Node25
class Node26
Node25 --> Node26
class Node27
Node26 --> Node27
class Node28
Node27 --> Node28
class Node29
Node28 --> Node29
class Node30
Node29 --> Node30
class Node31
Node30 --> Node31
class Node32
Node31 --> Node32
class Node33
Node32 --> Node33
class Node34
Node33 --> Node34
class Node35
Node34 --> Node35
class Node36
Node35 --> Node36
class Node37
Node36 --> Node37
class Node38
Node37 --> Node38
class Node39
Node38 --> Node39
class Node40
Node39 --> Node40
@enduml
----
`,
  "/workspace/docs/plantuml-japanese.adoc": `= Japanese PlantUML

== Sequence

[plantuml]
----
@startuml
participant "利用者" as User
participant "ビューア" as Viewer
User -> Viewer: 文書を開く
Viewer --> User: 表示完了
note right of Viewer
複数行の日本語メモ
検索結果のハイライト
確認する
end note
@enduml
----
`,
  "/workspace/docs/plantuml-japanese-long-text.adoc": `= Long Japanese PlantUML

== Long Label

[plantuml]
----
@startuml
class "これは長い日本語ラベルです。句読点、全角記号「」と半角英数字abc123を含んでも欠落せず表示されることを確認します。" as LongLabel
note right of LongLabel
これは長い日本語ラベルを含むメモです。
句読点、全角記号、abc123 を混在させます。
end note
@enduml
----
`,
  "/workspace/docs/plantuml-multiline.adoc": `= Multiline PlantUML

== Multiline Label

[plantuml]
----
@startuml
class "設定画面\\nKroki確認\\nローカル描画" as Preferences
class "文書ビュー<br>複数行ラベル" as Viewer
Preferences --> Viewer
@enduml
----
`,
};

export function fixtureIncludeFilesForPath(path: string) {
  const rootSource = fixtureDocuments[path];
  if (!rootSource) {
    return [];
  }
  const includes: Array<{ path: string; source: string }> = [];
  const visited = new Set<string>();

  function normalize(input: string) {
    const parts: string[] = [];
    for (const part of input.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    return `/${parts.join("/")}`;
  }

  function dirname(input: string) {
    const normalized = normalize(input);
    return normalized.slice(0, normalized.lastIndexOf("/")) || "/";
  }

  function isRecursiveAsciiDocPath(input: string) {
    return /\.(adoc|asciidoc|asc)$/i.test(input);
  }

  function substituteAttributes(
    input: string,
    attributes: Map<string, string>,
  ) {
    return input.replace(/\{([^}]+)\}/g, (_match, name: string) => {
      return attributes.get(name.trim()) ?? "";
    });
  }

  function applyAttribute(trimmed: string, attributes: Map<string, string>) {
    const unset = /^:(?:!([^:]+)|([^:!]+)!):\s*$/.exec(trimmed);
    if (unset) {
      attributes.delete((unset[1] ?? unset[2]).trim());
      return;
    }
    const assignment = /^:([^:!\s][^:]*):\s*(.*)$/.exec(trimmed);
    if (!assignment) {
      return;
    }
    attributes.set(
      assignment[1].trim(),
      substituteAttributes(assignment[2].trim(), attributes),
    );
  }

  function conditionActive(
    trimmed: string,
    attributes: Map<string, string>,
  ): boolean | null {
    const conditional = /^(ifdef|ifndef)::([^[]+)\[.*\]\s*$/.exec(trimmed);
    if (conditional) {
      const anyDefined = conditional[2]
        .split(/[,+]/)
        .map((name) => name.trim())
        .filter(Boolean)
        .some((name) => attributes.has(name));
      return conditional[1] === "ifdef" ? anyDefined : !anyDefined;
    }
    const ifeval = /^ifeval::\[(.*)\]\s*$/.exec(trimmed);
    if (!ifeval) {
      return null;
    }
    const expression = substituteAttributes(ifeval[1], attributes).trim();
    const match =
      /^['"]?([^'"]*?)['"]?\s*(==|!=)\s*['"]?([^'"]*?)['"]?\s*$/.exec(
        expression,
      );
    if (!match) {
      return false;
    }
    return match[2] === "=="
      ? match[1].trim() === match[3].trim()
      : match[1].trim() !== match[3].trim();
  }

  function collect(currentPath: string, source: string) {
    const attributes = fixtureInitialAsciiDocAttributesForPath(currentPath);
    for (const line of source.split("\n")) {
      applyAttribute(line.trim(), attributes);
    }
    collectWithAttributes(currentPath, source, attributes);
  }

  function collectWithAttributes(
    currentPath: string,
    source: string,
    attributes: Map<string, string>,
  ) {
    const conditionStack: boolean[] = [];
    let inDelimitedBlock = false;
    for (const line of source.split("\n")) {
      const trimmed = line.trim();
      if (!inDelimitedBlock) {
        if (/^endif::(?:[^[]*)?\[\]\s*$/.test(trimmed)) {
          conditionStack.pop();
          continue;
        }
        const condition = conditionActive(trimmed, attributes);
        if (condition !== null) {
          conditionStack.push(conditionStack.every(Boolean) && condition);
          continue;
        }
        if (!conditionStack.every(Boolean)) {
          continue;
        }
        applyAttribute(trimmed, attributes);
      }
      if (trimmed === "----" || trimmed === "....") {
        inDelimitedBlock = !inDelimitedBlock;
      }
      if (!trimmed.startsWith("include::")) {
        continue;
      }
      const target = substituteAttributes(
        trimmed.slice("include::".length).split("[")[0]?.trim() ?? "",
        attributes,
      );
      if (!target || target.startsWith("/") || target.includes("://")) {
        continue;
      }
      const resolved = normalize(`${dirname(currentPath)}/${target}`);
      const includeSource = fixtureDocuments[resolved];
      if (includeSource === undefined || visited.has(resolved)) {
        continue;
      }
      visited.add(resolved);
      includes.push({ path: resolved, source: includeSource });
      if (isRecursiveAsciiDocPath(resolved)) {
        collectWithAttributes(resolved, includeSource, attributes);
      }
    }
  }

  collect(path, rootSource);
  return includes;
}

export function fixtureIncludeGraphForPath(
  path: string,
): AsciiDocIncludeGraph | undefined {
  const rootSource = fixtureDocuments[path];
  if (!rootSource || !/\.a(?:doc|sciidoc|sc)$/i.test(path)) {
    return undefined;
  }
  const graph: AsciiDocIncludeGraph = {
    nodes: [
      {
        id: "root",
        path,
        displayPath: basename(path),
        kind: "root",
        status: "active",
      },
    ],
    edges: [],
  };
  const visited = new Set<string>();
  let nextId = 1;

  function addInclude(input: {
    parentId: string;
    displayPath: string;
    path?: string;
    status: AsciiDocIncludeGraph["nodes"][number]["status"];
    reason?: string;
    sourcePath: string;
    line: number;
  }) {
    const id = `include-${nextId++}`;
    const sourceLocation = {
      sourcePath: input.sourcePath,
      line: input.line,
      column: 1,
    };
    graph.nodes.push({
      id,
      path: input.path,
      displayPath: input.displayPath,
      kind: "include",
      status: input.status,
      reason: input.reason,
      sourceLocation,
      parentId: input.parentId,
    });
    graph.edges.push({
      fromId: input.parentId,
      toId: id,
      sourceLocation,
      status: input.status,
    });
    return id;
  }

  function normalize(input: string) {
    const parts: string[] = [];
    for (const part of input.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    return `/${parts.join("/")}`;
  }

  function dirname(input: string) {
    const normalized = normalize(input);
    return normalized.slice(0, normalized.lastIndexOf("/")) || "/";
  }

  function basename(input: string) {
    return input.split("/").filter(Boolean).at(-1) ?? input;
  }

  function isRecursiveAsciiDocPath(input: string) {
    return /\.(adoc|asciidoc|asc)$/i.test(input);
  }

  function substituteAttributes(
    input: string,
    attributes: Map<string, string>,
  ) {
    return input.replace(/\{([^}]+)\}/g, (_match, name: string) => {
      return attributes.get(name.trim()) ?? "";
    });
  }

  function applyAttribute(trimmed: string, attributes: Map<string, string>) {
    const unset = /^:(?:!([^:]+)|([^:!]+)!):\s*$/.exec(trimmed);
    if (unset) {
      attributes.delete((unset[1] ?? unset[2]).trim());
      return;
    }
    const assignment = /^:([^:!\s][^:]*):\s*(.*)$/.exec(trimmed);
    if (!assignment) {
      return;
    }
    attributes.set(
      assignment[1].trim(),
      substituteAttributes(assignment[2].trim(), attributes),
    );
  }

  function conditionActive(
    trimmed: string,
    attributes: Map<string, string>,
  ): boolean | null {
    const conditional = /^(ifdef|ifndef)::([^[]+)\[.*\]\s*$/.exec(trimmed);
    if (conditional) {
      const anyDefined = conditional[2]
        .split(/[,+]/)
        .map((name) => name.trim())
        .filter(Boolean)
        .some((name) => attributes.has(name));
      return conditional[1] === "ifdef" ? anyDefined : !anyDefined;
    }
    const ifeval = /^ifeval::\[(.*)\]\s*$/.exec(trimmed);
    if (!ifeval) {
      return null;
    }
    const expression = substituteAttributes(ifeval[1], attributes).trim();
    const match =
      /^['"]?([^'"]*?)['"]?\s*(==|!=)\s*['"]?([^'"]*?)['"]?\s*$/.exec(
        expression,
      );
    if (!match) {
      return false;
    }
    return match[2] === "=="
      ? match[1].trim() === match[3].trim()
      : match[1].trim() !== match[3].trim();
  }

  function includeTarget(trimmed: string, attributes: Map<string, string>) {
    if (!trimmed.startsWith("include::")) {
      return null;
    }
    return substituteAttributes(
      trimmed.slice("include::".length).split("[")[0]?.trim() ?? "",
      attributes,
    );
  }

  function collect(
    currentPath: string,
    source: string,
    parentId: string,
    attributes: Map<string, string>,
  ) {
    const conditionStack: boolean[] = [];
    let inDelimitedBlock = false;
    for (const [index, line] of source.split("\n").entries()) {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      if (!inDelimitedBlock) {
        if (/^endif::(?:[^[]*)?\[\]\s*$/.test(trimmed)) {
          conditionStack.pop();
          continue;
        }
        const condition = conditionActive(trimmed, attributes);
        if (condition !== null) {
          conditionStack.push(conditionStack.every(Boolean) && condition);
          continue;
        }
        if (!conditionStack.every(Boolean)) {
          const target = includeTarget(trimmed, attributes);
          if (target) {
            addInclude({
              parentId,
              displayPath: basename(target),
              status: "skipped",
              reason: "conditional",
              sourcePath: currentPath,
              line: lineNumber,
            });
          }
          continue;
        }
        applyAttribute(trimmed, attributes);
      }
      if (trimmed === "----" || trimmed === "....") {
        inDelimitedBlock = !inDelimitedBlock;
      }
      const target = includeTarget(trimmed, attributes);
      if (!target) {
        continue;
      }
      if (!target || target.startsWith("/") || target.includes("://")) {
        addInclude({
          parentId,
          displayPath: basename(target),
          status: "blocked",
          reason: "unsafe",
          sourcePath: currentPath,
          line: lineNumber,
        });
        continue;
      }
      const resolved = normalize(`${dirname(currentPath)}/${target}`);
      const includeSource = fixtureDocuments[resolved];
      if (includeSource === undefined) {
        addInclude({
          parentId,
          displayPath: basename(target),
          status: resolved.includes("/private") ? "blocked" : "missing",
          reason: resolved.includes("/private") ? "outside-root" : "missing",
          sourcePath: currentPath,
          line: lineNumber,
        });
        continue;
      }
      if (visited.has(resolved)) {
        addInclude({
          parentId,
          displayPath: basename(resolved),
          path: resolved,
          status: "recursive",
          reason: "recursive",
          sourcePath: currentPath,
          line: lineNumber,
        });
        continue;
      }
      visited.add(resolved);
      const includeId = addInclude({
        parentId,
        displayPath: basename(resolved),
        path: resolved,
        status: "active",
        sourcePath: currentPath,
        line: lineNumber,
      });
      if (isRecursiveAsciiDocPath(resolved)) {
        collect(resolved, includeSource, includeId, attributes);
      }
    }
  }

  const attributes = fixtureInitialAsciiDocAttributesForPath(path);
  for (const line of rootSource.split("\n")) {
    applyAttribute(line.trim(), attributes);
  }
  collect(path, rootSource, "root", attributes);
  return graph;
}

export function fixtureInitialAsciiDocAttributesForPath(path: string) {
  const attributes = new Map<string, string>();
  if (path === "/workspace/modules/module-a/pages/static-attributes.adoc") {
    attributes.set("partialsdir", "../partials");
    attributes.set("imagesdir", "../images");
    attributes.set("product-name", "Component Product");
    attributes.set("component-only", "component value");
    attributes.set("playbook-only", "42");
    attributes.set("static-preview", "");
  }
  return attributes;
}
