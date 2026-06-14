import { describe, expect, it } from "vitest";
import Asciidoctor from "@asciidoctor/core";

import { expandAsciiDocIncludes } from "../../src/core/asciidocInclude";
import {
  extractHeadings,
  extractSourceBlocks,
} from "../../src/core/asciidocSourceMap";
import {
  detectDiagramDiagnostics,
  extractDiagramSlots,
  extractPlantUmlDiagrams,
  replaceDiagramBlocksWithPlaceholders,
} from "../../src/core/extractDiagrams";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import type { DocumentPayload, RenderResult } from "../../src/core/types";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";

const asciidoctor = Asciidoctor();

const securityConfig = {
  security: { allowLocalImages: true, confirmExternalLinks: true },
};

async function renderAsciiDocCoverage(source: string) {
  const documentPath = "/workspace/docs/coverage.adoc";
  const includeFiles = [
    {
      path: "/workspace/docs/partials/intro.adoc",
      source: `:imagesdir: ../images

== Included Section

Included paragraph.`,
    },
  ];
  const expanded = expandAsciiDocIncludes(source, documentPath, includeFiles);
  const renderSource = replaceDiagramBlocksWithPlaceholders(expanded.source);
  const html = asciidoctor.convert(renderSource, {
    base_dir: "/workspace/docs",
    safe: "safe",
    sourcemap: true,
    attributes: {
      showtitle: true,
      icons: "font",
    },
  }) as string;
  const renderResult: RenderResult = {
    html,
    headings: extractHeadings(html, expanded.source, expanded.lineOrigins),
    sourceBlocks: extractSourceBlocks(expanded.source, expanded.lineOrigins),
    diagnostics: [
      ...expanded.diagnostics,
      ...detectDiagramDiagnostics(expanded.source, expanded.lineOrigins),
    ],
    diagramSlots: extractDiagramSlots(expanded.source, expanded.lineOrigins),
    mermaidDiagrams: [],
    plantUmlDiagrams: extractPlantUmlDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    graphvizDiagrams: [],
    krokiDiagrams: [],
  };
  const document: DocumentPayload = {
    path: documentPath,
    basePath: "/workspace/docs",
    format: "asciidoc",
    source: expanded.source,
    updatedAt: "2026-05-20T00:00:00.000Z",
    includeFiles,
    asciidocContext: {
      baseDir: "/workspace/docs",
      workspaceRoot: "/workspace",
      documentDir: "/workspace/docs",
      attributes: {},
      resourceRoots: ["/workspace"],
    },
  };
  const preparedHtml = await prepareDocumentHtml(
    html,
    document,
    securityConfig,
    renderResult,
    {
      resolveLocalImage: async (src) => ({
        status: "resolved",
        mediaType: "image/svg+xml",
        encoding: "utf8",
        content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><text>Image ${src}</text></svg>`,
      }),
    },
  );

  return {
    expanded,
    renderResult,
    doc: new DOMParser().parseFromString(preparedHtml, "text/html"),
  };
}

describe("render coverage matrix", () => {
  it("keeps high-risk AsciiDoc structures after include, render, and sanitization", async () => {
    const { doc, expanded, renderResult } =
      await renderAsciiDocCoverage(`= Coverage
:stem:

include::partials/intro.adoc[]

== Tables

.Coverage Table
[cols="1,1,1"]
|===
|Group 2+|Detail

.2+|Renderer
|AsciiDoc
|Markdown

|Sanitizer
2+|Safe structure
|===

NOTE: Keep admonition layout.

[source,ts]
----
const covered = true;
----

[plantuml]
----
@startuml
Alice -> Bob: covered
@enduml
----

stem:[x^2]

image::../images/sample.svg[]
`);

    expect(expanded.diagnostics).toEqual([]);
    expect(
      renderResult.headings.some(
        (heading) => heading.text === "Included Section",
      ),
    ).toBe(true);
    expect(renderResult.sourceBlocks[0]).toMatchObject({
      language: "ts",
      sourceLocation: { line: 23, sourcePath: "/workspace/docs/coverage.adoc" },
    });
    expect(renderResult.diagramSlots[0]).toMatchObject({
      id: "plantuml-1",
      renderer: "plantuml",
    });

    const table = doc.querySelector("table.tableblock");
    expect(table?.querySelector("caption.title")?.textContent).toContain(
      "Coverage Table",
    );
    expect(table?.querySelector("td[rowspan='2']")).toBeTruthy();
    expect(
      table?.querySelector("th[colspan='2'], td[colspan='2']"),
    ).toBeTruthy();
    expect(table?.querySelector("colgroup col")).toBeTruthy();
    expect(table?.getAttribute("data-review-id")).toBe("rendered-table");
    expect(doc.querySelector(".admonitionblock.note .icon-note")).toBeTruthy();
    expect(
      doc.querySelector(".source-block-frame pre .language-ts"),
    ).toBeTruthy();
    expect(doc.querySelector(".stem .math-inline, .math-inline")).toBeTruthy();
    expect(
      doc.querySelector("img[data-image-path='../images/sample.svg']"),
    ).toBeTruthy();
    expect(doc.querySelector("[onclick], script, iframe, object")).toBeNull();
  });

  it("keeps Markdown render extensions and safety boundaries stable", async () => {
    const result = renderMarkdownCore(`---
title: Coverage
tags:
  - markdown
---

# Coverage

> [!TIP]
> Keep alert.

!!! warning "MkDocs warning"
    Keep MkDocs admonition readable.

- [x] Task item

Footnote.[^one]

[^one]: Footnote body.

| Item | Formula |
| --- | --- |
| Valid | $a + b$ |
| Currency | $12.00 |

<details open>
<summary>More **details**</summary>

Inside details.
</details>

\`\`\`python
print("covered")
\`\`\`

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

<script>alert(1)</script>
`);
    const document: DocumentPayload = {
      path: "/workspace/docs/coverage.md",
      basePath: "/workspace/docs",
      format: "markdown",
      source: result.html,
      updatedAt: "2026-05-20T00:00:00.000Z",
    };
    const html = await prepareDocumentHtml(
      result.html,
      document,
      securityConfig,
      result,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector(".markdown-frontmatter")).toBeTruthy();
    expect(doc.querySelector(".markdown-alert-tip")).toBeTruthy();
    expect(doc.querySelector(".markdown-alert-warning strong")).toBeTruthy();
    expect(doc.querySelector(".task-list-item-checkbox")).toBeTruthy();
    expect(doc.querySelector(".footnotes")).toBeTruthy();
    expect(doc.querySelector(".math-inline")).toBeTruthy();
    expect(doc.body.textContent).toContain("$12.00");
    expect(doc.querySelector(".markdown-details[open] strong")).toBeTruthy();
    expect(
      doc.querySelector("pre.language-python, pre .language-python"),
    ).toBeTruthy();
    expect(result.diagramSlots[0]).toMatchObject({
      id: "mermaid-1",
      renderer: "mermaid",
    });
    expect(doc.querySelector("[data-diagram-id='mermaid-1']")).toBeTruthy();
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.body.innerHTML).toContain("&lt;script&gt;");
    expect(doc.querySelector("td[rowspan], td[colspan]")).toBeNull();
  });
});
