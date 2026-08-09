import { describe, expect, it } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

describe("renderMarkdownCore", () => {
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

  it("renders inline and block math locally", () => {
    const result = renderMarkdownCore(`# Math

Inline $E = mc^2$ stays in prose.

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

\`\`\`tex
$not rendered in source$
\`\`\`
`);

    expect(result.html).toContain('class="math-inline"');
    expect(result.html).toContain('data-review-id="math-block"');
    expect(result.html).toContain("katex");
    expect(result.html).toContain("$not rendered in source$");
  });

  it("preserves Markdown matrix rows and columns", () => {
    const result = renderMarkdownCore(`# Matrix

$$
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
$$
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const matrix = doc.querySelector('[data-review-id="math-block"] .mtable');
    const columns = Array.from(
      matrix?.querySelectorAll(":scope > .col-align-c") ?? [],
    );

    expect(
      columns.map((column) =>
        Array.from(
          column.querySelectorAll(
            ":scope > .vlist-t > .vlist-r > .vlist > span",
          ),
        )
          .map((row) => row.textContent?.trim())
          .filter(Boolean),
      ),
    ).toEqual([
      ["1", "3"],
      ["2", "4"],
    ]);
  });

  it("renders inline math adjacent to non-ASCII prose", () => {
    const result = renderMarkdownCore(`# Non-ASCII Math Boundaries

予測値と正解$t$の差を測る。

- $x$と$t$：学習データ
- 中文$x$内容
- 한국어$y$내용
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(5);
    expect(result.html.match(/data-math-source="t"/g)?.length).toBe(2);
    expect(result.html).not.toContain("$x$と$t$");
    expect(result.html).not.toContain("中文$x$内容");
    expect(result.html).not.toContain("한국어$y$내용");
  });

  it("keeps ASCII word adjacency and non-ASCII currency as text", () => {
    const result = renderMarkdownCore(`# Ambiguous Dollar Boundaries

ASCII identifiers stay readable: word$x$word and v2$x$.

Japanese currency stays readable: 日本語$5$です。
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("word$x$word");
    expect(result.html).toContain("v2$x$");
    expect(result.html).toContain("日本語$5$です");
  });

  it("renders boundary-delimited numeric inline math", () => {
    const result = renderMarkdownCore(`# Numeric Inline Math

Standalone values: $1$, $2$, and $0.5774$.

Japanese prose keeps embedded currency readable: 日本語$5$です。
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(3);
    expect(result.html).toContain('data-math-source="1"');
    expect(result.html).toContain('data-math-source="2"');
    expect(result.html).toContain('data-math-source="0.5774"');
    expect(result.html).toContain("日本語$5$です");
  });

  it("does not treat currency and escaped dollars as inline math", () => {
    const result = renderMarkdownCore(`# Math Edge Cases

Costs stay readable: $12.00, USD $5, and price is $5 and $6.

Escaped dollars stay readable: \\$escaped\\$.
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("$12.00");
    expect(result.html).toContain("USD $5");
    expect(result.html).toContain("price is $5 and $6");
    expect(result.html).toContain("$escaped$");
  });

  it("keeps code spans and fenced code out of Markdown math", () => {
    const result = renderMarkdownCore(`# Math Code Safety

Inline code keeps \`$not math$\` as source text.

\`\`\`tex
$not rendered in source$
$$
not rendered inside source
$$
\`\`\`
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).not.toContain('data-review-id="math-block"');
    expect(result.html).toContain("$not math$");
    expect(result.html).toContain("$not rendered in source$");
    expect(result.html).toContain("not rendered inside source");
  });

  it("renders table cell math without matching across table pipes", () => {
    const result = renderMarkdownCore(`# Table Math

| Item | Formula | Notes |
| --- | --- | --- |
| Valid | $a + b$ | rendered in one cell |
| Broken | $a | b$ | pipe crossing stays text |
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(1);
    expect(result.html).toContain("$a");
    expect(result.html).toContain("b$");
  });

  it("renders numeric-only math in Markdown table cells", () => {
    const result = renderMarkdownCore(`# Numeric Table Math

| Query | Key | Before $R[i,j]$ | After $S[i,j]$ |
| --- | --- | --- | --- |
| Fish | Fish | $1$ | $1 / \\sqrt{3} \\approx 0.5774$ |
| Fish | Eats | $1$ | $1 / \\sqrt{3} \\approx 0.5774$ |
| Object | Object | $2$ | $2 / \\sqrt{3} \\approx 1.1547$ |
| Eats | Eats | $2$ | $2 / \\sqrt{3} \\approx 1.1547$ |
| Decimal | Decimal | $0.5774$ | $0.5774$ |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const table = doc.querySelector("table");

    expect(table?.querySelectorAll(".math-inline .katex")).toHaveLength(12);
    expect(table?.querySelectorAll('[data-math-source="1"]')).toHaveLength(2);
    expect(table?.querySelectorAll('[data-math-source="2"]')).toHaveLength(2);
    expect(table?.querySelectorAll('[data-math-source="0.5774"]')).toHaveLength(
      2,
    );
    expect(table?.textContent).not.toContain("$1$");
    expect(table?.textContent).not.toContain("$2$");
    expect(table?.textContent).not.toContain("$0.5774$");
  });

  it("keeps paragraph dollar pairs out of block math", () => {
    const result = renderMarkdownCore(`# Block Boundary

Paragraph $$x + y$$ stays paragraph text.

$$
x + y
$$ trailing text
`);

    expect(result.html).not.toContain('data-review-id="math-block"');
    expect(result.html).toContain("Paragraph $$x + y$$ stays paragraph text.");
    expect(result.html).toContain("trailing text");
  });

  it("renders invalid math fallback without stopping the document", () => {
    const result = renderMarkdownCore(`# Invalid Math

Invalid inline $\\frac{1}{$ keeps going after.

$$
\\frac{1}{
$$

After invalid block.
`);

    expect(result.html).toContain("math-render-error");
    expect(result.html).toContain("math-render-error-block");
    expect(result.html).toContain("keeps going after");
    expect(result.html).toContain("After invalid block.");
  });

  it("renders safe Markdown details blocks without enabling raw HTML", () => {
    const result = renderMarkdownCore(`<details>
<summary>Click **here** & stay safe</summary>

### Hidden Heading

- Rust
- Node.js

\`\`\`python
print("inside details")
\`\`\`
</details>
`);

    expect(result.html).toContain('class="markdown-details"');
    expect(result.html).toContain('data-review-id="markdown-details"');
    expect(result.html).toContain("Click <strong>here</strong>");
    expect(result.html).toContain("<h3>Hidden Heading</h3>");
    expect(result.html).toContain("language-python");
    expect(result.html).toContain("inside details");
    expect(result.headings).toEqual([]);
    expect(result.sourceBlocks).toEqual([]);
  });

  it("renders open Markdown details and body Markdown features", () => {
    const result = renderMarkdownCore(`<details open>
<summary>Open by default</summary>

Inline math $E = mc^2$.

> [!NOTE]
> Alert inside details.
</details>
`);

    expect(result.html).toContain('<details class="markdown-details" open');
    expect(result.html).toContain('class="math-inline"');
    expect(result.html).toContain("markdown-alert-note");
  });

  it("escapes raw HTML inside Markdown details summary and body", () => {
    const result = renderMarkdownCore(`<details>
<summary><img src=x onerror=alert(1)> Summary</summary>

<script>window.unsafeDetails = true</script>
</details>
`);

    expect(result.html).toContain('class="markdown-details"');
    expect(result.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<img src=x");
    expect(result.html).not.toContain("<script>");
  });

  it("keeps unsupported Markdown details syntax escaped", () => {
    const invalidCases = [
      `<details onclick="alert(1)">
<summary>Unsafe</summary>
body
</details>`,
      `<details>
No summary
</details>`,
      `<details>
<summary>Missing close</summary>
body`,
      `<details>
<summary>Nested</summary>
<details>
<summary>Inner</summary>
body
</details>
</details>`,
    ];

    for (const source of invalidCases) {
      const result = renderMarkdownCore(source);
      expect(result.html).not.toContain('class="markdown-details"');
      expect(result.html).toContain("&lt;details");
    }
  });

  it("escapes raw HTML by default", () => {
    const result = renderMarkdownCore(`<script>window.unsafe = true</script>`);

    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<script>");
  });
});
