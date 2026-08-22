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
    expect(body.querySelector("kbd, section")).toBeNull();
    expect(body.textContent).toContain(`Before ${inline} after.`);
    expect(body.textContent).toContain(block);
    expect(body.innerHTML).toContain("&lt;kbd&gt;Ctrl&lt;/kbd&gt;");
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
