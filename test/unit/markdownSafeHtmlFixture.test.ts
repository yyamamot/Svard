import { describe, expect, it } from "vitest";

import { fixtureDocuments } from "../../src/core/fixtures";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { documentPayload } from "./helpers/documentHtml";

describe("Markdown Safe HTML UI fixture", () => {
  it("renders the synthetic allowlist document through the viewer boundary", async () => {
    const path = "/workspace/docs/markdown-safe-html.md";
    const source = fixtureDocuments[path];
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      { ...documentPayload, path, format: "markdown", source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("h1")?.textContent).toContain(
      "Markdown Safe HTML Sample",
    );
    expect(doc.querySelectorAll("kbd")).toHaveLength(2);
    expect(doc.querySelectorAll("mark")).toHaveLength(3);
    expect(
      doc.querySelector('abbr[title="Application Programming Interface"]'),
    ).not.toBeNull();
    expect(doc.querySelectorAll("ruby > rt")).toHaveLength(2);
    expect(doc.querySelectorAll("ruby > rp")).toHaveLength(2);
    expect(doc.querySelector(".markdown-details.author-style")).toBeNull();
    expect(doc.querySelector("mark.author-style")).toBeNull();
    expect(doc.body.textContent).toContain("<kbd>Unclosed fragment");
    expect(
      doc.querySelector("[data-svard-markdown-author-html-id]"),
    ).toBeNull();
  });

  it("renders the synthetic block and table document through the viewer boundary", async () => {
    const path = "/workspace/docs/markdown-safe-html-blocks.md";
    const source = fixtureDocuments[path];
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      { ...documentPayload, path, format: "markdown", source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelectorAll(".markdown-safe-html-block")).toHaveLength(5);
    expect(doc.querySelector(".author-layout,.author-table")).toBeNull();
    expect(
      doc.querySelector("ol[start='2'][reversed][type='A']"),
    ).not.toBeNull();
    expect(
      doc
        .querySelector("table.markdown-safe-html-block")
        ?.closest(".markdown-table-scroll"),
    ).not.toBeNull();
    expect(
      doc.querySelector(
        ".markdown-safe-html-block [data-source-reference],.markdown-safe-html-block[data-source-reference]",
      ),
    ).toBeNull();
    expect(doc.querySelector("h2")?.getAttribute("data-source-reference")).toBe(
      `${path}:21#following-markdown-heading`,
    );
  });

  it("renders the synthetic link and image policy document through the viewer boundary", async () => {
    const path = "/workspace/docs/markdown-safe-html-links-assets.md";
    const source = fixtureDocuments[path];
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      { ...documentPayload, path, format: "markdown", source },
      {
        security: {
          allowLocalImages: true,
          confirmExternalLinks: true,
          showExternalImages: false,
        },
      },
      result,
      {
        resolveDocumentLink: async () => ({
          status: "resolved",
          path: "/workspace/docs/markdown-safe-html.md",
          hash: null,
        }),
        resolveLocalImage: async () => ({
          status: "resolved",
          resolvedPath: "/private/workspace/assets/svard-sample.svg",
          mediaType: "image/svg+xml",
          encoding: "utf8",
          content:
            '<svg xmlns="http://www.w3.org/2000/svg"><text>Svard</text></svg>',
        }),
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      doc.querySelector('a[href="./markdown-safe-html.md"]'),
    ).not.toBeNull();
    expect(
      doc.querySelector('a[href="https://example.test/svard"]'),
    ).not.toBeNull();
    expect(doc.querySelector('img[alt="Local Svard sample"]')).not.toBeNull();
    expect(
      doc.querySelector(
        'a[href="#resource-target"] > img[alt="Linked Svard sample"]',
      ),
    ).not.toBeNull();
    expect(doc.querySelector('img[alt="External image disabled"]')).toBeNull();
    expect(doc.body.textContent).toContain("Image: External image disabled");
    expect(doc.body.textContent).toContain("Blocked link label");
    expect(doc.body.textContent).toContain("Image: Blocked image");
    expect(doc.body.innerHTML).not.toMatch(
      /javascript:blocked|data:image\/svg\+xml,blocked|\/private\/workspace/u,
    );
    expect(
      Array.from(doc.querySelectorAll("p,details,table"))
        .filter((element) => element.querySelector("a,img"))
        .some(
          (element) =>
            element.hasAttribute("data-source-reference") ||
            element.hasAttribute("data-source-selection-block-id") ||
            element.querySelector(
              "[data-source-reference],[data-source-selection-block-id]",
            ),
        ),
    ).toBe(false);
    expect(
      doc.querySelector(
        "[data-svard-markdown-author-html-id],[data-source-renderer-id]",
      ),
    ).toBeNull();
  });
});
