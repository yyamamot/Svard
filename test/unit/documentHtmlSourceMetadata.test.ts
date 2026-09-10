import { describe, expect, it } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { documentPayload, renderResult } from "./helpers/documentHtml";

describe("prepareDocumentHtml", () => {
  it("attaches source references to headings and source blocks", async () => {
    const html = await prepareDocumentHtml(
      '<h2 id="overview">Overview</h2><pre>const product = "Svard";</pre>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.getElementById("overview")?.getAttribute("data-source-line"),
    ).toBe("4");
    expect(
      doc.getElementById("overview")?.getAttribute("data-source-reference"),
    ).toBe("/workspace/docs/example.adoc:4#overview");
    expect(
      doc
        .getElementById("overview")
        ?.querySelector("[data-section-collapse-toggle]"),
    ).not.toBeNull();
    expect(
      doc
        .getElementById("overview")
        ?.getAttribute("data-section-collapse-heading"),
    ).toBe("true");
    expect(
      doc.getElementById("overview")?.getAttribute("data-section-collapsed"),
    ).toBe("false");

    const frame = doc.querySelector(".source-block-frame");
    expect(frame?.getAttribute("data-source-block-id")).toBe("source-1");
    expect(frame?.getAttribute("data-source-line")).toBe("12");
    expect(frame?.getAttribute("data-source-column")).toBe("1");
    expect(frame?.getAttribute("data-source-reference")).toBe(
      "/workspace/docs/example.adoc:12",
    );
    expect(
      doc.querySelector("[data-review-id='source-block-toolbar']"),
    ).not.toBeNull();
    expect(
      doc
        .querySelector("[data-review-id='source-block-toolbar']")
        ?.getAttribute("data-selection-exclude"),
    ).toBe("true");
    expect(
      doc.querySelector("[data-review-id='source-block-language']")
        ?.textContent,
    ).toBe("ts");
    expect(doc.querySelector("[data-copy-source-button]")?.textContent).toBe(
      "Copy",
    );
    expect(
      doc.querySelector("[data-copy-source-location-button]")?.textContent,
    ).toBe("Ref");
    expect(doc.querySelector("[data-source-wrap-toggle]")?.textContent).toBe(
      "Wrap",
    );
    expect(
      doc.querySelector("[data-source-collapse-toggle]")?.textContent,
    ).toBe("Collapse");
  });

  it("maps a simple list independently from nested and task lists", async () => {
    const source = [
      "Intro.",
      "",
      "* one",
      "* two",
      "",
      "Nested:",
      "",
      "* outer",
      "** inner",
      "",
      "Tasks:",
      "",
      "* [ ] pending",
      "",
    ].join("\n");
    const html = await prepareDocumentHtml(
      `<div class="paragraph"><p>Intro.</p></div>
<div class="ulist"><ul><li><p>one</p></li><li><p>two</p></li></ul></div>
<div class="paragraph"><p>Nested:</p></div>
<div class="ulist"><ul><li><p>outer</p><div class="ulist"><ul><li><p>inner</p></li></ul></div></li></ul></div>
<div class="paragraph"><p>Tasks:</p></div>
<div class="ulist checklist"><ul class="checklist"><li><p>pending</p></li></ul></div>`,
      { ...documentPayload, source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [],
        sourceBlocks: [],
        sourceTextBlocks: [],
        sourceSelectionBlocks: [
          {
            id: "selection-list-1",
            kind: "list",
            startLine: 3,
            endLine: 4,
          },
          {
            id: "selection-list-2",
            kind: "list",
            startLine: 13,
            endLine: 13,
          },
        ],
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const lists = doc.querySelectorAll("ul");

    expect(lists[0].getAttribute("data-source-selection-block-id")).toBe(
      "selection-list-1",
    );
    expect(lists[0].getAttribute("data-source-selection-start")).toBe("3");
    expect(lists[0].getAttribute("data-source-selection-end")).toBe("4");
    expect(lists[1].hasAttribute("data-source-selection-block-id")).toBe(false);
    expect(lists[2].hasAttribute("data-source-selection-block-id")).toBe(false);
    expect(lists[3].hasAttribute("data-source-selection-block-id")).toBe(false);
  });

  it("maps paragraphs by source range when other rendered paragraphs are unsupported", async () => {
    const html = await prepareDocumentHtml(
      `<div class="paragraph"><p>Mapped paragraph.</p></div>
<div class="paragraph"><p>Rendered-only paragraph.</p></div>`,
      {
        ...documentPayload,
        source: "Mapped paragraph.\n\nRendered-only paragraph.\n",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [],
        sourceBlocks: [],
        sourceTextBlocks: [
          {
            id: "text-1",
            kind: "paragraph",
            startLine: 1,
            endLine: 1,
          },
          {
            id: "text-2",
            kind: "paragraph",
            startLine: 3,
            endLine: 3,
          },
        ],
        sourceSelectionBlocks: [
          {
            id: "selection-paragraph-1",
            kind: "paragraph",
            startLine: 1,
            endLine: 1,
          },
        ],
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const paragraphs = doc.querySelectorAll("p");

    expect(paragraphs[0].getAttribute("data-source-selection-block-id")).toBe(
      "selection-paragraph-1",
    );
    expect(paragraphs[1].hasAttribute("data-source-selection-block-id")).toBe(
      false,
    );
  });

  it("uses include origin paths for source references when available", async () => {
    const html = await prepareDocumentHtml(
      '<h2 id="included">Included</h2><pre>const included = true;</pre>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [
          {
            id: "included",
            level: 2,
            text: "Included",
            sourceLocation: {
              line: 7,
              column: 1,
              sourcePath: "/workspace/docs/partials/partial.adoc",
            },
          },
        ],
        sourceBlocks: [
          {
            id: "source-1",
            language: "ts",
            sourceLocation: {
              line: 10,
              column: 1,
              sourcePath: "/workspace/docs/partials/partial.adoc",
            },
          },
        ],
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.getElementById("included")?.getAttribute("data-source-reference"),
    ).toBe("/workspace/docs/partials/partial.adoc:7#included");
    expect(
      doc
        .querySelector(".source-block-frame")
        ?.getAttribute("data-source-reference"),
    ).toBe("/workspace/docs/partials/partial.adoc:10");
  });

  it("uses validated Markdown renderer identities for source actions and removes private identities", async () => {
    const source = [
      "# Identity boundary",
      "",
      "```ts",
      "const safe = true;",
      "```",
      "",
      "| Feature | Status |",
      "| --- | --- |",
      "| Provenance | Ready |",
    ].join("\n");
    const markdownResult = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      markdownResult.html,
      {
        ...documentPayload,
        path: "/workspace/docs/identity.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      markdownResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("[data-source-renderer-id]")).toBeNull();
    expect(doc.querySelector("h1 [data-section-collapse-toggle]")).toBeTruthy();
    expect(doc.querySelector(".source-block-frame")).toBeTruthy();
    expect(doc.querySelector("[data-copy-source-button]")).toBeTruthy();
    expect(doc.querySelector("table")?.getAttribute("data-source-line")).toBe(
      "7",
    );
    expect(
      doc.querySelectorAll("[data-source-selection-block-id]").length,
    ).toBeGreaterThan(0);
  });

  it("rejects Markdown provenance as one document while retaining visual-only rendering", async () => {
    const source = [
      "# Identity boundary",
      "",
      "Text with a footnote.[^one]",
      "",
      "```ts",
      "const visible = true;",
      "```",
      "",
      "| Feature | Status |",
      "| --- | --- |",
      "| Provenance | Rejected |",
      "",
      "<details>",
      "<summary>Native details</summary>",
      "Visible body.",
      "</details>",
      "",
      "[^one]: Footnote body.",
    ].join("\n");
    const markdownResult = renderMarkdownCore(source);
    const replayId = markdownResult.markdownRendererProvenance?.[0]?.id;
    expect(replayId).toBeTruthy();
    const tamperedHtml = markdownResult.html.replace(
      "</h1>",
      `<button data-section-collapse-toggle="true">forged</button></h1><p data-source-renderer-id="${replayId}">replay</p>`,
    );
    const html = await prepareDocumentHtml(
      tamperedHtml,
      {
        ...documentPayload,
        path: "/workspace/docs/rejected.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      markdownResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("h1")?.textContent).toContain("Identity boundary");
    expect(doc.querySelector("pre code")?.textContent).toContain(
      "const visible = true;",
    );
    expect(doc.querySelector(".markdown-table-scroll > table")).toBeTruthy();
    expect(doc.querySelector("details.markdown-details")).toBeTruthy();
    expect(
      doc.querySelector("li.footnote-item a.footnote-backref"),
    ).toBeTruthy();
    expect(doc.querySelector("[data-source-renderer-id]")).toBeNull();
    expect(doc.querySelector(".source-block-frame")).toBeNull();
    expect(doc.querySelector("[data-section-collapse-toggle]")).toBeNull();
    expect(doc.querySelector("[data-copy-source-button]")).toBeNull();
    expect(
      doc.querySelector(
        "[data-source-reference],[data-source-line],[data-source-selection-block-id]",
      ),
    ).toBeNull();
  });

  it("keeps repeated footnote navigation valid without retaining renderer identities", async () => {
    const source = [
      "# Footnotes",
      "",
      "First[^one] and repeated[^one].",
      "",
      "[^one]: Shared note.",
    ].join("\n");
    const markdownResult = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      markdownResult.html,
      {
        ...documentPayload,
        path: "/workspace/docs/footnotes.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      markdownResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("h1 [data-section-collapse-toggle]")).toBeTruthy();
    expect(
      Array.from(doc.querySelectorAll(".footnote-ref > a")).map(
        (link) => link.id,
      ),
    ).toEqual(["svard-footnote-ref-1", "svard-footnote-ref-1-2"]);
    expect(
      Array.from(doc.querySelectorAll(".footnote-backref")).map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual(["#svard-footnote-ref-1", "#svard-footnote-ref-1-2"]);
    expect(doc.querySelector("[data-source-renderer-id]")).toBeNull();
  });

  it("does not let shielded frontmatter, details, or compatibility tables steal Markdown actions", async () => {
    const source = [
      "---",
      "title: Boundary",
      "---",
      "",
      "<details>",
      "<summary>Shielded details</summary>",
      "```js",
      "const inner = true;",
      "```",
      "</details>",
      "",
      "| --- | --- |",
      "| Compatibility | No action |",
      "",
      "| Standard | Action |",
      "| --- | --- |",
      "| Exact | Mapping |",
      "",
      "```ts",
      "const outer = true;",
      "```",
    ].join("\n");
    const markdownResult = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      markdownResult.html,
      {
        ...documentPayload,
        path: "/workspace/docs/shields.md",
        format: "markdown",
        source,
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      markdownResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    const compatibility = tables.find((table) =>
      table.textContent?.includes("Compatibility"),
    );
    const standard = tables.find((table) =>
      table.textContent?.includes("Standard"),
    );

    expect(
      doc.querySelector(".markdown-frontmatter [data-source-reference]"),
    ).toBeNull();
    expect(
      doc.querySelector(".markdown-details .source-block-frame"),
    ).toBeNull();
    expect(
      doc.querySelector(".markdown-details [data-source-selection-block-id]"),
    ).toBeNull();
    expect(compatibility?.getAttribute("data-source-reference")).toBeNull();
    expect(
      compatibility?.getAttribute("data-source-selection-block-id"),
    ).toBeNull();
    expect(standard?.getAttribute("data-source-line")).toBe("15");
    expect(standard?.getAttribute("data-source-reference")).toBe(
      "/workspace/docs/shields.md:15",
    );
    expect(doc.querySelectorAll(".source-block-frame")).toHaveLength(1);
    expect(
      doc
        .querySelector(".source-block-frame")
        ?.getAttribute("data-source-reference"),
    ).toBe("/workspace/docs/shields.md:19");
  });
});
