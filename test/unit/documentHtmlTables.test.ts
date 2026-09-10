import { describe, expect, it } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { documentPayload, renderResult } from "./helpers/documentHtml";

describe("prepareDocumentHtml", () => {
  it("attaches source references to rendered tables", async () => {
    const html = await prepareDocumentHtml(
      "<table><tbody><tr><td>Item</td><td>Status</td></tr></tbody></table>",
      {
        ...documentPayload,
        source: "= Example\n\n== Table\n\n|===\n|Item |Status\n|===",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table");

    expect(table?.getAttribute("data-review-id")).toBe("rendered-table");
    expect(table?.getAttribute("data-source-line")).toBe("5");
    expect(table?.getAttribute("data-source-reference")).toBe(
      "/workspace/docs/example.adoc:5",
    );
  });

  it("wraps Markdown tables for horizontal scrolling without hiding table metadata", async () => {
    const source =
      "# README\n\n| Feature | Status |\n| --- | --- |\n| Wide Markdown table | Ready |";
    const markdownResult = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      markdownResult.html,
      {
        ...documentPayload,
        path: "/workspace/docs/readme.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      markdownResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const wrapper = doc.querySelector(".markdown-table-scroll");
    const table = doc.querySelector("table");

    expect(wrapper?.getAttribute("data-review-id")).toBe(
      "markdown-table-scroll",
    );
    expect(wrapper?.querySelector("table")).toBe(table);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(table?.getAttribute("data-review-id")).toBe("rendered-table");
    expect(table?.getAttribute("data-source-line")).toBe("3");
    expect(table?.getAttribute("data-source-reference")).toBe(
      "/workspace/docs/readme.md:3",
    );
  });

  it("does not wrap Markdown frontmatter or Rouge helper tables", async () => {
    const html = await prepareDocumentHtml(
      '<details class="markdown-frontmatter"><summary>Frontmatter</summary><table><tbody><tr><th>title</th><td>Guide</td></tr></tbody></table></details><table class="rouge-table"><tbody><tr><td>line</td></tr></tbody></table><table><tbody><tr><td>Body</td></tr></tbody></table>',
      {
        ...documentPayload,
        path: "/workspace/docs/readme.md",
        format: "markdown",
        source: "# README\n\n| Body |\n| --- |\n| Cell |",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc
        .querySelector(".markdown-frontmatter table")
        ?.parentElement?.classList.contains("markdown-table-scroll"),
    ).toBe(false);
    expect(
      doc
        .querySelector(".rouge-table")
        ?.parentElement?.classList.contains("markdown-table-scroll"),
    ).toBe(false);
    expect(doc.querySelectorAll(".markdown-table-scroll")).toHaveLength(1);
    expect(
      doc.querySelector(".markdown-table-scroll > table")?.textContent,
    ).toContain("Body");
  });

  it("keeps AsciiDoc document attributes tables out of rendered table metadata", async () => {
    const html = await prepareDocumentHtml(
      '<details class="markdown-frontmatter asciidoc-document-attributes"><summary>Document Attributes</summary><table><tbody><tr><th>toc</th><td><span class="frontmatter-null">empty</span></td></tr></tbody></table></details><table><tbody><tr><td>Item</td></tr></tbody></table>',
      {
        ...documentPayload,
        source: "= Example\n:toc:\n\n== Table\n\n|===\n|Item\n|===",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const attributesTable = doc.querySelector(
      ".asciidoc-document-attributes table",
    );
    const renderedTable = doc.querySelector(
      "body > table, .document-body > table",
    );

    expect(attributesTable?.getAttribute("data-review-id")).toBeNull();
    expect(attributesTable?.getAttribute("data-source-reference")).toBeNull();
    expect(renderedTable?.getAttribute("data-review-id")).toBe(
      "rendered-table",
    );
  });
});
