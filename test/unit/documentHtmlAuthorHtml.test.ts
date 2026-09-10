import { describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { addTableItems } from "../../src/ui/hooks/documentLinks/tableActions";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { documentPayload } from "./helpers/documentHtml";

describe("prepareDocumentHtml", () => {
  it("renders typed author blocks and tables without source or resolver actions", async () => {
    const source = `<div align="center" class="author">
<p>Block <kbd>content</kbd>.</p>
</div>

<table>
<tbody><tr><th scope="row">Name</th><td colspan="2">Svard</td></tr></tbody>
</table>`;
    const result = renderMarkdownCore(source);
    const resolveLocalImage = vi.fn();
    const resolveDocumentLink = vi.fn();
    const html = await prepareDocumentHtml(
      result.html,
      { ...documentPayload, format: "markdown", source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
      { resolveDocumentLink, resolveLocalImage },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const block = doc.querySelector("div.markdown-safe-html-block");
    const table = doc.querySelector<HTMLTableElement>(
      "table.markdown-safe-html-block",
    );

    expect(block?.getAttribute("align")).toBe("center");
    expect(block?.querySelector("kbd")?.textContent).toBe("content");
    expect(table?.querySelector("th")?.getAttribute("scope")).toBe("row");
    expect(table?.querySelector("td")?.getAttribute("colspan")).toBe("2");
    expect(table?.closest(".markdown-table-scroll")).not.toBeNull();
    expect(
      doc.querySelector(
        ".markdown-safe-html-block[data-source-reference],.markdown-safe-html-block [data-source-reference],.markdown-safe-html-block[data-source-selection-block-id],.markdown-safe-html-block [data-source-selection-block-id]",
      ),
    ).toBeNull();
    expect(
      doc.querySelector("[data-svard-markdown-author-html-id]"),
    ).toBeNull();
    expect(resolveLocalImage).not.toHaveBeenCalled();
    expect(resolveDocumentLink).not.toHaveBeenCalled();

    const items: Parameters<typeof addTableItems>[0] = [];
    addTableItems(items, table!, vi.fn());
    expect(items.map((item) => item.id)).toEqual([
      "copy-table-tsv",
      "copy-table-csv",
      "copy-table-markdown",
    ]);
  });

  it("keeps heading collapse while omitting source actions for passed author HTML", async () => {
    const source = "# Use <kbd>Ctrl</kbd> safely";
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      {
        ...documentPayload,
        path: "/workspace/docs/example.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const heading = doc.querySelector("h1");

    expect(heading?.querySelector("kbd")?.textContent).toBe("Ctrl");
    expect(
      heading?.querySelector("[data-section-collapse-toggle]"),
    ).not.toBeNull();
    expect(heading?.hasAttribute("data-source-reference")).toBe(false);
    expect(heading?.hasAttribute("data-source-selection-block-id")).toBe(false);
    expect(
      doc.querySelector("[data-svard-markdown-author-html-id]"),
    ).toBeNull();
  });

  it("omits source selection actions from list and table ancestors containing passed author HTML", async () => {
    const source = `- Press <kbd>Ctrl</kbd>

| Key | Meaning |
| --- | --- |
| <mark>Ctrl</mark> | Control |`;
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      { ...documentPayload, format: "markdown", source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("ul kbd")?.textContent).toBe("Ctrl");
    expect(doc.querySelector("table mark")?.textContent).toBe("Ctrl");
    expect(
      doc.querySelector("ul")?.hasAttribute("data-source-selection-block-id"),
    ).toBe(false);
    expect(
      doc
        .querySelector("table")
        ?.hasAttribute("data-source-selection-block-id"),
    ).toBe(false);
  });

  it("neutralizes synthetic author HTML before resolvers and source actions", async () => {
    const source = `<a href="./next.md" data-wikilink-target="forged" data-source-reference="/private/source.md:1">local link</a>
<img src="./private.png" data-image-path="/private/image.png" alt="private">
<a href="https://remote.example/path">http link</a>
<a href="//remote.example/path">protocol-relative link</a>
<a href="javascript:alert(1)">javascript link</a>
<a href="data:text/html,unsafe">data link</a>
<a href="file:///private/source.md">file link</a>
<a href="asset://localhost/private/source.md">asset link</a>
<img src="https://remote.example/private.png" alt="remote">
<img src="//remote.example/private.png" alt="protocol-relative">
<img src="data:image/svg+xml,unsafe" alt="data">
<img src="file:///private/image.png" alt="file">
<img src="asset://localhost/private/image.png" alt="asset">
<link rel="stylesheet" href="./private.css">
<meta http-equiv="refresh" content="0;url=./next.md">
<base href="https://example.test/">
<style>body { display: none; }</style>
<iframe src="./next.md">frame fallback</iframe>
<svg data-review-id="forged" data-diagram-id="diagram-1"><a href="./next.md"><text>svg link</text></a></svg>
<h2 id="forged-heading" data-section-collapse-toggle="true" data-source-reference="/private/source.md:1">heading-looking</h2>
<table data-source-line="1" data-source-reference="/private/source.md:1" data-review-id="rendered-table"><tbody><tr><td>table-looking</td></tr></tbody></table>
<pre data-source-block-id="source-1" data-source-line="1" data-copy-source-button="1">source-looking</pre>`;
    const escapedSource = source
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const resolveLocalImage = vi.fn(async () => ({
      status: "resolved" as const,
      mediaType: "image/png",
      encoding: "base64" as const,
      content: "AA==",
    }));
    const resolveDocumentLink = vi.fn(async () => ({
      status: "resolved" as const,
      path: "/workspace/docs/next.md",
    }));
    const html = await prepareDocumentHtml(
      `<svard-markdown-author-html-block data-svard-markdown-author-html-id="markdown-author-html-1">${escapedSource}</svard-markdown-author-html-block>`,
      {
        ...documentPayload,
        path: "/workspace/docs/example.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [],
        sourceBlocks: [
          {
            id: "source-1",
            language: "html",
            sourceLocation: { line: 1, column: 1 },
          },
        ],
        markdownAuthorHtmlFragments: [
          {
            id: "markdown-author-html-1",
            kind: "block",
            sourceSpan: { startOffset: 0, endOffset: source.length },
          },
        ],
      },
      { resolveLocalImage, resolveDocumentLink },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(resolveLocalImage).not.toHaveBeenCalled();
    expect(resolveDocumentLink).not.toHaveBeenCalled();
    expect(
      doc.querySelector(
        "a,img,link,meta,base,style,iframe,svg,h2,table,pre,svard-markdown-author-html-block",
      ),
    ).toBeNull();
    expect(
      doc.querySelector(
        "[data-svard-markdown-author-html-id],[data-wikilink-target],[data-source-reference],[data-source-block-id],[data-source-line],[data-image-path],[data-review-id],[data-copy-source-button],[data-section-collapse-toggle],[data-diagram-id]",
      ),
    ).toBeNull();
    expect(doc.querySelector(".source-block-frame")).toBeNull();
    expect(doc.querySelector("[data-copy-source-button]")).toBeNull();
    expect(doc.body.textContent).toContain('<a href="./next.md"');
    expect(doc.body.textContent).toContain('<img src="./private.png"');
    expect(doc.body.textContent).toContain('href="https://remote.example/');
    expect(doc.body.textContent).toContain('href="//remote.example/');
    expect(doc.body.textContent).toContain('href="javascript:');
    expect(doc.body.textContent).toContain('href="data:');
    expect(doc.body.textContent).toContain('href="file:');
    expect(doc.body.textContent).toContain('href="asset:');
    expect(doc.body.textContent).toContain("<link rel=");
    expect(doc.body.textContent).toContain("<meta http-equiv=");
    expect(doc.body.textContent).toContain("<base href=");
    expect(doc.body.textContent).toContain("<style>");
    expect(doc.body.textContent).toContain("<iframe src=");
    expect(doc.body.textContent).toContain("<svg data-review-id=");
    expect(doc.body.textContent).toContain("<h2 id=");
    expect(doc.body.textContent).toContain("<table data-source-line=");
    expect(doc.body.textContent).toContain("<pre data-source-block-id=");
  });

  it("does not apply Markdown author HTML normalization to AsciiDoc", async () => {
    const html = await prepareDocumentHtml(
      '<svard-markdown-author-html-inline data-svard-markdown-author-html-id="markdown-author-html-1">AsciiDoc fallback</svard-markdown-author-html-inline>',
      {
        ...documentPayload,
        format: "asciidoc",
        source: "<b>Markdown-only source</b>",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [],
        sourceBlocks: [],
        markdownAuthorHtmlFragments: [
          {
            id: "markdown-author-html-1",
            kind: "inline",
            sourceSpan: { startOffset: 0, endOffset: 27 },
          },
        ],
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.body.textContent).toContain("AsciiDoc fallback");
    expect(doc.body.textContent).not.toContain("Markdown-only source");
    expect(
      doc.querySelector("b, svard-markdown-author-html-inline"),
    ).toBeNull();
  });
});
