import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

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
});
