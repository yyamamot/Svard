import { describe, expect, it } from "vitest";

import type { MarkdownAuthorHtmlFragment } from "../../src/core/types";
import { normalizeMarkdownAuthorHtmlInPlace } from "../../src/ui/lib/markdownAuthorHtml";

const markerSelector =
  "svard-markdown-author-html-inline,svard-markdown-author-html-block";

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, "text/html").body;
}

function marker(
  kind: MarkdownAuthorHtmlFragment["kind"],
  id: string,
  fallback: string,
  extraAttribute = "",
): string {
  return `<svard-markdown-author-html-${kind} data-svard-markdown-author-html-id="${id}"${extraAttribute}>${fallback}</svard-markdown-author-html-${kind}>`;
}

function sourceSpan(source: string, value: string) {
  const startOffset = source.indexOf(value);
  return { startOffset, endOffset: startOffset + value.length };
}

describe("normalizeMarkdownAuthorHtmlInPlace", () => {
  it("creates resource elements without URL attributes and returns ephemeral candidates", () => {
    const source =
      '<a href="./guide.md"><img src="./logo.svg" alt="Logo" align="center"></a>';
    const body = parseBody(marker("inline", "resource-1", "fallback"));

    const result = normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "resource-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: source.length },
      },
    ]);
    const link = body.querySelector("a");
    const image = body.querySelector("img");

    expect(link?.hasAttribute("href")).toBe(false);
    expect(image?.hasAttribute("src")).toBe(false);
    expect(image?.className).toBe("markdown-safe-html-image-align-center");
    expect(result.resourceCandidates.get(link!)).toEqual({
      kind: "link",
      value: "./guide.md",
    });
    expect(result.resourceCandidates.get(image!)).toEqual({
      kind: "image",
      value: "./logo.svg",
    });
    expect(result.sourceActionExcludedElements.has(link!)).toBe(true);
    expect(result.sourceActionExcludedElements.has(image!)).toBe(true);
  });
  it("constructs a typed block tree and records only app-owned block roots", () => {
    const source = `<table class="author"><tbody><tr><th scope="COL">A</th><td colspan="2"><kbd>B</kbd></td></tr></tbody></table>`;
    const body = parseBody(marker("block", "block-1", "fallback"));

    const result = normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "block-1",
        kind: "block",
        sourceSpan: { startOffset: 0, endOffset: source.length },
      },
    ]);

    const table = body.querySelector("table");
    expect(result).toMatchObject({
      passedCount: 1,
      escapedCount: 0,
      rejectedCount: 0,
    });
    expect(result.blockRootElements).toEqual(new Set([table as Element]));
    expect(table?.classList.contains("markdown-safe-html-block")).toBe(true);
    expect(table?.getAttribute("class")).toBe("markdown-safe-html-block");
    expect(table?.querySelector("th")?.getAttribute("scope")).toBe("col");
    expect(table?.querySelector("td")?.getAttribute("colspan")).toBe("2");
    expect(table?.querySelector("kbd")?.textContent).toBe("B");
    expect(result.sourceActionExcludedElements.has(table as Element)).toBe(
      true,
    );
    expect(body.querySelector(markerSelector)).toBeNull();
  });

  it("constructs allowed nested elements and normalized attributes without an HTML sink", () => {
    const source =
      '<AbBr TITLE="term" onclick="alert(1)"><mark>API</mark></AbBr>';
    const body = parseBody(marker("inline", "safe-1", "fallback"));

    const result = normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "safe-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: source.length },
      },
    ]);

    expect(result.passedCount).toBe(1);
    expect(body.querySelector("abbr")?.getAttributeNames()).toEqual(["title"]);
    expect(body.querySelector("abbr")?.title).toBe("term");
    expect(body.querySelector("mark")?.textContent).toBe("API");
    expect(body.innerHTML).not.toContain("onclick");
  });

  it("restores valid inline and block fragments from the authoritative source", () => {
    const inline = "<kbd>Ctrl</kbd>";
    const block = "<section>Block</section>";
    const source = `Before ${inline} after.\r\n\r\n${block}`;
    const body = parseBody(
      `<p>Before ${marker("inline", "markdown-author-html-1", "tampered inline")} after.</p>${marker("block", "markdown-author-html-2", "tampered block")}`,
    );
    const fragments: MarkdownAuthorHtmlFragment[] = [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: sourceSpan(source, inline),
      },
      {
        id: "markdown-author-html-2",
        kind: "block",
        sourceSpan: sourceSpan(source, block),
      },
    ];

    normalizeMarkdownAuthorHtmlInPlace(body, source, fragments);

    expect(body.querySelector(markerSelector)).toBeNull();
    expect(body.querySelector("kbd")?.textContent).toBe("Ctrl");
    expect(body.querySelector("section")).toBeNull();
    expect(body.textContent).toContain("Before Ctrl after.");
    expect(body.textContent).toContain(block);
    expect(body.innerHTML).toContain("&lt;section&gt;Block&lt;/section&gt;");
    expect(body.textContent).not.toContain("tampered");
  });

  it("accepts adjacent source spans without merging their identities", () => {
    const first = "<i>A</i>";
    const second = "<b>B</b>";
    const source = `${first}${second}`;
    const body = parseBody(
      `${marker("inline", "markdown-author-html-1", "first fallback")}${marker("inline", "markdown-author-html-2", "second fallback")}`,
    );
    const fragments: MarkdownAuthorHtmlFragment[] = [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: first.length },
      },
      {
        id: "markdown-author-html-2",
        kind: "inline",
        sourceSpan: { startOffset: first.length, endOffset: source.length },
      },
    ];

    normalizeMarkdownAuthorHtmlInPlace(body, source, fragments);

    expect(body.querySelector(markerSelector)).toBeNull();
    expect(body.textContent).toBe(source);
    expect(body.querySelector("i, b")).toBeNull();
  });

  it("uses UTF-16 offsets across emoji and CRLF boundaries", () => {
    const rawHtml = "<span>日本語</span>";
    const source = `😀\r\n${rawHtml}\r\nAfter`;
    const span = sourceSpan(source, rawHtml);
    const body = parseBody(
      marker("inline", "markdown-author-html-1", "fallback"),
    );

    expect(span.startOffset).toBe(4);
    normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: span,
      },
    ]);

    expect(body.textContent).toBe(rawHtml);
    expect(body.querySelector("span")).toBeNull();
  });

  it.each([
    {
      name: "negative",
      sourceSpan: { startOffset: -1, endOffset: 4 },
    },
    {
      name: "floating point",
      sourceSpan: { startOffset: 2.5, endOffset: 8 },
    },
    {
      name: "empty",
      sourceSpan: { startOffset: 2, endOffset: 2 },
    },
    {
      name: "reversed",
      sourceSpan: { startOffset: 8, endOffset: 2 },
    },
    {
      name: "out of range",
      sourceSpan: { startOffset: 2, endOffset: 100 },
    },
    {
      name: "half-surrogate start",
      sourceSpan: { startOffset: 1, endOffset: 10 },
    },
    {
      name: "half-surrogate end",
      sourceSpan: { startOffset: 0, endOffset: 1 },
    },
  ])("textifies a marker with a $name source span", ({ sourceSpan }) => {
    const source = "😀<i>A</i>";
    const body = parseBody(
      marker("inline", "markdown-author-html-1", "invalid fallback"),
    );

    normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan,
      },
    ]);

    expect(body.querySelector(markerSelector)).toBeNull();
    expect(body.textContent).toBe("invalid fallback");
  });

  it("rejects overlapping fragment spans as one ambiguous set", () => {
    const source = "<i>A</i><b>B</b>";
    const body = parseBody(
      `${marker("inline", "markdown-author-html-1", "first fallback")}${marker("inline", "markdown-author-html-2", "second fallback")}`,
    );

    normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: 12 },
      },
      {
        id: "markdown-author-html-2",
        kind: "inline",
        sourceSpan: { startOffset: 8, endOffset: source.length },
      },
    ]);

    expect(body.querySelector(markerSelector)).toBeNull();
    expect(body.textContent).toBe("first fallbacksecond fallback");
  });

  it("ignores fragment metadata with no corresponding marker", () => {
    const body = parseBody("<p>unchanged</p>");

    normalizeMarkdownAuthorHtmlInPlace(body, "<b>source</b>", [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: 13 },
      },
    ]);

    expect(body.innerHTML).toBe("<p>unchanged</p>");
  });

  it.each([
    {
      name: "missing identity",
      html: "<svard-markdown-author-html-inline>missing identity</svard-markdown-author-html-inline>",
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "missing identity",
    },
    {
      name: "unknown identity",
      html: marker("inline", "unknown", "unknown identity"),
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "unknown identity",
    },
    {
      name: "empty identity",
      html: marker("inline", "", "empty identity"),
      fragments: [
        {
          id: "",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "empty identity",
    },
    {
      name: "duplicate marker identity",
      html: `${marker("inline", "markdown-author-html-1", "first")}${marker("inline", "markdown-author-html-1", "second")}`,
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "firstsecond",
    },
    {
      name: "duplicate fragment identity",
      html: marker("inline", "markdown-author-html-1", "duplicate fragment"),
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 8, endOffset: 16 },
        },
      ],
      expectedText: "duplicate fragment",
    },
    {
      name: "kind mismatch",
      html: marker("block", "markdown-author-html-1", "kind mismatch"),
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "kind mismatch",
    },
    {
      name: "extra marker attribute",
      html: marker(
        "inline",
        "markdown-author-html-1",
        "extra attribute",
        ' class="forged"',
      ),
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "extra attribute",
    },
    {
      name: "element child",
      html: marker(
        "inline",
        "markdown-author-html-1",
        "<strong>element child</strong>",
      ),
      fragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline" as const,
          sourceSpan: { startOffset: 0, endOffset: 8 },
        },
      ],
      expectedText: "element child",
    },
  ])("textifies a marker with $name", ({ html, fragments, expectedText }) => {
    const body = parseBody(html);

    normalizeMarkdownAuthorHtmlInPlace(body, "<i>A</i><b>B</b>", fragments);

    expect(body.querySelector(markerSelector)).toBeNull();
    expect(body.querySelector("strong")).toBeNull();
    expect(body.textContent).toBe(expectedText);
  });

  it("rejects valid identities whose DOM order disagrees with source order", () => {
    const source = "<i>A</i><b>B</b>";
    const body = parseBody(
      `${marker("inline", "markdown-author-html-2", "second fallback")}${marker("inline", "markdown-author-html-1", "first fallback")}`,
    );

    normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: 8 },
      },
      {
        id: "markdown-author-html-2",
        kind: "inline",
        sourceSpan: { startOffset: 8, endOffset: source.length },
      },
    ]);

    expect(body.querySelector(markerSelector)).toBeNull();
    expect(body.textContent).toBe("second fallbackfirst fallback");
  });

  it("rejects all markers when one marker fails integrity validation", () => {
    const source = "<kbd>Safe</kbd><mark>Second</mark>";
    const body = parseBody(
      `${marker("inline", "safe", "safe fallback")}${marker("inline", "unknown", "unknown fallback")}`,
    );

    const result = normalizeMarkdownAuthorHtmlInPlace(body, source, [
      {
        id: "safe",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: 16 },
      },
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        passedCount: 0,
        escapedCount: 0,
        rejectedCount: 2,
      }),
    );
    expect(body.querySelector("kbd,mark")).toBeNull();
    expect(body.textContent).toBe("safe fallbackunknown fallback");
  });

  it("textifies an identity attribute attached to an unknown marker element", () => {
    const body = parseBody(
      '<a href="./next.md" data-svard-markdown-author-html-id="markdown-author-html-1">forged marker</a>',
    );

    normalizeMarkdownAuthorHtmlInPlace(body, "<i>A</i>", [
      {
        id: "markdown-author-html-1",
        kind: "inline",
        sourceSpan: { startOffset: 0, endOffset: 8 },
      },
    ]);

    expect(body.querySelector("a")).toBeNull();
    expect(body.textContent).toBe("forged marker");
  });
});
