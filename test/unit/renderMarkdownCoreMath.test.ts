import { afterEach, describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMarkdownCore", () => {
  it("renders inline and block math locally", () => {
    const result = renderMarkdownCore(`# Math

Inline $E = mc^2$ stays in prose.

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

\`\`\`tex
$not rendered in source$
\`\`\`
`);

    expect(result.html).toContain('class="math-inline"');
    expect(result.html).toContain('data-review-id="math-block"');
    expect(result.html).toContain("katex");
    expect(result.html).toContain("$not rendered in source$");
  });

  it("preserves Markdown matrix rows and columns", () => {
    const result = renderMarkdownCore(`# Matrix

$$
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
$$
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const matrix = doc.querySelector('[data-review-id="math-block"] .mtable');
    const columns = Array.from(
      matrix?.querySelectorAll(":scope > .col-align-c") ?? [],
    );

    expect(
      columns.map((column) =>
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
  });

  it("renders inline math adjacent to non-ASCII prose", () => {
    const result = renderMarkdownCore(`# Non-ASCII Math Boundaries

予測値と正解$t$の差を測る。

- $x$と$t$：学習データ
- 中文$x$内容
- 한국어$y$내용
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(5);
    expect(result.html.match(/data-math-source="t"/g)?.length).toBe(2);
    expect(result.html).not.toContain("$x$と$t$");
    expect(result.html).not.toContain("中文$x$内容");
    expect(result.html).not.toContain("한국어$y$내용");
  });

  it("keeps ASCII word adjacency and non-ASCII currency as text", () => {
    const result = renderMarkdownCore(`# Ambiguous Dollar Boundaries

ASCII identifiers stay readable: word$x$word and v2$x$.

Japanese currency stays readable: 日本語$5$です。
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("word$x$word");
    expect(result.html).toContain("v2$x$");
    expect(result.html).toContain("日本語$5$です");
  });

  it("renders variable math between an ASCII label and non-ASCII prose", () => {
    const result = renderMarkdownCore(`# ASCII Label Math Boundaries

位置$i$、語彙ID$v$の一つのロジットを計算する。

API$x$を使い、API$W_{\\mathrm{LM}}$、を射影に使う。
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(4);
    expect(result.html).toContain('data-math-source="v"');
    expect(result.html).toContain('data-math-source="x"');
    expect(result.html).toContain('data-math-source="W_{\\mathrm{LM}}"');
    expect(result.html).not.toContain("ID$v$の");
    expect(result.html).not.toContain("API$x$を");
  });

  it("keeps unsupported ASCII label boundaries and numeric prose as text", () => {
    const result = renderMarkdownCore(`# Unsupported ASCII Label Boundaries

ASCII identifiers stay readable: word$x$word and v2$x$.

End-of-line label math stays readable: ID$v$

Numeric prose stays readable: ID$5$です and 日本語$5$です。
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("word$x$word");
    expect(result.html).toContain("v2$x$.");
    expect(result.html).toContain("ID$v$");
    expect(result.html).toContain("ID$5$です");
    expect(result.html).toContain("日本語$5$です");
  });

  it("keeps invalid math after an ASCII label as text", () => {
    const result = renderMarkdownCore(
      "Invalid label math: ID$\\frac{1}{$の後。",
    );

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("ID$\\frac{1}{$の後");
  });

  it("renders boundary-delimited numeric inline math", () => {
    const result = renderMarkdownCore(`# Numeric Inline Math

Standalone values: $1$, $2$, and $0.5774$.

Japanese prose keeps embedded currency readable: 日本語$5$です。
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(3);
    expect(result.html).toContain('data-math-source="1"');
    expect(result.html).toContain('data-math-source="2"');
    expect(result.html).toContain('data-math-source="0.5774"');
    expect(result.html).toContain("日本語$5$です");
  });

  it("does not treat currency and escaped dollars as inline math", () => {
    const result = renderMarkdownCore(`# Math Edge Cases

Costs stay readable: $12.00, USD $5, and price is $5 and $6.

Escaped dollars stay readable: \\$escaped\\$.
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).toContain("$12.00");
    expect(result.html).toContain("USD $5");
    expect(result.html).toContain("price is $5 and $6");
    expect(result.html).toContain("$escaped$");
  });

  it("keeps code spans and fenced code out of Markdown math", () => {
    const result = renderMarkdownCore(`# Math Code Safety

Inline code keeps \`$not math$\` as source text.

\`\`\`tex
$not rendered in source$
$$
not rendered inside source
$$
\`\`\`
`);

    expect(result.html).not.toContain('class="math-inline"');
    expect(result.html).not.toContain('data-review-id="math-block"');
    expect(result.html).toContain("$not math$");
    expect(result.html).toContain("$not rendered in source$");
    expect(result.html).toContain("not rendered inside source");
  });

  it.each([
    [String.raw`距離は$\Delta=|n-m|$です。`, String.raw`\Delta=|n-m|`],
    ["絶対値$|x|$とします。", "|x|"],
    ["確率$P(A|B)$です。", "P(A|B)"],
    [String.raw`$\lvert x\rvert$`, String.raw`\lvert x\rvert`],
    [String.raw`$\|x\|$`, String.raw`\|x\|`],
    ["$cat | wc$", "cat | wc"],
    ["| Broken | $a | b$ |", "a | b"],
  ])("renders pipe math in prose: %s", (source, tex) => {
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const math = doc.querySelector(".math-inline");

    expect(doc.querySelectorAll(".math-inline .katex")).toHaveLength(1);
    expect(math?.getAttribute("data-math-source")).toBe(tex);
    expect(doc.querySelector(".math-render-error")).toBeNull();
    expect(doc.body.textContent).not.toContain("$");
  });

  it("keeps pipe math literal in code and escaped dollar text", () => {
    const source = [
      "`$|x|$`",
      "",
      "```tex",
      "$P(A|B)$",
      "```",
      "",
      String.raw`\$|x|\$`,
    ].join("\n");
    const result = renderMarkdownCore(source);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelector(".math-inline")).toBeNull();
    expect(doc.querySelector("p code")?.textContent).toBe("$|x|$");
    expect(doc.querySelector("pre code")?.textContent).toContain("$P(A|B)$");
    expect(doc.body.textContent).toContain("$|x|$");
  });

  it("uses the existing error fallback for invalid pipe math", () => {
    const result = renderMarkdownCore(String.raw`$\frac{|x|}{$`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");

    expect(doc.querySelector(".math-render-error")?.textContent).toBe(
      String.raw`\frac{|x|}{`,
    );
  });

  it("renders escaped and named table bars without joining cells", () => {
    const result = renderMarkdownCore(String.raw`| Item | Formula | Notes |
| --- | --- | --- |
| Named | $\lvert x\rvert$ | absolute value |
| Escaped | $\|x\|$ | Markdown escapes single bars |
| Broken | $a | b$ |
| Raw | $|x|$ | raw bars split cells |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const rows = Array.from(doc.querySelectorAll("tbody tr"));

    expect(rows.map((row) => row.querySelectorAll("td").length)).toEqual([
      3, 3, 3, 3,
    ]);
    expect(doc.querySelectorAll("table .math-inline .katex")).toHaveLength(2);
    expect(
      rows[0].querySelector(".math-inline")?.getAttribute("data-math-source"),
    ).toBe(String.raw`\lvert x\rvert`);
    expect(
      rows[1].querySelector(".math-inline")?.getAttribute("data-math-source"),
    ).toBe("|x|");
    expect(
      Array.from(rows[2].querySelectorAll("td"), (cell) => cell.textContent),
    ).toEqual(["Broken", "$a", "b$"]);
    expect(rows[3].querySelector(".math-inline")).toBeNull();
  });

  it("renders table cell math without matching across table pipes", () => {
    const result = renderMarkdownCore(`# Table Math

| Item | Formula | Notes |
| --- | --- | --- |
| Valid | $a + b$ | rendered in one cell |
| Broken | $a | b$ | pipe crossing stays text |
`);

    expect(result.html.match(/class="math-inline"/g)?.length).toBe(1);
    expect(result.html).toContain("$a");
    expect(result.html).toContain("b$");
  });

  it("renders numeric-only math in Markdown table cells", () => {
    const result = renderMarkdownCore(`# Numeric Table Math

| Query | Key | Before $R[i,j]$ | After $S[i,j]$ |
| --- | --- | --- | --- |
| Fish | Fish | $1$ | $1 / \\sqrt{3} \\approx 0.5774$ |
| Fish | Eats | $1$ | $1 / \\sqrt{3} \\approx 0.5774$ |
| Object | Object | $2$ | $2 / \\sqrt{3} \\approx 1.1547$ |
| Eats | Eats | $2$ | $2 / \\sqrt{3} \\approx 1.1547$ |
| Decimal | Decimal | $0.5774$ | $0.5774$ |
`);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    const table = doc.querySelector("table");

    expect(table?.querySelectorAll(".math-inline .katex")).toHaveLength(12);
    expect(table?.querySelectorAll('[data-math-source="1"]')).toHaveLength(2);
    expect(table?.querySelectorAll('[data-math-source="2"]')).toHaveLength(2);
    expect(table?.querySelectorAll('[data-math-source="0.5774"]')).toHaveLength(
      2,
    );
    expect(table?.textContent).not.toContain("$1$");
    expect(table?.textContent).not.toContain("$2$");
    expect(table?.textContent).not.toContain("$0.5774$");
  });

  it("keeps paragraph dollar pairs out of block math", () => {
    const result = renderMarkdownCore(`# Block Boundary

Paragraph $$x + y$$ stays paragraph text.

$$
x + y
$$ trailing text
`);

    expect(result.html).not.toContain('data-review-id="math-block"');
    expect(result.html).toContain("Paragraph $$x + y$$ stays paragraph text.");
    expect(result.html).toContain("trailing text");
  });

  it("renders invalid math fallback without stopping the document", () => {
    const result = renderMarkdownCore(`# Invalid Math

Invalid inline $\\frac{1}{$ keeps going after.

$$
\\frac{1}{
$$

After invalid block.
`);

    expect(result.html).toContain("math-render-error");
    expect(result.html).toContain("math-render-error-block");
    expect(result.html).toContain("keeps going after");
    expect(result.html).toContain("After invalid block.");
  });
});
