import { describe, expect, it } from "vitest";

import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { documentPayload, renderResult } from "./helpers/documentHtml";

describe("prepareDocumentHtml", () => {
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
});
