import { describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import type { DocumentPayload, RenderResult } from "../../src/core/types";

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/example.adoc",
  basePath: "/workspace/docs",
  format: "asciidoc",
  source: "",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

const renderResult: Pick<RenderResult, "headings" | "sourceBlocks"> = {
  headings: [
    {
      id: "overview",
      level: 2,
      text: "Overview",
      sourceLocation: { line: 4, column: 1 },
    },
  ],
  sourceBlocks: [
    {
      id: "source-1",
      language: "ts",
      sourceLocation: { line: 12, column: 1 },
    },
  ],
};

async function collectPrepareDocumentEvents(
  html: string,
  payload: DocumentPayload,
  result: Pick<RenderResult, "headings" | "sourceBlocks">,
) {
  const events: Array<Record<string, unknown>> = [];
  localStorage.setItem("SVARD_PERF_TRACE", "1");
  const infoSpy = vi
    .spyOn(console, "info")
    .mockImplementation((label: unknown, payload: unknown) => {
      if (label === "[perf]" && payload && typeof payload === "object") {
        events.push(payload as Record<string, unknown>);
      }
    });

  try {
    const preparedHtml = await prepareDocumentHtml(
      html,
      payload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    return { events, html: preparedHtml };
  } finally {
    infoSpy.mockRestore();
    localStorage.removeItem("SVARD_PERF_TRACE");
  }
}

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

  it("uses a Source label and disables source reference actions without source metadata", async () => {
    const html = await prepareDocumentHtml(
      "<pre>plain source block</pre>",
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [{ id: "source-unknown" }] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const referenceButton = doc.querySelector<HTMLButtonElement>(
      "[data-copy-source-location-button]",
    );

    expect(
      doc.querySelector("[data-review-id='source-block-language']")
        ?.textContent,
    ).toBe("Source");
    expect(referenceButton?.disabled).toBe(true);
    expect(referenceButton?.title).toBe("Source location unavailable");
  });

  it("highlights AsciiDoc source blocks with known languages", async () => {
    const html = await prepareDocumentHtml(
      '<pre><code>const product = "Svard";</code></pre>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [],
        sourceBlocks: [
          {
            id: "source-ts",
            language: "ts",
            sourceLocation: { line: 1, column: 1 },
          },
        ],
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("pre")?.classList.contains("hljs")).toBe(true);
    expect(doc.querySelector("code")?.classList.contains("language-ts")).toBe(
      true,
    );
    expect(doc.querySelector(".hljs-keyword")?.textContent).toBe("const");
    expect(doc.querySelector(".hljs-string")?.textContent).toBe('"Svard"');
    expect(doc.querySelector("pre")?.textContent).toContain(
      'const product = "Svard";',
    );
  });

  it("keeps unknown AsciiDoc source languages escaped without executable HTML", async () => {
    const html = await prepareDocumentHtml(
      "<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>",
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      {
        headings: [],
        sourceBlocks: [
          {
            id: "source-unknown",
            language: "svard-unknown",
            sourceLocation: { line: 1, column: 1 },
          },
        ],
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("code")?.innerHTML).toContain(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
    expect(doc.querySelector("img")).toBeNull();
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

  it("renders AsciiDoc stem math and skips source blocks", async () => {
    const html = await prepareDocumentHtml(
      '<div class="paragraph"><p>Inline \\$E = mc^2\\$ prose.</p></div><div class="stemblock"><div class="content">\\$\\begin{bmatrix}\n1 &amp; 2 \\\\$ \n\\$3 &amp; 4\n\\end{bmatrix}\\$</div></div><pre>\\$not math\\$</pre>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector(".math-inline .katex")).toBeTruthy();
    expect(
      doc.querySelector('[data-review-id="math-block"] .katex'),
    ).toBeTruthy();
    expect(
      doc.querySelector('[data-review-id="math-block"]')?.textContent,
    ).not.toContain("$");
    expect(
      doc.querySelector('[data-review-id="math-block"] [style]'),
    ).toBeTruthy();
    expect(doc.querySelector("pre")?.textContent).toContain("\\$not math\\$");
  });

  it("renders AsciiDoc stem math with escaped backslash pairs", async () => {
    const html = await prepareDocumentHtml(
      '<div class="paragraph"><p>Inline \\\\$E = mc^2\\\\$ prose.</p></div><div class="stemblock"><div class="content">\\\\$x^2\\\\$</div></div>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector(".math-inline .katex")).toBeTruthy();
    expect(
      doc.querySelector('[data-review-id="math-block"] .katex'),
    ).toBeTruthy();
    expect(doc.body.textContent).not.toContain("\\$");
  });

  it.each([
    {
      format: "markdown" as const,
      name: "Markdown without math",
      rawHtml: "<h1>Plain Markdown</h1><p>No math here.</p>",
      source: "# Plain Markdown\n\nNo math here.",
      reparseSkipped: true,
      expectedMathSelector: null,
    },
    {
      format: "markdown" as const,
      name: "Markdown with math placeholders",
      markdownSource: "Inline math: $a + b$.",
      reparseSkipped: false,
      expectedMathSelector: ".math-inline .katex",
    },
    {
      format: "asciidoc" as const,
      name: "AsciiDoc without stem",
      rawHtml: "<p>Plain AsciiDoc prose.</p>",
      source: "= Plain\n\nPlain AsciiDoc prose.",
      reparseSkipped: true,
      expectedMathSelector: null,
    },
    {
      format: "asciidoc" as const,
      name: "AsciiDoc with stem",
      rawHtml:
        '<div class="paragraph"><p>Inline \\$E = mc^2\\$ prose.</p></div>',
      source: "= Stem\n\nstem:[E = mc^2]",
      reparseSkipped: false,
      expectedMathSelector: ".math-inline .katex",
    },
  ])("keeps the post-sanitize reparse contract for $name", async (caseSpec) => {
    const markdownResult = caseSpec.markdownSource
      ? renderMarkdownCore(caseSpec.markdownSource)
      : null;
    const { events, html } = await collectPrepareDocumentEvents(
      markdownResult?.html ?? caseSpec.rawHtml ?? "",
      {
        ...documentPayload,
        format: caseSpec.format,
        path: `/workspace/docs/example.${caseSpec.format === "markdown" ? "md" : "adoc"}`,
        source: caseSpec.markdownSource ?? caseSpec.source ?? "",
      },
      markdownResult ?? { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      events.find(
        (event) =>
          event.event === "render.prepareDocumentHtml.sanitizedDomParse",
      ),
    ).toEqual(
      expect.objectContaining({
        skipped: caseSpec.reparseSkipped,
      }),
    );
    expect(
      events.find((event) => event.event === "render.prepareDocumentHtml.math"),
    ).toEqual(
      expect.objectContaining({
        skipped: caseSpec.reparseSkipped,
      }),
    );
    if (caseSpec.expectedMathSelector) {
      expect(doc.querySelector(caseSpec.expectedMathSelector)).toBeTruthy();
    } else {
      expect(doc.querySelector(".math-inline, .math-block")).toBeNull();
    }
  });

  it("skips AsciiDoc math scan when stem markers are absent", async () => {
    const events: Array<Record<string, unknown>> = [];
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      });

    try {
      const html = await prepareDocumentHtml(
        "<p>Plain AsciiDoc prose without math.</p>",
        {
          ...documentPayload,
          source: "= Plain\n\nPlain AsciiDoc prose without math.",
        },
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        { headings: [], sourceBlocks: [] },
      );
      const doc = new DOMParser().parseFromString(html, "text/html");

      expect(doc.querySelector(".math-inline, .math-block")).toBeNull();
      expect(
        events.find(
          (event) => event.event === "render.prepareDocumentHtml.math",
        ),
      ).toEqual(
        expect.objectContaining({
          skipped: true,
        }),
      );
      expect(
        events.find(
          (event) =>
            event.event === "render.prepareDocumentHtml.sanitizedDomParse",
        ),
      ).toEqual(
        expect.objectContaining({
          skipped: true,
        }),
      );
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }
  });

  it("marks absent expensive element phases as skipped", async () => {
    const events: Array<Record<string, unknown>> = [];
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      });

    try {
      await prepareDocumentHtml(
        "<p>Plain document.</p>",
        {
          ...documentPayload,
          source: "= Plain\n\nPlain document.",
        },
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        { headings: [], sourceBlocks: [] },
      );

      for (const eventName of [
        "render.prepareDocumentHtml.sourceBlocks",
        "render.prepareDocumentHtml.tables",
        "render.prepareDocumentHtml.images",
        "render.prepareDocumentHtml.links",
      ]) {
        expect(events.find((event) => event.event === eventName)).toEqual(
          expect.objectContaining({
            skipped: true,
            count: 0,
          }),
        );
      }
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }
  });

  it("keeps Markdown KaTeX layout styles after document sanitization", async () => {
    const result = renderMarkdownCore(`Inline math: $a + b = c$.

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

\`\`\`tex
$not rendered in source$
\`\`\`
`);
    const html = await prepareDocumentHtml(
      result.html,
      {
        ...documentPayload,
        path: "/workspace/docs/example.md",
        format: "markdown",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector(".math-inline .katex")).toBeTruthy();
    expect(
      doc.querySelector('[data-review-id="math-block"] .katex'),
    ).toBeTruthy();
    expect(
      doc.querySelector('[data-review-id="math-block"] [style]'),
    ).toBeTruthy();
    expect(doc.querySelector("pre")?.textContent).toContain(
      "$not rendered in source$",
    );
  });

  it("blocks external images by default without exposing the raw URL", async () => {
    const html = await prepareDocumentHtml(
      '<p><img src="https://example.test/rust-logo.svg" alt="Rust Logo"></p>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelector(".image-placeholder")?.textContent).toBe(
      "External image blocked: Rust Logo",
    );
    expect(html).not.toContain("https://example.test/rust-logo.svg");
  });

  it("keeps external images when explicitly enabled", async () => {
    const html = await prepareDocumentHtml(
      '<p><img src="https://example.test/rust-logo.svg" alt="Rust Logo"></p>',
      documentPayload,
      {
        security: {
          allowLocalImages: true,
          showExternalImages: true,
          confirmExternalLinks: true,
        },
      },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.test/rust-logo.svg",
    );
  });

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

  it("preserves AsciiDoc theme classes for admonitions and table captions", async () => {
    const html = await prepareDocumentHtml(
      '<div class="admonitionblock note"><table><tr><td class="icon"><i class="fa icon-note" title="Note"></i></td><td class="content">Note body</td></tr></table></div><table class="tableblock frame-all grid-all stretch"><caption class="title">Table 1. Caption</caption><tbody><tr><td class="tableblock halign-left valign-top" rowspan="2"><p class="tableblock">Group</p></td><td class="tableblock halign-left valign-top" colspan="2"><p class="tableblock">Cell</p></td></tr><tr><td class="tableblock halign-left valign-top"><p class="tableblock">Nested</p></td></tr></tbody></table>',
      {
        ...documentPayload,
        source:
          "= Example\n\nNOTE: Note body\n\n.Caption\n|===\n.2+|Group 2+|Cell\n|Nested\n|===",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector(".admonitionblock.note .icon-note")).toBeTruthy();
    expect(doc.querySelector(".admonitionblock .content")?.textContent).toBe(
      "Note body",
    );
    expect(doc.querySelector("table.tableblock caption.title")).toBeTruthy();
    expect(
      doc.querySelector("table.tableblock")?.getAttribute("data-review-id"),
    ).toBe("rendered-table");
    expect(
      doc.querySelector("table.tableblock td")?.getAttribute("rowspan"),
    ).toBe("2");
    expect(
      doc
        .querySelector("table.tableblock td:nth-child(2)")
        ?.getAttribute("colspan"),
    ).toBe("2");
  });

  it("sanitizes rendered document HTML without removing viewer metadata", async () => {
    const html = await prepareDocumentHtml(
      '<h2 id="overview" onclick="alert(1)">Overview</h2><p><a href="javascript:alert(1)" onmouseover="alert(2)">bad</a></p><details open><summary>More</summary><p>Body</p></details><pre>const value = 1;</pre>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      renderResult,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("[onclick]")).toBeNull();
    expect(doc.querySelector("[onmouseover]")).toBeNull();
    expect(doc.querySelector("a")?.getAttribute("href")).toBeNull();
    expect(doc.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(
      doc
        .querySelector(".source-block-frame")
        ?.getAttribute("data-source-line"),
    ).toBe("12");
  });

  it("skips document link processing without a resolver while keeping sanitizer URL safety", async () => {
    const events: Array<Record<string, unknown>> = [];
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      });

    try {
      const html = await prepareDocumentHtml(
        '<p><a href="./next.md">Next</a><a href="javascript:alert(1)">bad</a></p>',
        documentPayload,
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        { headings: [], sourceBlocks: [] },
      );
      const doc = new DOMParser().parseFromString(html, "text/html");
      const links = Array.from(doc.querySelectorAll("a"));

      expect(links[0]?.getAttribute("href")).toBe("./next.md");
      expect(links[1]?.getAttribute("href")).toBeNull();
      expect(
        events.find(
          (event) => event.event === "render.prepareDocumentHtml.links",
        ),
      ).toEqual(
        expect.objectContaining({
          skipped: true,
          count: 0,
        }),
      );
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }
  });

  it("preserves task list checkbox semantics during sanitization", async () => {
    const html = await prepareDocumentHtml(
      '<ul class="contains-task-list"><li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled checked> Done</li><li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled> Todo</li></ul>',
      { ...documentPayload, format: "markdown" },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const inputs = Array.from(doc.querySelectorAll("input"));

    expect(inputs).toHaveLength(2);
    expect(
      inputs.every((input) => input.getAttribute("type") === "checkbox"),
    ).toBe(true);
    expect(inputs.every((input) => input.hasAttribute("disabled"))).toBe(true);
    expect(inputs[0]?.hasAttribute("checked")).toBe(true);
    expect(inputs[1]?.hasAttribute("checked")).toBe(false);
  });

  it("hydrates local SVG images through the backend resolver as image data", async () => {
    const html = await prepareDocumentHtml(
      '<p><img src="./assets/sample.svg" alt="Sample"></p>',
      {
        ...documentPayload,
        path: "/workspace/svard/docs/example.adoc",
        basePath: "/workspace/svard/docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath) => {
          expect(path).toBe("./assets/sample.svg");
          expect(documentPath).toBe(
            "/workspace/svard/docs/example.adoc",
          );
          return {
            status: "resolved",
            mediaType: "image/svg+xml",
            encoding: "utf8",
            content:
              '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">Diagram&nbsp;text</div></foreignObject><text>Safe</text></svg>',
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const image = doc.querySelector("img");

    expect(image?.getAttribute("src")).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "Safe",
    );
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "foreignObject",
    );
    expect(decodeURIComponent(image?.getAttribute("src") ?? "")).toContain(
      "Diagram&#160;text",
    );
  });

  it("passes root-relative local image paths to the backend resolver unchanged", async () => {
    const html = await prepareDocumentHtml(
      '<p><img src="/images/article/root.svg" alt="Root"></p>',
      {
        ...documentPayload,
        path: "/workspace/svard/articles/post.md",
        basePath: "/workspace/svard/articles",
        format: "markdown",
        resourceContext: {
          workspaceRoot: "/workspace/svard",
          documentDir: "/workspace/svard/articles",
          resourceRoots: ["/workspace/svard", "/workspace/svard/articles"],
        },
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath, context) => {
          expect(path).toBe("/images/article/root.svg");
          expect(documentPath).toBe("/workspace/svard/articles/post.md");
          expect(context).toEqual({
            workspaceRoot: "/workspace/svard",
            documentDir: "/workspace/svard/articles",
            resourceRoots: ["/workspace/svard", "/workspace/svard/articles"],
          });
          return {
            status: "resolved",
            mediaType: "image/svg+xml",
            encoding: "utf8",
            content:
              '<svg xmlns="http://www.w3.org/2000/svg"><text>Root image</text></svg>',
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const image = doc.querySelector("img");

    expect(image?.getAttribute("data-image-path")).toBe(
      "/images/article/root.svg",
    );
    expect(image?.getAttribute("src")).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
  });

  it("keeps AsciiDoc image placeholders visible when a later local image is missing", async () => {
    const html = await prepareDocumentHtml(
      `<div class="imageblock">
<div class="content">
<img src="assets/oversized-diagram.svg" alt="Oversized manual SVG">
</div>
<div class="title">Figure 3. Oversized SVG</div>
</div>
<div class="imageblock">
<div class="content">
<img src="assets/missing-manual-image.png" alt="Missing manual image">
</div>
<div class="title">Figure 4. Missing image placeholder</div>
</div>`,
      {
        ...documentPayload,
        format: "asciidoc",
        path: "/workspace/svard/docs/samples/manual/index.adoc",
        basePath: "/workspace/svard/docs/samples/manual",
        asciidocContext: {
          baseDir: "/workspace/svard",
          workspaceRoot: "/workspace/svard",
          documentDir: "/workspace/svard/docs/samples/manual",
          attributes: { imagesdir: "assets" },
          resourceRoots: [
            "/workspace/svard",
            "/workspace/svard/docs/samples/manual",
          ],
        },
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path) =>
          path.endsWith("oversized-diagram.svg")
            ? {
                status: "resolved",
                mediaType: "image/svg+xml",
                encoding: "utf8",
                content:
                  '<svg xmlns="http://www.w3.org/2000/svg"><text>Oversized SVG</text></svg>',
              }
            : {
                status: "blocked",
                placeholderText: "Local image is not available.",
              },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const imageBlocks = Array.from(doc.querySelectorAll(".imageblock"));

    expect(imageBlocks[0]?.querySelector("img")?.getAttribute("src")).toContain(
      "data:image/svg+xml;charset=utf-8,",
    );
    expect(imageBlocks[0]?.querySelector(".image-placeholder")).toBeNull();
    expect(imageBlocks[1]?.querySelector("img")).toBeNull();
    expect(
      imageBlocks[1]?.querySelector(".image-placeholder")?.textContent,
    ).toBe("Local image is not available.");
    expect(imageBlocks[1]?.querySelector(".title")?.textContent).toBe(
      "Figure 4. Missing image placeholder",
    );
  });

  it("hydrates Windows local image paths without converting the drive path to a URL path", async () => {
    await prepareDocumentHtml(
      '<p><img src="sample.png" alt="Sample"></p>',
      {
        ...documentPayload,
        path: "C:\\Users\\developer\\docs\\example.adoc",
        basePath: "C:\\Users\\developer\\docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath) => {
          expect(path).toBe("sample.png");
          expect(documentPath).toBe("C:\\Users\\developer\\docs\\example.adoc");
          return {
            status: "resolved",
            mediaType: "image/png",
            encoding: "base64",
            content: "AA==",
          };
        },
      },
    );
  });

  it("passes sibling workspace image paths to the backend resolver unchanged", async () => {
    await prepareDocumentHtml(
      '<p><img src="../images/test.svg" alt="Sibling"></p>',
      {
        ...documentPayload,
        path: "C:\\Users\\developer\\project\\docs\\index.adoc",
        basePath: "C:\\Users\\developer\\project\\docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveLocalImage: async (path, documentPath) => {
          expect(path).toBe("../images/test.svg");
          expect(documentPath).toBe(
            "C:\\Users\\developer\\project\\docs\\index.adoc",
          );
          return {
            status: "resolved",
            mediaType: "image/svg+xml",
            encoding: "utf8",
            content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          };
        },
      },
    );
  });

  it("hydrates local document links through the backend resolver", async () => {
    const html = await prepareDocumentHtml(
      '<p><a href="next.md#usage">Next</a></p>',
      {
        ...documentPayload,
        path: "C:\\Users\\developer\\docs\\example.adoc",
        basePath: "C:\\Users\\developer\\docs",
      },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveDocumentLink: async (href, documentPath) => {
          expect(href).toBe("next.md#usage");
          expect(documentPath).toBe("C:\\Users\\developer\\docs\\example.adoc");
          return {
            status: "resolved",
            path: "C:\\Users\\developer\\docs\\next.md",
            hash: "usage",
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("a")?.getAttribute("href")).toBe(
      "C:\\Users\\developer\\docs\\next.md#usage",
    );
  });

  it("removes unavailable local document links without resolving paths in the frontend", async () => {
    const html = await prepareDocumentHtml(
      '<p><a href="../secret.md">Secret</a></p>',
      documentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
      {
        resolveDocumentLink: async (href, documentPath) => {
          expect(href).toBe("../secret.md");
          expect(documentPath).toBe("/workspace/docs/example.adoc");
          return {
            status: "blocked",
            message: "Document link is outside the current workspace.",
          };
        },
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("a")?.getAttribute("href")).toBeNull();
    expect(doc.querySelector("a")?.getAttribute("title")).toBe(
      "Document link is outside the current workspace.",
    );
  });
});
