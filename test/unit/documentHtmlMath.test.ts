import { describe, expect, it } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { documentPayload, renderResult } from "./helpers/documentHtml";

describe("prepareDocumentHtml", () => {
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
      doc
        .querySelector(".math-inline .katex")
        ?.getAttribute("data-math-source"),
    ).toBe("E = mc^2");
    expect(
      doc
        .querySelector(".math-inline .katex")
        ?.getAttribute("data-math-display"),
    ).toBe("inline");
    expect(
      doc.querySelector('[data-review-id="math-block"] .katex'),
    ).toBeTruthy();
    expect(
      doc
        .querySelector('[data-review-id="math-block"] .katex')
        ?.getAttribute("data-math-source"),
    ).toContain("\\begin{bmatrix}");
    expect(
      doc
        .querySelector('[data-review-id="math-block"] .katex')
        ?.getAttribute("data-math-display"),
    ).toBe("block");
    expect(
      doc.querySelector('[data-review-id="math-block"]')?.textContent,
    ).not.toContain("$");
    expect(
      doc.querySelector('[data-review-id="math-block"] [style]'),
    ).toBeTruthy();
    const matrix = doc.querySelector('[data-review-id="math-block"] .mtable');
    const matrixColumns = Array.from(
      matrix?.querySelectorAll(":scope > .col-align-c") ?? [],
    );
    expect(matrixColumns).toHaveLength(2);
    expect(
      matrixColumns.map((column) =>
        Array.from(
          column.querySelectorAll(
            ":scope > .vlist-t > .vlist-r > .vlist > span",
          ),
        )
          .map((row) => row.textContent?.trim())
          .filter(Boolean),
      ),
    ).toEqual([
      ["1", "3"],
      ["2", "4"],
    ]);
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
      doc
        .querySelector(".math-inline .katex")
        ?.getAttribute("data-math-source"),
    ).toBe("a + b = c");
    expect(
      doc
        .querySelector(".math-inline .katex")
        ?.getAttribute("data-math-display"),
    ).toBe("inline");
    expect(
      doc.querySelector('[data-review-id="math-block"] .katex'),
    ).toBeTruthy();
    expect(
      doc
        .querySelector('[data-review-id="math-block"] .katex')
        ?.getAttribute("data-math-source"),
    ).toBe("\\int_0^1 x^2 dx = \\frac{1}{3}");
    expect(
      doc
        .querySelector('[data-review-id="math-block"] .katex')
        ?.getAttribute("data-math-display"),
    ).toBe("block");
    expect(
      doc.querySelector('[data-review-id="math-block"] [style]'),
    ).toBeTruthy();
    expect(doc.querySelector("pre")?.textContent).toContain(
      "$not rendered in source$",
    );
  });

  it("preserves pipe math and source metadata after sanitization and rerendering", async () => {
    const result =
      renderMarkdownCore(String.raw`距離は$\Delta=|n-m|$、確率は$P(A|B)$です。

| Kind | Value |
| --- | --- |
| Named | $\lvert x\rvert$ |
| Escaped | $\|x\|$ |
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
    const math = Array.from(doc.querySelectorAll(".math-inline .katex"));

    expect(math).toHaveLength(4);
    expect(
      math.map((element) => element.getAttribute("data-math-source")),
    ).toEqual([
      String.raw`\Delta=|n-m|`,
      "P(A|B)",
      String.raw`\lvert x\rvert`,
      "|x|",
    ]);
    expect(
      math.every(
        (element) => element.getAttribute("data-math-display") === "inline",
      ),
    ).toBe(true);
    expect(doc.querySelectorAll("table .math-inline .katex")).toHaveLength(2);
    expect(doc.querySelector(".math-render-error")).toBeNull();
    expect(doc.body.textContent).not.toContain("$");
  });

  it("preserves numeric table math after document sanitization", async () => {
    const result = renderMarkdownCore(`| Before | After |
| --- | --- |
| $1$ | $1 / \\sqrt{3}$ |
| $0.5774$ | $2$ |
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

    expect(doc.querySelectorAll("table .math-inline .katex")).toHaveLength(4);
    expect(doc.querySelector('table [data-math-source="1"]')).toBeTruthy();
    expect(doc.querySelector('table [data-math-source="0.5774"]')).toBeTruthy();
    expect(doc.querySelector("table")?.textContent).not.toContain("$1$");
  });

  it("preserves ASCII-label-adjacent variable math after sanitization", async () => {
    const result = renderMarkdownCore(
      "位置$i$、語彙ID$v$の値をAPI$x$を使って計算する。",
    );
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

    expect(doc.querySelectorAll(".math-inline .katex")).toHaveLength(3);
    expect(doc.querySelector('[data-math-source="v"]')).toBeTruthy();
    expect(doc.querySelector('[data-math-source="x"]')).toBeTruthy();
    expect(doc.body.textContent).not.toContain("ID$v$の");
    expect(doc.body.textContent).not.toContain("API$x$を");
  });
});
