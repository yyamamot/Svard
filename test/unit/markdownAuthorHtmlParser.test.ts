import { describe, expect, it } from "vitest";

import {
  MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES,
  MAX_MARKDOWN_AUTHOR_HTML_NESTING,
  parseMarkdownAuthorContainerOpeningTag,
  parseMarkdownAuthorHtmlFragment,
} from "../../src/core/markdown/authorHtml";
import {
  MARKDOWN_AUTHOR_HTML_INTEGRITY_ERROR,
  MarkdownAuthorHtmlRegistry,
  scanMarkdownAuthorHtml,
} from "../../src/core/markdown/authorHtmlRuntime";
import { MARKDOWN_RENDER_BUDGET_ERROR } from "../../src/core/markdown/placeholders";
import { afterEach, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("parseMarkdownAuthorHtmlFragment", () => {
  it.each([
    "<br>",
    "<br />",
    "<kbd>Ctrl</kbd>",
    "<sub>2</sub>",
    "<sup>2</sup>",
    "<mark>marked</mark>",
    "<ins>inserted</ins>",
    "<s>struck</s>",
    "<del>deleted</del>",
    "<small>small</small>",
    '<abbr title="HyperText &amp; Markdown">HTML</abbr>',
    "<ruby>漢<rp>(</rp><rt>かん</rt><rp>)</rp></ruby>",
  ])("accepts resource-free inline HTML: %s", (source) => {
    const result = parseMarkdownAuthorHtmlFragment(source);
    expect(result.status).toBe("pass");
  });

  it("normalizes tag and attribute names, decodes entities, and preserves relative spans", () => {
    const source = '<ABBR TITLE="A &amp; B" class="discard">x &lt; y</ABBR>';
    const result = parseMarkdownAuthorHtmlFragment(source);

    expect(result).toEqual({
      status: "pass",
      elementCount: 1,
      visibleText: "x < y",
      nodes: [
        {
          type: "element",
          tagName: "abbr",
          attributes: { title: "A & B" },
          sourceSpan: { startOffset: 0, endOffset: source.length },
          children: [
            {
              type: "text",
              value: "x < y",
              sourceSpan: {
                startOffset: source.indexOf("x"),
                endOffset: source.indexOf("</ABBR>"),
              },
            },
          ],
        },
      ],
    });
  });

  it("treats Markdown syntax and backslashes inside the fragment as text", () => {
    const result = parseMarkdownAuthorHtmlFragment(
      String.raw`<kbd>**bold** \*literal\* &amp;</kbd>`,
    );
    expect(result.status).toBe("pass");
    if (result.status === "pass") {
      expect(result.visibleText).toBe(String.raw`**bold** \*literal\* &`);
    }
  });

  it("allows ordinary nesting and enforces the ruby child grammar", () => {
    expect(
      parseMarkdownAuthorHtmlFragment("<kbd><mark>Ctrl</mark></kbd>").status,
    ).toBe("pass");
    expect(parseMarkdownAuthorHtmlFragment("<rt>かん</rt>").status).toBe(
      "escape",
    );
    expect(
      parseMarkdownAuthorHtmlFragment("<ruby><ruby>x</ruby></ruby>").status,
    ).toBe("escape");
    expect(
      parseMarkdownAuthorHtmlFragment("<ruby><rt><rp>x</rp></rt></ruby>")
        .status,
    ).toBe("escape");
  });

  it("accepts the maximum nesting depth and rejects one level beyond it", () => {
    const atLimit = `${"<kbd>".repeat(MAX_MARKDOWN_AUTHOR_HTML_NESTING)}x${"</kbd>".repeat(MAX_MARKDOWN_AUTHOR_HTML_NESTING)}`;
    const beyondLimit = `<kbd>${atLimit}</kbd>`;
    expect(parseMarkdownAuthorHtmlFragment(atLimit).status).toBe("pass");
    expect(parseMarkdownAuthorHtmlFragment(beyondLimit).status).toBe("escape");
  });

  it("accepts an abbr title at the UTF-8 byte limit and rejects one byte over", () => {
    const atLimit = "a".repeat(MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES);
    const overLimit = `${atLimit}a`;
    expect(
      parseMarkdownAuthorHtmlFragment(`<abbr title="${atLimit}">x</abbr>`)
        .status,
    ).toBe("pass");
    expect(
      parseMarkdownAuthorHtmlFragment(`<abbr title="${overLimit}">x</abbr>`)
        .status,
    ).toBe("escape");
  });

  it.each([
    "<kbd>x</kbd><mark>y</mark>",
    "<kbd>x",
    "<kbd><mark>x</kbd></mark>",
    "<kbd />",
    "<br></br>",
    "<div><kbd>x</kbd></div>",
    "<script>x</script>",
    '<abbr title="a" TITLE="b">x</abbr>',
    '<abbr title="unterminated>x</abbr>',
    "<kbd>x\ny</kbd>",
  ])("escapes malformed, unsupported, or ambiguous input: %s", (source) => {
    expect(parseMarkdownAuthorHtmlFragment(source)).toEqual({
      status: "escape",
    });
  });
});

describe("parseMarkdownAuthorContainerOpeningTag", () => {
  it("keeps only the details open boolean and accepts removable attributes", () => {
    const details = '<DETAILS class="x" OPEN data-private="y" onclick="z">';
    const summary = '<SUMMARY class="x">';
    expect(parseMarkdownAuthorContainerOpeningTag(details, "details")).toEqual({
      endOffset: details.length,
      open: true,
    });
    expect(parseMarkdownAuthorContainerOpeningTag(summary, "summary")).toEqual({
      endOffset: summary.length,
      open: false,
    });
  });

  it("rejects duplicate attributes, broken quotes, and self-closing containers", () => {
    expect(
      parseMarkdownAuthorContainerOpeningTag(
        '<details open OPEN="x">',
        "details",
      ),
    ).toBeNull();
    expect(
      parseMarkdownAuthorContainerOpeningTag(
        '<summary class="broken>',
        "summary",
      ),
    ).toBeNull();
    expect(
      parseMarkdownAuthorContainerOpeningTag("<details/>", "details"),
    ).toBeNull();
  });
});

describe("MarkdownAuthorHtmlRegistry and scanner", () => {
  it("scans inline fragments linearly while skipping code, fences, escaped tags, and frontmatter-sized prefixes", () => {
    const source = `Text <kbd>Ctrl</kbd> and \`<mark>code</mark>\`.
\\<sub>escaped</sub>
\`\`\`
<sup>fenced</sup>
\`\`\``;
    const registry = new MarkdownAuthorHtmlRegistry(
      `---\nx: y\n---\n${source}`,
    );
    const result = scanMarkdownAuthorHtml(source, 13, registry);

    expect(result.count).toBe(1);
    expect(result.source).toContain("SVARD_MARKDOWN_AUTHOR_HTML");
    expect(result.source).toContain("<mark>code</mark>");
    expect(result.source).toContain("<sup>fenced</sup>");
    expect(registry.fragments()[0].sourceSpan).toEqual({
      startOffset: 18,
      endOffset: 33,
    });
  });

  it("shields unsupported and malformed outer fragments from partial activation", () => {
    const source = "<div><kbd>blocked</kbd></div> <kbd>pass</kbd> <mark>broken";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(1);
    expect(result.source).toContain("<div><kbd>blocked</kbd></div>");
    expect(result.source).toContain("<mark>broken");
  });

  it("drops standalone multiline comments without dropping inline comments", () => {
    const source = "Before\n<!--\nhidden\n-->\nInline <!-- keep --> text";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.source).toBe("Before\n\n\n\nInline <!-- keep --> text");
  });

  it("shields complete inline comments from partial safe HTML activation", () => {
    const source =
      "<kbd>before</kbd> <!-- <mark>blocked</mark> --> <sup>after</sup>";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(2);
    expect(result.source).toContain("<!-- <mark>blocked</mark> -->");
    expect(
      registry
        .fragments()
        .map(({ sourceSpan }) =>
          source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
        ),
    ).toEqual(["<kbd>before</kbd>", "<sup>after</sup>"]);
  });

  it("keeps multiline and unclosed inline comments literal while resuming after a close", () => {
    const source = `Before <!--
<kbd>blocked</kbd>
--> <mark>after</mark>
Tail <!-- <sup>still blocked</sup>`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(1);
    expect(result.source).toContain("<kbd>blocked</kbd>");
    expect(result.source).toContain("<!-- <sup>still blocked</sup>");
    expect(
      registry
        .fragments()
        .map(({ sourceSpan }) =>
          source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
        ),
    ).toEqual(["<mark>after</mark>"]);
  });

  it("keeps an unclosed standalone comment literal through end of input", () => {
    const source = "Before\n<!--\nunclosed <kbd>literal</kbd>";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.source).toBe(source);
    expect(result.count).toBe(0);
  });

  it("does not partially activate an inner allowlisted tag after mismatched malformed markup", () => {
    const source = "<kbd><mark>blocked</kbd></mark> <sup>also blocked</sup>";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.source).toBe(source);
    expect(result.count).toBe(0);
  });

  it("keeps shorter and different fence runs inside the original fence", () => {
    const source = `\`\`\`\`html
\`\`\`not-a-close
<kbd>blocked</kbd>
~~~~
<mark>also blocked</mark>
\`\`\`\`
<sup>after</sup>`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(1);
    expect(result.source).toContain("<kbd>blocked</kbd>");
    expect(result.source).toContain("<mark>also blocked</mark>");
    expect(
      registry
        .fragments()
        .map(({ sourceSpan }) =>
          source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
        ),
    ).toEqual(["<sup>after</sup>"]);
  });

  it("accepts an equally long or longer matching fence close with at most three spaces", () => {
    const source = `   ~~~ info
<kbd>blocked</kbd>
  ~~~~
<mark>after</mark>`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(1);
    expect(
      registry
        .fragments()
        .map(({ sourceSpan }) =>
          source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
        ),
    ).toEqual(["<mark>after</mark>"]);
  });

  it("does not treat a four-space-indented marker as a fence opener", () => {
    const source = "    ~~~ not-a-fence\n<kbd>ordinary</kbd>";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(1);
    expect(
      registry
        .fragments()
        .map(({ sourceSpan }) =>
          source.slice(sourceSpan.startOffset, sourceSpan.endOffset),
        ),
    ).toEqual(["<kbd>ordinary</kbd>"]);
  });

  it("retries a source-colliding crypto nonce and produces nonce plus sequence identities", () => {
    let call = 0;
    vi.stubGlobal("crypto", {
      getRandomValues(bytes: Uint8Array) {
        bytes.fill(call++ === 0 ? 0xaa : 0xbb);
        return bytes;
      },
    });
    const collision = "aa".repeat(16);
    const source = `<SVARD_MARKDOWN_AUTHOR_HTML_${collision}_9>\n<kbd>x</kbd>`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    scanMarkdownAuthorHtml(source, 0, registry);

    expect(registry.fragments()[0].id).toMatch(/^b{32}-1$/u);
  });

  it("fails closed when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const source = "<kbd>x</kbd>";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    expect(() => scanMarkdownAuthorHtml(source, 0, registry)).toThrow(
      MARKDOWN_AUTHOR_HTML_INTEGRITY_ERROR,
    );
  });

  it("rejects a registry record whose source span does not match the original source", () => {
    const source = "<kbd>x</kbd>";
    const parsed = parseMarkdownAuthorHtmlFragment(source);
    expect(parsed.status).toBe("pass");
    if (parsed.status !== "pass") return;

    const registry = new MarkdownAuthorHtmlRegistry(source);
    expect(() =>
      registry.add(
        "<kbd>y</kbd>",
        { startOffset: 0, endOffset: source.length },
        parsed,
      ),
    ).toThrow(MARKDOWN_AUTHOR_HTML_INTEGRITY_ERROR);
    expect(() =>
      registry.add(
        source,
        { startOffset: 0, endOffset: source.length + 1 },
        parsed,
      ),
    ).toThrow(MARKDOWN_AUTHOR_HTML_INTEGRITY_ERROR);
  });

  it("accepts the exact combined fragment and element budget", () => {
    const source = Array.from({ length: 2_048 }, () => "<kbd>x</kbd>").join(
      " ",
    );
    const registry = new MarkdownAuthorHtmlRegistry(source);
    expect(scanMarkdownAuthorHtml(source, 0, registry).count).toBe(2_048);
  });

  it("rejects one item beyond the combined fragment and element budget", () => {
    const source = Array.from({ length: 2_049 }, () => "<kbd>x</kbd>").join(
      " ",
    );
    const registry = new MarkdownAuthorHtmlRegistry(source);
    expect(() => scanMarkdownAuthorHtml(source, 0, registry)).toThrow(
      MARKDOWN_RENDER_BUDGET_ERROR,
    );
  });
});
