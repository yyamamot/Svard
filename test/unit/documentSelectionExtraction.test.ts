import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentPayload } from "../../src/core/types";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import {
  cloneViewerSelectionRange,
  extractDocumentSelection,
  selectionHasBlockingDiagnostic,
  selectionPlainCopy,
  selectionSnapshotText,
  selectionTextReference,
} from "../../src/ui/lib/documentSelection";

vi.mock("../../src/ui/lib/imageClipboard", () => ({
  selectionImageToPng: vi.fn(async () => {
    return new Blob(["png"], { type: "image/png" });
  }),
}));

const payload: DocumentPayload = {
  path: "/workspace/docs/guide.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "Before **important `code`** after.\n",
  updatedAt: "revision-1",
};

function select(
  start: Text,
  startOffset: number,
  end: Text,
  endOffset: number,
) {
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

describe("document selection extraction", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
  });

  it("keeps exact visible text while preserving inline semantics separately", async () => {
    document.body.innerHTML =
      '<article><p data-source-selection-block-id="p1">Before <strong>important <code>code</code></strong> after.</p></article>';
    const article = document.querySelector("article")!;
    const paragraph = article.querySelector("p")!;
    const start = paragraph.firstChild as Text;
    const end = paragraph.lastChild as Text;
    const range = select(start, 2, end, 4);

    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range,
      renderResult: {
        headings: [],
        sourceSelectionBlocks: [
          { id: "p1", kind: "paragraph", startLine: 1, endLine: 1 },
        ],
      },
      snapshotId: "selection-1",
    });

    expect(snapshot.plainText).toBe("fore important code aft");
    expect(snapshot.blocks).toEqual([
      {
        type: "prose",
        role: "paragraph",
        plainText: "fore important code aft",
        markdown: "fore **important `code`** aft",
      },
    ]);
    expect(selectionHasBlockingDiagnostic(snapshot)).toBe(false);
    expect(snapshot.provenance).toEqual([
      {
        sourcePath: payload.path,
        startLine: 1,
        endLine: 1,
        startOffset: undefined,
        endOffset: undefined,
        exact: false,
      },
    ]);
  });

  it("preserves code whitespace and does not include its UI controls", async () => {
    document.body.innerHTML = `
      <article>
        <div class="source-block-frame" data-source-selection-block-id="code-1">
          <button data-selection-exclude>Copy</button>
          <pre><code class="language-ts">const value = 1;\n  return value;</code></pre>
        </div>
      </article>
    `;
    const article = document.querySelector("article")!;
    const code = article.querySelector("code")!.firstChild as Text;
    const range = select(code, 0, code, code.data.length);

    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range,
      renderResult: {
        headings: [],
        sourceSelectionBlocks: [
          { id: "code-1", kind: "code", startLine: 1, endLine: 2 },
        ],
      },
    });

    expect(snapshot.plainText).toBe("const value = 1;\n  return value;");
    expect(snapshot.blocks[0]).toEqual({
      type: "code",
      text: "const value = 1;\n  return value;",
      language: "ts",
    });
    expect(selectionSnapshotText(snapshot)).not.toContain("Copy");
  });

  it("represents selected table cells and span information", async () => {
    document.body.innerHTML = `
      <article>
        <table data-source-selection-block-id="table-1">
          <tbody>
            <tr><th>Name</th><th>Status</th></tr>
            <tr><td rowspan="2">Parser</td><td><strong>Ready</strong></td></tr>
            <tr><td><code>stable</code></td></tr>
          </tbody>
        </table>
      </article>
    `;
    const article = document.querySelector("article")!;
    const table = article.querySelector("table")!;
    const start = table.querySelector("th")!.firstChild as Text;
    const end = table.querySelector("tr:last-child code")!.firstChild as Text;
    const range = select(start, 0, end, end.data.length);

    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range,
      renderResult: {
        headings: [],
        sourceSelectionBlocks: [
          { id: "table-1", kind: "table", startLine: 1, endLine: 4 },
        ],
      },
    });

    expect(snapshot.blocks[0]).toMatchObject({
      type: "table",
      rows: [
        { cells: [{ rowSpan: 1 }, { rowSpan: 1 }] },
        { cells: [{ rowSpan: 2 }, { rowSpan: 1 }] },
        { cells: [{ rowSpan: 1 }] },
      ],
    });
    expect(selectionSnapshotText(snapshot)).toContain("row span 2");
  });

  it("keeps ordered paragraph-table-paragraph content", async () => {
    document.body.innerHTML = `
      <article>
        <p data-source-selection-block-id="p1">Before table.</p>
        <table data-source-selection-block-id="t1"><tbody>
          <tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr>
        </tbody></table>
        <p data-source-selection-block-id="p2">After table.</p>
      </article>
    `;
    const article = document.querySelector("article")!;
    const start = article.querySelector("p")!.firstChild as Text;
    const end = article.querySelector("p:last-child")!.firstChild as Text;
    const range = select(start, 0, end, end.data.length);

    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range,
      renderResult: {
        headings: [],
        sourceSelectionBlocks: [
          { id: "p1", kind: "paragraph", startLine: 1, endLine: 1 },
          { id: "t1", kind: "table", startLine: 2, endLine: 4 },
          { id: "p2", kind: "paragraph", startLine: 5, endLine: 5 },
        ],
      },
    });

    expect(snapshot.blocks.map((block) => block.type)).toEqual([
      "prose",
      "table",
      "prose",
    ]);
    expect(selectionSnapshotText(snapshot)).toMatch(
      /Before table\.[\s\S]*\| A \| B \|[\s\S]*After table\./u,
    );
  });

  it("blocks unsupported embedded content instead of silently dropping it", async () => {
    document.body.innerHTML = `
      <article>
        <p>Before.</p><iframe src="about:blank"></iframe><p>After.</p>
      </article>
    `;
    const article = document.querySelector("article")!;
    const start = article.querySelector("p")!.firstChild as Text;
    const end = article.querySelector("p:last-child")!.firstChild as Text;
    const range = select(start, 0, end, end.data.length);

    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range,
    });

    expect(selectionHasBlockingDiagnostic(snapshot)).toBe(true);
    expect(snapshot.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unsupportedElement" }),
    );
  });

  it("rejects selections outside the active article", () => {
    document.body.innerHTML =
      "<article><p>Inside</p></article><aside>Outside</aside>";
    const article = document.querySelector("article")!;
    const outside = document.querySelector("aside")!.firstChild as Text;
    select(outside, 0, outside, outside.data.length);
    expect(cloneViewerSelectionRange(article)).toBeNull();
  });

  it("builds a reference without adding unselected source text", async () => {
    document.body.innerHTML = `
      <article><p data-source-selection-block-id="p1">Selected only.</p></article>
    `;
    const article = document.querySelector("article")!;
    const text = article.querySelector("p")!.firstChild as Text;
    const range = select(text, 0, text, "Selected".length);
    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range,
      renderResult: {
        headings: [],
        sourceSelectionBlocks: [
          { id: "p1", kind: "paragraph", startLine: 4, endLine: 4 },
        ],
      },
    });

    expect(selectionTextReference(snapshot)).toContain(
      "File: /workspace/docs/guide.md:4",
    );
    expect(selectionTextReference(snapshot)).toContain("Text:\nSelected");
    expect(selectionTextReference(snapshot)).not.toContain("Selected content:");
    expect(selectionTextReference(snapshot)).not.toContain("only.");
  });

  it("keeps visible content usable when source provenance is ambiguous", async () => {
    document.body.innerHTML =
      "<article><p>Same visible text</p><p>Same visible text</p></article>";
    const article = document.querySelector("article")!;
    const start = article.querySelector("p")!.firstChild as Text;
    const end = article.querySelector("p:last-child")!.firstChild as Text;
    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range: select(start, 0, end, end.data.length),
    });

    expect(selectionHasBlockingDiagnostic(snapshot)).toBe(false);
    expect(snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "sourceAmbiguous",
        severity: "warning",
      }),
    );
  });

  it("keeps text-image-text order for plain copy", () => {
    expect(
      selectionPlainCopy({
        snapshotId: "mixed",
        documentPath: payload.path,
        documentRevision: payload.updatedAt,
        plainText: "BeforeAfter",
        blocks: [
          {
            type: "prose",
            role: "paragraph",
            markdown: "Before",
            plainText: "Before",
          },
          {
            type: "image",
            imageId: "image-1",
            kind: "diagram",
            label: "Flow",
          },
          {
            type: "prose",
            role: "paragraph",
            markdown: "After",
            plainText: "After",
          },
        ],
        imageResources: [
          {
            imageId: "image-1",
            displayLabel: "Flow",
            mediaType: "image/png",
            base64: "AA==",
            byteLength: 1,
          },
        ],
        provenance: [],
        diagnostics: [],
      }),
    ).toBe("Before\n\n[Image: Flow]\n\nAfter");
  });

  it("extracts hydrated local images between text in DOM order", async () => {
    document.body.innerHTML = `
      <article><p data-source-selection-block-id="p1">Before
        <img
          src="data:image/png;base64,AA=="
          data-image-path="assets/flow.png"
          data-image-resolved-path="/workspace/docs/assets/flow.png"
          alt="Flow"
        >
        After
      </p></article>
    `;
    const article = document.querySelector("article")!;
    const paragraph = article.querySelector("p")!;
    const start = paragraph.firstChild as Text;
    const end = paragraph.lastChild as Text;
    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range: select(start, 0, end, end.data.length),
      renderResult: {
        headings: [],
        sourceSelectionBlocks: [
          { id: "p1", kind: "paragraph", startLine: 1, endLine: 1 },
        ],
      },
    });

    expect(selectionHasBlockingDiagnostic(snapshot)).toBe(false);
    expect(snapshot.blocks.map((block) => block.type)).toEqual([
      "prose",
      "image",
      "prose",
    ]);
    expect(snapshot.imageResources).toEqual([
      expect.objectContaining({
        displayLabel: "Flow",
        mediaType: "image/png",
      }),
    ]);
    expect(selectionPlainCopy(snapshot)).toMatch(
      /Before\s*\n\n\[Image: Flow\]\n\n\s*After/u,
    );
  });

  it("does not prepare untrusted inline data images", async () => {
    document.body.innerHTML = `
      <article><p>Before
        <img src="data:image/png;base64,AA==" data-image-path="data:image/png;base64,AA==" alt="Inline">
        After
      </p></article>
    `;
    const article = document.querySelector("article")!;
    const paragraph = article.querySelector("p")!;
    const snapshot = await extractDocumentSelection({
      article,
      document: payload,
      range: select(
        paragraph.firstChild as Text,
        0,
        paragraph.lastChild as Text,
        (paragraph.lastChild as Text).data.length,
      ),
    });

    expect(snapshot.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "imageUnavailable",
        severity: "blocking",
      }),
    );
  });

  it("uses one TeX representation from the actual Markdown render", async () => {
    const source =
      "本章は単一ヘッドなので、$D_{\\mathrm{head}}=D_{\\mathrm{model}}=3$です。第4章では$D_{\\mathrm{model}}$を複数の$D_{\\mathrm{head}}$へ分けます。";
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      { ...payload, source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    document.body.innerHTML = `<article>${html}</article>`;
    const article = document.querySelector("article")!;
    const paragraph = article.querySelector("p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const snapshot = await extractDocumentSelection({
      article,
      document: { ...payload, source },
      range,
      renderResult: result,
    });

    expect(snapshot.plainText.match(/D_\{\\mathrm\{head\}\}/gu)).toHaveLength(
      2,
    );
    expect(snapshot.plainText.match(/D_\{\\mathrm\{model\}\}/gu)).toHaveLength(
      2,
    );
    expect(selectionSnapshotText(snapshot)).toBe(source);
    expect(selectionPlainCopy(snapshot)).toBe(snapshot.plainText);
    expect(selectionTextReference(snapshot)).toContain(
      `Text:\n${snapshot.plainText}`,
    );
    expect(selectionTextReference(snapshot)).not.toContain(source);
    expect(selectionSnapshotText(snapshot)).not.toContain("katex-html");
  });

  it("keeps display TeX delimiters and drops unowned KaTeX internals", async () => {
    const source = `Before.

$$
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
$$

After.`;
    const result = renderMarkdownCore(source);
    const html = await prepareDocumentHtml(
      result.html,
      { ...payload, source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    document.body.innerHTML = `<article>${html}<p id="unowned"><span class="katex"><span class="katex-html" aria-hidden="true">hidden visual math</span></span></p></article>`;
    const article = document.querySelector("article")!;
    const range = document.createRange();
    range.selectNodeContents(article);
    const snapshot = await extractDocumentSelection({
      article,
      document: { ...payload, source },
      range,
      renderResult: result,
    });

    expect(selectionSnapshotText(snapshot)).toContain(
      "$$\n\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}\n$$",
    );
    expect(selectionSnapshotText(snapshot)).not.toContain("hidden visual math");
    expect(snapshot.plainText).not.toContain("hidden visual math");
  });

  it("serializes actual AsciiDoc inline and display math once", async () => {
    const source = `= Math

Inline stem:[E = mc^2].

[stem]
++++
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
++++`;
    const html = await prepareDocumentHtml(
      '<div class="paragraph"><p>Inline \\$E = mc^2\\$.</p></div><div class="stemblock"><div class="content">\\$\\begin{bmatrix}\n1 &amp; 2 \\\\$ \n\\$3 &amp; 4\n\\end{bmatrix}\\$</div></div>',
      { ...payload, format: "asciidoc", source },
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      { headings: [], sourceBlocks: [] },
    );
    document.body.innerHTML = `<article>${html}</article>`;
    const article = document.querySelector("article")!;
    const range = document.createRange();
    range.selectNodeContents(article);
    const snapshot = await extractDocumentSelection({
      article,
      document: { ...payload, format: "asciidoc", source },
      range,
    });

    expect(selectionSnapshotText(snapshot)).toContain("$E = mc^2$");
    expect(selectionSnapshotText(snapshot)).toContain(
      "$$\n\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}\n$$",
    );
    expect(snapshot.plainText.match(/E = mc\^2/gu)).toHaveLength(1);
    expect(snapshot.plainText.match(/\\begin\{bmatrix\}/gu)).toHaveLength(1);
  });
});
