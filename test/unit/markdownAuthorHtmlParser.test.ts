import { describe, expect, it } from "vitest";

import {
  MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES,
  MAX_MARKDOWN_AUTHOR_HTML_NESTING,
  MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_TEXT_BYTES,
  MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_URL_BYTES,
  parseMarkdownAuthorContainerOpeningTag,
  parseMarkdownAuthorHtmlBlockFragment,
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

  it("parses links, images, and linked images without putting URLs in attributes", () => {
    const source =
      '<A href="./Guide%20File.md" title="Guide" class="discard"><IMG src="./logo.svg" alt="Logo &amp; mark" width="64" height="32" align="RIGHT" data-x="discard"></A>';
    const result = parseMarkdownAuthorHtmlFragment(source);

    expect(result.status).toBe("pass");
    if (result.status !== "pass") return;
    expect(result.visibleText).toBe("Logo & mark");
    expect(result.nodes).toEqual([
      expect.objectContaining({
        tagName: "a",
        attributes: { title: "Guide" },
        resource: { kind: "link", value: "./Guide%20File.md" },
        children: [
          expect.objectContaining({
            tagName: "img",
            attributes: {
              alt: "Logo & mark",
              width: "64",
              height: "32",
              align: "right",
            },
            resource: { kind: "image", value: "./logo.svg" },
          }),
        ],
      }),
    ]);
  });

  it("enforces resource URL, text, and dimension boundaries", () => {
    const urlAtLimit = `./${"a".repeat(MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_URL_BYTES - 2)}`;
    const textAtLimit = "a".repeat(
      MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_TEXT_BYTES,
    );
    expect(
      parseMarkdownAuthorHtmlFragment(
        `<img src="${urlAtLimit}" alt="${textAtLimit}" width="1" height="4096">`,
      ).status,
    ).toBe("pass");
    expect(
      parseMarkdownAuthorHtmlFragment(`<img src="${urlAtLimit}a" alt="x">`)
        .status,
    ).toBe("escape");
    expect(
      parseMarkdownAuthorHtmlFragment(`<img src="./x" alt="${textAtLimit}a">`)
        .status,
    ).toBe("escape");
    expect(
      parseMarkdownAuthorHtmlFragment('<img src="./x" width="0">').status,
    ).toBe("escape");
    expect(
      parseMarkdownAuthorHtmlFragment('<img src="./x" height="4097">').status,
    ).toBe("escape");
  });

  it.each([
    "<a>missing</a>",
    '<img alt="missing source">',
    '<a href="./one"><a href="./two">nested</a></a>',
    '<img src="./x"></img>',
    '<img src="./x">child',
    '<a href="./one" HREF="./two">duplicate</a>',
    '<img src="./x" width="broken">',
  ])("escapes invalid resource element syntax: %s", (source) => {
    expect(parseMarkdownAuthorHtmlFragment(source).status).toBe("escape");
  });

  it("does not partially activate an image with an invalid closing tag", () => {
    const source = '<img src="./x">child</img>';
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const scanned = scanMarkdownAuthorHtml(source, 0, registry);

    expect(scanned.source).toBe(source);
    expect(registry.fragments()).toEqual([]);
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

describe("parseMarkdownAuthorHtmlBlockFragment", () => {
  it.each([
    "<p>Text <kbd>Ctrl</kbd></p>",
    '<div align="CENTER"><blockquote>Quote</blockquote></div>',
    '<ol start="+02" reversed type="I"><li value="-3">Item</li></ol>',
    "<dl><dt>Term</dt><dd><p>Definition</p></dd></dl>",
    "<hr>",
    `<table><caption>Caption</caption><colgroup><col span="2"></colgroup><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td rowspan="2">B</td></tr></tbody><tfoot><tr><td>C</td></tr></tfoot></table>`,
  ])("accepts strict resource-free block HTML: %s", (source) => {
    expect(parseMarkdownAuthorHtmlBlockFragment(source).status).toBe("pass");
  });

  it("normalizes typed attributes and removes unknown attributes", () => {
    const result = parseMarkdownAuthorHtmlBlockFragment(
      '<OL START="+02" REVERSED="false" TYPE="A" class="discard"><LI VALUE="-03">x</LI></OL>',
    );
    expect(result.status).toBe("pass");
    if (result.status !== "pass" || result.nodes[0].type !== "element") return;
    expect(result.nodes[0].attributes).toEqual({
      start: "2",
      reversed: "",
      type: "A",
    });
    const item = result.nodes[0].children.find(
      (node) => node.type === "element",
    );
    expect(item?.type === "element" ? item.attributes : {}).toEqual({
      value: "-3",
    });
  });

  it.each([
    "<li>orphan</li>",
    "<div>a</div><p>b</p>",
    "<p><div>invalid</div></p>",
    "<ul><p>invalid</p></ul>",
    "<dl><dt>missing description</dt></dl>",
    "<dl><dt>one</dt><dt>two</dt><dd>description</dd></dl>",
    "<table><tr><td>x</td></tr><tbody><tr><td>mixed</td></tr></tbody></table>",
    "<table><tbody><tr><td><table><tr><td>nested</td></tr></table></td></tr></tbody></table>",
    '<table><tbody><tr><td colspan="101">x</td></tr></tbody></table>',
    '<ol type="z"><li>x</li></ol>',
    '<div align="sideways">x</div>',
    '<div class="a" CLASS="b">x</div>',
    '<div\nclass="x">x</div>',
  ])("escapes invalid block grammar: %s", (source) => {
    expect(parseMarkdownAuthorHtmlBlockFragment(source)).toEqual({
      status: "escape",
    });
  });

  it("accepts one or more descriptions after every definition term", () => {
    expect(
      parseMarkdownAuthorHtmlBlockFragment(
        "<dl><dt>one</dt><dd>first</dd><dd>second</dd><dt>two</dt><dd>third</dd></dl>",
      ).status,
    ).toBe("pass");
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
  it("scans a multiline block into one block marker while preserving line count", () => {
    const source = `Before

  <div class="discard">
<p>Text <kbd>Ctrl</kbd></p>
</div>

After`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(1);
    expect(result.source.split("\n")).toHaveLength(source.split("\n").length);
    expect(result.source).toContain("SVARD_MARKDOWN_AUTHOR_HTML");
    expect(registry.fragments()).toMatchObject([
      {
        kind: "block",
        sourceSpan: {
          startOffset: source.indexOf("<div"),
          endOffset: source.indexOf("</div>") + "</div>".length,
        },
      },
    ]);
    expect(registry.blockLineRanges()).toEqual([{ startLine: 3, endLine: 5 }]);
  });

  it("keeps CRLF and emoji UTF-16 offsets exact for block spans", () => {
    const block = "<div>\r\n<p>😀</p>\r\n</div>";
    const source = `😀 prefix\r\n${block}\r\nAfter`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    scanMarkdownAuthorHtml(source, 0, registry);

    expect(registry.fragments()).toMatchObject([
      {
        kind: "block",
        sourceSpan: {
          startOffset: source.indexOf(block),
          endOffset: source.indexOf(block) + block.length,
        },
      },
    ]);
  });

  it("keeps inline-position block tags and invalid or unsupported blocks literal", () => {
    const source = `Text <div><kbd>inline</kbd></div>

<table><div><kbd>invalid</kbd></div></table>

<script>
<mark>blocked</mark>
</script>`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result.count).toBe(0);
    expect(result.source).toBe(source);
  });

  it("scans many independent unsupported one-line roots without rebuilding document suffixes", () => {
    const source = Array.from(
      { length: 16_000 },
      (_, index) => `<x>${index}</x>`,
    ).join("\n");
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const startedAt = performance.now();
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(performance.now() - startedAt).toBeLessThan(1_500);
    expect(result).toEqual({ count: 0, source });
  });

  it("bounds repeated malformed root and opening-tag scans", () => {
    const source = Array.from({ length: 16_000 }, (_, index) =>
      index % 2 === 0 ? "<x>" : '<div title="unterminated',
    ).join("\n\n");
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const startedAt = performance.now();
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(performance.now() - startedAt).toBeLessThan(1_500);
    expect(result).toEqual({ count: 0, source });
  });

  it("shields an unsupported outer root across blank lines", () => {
    const source = "<script>\n\n<kbd>blocked</kbd>\n</script>";
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result).toEqual({ count: 0, source });
  });

  it("bounds a deeply nested unsupported root on one line", () => {
    const source = `${"<x>".repeat(16_000)}content${"</x>".repeat(16_000)}`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const startedAt = performance.now();
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(performance.now() - startedAt).toBeLessThan(1_500);
    expect(result).toEqual({ count: 0, source });
  });

  it("preserves a deeply nested unsupported inline root after ordinary text", () => {
    const source = `prefix ${"<x>".repeat(MAX_MARKDOWN_AUTHOR_HTML_NESTING + 1)}content${"</x>".repeat(MAX_MARKDOWN_AUTHOR_HTML_NESTING + 1)} suffix`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result).toEqual({ count: 0, source });
  });

  it("fails closed for discovery work beyond the typed nesting budget", () => {
    const source = `<div>${"<x>".repeat(MAX_MARKDOWN_AUTHOR_HTML_NESTING + 1)}

<kbd>must remain literal</kbd>
${"</x>".repeat(MAX_MARKDOWN_AUTHOR_HTML_NESTING + 1)}</div>`;
    const registry = new MarkdownAuthorHtmlRegistry(source);
    const result = scanMarkdownAuthorHtml(source, 0, registry);

    expect(result).toEqual({ count: 0, source });
  });

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

  it("applies the combined item budget to one block root and all descendants", () => {
    const atLimit = `<ul>${"<li>x</li>".repeat(4_094)}</ul>`;
    const registry = new MarkdownAuthorHtmlRegistry(atLimit);
    expect(scanMarkdownAuthorHtml(atLimit, 0, registry).count).toBe(1);

    const overLimit = `<ul>${"<li>x</li>".repeat(4_095)}</ul>`;
    expect(() =>
      scanMarkdownAuthorHtml(
        overLimit,
        0,
        new MarkdownAuthorHtmlRegistry(overLimit),
      ),
    ).toThrow(MARKDOWN_RENDER_BUDGET_ERROR);
  });
});
