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
});
