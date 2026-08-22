import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

const legacyDetailsMarkerPrefix = "SVARD_MARKDOWN_DETAILS_PLACEHOLDER";
const legacyCompatibilityMarkerPrefix = "SVARD_MARKDOWN_COMPAT_PLACEHOLDER";

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function legacyFutureMarkerChain(
  kind: "compatibility" | "details",
  depth: number,
): string {
  return Array.from({ length: depth }, (_, index) => {
    const nextMarker =
      index + 1 < depth
        ? `${kind === "details" ? legacyDetailsMarkerPrefix : legacyCompatibilityMarkerPrefix}_${index + 1}`
        : "chain leaf";
    if (kind === "details") {
      return `<details><summary>Level ${index}</summary>\n\n${nextMarker}\n\n${nextMarker}\n</details>`;
    }
    return `| --- | --- |\n| Level ${index} | ${nextMarker} ${nextMarker} |`;
  }).join("\n\n");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMarkdownCore", () => {
  it("omits inactive author HTML provenance from normal Markdown output", () => {
    const result = renderMarkdownCore("# Title\n\nPlain Markdown.\n");

    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
  });

  it.each([
    {
      name: "active HTML",
      source: '<script src="./private.js"></script>',
      literal: '<script src="./private.js"></script>',
      activeSelector: "script",
    },
    {
      name: "malformed unbalanced HTML",
      source: '<div class="open">unterminated',
      literal: '<div class="open">unterminated',
      activeSelector: "div",
    },
  ])(
    "keeps $name literal without activating the provenance producer",
    ({ source, literal, activeSelector }) => {
      const result = renderMarkdownCore(source);
      const doc = new DOMParser().parseFromString(result.html, "text/html");

      expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
      expect(result.html).not.toContain("svard-markdown-author-html-");
      expect(doc.querySelector(activeSelector)).toBeNull();
      expect(doc.body.textContent).toContain(literal);
    },
  );

  it("emits inert provenance markers for resource-free inline HTML", () => {
    const source = "Press <kbd>Ctrl</kbd> and <mark>Enter</mark>.";
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.markdownAuthorHtmlFragments).toHaveLength(2);
    expect(
      result.markdownAuthorHtmlFragments?.map(({ sourceSpan }) =>
        source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
      ),
    ).toEqual(["<kbd>Ctrl</kbd>", "<mark>Enter</mark>"]);
    expect(
      doc.querySelectorAll("svard-markdown-author-html-inline"),
    ).toHaveLength(2);
    expect(doc.querySelector("kbd, mark")).toBeNull();
  });

  it("emits one standalone block marker and shields block source metadata", () => {
    const source = `Before.

<div class="author">
<p>Block <kbd>content</kbd>.</p>
</div>

After.`;
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.markdownAuthorHtmlFragments).toHaveLength(1);
    expect(result.markdownAuthorHtmlFragments?.[0]).toMatchObject({
      kind: "block",
      sourceSpan: {
        startOffset: source.indexOf("<div"),
        endOffset: source.indexOf("</div>") + "</div>".length,
      },
    });
    expect(
      doc.querySelectorAll("svard-markdown-author-html-block"),
    ).toHaveLength(1);
    expect(
      doc.querySelector("svard-markdown-author-html-block")?.parentElement,
    ).toBe(doc.body);
    expect(result.sourceSelectionBlocks).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ startLine: 3 }),
        expect.objectContaining({ startLine: 4 }),
      ]),
    );
    expect(result.sourceTextBlocks).toHaveLength(2);
    expect(result.markdownRendererProvenance).toHaveLength(2);
  });

  it("keeps the source location of Markdown following a multiline author block", () => {
    const result = renderMarkdownCore(`<table>
<tr><td>HTML</td></tr>
</table>

## After

Paragraph.`);

    expect(result.headings[0]?.sourceLocation).toEqual({ line: 5, column: 1 });
    expect(result.sourceSelectionBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "heading", startLine: 5, endLine: 5 }),
        expect.objectContaining({
          kind: "paragraph",
          startLine: 7,
          endLine: 7,
        }),
      ]),
    );
    expect(result.markdownRendererProvenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "heading" }),
        expect.objectContaining({ kind: "paragraph" }),
      ]),
    );
  });

  it("does not activate block HTML inside renderer-owned details", () => {
    const source = `<details>
<summary>Block boundary</summary>

<div><p>Literal details block</p></div>
</details>`;
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.markdownAuthorHtmlFragments).toBeUndefined();
    expect(
      doc.querySelector("details div.markdown-safe-html-block"),
    ).toBeNull();
    expect(doc.querySelector("details")?.textContent).toContain(
      "<div><p>Literal details block</p></div>",
    );
  });

  it("consumes adjacent author markers followed directly by ordinary text", () => {
    const source = "Line<br>notation<kbd>Ctrl</kbd>adjacent";
    const result = renderMarkdownCore(source);

    expect(result.markdownAuthorHtmlFragments).toHaveLength(2);
    expect(result.html).toContain("notation");
    expect(result.html).toContain("adjacent");
  });

  it("uses visible safe HTML text for heading metadata and omits source provenance", () => {
    const result = renderMarkdownCore("# Use <kbd>Ctrl</kbd> safely");

    expect(result.headings).toMatchObject([
      {
        id: "use-ctrl-safely",
        text: "Use Ctrl safely",
        rawText: "Use <kbd>Ctrl</kbd> safely",
      },
    ]);
    expect(result.markdownRendererProvenance).toBeUndefined();
    expect(result.markdownAuthorHtmlFragments).toHaveLength(1);
  });

  it("uses the same author HTML registry in details summary and body", () => {
    const source = `<details open>
<summary>Press <kbd>Ctrl</kbd></summary>

Body <mark>marked</mark>.
</details>`;
    const result = renderMarkdownCore(source);

    expect(result.markdownAuthorHtmlFragments).toHaveLength(2);
    expect(
      result.markdownAuthorHtmlFragments?.map(({ sourceSpan }) =>
        source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
      ),
    ).toEqual(["<kbd>Ctrl</kbd>", "<mark>marked</mark>"]);
    expect(result.html).toContain("markdown-details");
    expect(
      result.html.match(/svard-markdown-author-html-inline/g),
    ).toHaveLength(4);
  });

  it("drops valid author attributes from details and summary while preserving open", () => {
    const result =
      renderMarkdownCore(`<DETAILS OPEN class="outer" id="author-id">
<SUMMARY class="inner" data-private="value">Title</SUMMARY>

Body.
</details>`);

    expect(result.html).toContain('<details class="markdown-details" open');
    expect(result.html).toContain("<summary>Title</summary>");
    expect(result.html).not.toContain("outer");
    expect(result.html).not.toContain("author-id");
    expect(result.html).not.toContain("data-private");
  });

  it.each([
    '<details open OPEN="x">\n<summary>Title</summary>\n\n<kbd>literal</kbd>\n</details>',
    '<details>\n<summary class="broken>Title</summary>\n\n<kbd>literal</kbd>\n</details>',
  ])(
    "escapes the whole malformed details block without partial activation",
    (source) => {
      const result = renderMarkdownCore(source);

      expect(result.html).not.toContain("markdown-details");
      expect(result.markdownAuthorHtmlFragments).toBeUndefined();
      expect(result.html).toContain("&lt;kbd&gt;literal&lt;/kbd&gt;");
    },
  );

  it("drops standalone multiline comments but preserves inline and fenced comments", () => {
    const result = renderMarkdownCore(`Before.

<!--
hidden
-->

Inline <!-- visible --> text.

\`\`\`html
<!-- fenced -->
\`\`\``);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.body.textContent).not.toContain("hidden");
    expect(doc.body.textContent).toContain("<!-- visible -->");
    expect(doc.querySelector("pre code")?.textContent).toContain(
      "<!-- fenced -->",
    );
  });

  it("keeps the existing HTML comment drop behavior without creating comment nodes", () => {
    const result = renderMarkdownCore(`Before.

<!-- author comment -->

After.`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const comments: Comment[] = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
    let current = walker.nextNode();
    while (current) {
      comments.push(current as Comment);
      current = walker.nextNode();
    }

    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
    expect(comments).toEqual([]);
    expect(doc.body.textContent).toContain("Before.");
    expect(doc.body.textContent).toContain("After.");
    expect(doc.body.textContent).not.toContain("author comment");
  });

  it("keeps raw HTML inside inline and fenced code as code source text", () => {
    const result = renderMarkdownCore(`Inline \`<kbd>code</kbd>\`.

\`\`\`html
<script>alert(1)</script>
\`\`\`
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
    expect(doc.querySelector("kbd, script")).toBeNull();
    expect(doc.querySelector("p code")?.textContent).toBe("<kbd>code</kbd>");
    expect(doc.querySelector("pre code")?.textContent).toContain(
      "<script>alert(1)</script>",
    );
  });

  it("does not activate allowlisted HTML inside an inline comment", () => {
    const source = "Text <!-- <kbd>blocked</kbd> --> tail";
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.markdownAuthorHtmlFragments).toBeUndefined();
    expect(result.html).not.toContain("svard-markdown-author-html-inline");
    expect(doc.body.textContent).toContain("<!-- <kbd>blocked</kbd> -->");
  });

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

  it("keeps renderer placeholder line identity after titled admonition expansion", () => {
    const result = renderMarkdownCore(`!!! note "Expanded title"
    Admonition body.

<details><summary>Details after admonition</summary>

Details body.
</details>

| --- | --- |
| Compatibility | after admonition |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelectorAll(".markdown-alert-note")).toHaveLength(1);
    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
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

  it("keeps author-provided legacy placeholder markers literal", () => {
    const result = renderMarkdownCore(`${legacyDetailsMarkerPrefix}_0

${legacyCompatibilityMarkerPrefix}_0

<details><summary>Actual details</summary>

Details body.
</details>

| --- | --- |
| Actual | compatibility table |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(doc.body.textContent).toContain(`${legacyDetailsMarkerPrefix}_0`);
    expect(doc.body.textContent).toContain(
      `${legacyCompatibilityMarkerPrefix}_0`,
    );
  });

  it("regenerates a renderer identity that collides with author source", () => {
    const firstIdentity = "00".repeat(16);
    const collidingMarker = `SVARD_RENDERER_PLACEHOLDER_${firstIdentity}`;
    let calls = 0;
    vi.stubGlobal("crypto", {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const bytes = new Uint8Array(
          array.buffer,
          array.byteOffset,
          array.byteLength,
        );
        bytes.fill(calls === 0 ? 0 : 1);
        calls += 1;
        return array;
      },
    });

    const result = renderMarkdownCore(`${collidingMarker}

<details><summary>Actual details</summary>

Body.
</details>
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(calls).toBe(2);
    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.body.textContent).toContain(collidingMarker);
  });

  it("does not restore compatibility placeholders inserted by a details replacement", () => {
    const marker = `${legacyCompatibilityMarkerPrefix}_0`;
    const result = renderMarkdownCore(`<details><summary>Mixed chain</summary>

${marker}

${marker}
</details>

| --- | --- |
| Actual | compatibility table |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelectorAll(".markdown-details")).toHaveLength(1);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(countOccurrences(doc.body.textContent ?? "", marker)).toBe(2);
  });

  it.each(["details", "compatibility"] as const)(
    "keeps 5/10/15-level %s future-marker chains linear",
    (kind) => {
      const measurements = [5, 10, 15].map((depth) => {
        const result = renderMarkdownCore(legacyFutureMarkerChain(kind, depth));
        const doc = new DOMParser().parseFromString(result.html, "text/html");
        const markerPrefix =
          kind === "details"
            ? legacyDetailsMarkerPrefix
            : legacyCompatibilityMarkerPrefix;

        expect(
          doc.querySelectorAll(
            kind === "details" ? ".markdown-details" : "table",
          ),
        ).toHaveLength(depth);
        expect(countOccurrences(doc.body.textContent ?? "", markerPrefix)).toBe(
          (depth - 1) * 2,
        );

        return new TextEncoder().encode(result.html).byteLength;
      });

      const firstGrowth = measurements[1] - measurements[0];
      const secondGrowth = measurements[2] - measurements[1];
      expect(secondGrowth).toBeLessThanOrEqual(firstGrowth + 512);
      expect(measurements[2]).toBeLessThan(measurements[0] * 4);
    },
  );

  it("does not expose renderer placeholder paragraphs as source text blocks", () => {
    const result = renderMarkdownCore(`Before.

<details><summary>Details</summary>

Body.
</details>

| --- | --- |
| Compatibility | table |

After.
`);

    expect(result.sourceTextBlocks).toEqual([
      { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
      { id: "text-2", kind: "paragraph", startLine: 11, endLine: 11 },
    ]);
    expect(result.html).not.toContain("data-source-text-block-id");
    const paragraphProvenance =
      result.markdownRendererProvenance?.filter(
        (record) => record.kind === "paragraph",
      ) ?? [];
    expect(
      paragraphProvenance.map((record) => record.sourceTextBlockId),
    ).toEqual(["text-1", "text-2"]);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    expect(
      Array.from(
        doc.querySelectorAll<HTMLElement>("p[data-source-renderer-id]"),
        (paragraph) => paragraph.dataset.sourceRendererId,
      ),
    ).toEqual(paragraphProvenance.map((record) => record.id));
  });

  it("fails closed with a fixed privacy-safe error when a placeholder is not an independent paragraph", () => {
    const privateSource = `private /workspace/secret.md
<details><summary>Malformed placeholder shape</summary>

private-token-123
</details>`;
    let thrown: unknown;

    try {
      renderMarkdownCore(privateSource);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "Markdown rendering stopped because renderer placeholder integrity validation failed.",
    );
    expect((thrown as Error).message).not.toContain("/workspace/secret.md");
    expect((thrown as Error).message).not.toContain("private-token-123");
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

  it("renders variable math between an ASCII label and non-ASCII prose", () => {
    const result = renderMarkdownCore(`# ASCII Label Math Boundaries

位置$i$、語彙ID$v$の一つのロジットを計算する。

API$x$を使い、API$W_{\\mathrm{LM}}$、を射影に使う。
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(4);
    expect(result.html).toContain('data-math-source="v"');
    expect(result.html).toContain('data-math-source="x"');
    expect(result.html).toContain('data-math-source="W_{\\mathrm{LM}}"');
    expect(result.html).not.toContain("ID$v$の");
    expect(result.html).not.toContain("API$x$を");
  });

  it("keeps unsupported ASCII label boundaries and numeric prose as text", () => {
    const result = renderMarkdownCore(`# Unsupported ASCII Label Boundaries

ASCII identifiers stay readable: word$x$word and v2$x$.

End-of-line label math stays readable: ID$v$

Numeric prose stays readable: ID$5$です and 日本語$5$です。
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("word$x$word");
    expect(result.html).toContain("v2$x$.");
    expect(result.html).toContain("ID$v$");
    expect(result.html).toContain("ID$5$です");
    expect(result.html).toContain("日本語$5$です");
  });

  it("keeps invalid math after an ASCII label as text", () => {
    const result = renderMarkdownCore(
      "Invalid label math: ID$\\frac{1}{$の後。",
    );

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("ID$\\frac{1}{$の後");
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
    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
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

  it("renders compact Markdown details opening lines", () => {
    const result = renderMarkdownCore(`<details><summary>解答</summary>

\`D_head = D_model / H = 12 / 3 = 4\`です。

</details>

<details open><summary>Open **answer**</summary>

Inline math $E = mc^2$.

</details>
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const details = doc.querySelectorAll(".markdown-details");

    expect(details).toHaveLength(2);
    expect(details[0].hasAttribute("open")).toBe(false);
    expect(details[0].querySelector("summary")?.textContent).toBe("解答");
    expect(details[0].querySelector("code")?.textContent).toBe(
      "D_head = D_model / H = 12 / 3 = 4",
    );
    expect(details[1].hasAttribute("open")).toBe(true);
    expect(details[1].querySelector("summary strong")?.textContent).toBe(
      "answer",
    );
    expect(details[1].querySelector(".math-inline .katex")).toBeTruthy();
  });

  it("keeps compact details inside fenced code as source text", () => {
    const result = renderMarkdownCore(`\`\`\`markdown
<details><summary>Not interactive</summary>
body
</details>
\`\`\`
`);

    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(result.html).not.toContain('class="markdown-details"');
    expect(doc.querySelector("pre")?.textContent).toContain(
      "<details><summary>Not interactive</summary>",
    );
  });

  it("escapes raw HTML inside Markdown details summary and body", () => {
    const result = renderMarkdownCore(`<details>
<summary><img onerror=alert(1)> Summary</summary>

<script>window.unsafeDetails = true</script>
</details>
`);

    expect(result.html).toContain('class="markdown-details"');
    expect(result.html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<img onerror");
    expect(result.html).not.toContain("<script>");
    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");
    expect(result.html).not.toContain("svard-markdown-author-html-");
  });

  it("keeps unsupported Markdown details syntax escaped", () => {
    const invalidCases = [
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
      `<details><summary>Single line</summary>body</details>`,
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
