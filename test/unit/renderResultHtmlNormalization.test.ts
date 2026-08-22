import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { MarkdownAuthorHtmlFragment } from "../../src/core/types";
import { extractRenderedBlocksFromRoot } from "../../src/ui/lib/gitRenderedDiff/extraction";
import { extractRenderedTablesFromRoot } from "../../src/ui/lib/gitTableDiff";
import { normalizeRenderResultHtml } from "../../src/ui/lib/renderResultHtml";

function marker(
  kind: MarkdownAuthorHtmlFragment["kind"],
  id: string,
  fallback: string,
  extraAttribute = "",
): string {
  return `<svard-markdown-author-html-${kind} data-svard-markdown-author-html-id="${id}"${extraAttribute}>${fallback}</svard-markdown-author-html-${kind}>`;
}

describe("normalizeRenderResultHtml", () => {
  it("neutralizes AsciiDoc active controls and app-owned Kroki action metadata", () => {
    const result = normalizeRenderResultHtml("asciidoc", "", {
      html: '<form action="https://example.test/submit"><label>Static label</label><button data-kroki-confirm-key="spoof" formaction="http://127.0.0.1/action">Send</button><textarea>Notes</textarea><select><option>First</option></select><input value="secret"></form><img src="./safe.png" usemap="#routes" ismap><map name="routes"><area href="https://example.test/escape"></map><span data-kroki-fallback-key="spoof" data-kroki-open-preferences="true">Fallback</span>',
    });

    expect(
      result.body.querySelector(
        "form,input,button,textarea,select,option,map,area",
      ),
    ).toBeNull();
    expect(
      result.body.querySelector(
        "[action],[formaction],[usemap],[ismap],[data-kroki-confirm-key],[data-kroki-fallback-key],[data-kroki-open-preferences]",
      ),
    ).toBeNull();
    expect(result.body.textContent).toContain("Static label");
    expect(result.body.textContent).toContain("Send");
    expect(result.body.textContent).toContain("Notes");
    expect(result.body.textContent).toContain("First");
    expect(result.body.textContent).toContain("Fallback");
    expect(result.body.querySelector("img")?.getAttribute("src")).toBe(
      "./safe.png",
    );
  });

  it("normalizes valid inline and block fragments once with UTF-16 source spans", () => {
    const inline = "<kbd>😀</kbd>";
    const block = "<section>Block</section>";
    const source = `Before\r\n${inline}${block}`;
    const inlineStart = source.indexOf(inline);
    const blockStart = source.indexOf(block);
    const result = normalizeRenderResultHtml("markdown", source, {
      html: `${marker("inline", "inline-1", "wrong")}${marker("block", "block-1", "wrong")}`,
      markdownAuthorHtmlFragments: [
        {
          id: "inline-1",
          kind: "inline",
          sourceSpan: {
            startOffset: inlineStart,
            endOffset: inlineStart + inline.length,
          },
        },
        {
          id: "block-1",
          kind: "block",
          sourceSpan: {
            startOffset: blockStart,
            endOffset: blockStart + block.length,
          },
        },
      ],
    });

    expect(result.authorHtml).toEqual({
      status: "invoked",
      passedCount: 1,
      escapedCount: 1,
      rejectedCount: 0,
    });
    expect(result.body.textContent).toBe(`😀${block}`);
    expect(result.body.querySelector("kbd")?.textContent).toBe("😀");
    expect(result.body.querySelector("section")).toBeNull();
    expect(result.body.innerHTML).not.toContain("svard-markdown-author-html");
  });

  it.each([
    {
      name: "unknown identity",
      html: marker("inline", "unknown", "unknown fallback"),
      fragments: [],
    },
    {
      name: "duplicate identity",
      html: `${marker("inline", "same", "first")}${marker("inline", "same", "second")}`,
      fragments: [
        {
          id: "same",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
    },
    {
      name: "kind mismatch",
      html: marker("block", "one", "kind fallback"),
      fragments: [
        {
          id: "one",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
    },
    {
      name: "extra attribute",
      html: marker("inline", "one", "attribute fallback", ' class="spoof"'),
      fragments: [
        {
          id: "one",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
    },
    {
      name: "element child",
      html: marker("block", "one", '<a href="./next.md">child</a>'),
      fragments: [
        {
          id: "one",
          kind: "block" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
    },
    {
      name: "half surrogate span",
      html: marker("inline", "one", "surrogate fallback"),
      fragments: [
        {
          id: "one",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 1 },
        },
      ],
    },
  ])(
    "rejects $name without retaining an active marker",
    ({ html, fragments }) => {
      const result = normalizeRenderResultHtml("markdown", "😀source", {
        html,
        markdownAuthorHtmlFragments: fragments,
      });

      expect(result.authorHtml.status).toBe("invoked");
      expect(result.authorHtml.rejectedCount).toBeGreaterThan(0);
      expect(
        result.body.querySelector(
          "svard-markdown-author-html-inline,svard-markdown-author-html-block,[data-svard-markdown-author-html-id]",
        ),
      ).toBeNull();
      expect(result.body.querySelector("a,img,script,style")).toBeNull();
    },
  );

  it("rejects overlapping and DOM-reordered spans as one ambiguous set", () => {
    const result = normalizeRenderResultHtml("markdown", "0123456789abcdef", {
      html: `${marker("inline", "later", "later fallback")}${marker("inline", "earlier", "earlier fallback")}`,
      markdownAuthorHtmlFragments: [
        {
          id: "earlier",
          kind: "inline",
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
        {
          id: "later",
          kind: "inline",
          sourceSpan: { startOffset: 7, endOffset: 16 },
        },
      ],
    });

    expect(result.authorHtml).toEqual({
      status: "invoked",
      passedCount: 0,
      escapedCount: 0,
      rejectedCount: 2,
    });
    expect(result.body.textContent).toBe("later fallbackearlier fallback");
  });

  it("flattens a reserved attribute spoof before semantic extraction", () => {
    const result = normalizeRenderResultHtml("markdown", "source", {
      html: `<h2 data-source-renderer-id="private">Visible heading</h2><a data-svard-markdown-author-html-id="spoof" href="file:///private">link</a>`,
    });

    expect(result.authorHtml).toEqual({
      status: "invoked",
      passedCount: 0,
      escapedCount: 0,
      rejectedCount: 1,
    });
    expect(result.body.querySelector("a")).toBeNull();
    expect(result.body.querySelector("[data-source-renderer-id]")).toBeNull();
    expect(result.body.textContent).toContain("link");
  });

  it("does not expose a parser-reparented child as semantic content", () => {
    const result = normalizeRenderResultHtml("markdown", "<div>source</div>", {
      html: marker(
        "inline",
        "one",
        '<div><a href="./next.md" data-source-reference="private">child</a></div>',
      ),
      markdownAuthorHtmlFragments: [
        {
          id: "one",
          kind: "inline",
          sourceSpan: { startOffset: 0, endOffset: 17 },
        },
      ],
    });

    expect(result.authorHtml.rejectedCount).toBeGreaterThan(0);
    expect(result.body.querySelector("a,[data-source-reference]")).toBeNull();
    expect(result.body.textContent).toContain("child");
  });

  it("skips author selectors for ordinary Markdown and all AsciiDoc", () => {
    const markdown = normalizeRenderResultHtml("markdown", "plain", {
      html: '<p data-source-renderer-id="private">plain</p>',
    });
    const asciidoc = normalizeRenderResultHtml("asciidoc", "source", {
      html: marker("inline", "ignored", "AsciiDoc marker"),
      markdownAuthorHtmlFragments: [
        {
          id: "ignored",
          kind: "inline",
          sourceSpan: { startOffset: 0, endOffset: 6 },
        },
      ],
    });

    expect(markdown.authorHtml.status).toBe("skipped");
    expect(markdown.body.querySelector("[data-source-renderer-id]")).toBeNull();
    expect(asciidoc.authorHtml.status).toBe("skipped");
    expect(
      asciidoc.body.querySelector("svard-markdown-author-html-inline"),
    ).not.toBeNull();
  });

  it("preserves renderer identity only for the main provenance validation handoff", () => {
    const result = normalizeRenderResultHtml(
      "markdown",
      "Heading",
      { html: '<h1 data-source-renderer-id="private">Heading</h1>' },
      { rendererIdentity: "preserve-for-validation" },
    );

    expect(
      result.body.querySelector("[data-source-renderer-id]")?.textContent,
    ).toBe("Heading");
  });

  it("keeps escaped author headings and tables out of semantic extractors", () => {
    const authorHtml =
      '<h2 data-source-reference="private">Spoof</h2><table><tr><td>secret</td></tr></table>';
    const result = normalizeRenderResultHtml("markdown", authorHtml, {
      html: marker("block", "one", "fallback"),
      markdownAuthorHtmlFragments: [
        {
          id: "one",
          kind: "block",
          sourceSpan: { startOffset: 0, endOffset: authorHtml.length },
        },
      ],
    });

    expect(extractRenderedBlocksFromRoot(result.body)).toEqual([]);
    expect(extractRenderedTablesFromRoot(result.body)).toEqual([]);
    expect(result.body.textContent).toBe(authorHtml);
  });
});

describe("RenderResult HTML consumer inventory", () => {
  it("routes production direct consumers through the common boundary", () => {
    const sources = [
      "src/ui/lib/linkPreview.ts",
      "src/ui/lib/gitRenderedDiff/renderSummary.ts",
      "src/ui/lib/gitTableDiff.ts",
    ].map((path) => readFileSync(path, "utf8"));

    for (const source of sources) {
      expect(source).toContain("normalizeRenderResultHtml");
      expect(source).not.toMatch(/parseFromString\(\s*result\.html/u);
      expect(source).not.toMatch(
        /extractRenderedBlocksFromHtml\(\s*result\.html/u,
      );
      expect(source).not.toMatch(
        /extractRenderedTablesFromHtml\(\s*result\.html/u,
      );
    }
  });
});
