import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMarkdownCore", () => {
  it("keeps a shorter backtick run inside a four-backtick fence", () => {
    const source = `\`\`\`\`html
\`\`\`not-a-close
<kbd>blocked</kbd>
\`\`\`\``;
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.markdownAuthorHtmlFragments).toBeUndefined();
    expect(result.html).not.toContain("svard-markdown-author-html-inline");
    expect(doc.querySelector("pre code")?.textContent).toContain(
      "<kbd>blocked</kbd>",
    );
  });

  it("renders Obsidian wikilinks as internal anchors and leaves embeds untouched", () => {
    const result = renderMarkdownCore(
      "Open [[Guide|the guide]] but not ![[Embed]].",
    );

    expect(result.html).toContain('data-wikilink-target="Guide"');
    expect(result.html).toContain("the guide</a>");
    expect(result.html).toContain("![[Embed]]");
  });

  it("renders headings with stable duplicate ids and source locations", () => {
    const result = renderMarkdownCore(`# Title

## 日本語 見出し

## 日本語 見出し
`);

    expect(result.headings.map((heading) => heading.id)).toEqual([
      "title",
      "日本語-見出し",
      "日本語-見出し-2",
    ]);
    expect(result.headings[1].sourceLocation).toEqual({ line: 3, column: 1 });
    expect(result.html).toContain('id="日本語-見出し"');
  });

  it("extracts safe inline formatting and plain text for Markdown headings", () => {
    const result =
      renderMarkdownCore(`## **Hugging *Face*** \`Conv1D\` and [nn.Linear](https://example.com)

## Image ![diagram](./diagram.png), ~~legacy~~, [[Guide|local guide]], and $x^2$
`);

    expect(result.headings).toMatchObject([
      {
        id: "hugging-face-conv1d-and-nnlinearhttpsexamplecom",
        level: 2,
        text: "Hugging Face Conv1D and nn.Linear",
        rawText:
          "**Hugging *Face*** `Conv1D` and [nn.Linear](https://example.com)",
        inline: [
          {
            type: "strong",
            children: [
              { type: "text", value: "Hugging " },
              {
                type: "emphasis",
                children: [{ type: "text", value: "Face" }],
              },
            ],
          },
          { type: "text", value: " " },
          { type: "code", value: "Conv1D" },
          { type: "text", value: " and nn.Linear" },
        ],
      },
      {
        text: "Image diagram, legacy, local guide, and x^2",
        rawText:
          "Image ![diagram](./diagram.png), ~~legacy~~, [[Guide|local guide]], and $x^2$",
      },
    ]);
    expect(result.headings[1].inline).toBeUndefined();
    expect(result.html).toContain('href="https://example.com">nn.Linear</a>');
  });

  it("keeps escaped heading markers as text and ids source-compatible", () => {
    const result = renderMarkdownCore(`## \\*literal\\* and **bold**

## \\*literal\\* and **bold**
`);

    expect(result.headings.map(({ id, text }) => ({ id, text }))).toEqual([
      { id: "literal-and-bold", text: "*literal* and bold" },
      { id: "literal-and-bold-2", text: "*literal* and bold" },
    ]);
  });

  it("reports privacy-safe Markdown render performance stages", () => {
    const result = renderMarkdownCore(`# Title

Plain Markdown.
`);

    expect(result.perf?.map((stage) => stage.event)).toEqual(
      expect.arrayContaining([
        "markdown.parse",
        "markdown.enhanceTokens",
        "markdown.metadata",
        "markdown.htmlRender",
        "markdown.total",
      ]),
    );
    for (const stage of result.perf ?? []) {
      expect(stage.durationMs).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(stage)).not.toContain("Plain Markdown");
    }
  });

  it("extracts regular fenced code blocks as source blocks", () => {
    const result = renderMarkdownCore(`## Code

\`\`\`ts
const product = "Svard";
\`\`\`
`);

    expect(result.sourceBlocks).toEqual([
      {
        id: "source-1",
        language: "ts",
        sourceLocation: { line: 3, column: 1 },
      },
    ]);
    expect(result.html).toContain("product");
    expect(result.html).toContain("hljs");
    expect(result.html).toContain("language-ts");
  });

  it("highlights common fenced code languages", () => {
    const result = renderMarkdownCore(`## Code

\`\`\`python
print("Svard")
\`\`\`

\`\`\`go
package main
\`\`\`

\`\`\`java
class App {}
\`\`\`

\`\`\`c
int main(void) { return 0; }
\`\`\`

\`\`\`cpp
int main() { return 0; }
\`\`\`

\`\`\`sql
select * from documents;
\`\`\`

\`\`\`dockerfile
FROM node:22
\`\`\`

\`\`\`toml
name = "Svard"
\`\`\`
`);

    for (const language of [
      "python",
      "go",
      "java",
      "c",
      "cpp",
      "sql",
      "dockerfile",
      "toml",
    ]) {
      expect(result.html).toContain(`language-${language}`);
    }
    expect(result.html).toContain("hljs-keyword");
  });

  it("renders GitHub style alerts and task lists", () => {
    const result = renderMarkdownCore(`> [!WARNING]
> Confirm remote diagrams before sending source.

- [x] Render Markdown
- [ ] Review layout
`);

    expect(result.html).toContain("markdown-alert-warning");
    expect(result.html).toContain("Confirm remote diagrams");
    expect(result.html).not.toContain("[!WARNING]");
    expect(result.html).toContain("task-list-item-checkbox");
    expect(result.html).toContain("checked");
    expect(result.html).not.toContain("[x] Render Markdown");
  });

  it("renders practical GFM README features without enabling raw HTML", () => {
    const result = renderMarkdownCore(`# README

| Feature | Status |
| --- | --- |
| Table | Ready |
| ~~Legacy~~ | <script>alert(1)</script> |

- [x] Render GFM tables
- [ ] Keep raw HTML escaped

Visit https://example.test/docs.
`);

    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelector("table")).not.toBeNull();
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(doc.querySelector("s")?.textContent).toBe("Legacy");
    expect(doc.querySelectorAll(".task-list-item-checkbox")).toHaveLength(2);
    expect(doc.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.test/docs",
    );
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<script>");
  });

  it("keeps standard GFM table headers when separator cells omit spaces", () => {
    const result = renderMarkdownCore(`### DOCA services

| DOCA Service | Quality Level |
|--------------|---------------|
| DOCA Argus | Beta |
| DOCA Blueman | GA |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const table = doc.querySelector("table");

    expect(result.html).not.toContain("<p>| DOCA Service | Quality Level |");
    expect(table?.querySelectorAll("thead th")).toHaveLength(2);
    expect(table?.querySelector("thead")?.textContent).toContain(
      "DOCA Service",
    );
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("renders Markdown footnotes and leaves missing definitions readable", () => {
    const result =
      renderMarkdownCore(`Footnote one.[^one] Repeated.[^one] Missing stays readable.[^missing]

[^one]: This is the footnote body.
`);

    expect(result.html).toContain("footnote-ref");
    expect(result.html).toContain("footnote-item");
    expect(result.html).toContain("This is the footnote body");
    expect(result.html).toContain("[^missing]");
  });

  it("renders simple Markdown admonitions without touching fences", () => {
    const result = renderMarkdownCore(`[NOTE]
Review local documents before sending diagram source.

\`\`\`md
[WARNING]
This remains a source block.
[^code]
\`\`\`
`);

    expect(result.html).toContain("markdown-alert-note");
    expect(result.html).toContain("Review local documents");
    expect(result.html).not.toContain("[NOTE]");
    expect(result.html).toContain("[WARNING]");
    expect(result.html).toContain("[^code]");
  });

  it("renders MkDocs admonitions without touching fences or unsupported types", () => {
    const result = renderMarkdownCore(`!!! note "Local review"
    Review **local** documents before sending [diagram](diagram.md) source.

    Keep \`Kroki\` as explicit fallback.

!!! warning "Remote rendering"
    Confirm remote diagrams.

!!! success "Unsupported"
    This remains plain Markdown.

\`\`\`md
!!! note "Source sample"
    This remains a source block.
\`\`\`
`);

    expect(result.html).toContain("markdown-alert-note");
    expect(result.html).toContain("markdown-alert-warning");
    expect(result.html).toContain("<strong>Local review</strong>");
    expect(result.html).toContain("<strong>local</strong>");
    expect(result.html).toContain('href="diagram.md"');
    expect(result.html).toContain("<code>Kroki</code>");
    expect(result.html).toContain("Confirm remote diagrams");
    expect(result.html).toContain("!!! success");
    expect(result.html).toContain("!!! note &quot;Source sample&quot;");
  });

  it("renders frontmatter as a collapsible table and offsets source locations", () => {
    const result = renderMarkdownCore(`---
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

# Title
`);

    expect(result.html).toContain("markdown-frontmatter");
    expect(result.html).toContain("Frontmatter");
    expect(result.html).toContain("7 fields");
    expect(result.html).toContain("<th>title</th>");
    expect(result.html).toContain("<td>Markdown GitHub Sample</td>");
    expect(result.html).toContain(
      '<span class="frontmatter-boolean">false</span>',
    );
    expect(result.html).toContain('<span class="frontmatter-number">1</span>');
    expect(result.html).toContain('<ul class="frontmatter-list">');
    expect(result.html).toContain("<li>markdown</li>");
    expect(result.html).toContain('<table class="frontmatter-nested">');
    expect(result.html).toContain(
      '<span class="frontmatter-boolean">true</span>',
    );
    expect(result.html).toContain('<span class="frontmatter-null">null</span>');
    expect(result.html).not.toContain("---");
    expect(result.headings[0].sourceLocation).toEqual({ line: 15, column: 1 });
  });

  it("hides standalone HTML comments and renders separator-first pipe tables", () => {
    const result = renderMarkdownCore(`* mft-mlx5

<!-- -->

* mft-nvredfish

|---------------|------------------------------------------------------------------------------|
| **DEB-based** | $ sudo apt install -y \\\\ kernel-mft-dkms \\\\ mft \\\\ mft-mlx5 \\\\ mft-nvredfish |
| **RPM-based** | $ sudo yum install -y \\\\ kernel-mft-dkms \\\\ mft \\\\ mft-mlx5 \\\\ mft-nvredfish |

\`\`\`md
<!-- keep comments in code fences -->
|---------------|------|
\`\`\`
`);

    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const table = doc.querySelector("table");
    expect(result.html).not.toContain("&lt;!-- --&gt;");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(table?.querySelector("strong")?.textContent).toBe("DEB-based");
    expect(table?.textContent).toContain("sudo apt install");
    expect(result.html).toContain(
      "&lt;!-- keep comments in code fences --&gt;",
    );
    expect(result.html).toContain("|---------------|------|");
  });

  it("turns Markdown diagram fences into inline placeholders", () => {
    const result = renderMarkdownCore(`## Diagrams

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`puml
@startuml
Alice -> Bob
@enduml
\`\`\`

\`\`\`dot
digraph G { A -> B }
\`\`\`

\`\`\`blockdiag
A -> B
\`\`\`
`);

    expect(result.diagramSlots.map((slot) => slot.id)).toEqual([
      "mermaid-1",
      "plantuml-1",
      "graphviz-1",
      "kroki-1",
    ]);
    expect(result.plantUmlDiagrams[0].source).toContain("@startuml");
    expect(result.graphvizDiagrams[0].diagramType).toBe("dot");
    expect(result.diagnostics[0].message).toContain("Kroki blockdiag");
    expect(result.html).toContain('data-diagram-id="mermaid-1"');
    expect(result.html).not.toContain("flowchart LR");
    expect(result.html).not.toContain("@startuml");
  });

  it("keeps markerless Markdown PlantUML source unchanged while slotting it", () => {
    const result = renderMarkdownCore(`## Markerless PlantUML

\`\`\`plantuml
actor User
User -> Renderer: Render
\`\`\`
`);

    expect(result.diagramSlots[0]).toMatchObject({
      id: "plantuml-1",
      renderer: "plantuml",
    });
    expect(result.plantUmlDiagrams[0].source).toBe(
      "actor User\nUser -> Renderer: Render",
    );
    expect(result.html).toContain('data-diagram-id="plantuml-1"');
    expect(result.html).not.toContain("User -> Renderer");
  });

  it("escapes raw HTML by default", () => {
    const result = renderMarkdownCore(`<script>window.unsafe = true</script>`);

    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<script>");
  });
});
