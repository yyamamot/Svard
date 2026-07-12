import { afterEach, describe, expect, it } from "vitest";

import type { DocumentPayload } from "../../src/core/types";
import {
  originalTextReferenceForSelection,
  sourceReferenceForSelection,
  sourceTextBlockForSelection,
} from "../../src/ui/lib/sourceTextCopy";

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/main.adoc",
  basePath: "/workspace/docs",
  format: "asciidoc",
  source: "= Title\n\nRoot paragraph.\n",
  updatedAt: "2026-07-11T00:00:00.000Z",
  includeFiles: [
    {
      path: "/workspace/docs/part.adoc",
      source: "Included *paragraph*.\ncontinued.\n",
    },
  ],
};

afterEach(() => window.getSelection()?.removeAllRanges());

describe("sourceTextBlockForSelection", () => {
  it("adds the shared heading breadcrumb to original source text", () => {
    const article = document.createElement("article");
    article.innerHTML = `<h1 id="guide">Guide</h1><h2 id="copy">Copy</h2><p data-source-text-block-id="text-1">Root paragraph.</p>`;
    const paragraph = article.querySelector("p")!;
    document.body.append(article);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: documentPayload,
        renderResult: {
          headings: [
            { id: "guide", level: 1, text: "Guide" },
            { id: "copy", level: 2, text: "Copy" },
          ],
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 3, endLine: 3 },
          ],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/main.adoc:3\nSection: Guide > Copy\nOriginal text:\nRoot paragraph.",
    );
    article.remove();
  });

  it("copies a partial multi-line paragraph with its actual line range", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">First line.\nSecond line.\nThird line.</p>`;
    const paragraph = article.querySelector("p")!;
    document.body.append(article);
    const text = paragraph.firstChild!;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 18);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: {
          ...documentPayload,
          source: "First line.\nSecond line.\nThird line.\n",
        },
        renderResult: {
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 1, endLine: 3 },
          ],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/main.adoc:1-2\nOriginal text:\nline.\nSecond",
    );
    article.remove();
  });

  it("copies only the selected literal text from its include origin", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">Included paragraph.</p>`;
    const paragraph = article.querySelector("p")!;
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, 3);
    range.setEnd(paragraph.firstChild!, 11);
    window.getSelection()?.addRange(range);

    const plainIncludeDocument = {
      ...documentPayload,
      includeFiles: [
        {
          path: "/workspace/docs/part.adoc",
          source: "Included paragraph.\ncontinued.\n",
        },
      ],
    };
    expect(
      sourceTextBlockForSelection({
        article,
        document: plainIncludeDocument,
        renderResult: {
          sourceTextBlocks: [
            {
              id: "text-1",
              kind: "paragraph",
              startLine: 1,
              endLine: 2,
              sourceLocation: {
                sourcePath: "/workspace/docs/part.adoc",
                line: 1,
              },
            },
          ],
        },
      }),
    ).toBe("luded pa");
    expect(
      sourceReferenceForSelection({
        article,
        document: plainIncludeDocument,
        renderResult: {
          sourceTextBlocks: [
            {
              id: "text-1",
              kind: "paragraph",
              startLine: 1,
              endLine: 2,
              sourceLocation: {
                sourcePath: "/workspace/docs/part.adoc",
                line: 1,
              },
            },
          ],
        },
      }),
    ).toBe("/workspace/docs/part.adoc:1");

    article.remove();
  });

  it("does not copy a selection that spans source blocks", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">First.</p><p data-source-text-block-id="text-2">Second.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, 7);
    window.getSelection()?.addRange(range);

    expect(
      sourceTextBlockForSelection({
        article,
        document: documentPayload,
        renderResult: { sourceTextBlocks: [] },
      }),
    ).toBeUndefined();

    article.remove();
  });

  it("copies only the selected Markdown code without its fence", () => {
    const markdownDocument = {
      ...documentPayload,
      path: "/workspace/docs/code.md",
      format: "markdown" as const,
      source: "```c\nint main(void) {}\n```\n",
    };
    const article = document.createElement("article");
    article.innerHTML = `<div class="source-block-frame"><pre data-source-block-id="source-1">int main(void) {}</pre></div>`;
    const pre = article.querySelector("pre")!;
    document.body.append(article);
    const range = document.createRange();
    range.setStart(pre.firstChild!, 4);
    range.setEnd(pre.firstChild!, 8);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: markdownDocument,
        renderResult: {
          sourceBlocks: [{ id: "source-1", sourceLocation: { line: 1 } }],
        },
      })?.value,
    ).toBe("File: /workspace/docs/code.md:2\nOriginal text:\nmain");

    article.remove();
  });

  it("copies consecutive Markdown paragraph and code units as one original range", () => {
    const markdownDocument = {
      ...documentPayload,
      path: "/workspace/docs/steps.md",
      format: "markdown" as const,
      source: "Use this command.\n\n```sh\n$ run\n```\n\nThen verify.\n",
    };
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">Use this command.</p><div class="source-block-frame"><pre data-source-block-id="source-1">$ run</pre></div><p data-source-text-block-id="text-2">Then verify.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 4);
    range.setEnd(paragraphs[1].firstChild!, 5);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: markdownDocument,
        renderResult: {
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
            { id: "text-2", kind: "paragraph", startLine: 7, endLine: 7 },
          ],
          sourceBlocks: [{ id: "source-1", sourceLocation: { line: 3 } }],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/steps.md:1-7\nOriginal text:\nthis command.\n\n```sh\n$ run\n```\n\nThen ",
    );
    article.remove();
  });

  it("copies a paragraph-code-paragraph range from the rendered selection mapping", () => {
    const markdownDocument = {
      ...documentPayload,
      path: "/workspace/docs/steps.md",
      format: "markdown" as const,
      source: "Before text.\n\n```text\n$ run\n```\n\nAfter text.\n",
    };
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-selection-block-id="selection-paragraph-1">Before text.</p><div class="source-block-frame" data-source-selection-block-id="selection-code-1"><pre data-source-selection-block-id="selection-code-1">$ run</pre></div><p data-source-selection-block-id="selection-paragraph-2">After text.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 7);
    range.setEnd(paragraphs[1].firstChild!, 5);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: markdownDocument,
        renderResult: {
          sourceTextBlocks: [],
          sourceSelectionBlocks: [
            {
              id: "selection-paragraph-1",
              kind: "paragraph",
              startLine: 1,
              endLine: 1,
            },
            {
              id: "selection-code-1",
              kind: "code",
              startLine: 3,
              endLine: 5,
            },
            {
              id: "selection-paragraph-2",
              kind: "paragraph",
              startLine: 7,
              endLine: 7,
            },
          ],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/steps.md:1-7\nOriginal text:\ntext.\n\n```text\n$ run\n```\n\nAfter",
    );
    article.remove();
  });

  it("copies full mapped boundary blocks when inline markup prevents a literal match", () => {
    const markdownDocument = {
      ...documentPayload,
      path: "/workspace/docs/steps.md",
      format: "markdown" as const,
      source:
        "Before `checksum(A)`.\n\n```text\n$ run\n```\n\nAfter **verification**.\n",
    };
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-selection-block-id="selection-paragraph-1">Before <code>checksum(A)</code>.</p><div class="source-block-frame" data-source-selection-block-id="selection-code-1"><pre data-source-selection-block-id="selection-code-1">$ run</pre></div><p data-source-selection-block-id="selection-paragraph-2">After <strong>verification</strong>.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0], 0);
    range.setEnd(paragraphs[1], paragraphs[1].childNodes.length);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: markdownDocument,
        renderResult: {
          sourceTextBlocks: [],
          sourceSelectionBlocks: [
            {
              id: "selection-paragraph-1",
              kind: "paragraph",
              startLine: 1,
              endLine: 1,
            },
            {
              id: "selection-code-1",
              kind: "code",
              startLine: 3,
              endLine: 5,
            },
            {
              id: "selection-paragraph-2",
              kind: "paragraph",
              startLine: 7,
              endLine: 7,
            },
          ],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/steps.md:1-7\nOriginal text:\nBefore `checksum(A)`.\n\n```text\n$ run\n```\n\nAfter **verification**.",
    );
    article.remove();
  });

  it("copies consecutive AsciiDoc paragraph and code units with attributes", () => {
    const asciidocDocument = {
      ...documentPayload,
      path: "/workspace/docs/steps.adoc",
      source: "Check this.\n\n[source,c]\n----\nint main() {}\n----\n\nDone.\n",
    };
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">Check this.</p><div class="source-block-frame"><pre data-source-block-id="source-1">int main() {}</pre></div><p data-source-text-block-id="text-2">Done.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, 5);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: asciidocDocument,
        renderResult: {
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
            { id: "text-2", kind: "paragraph", startLine: 8, endLine: 8 },
          ],
          sourceBlocks: [{ id: "source-1", sourceLocation: { line: 3 } }],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/steps.adoc:1-8\nOriginal text:\nCheck this.\n\n[source,c]\n----\nint main() {}\n----\n\nDone.",
    );
    article.remove();
  });

  it("does not copy a range that includes an unsupported heading or another origin", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">First.</p><h2>Stop</h2><p data-source-text-block-id="text-2">Second.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, 7);
    window.getSelection()?.addRange(range);

    expect(
      originalTextReferenceForSelection({
        article,
        document: documentPayload,
        renderResult: {
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
            {
              id: "text-2",
              kind: "paragraph",
              startLine: 1,
              endLine: 1,
              sourceLocation: {
                sourcePath: "/workspace/docs/part.adoc",
                line: 1,
              },
            },
          ],
        },
      }),
    ).toBeUndefined();
    article.remove();
  });

  it("copies include-origin units as ordered file fragments", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-selection-block-id="selection-paragraph-1">Root.</p><p data-source-selection-block-id="selection-paragraph-2">Included.</p>`;
    const paragraphs = article.querySelectorAll("p");
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraphs[0], 0);
    range.setEnd(paragraphs[1], paragraphs[1].childNodes.length);
    window.getSelection()?.addRange(range);
    expect(
      originalTextReferenceForSelection({
        article,
        document: {
          ...documentPayload,
          source: "Root.\n",
          includeFiles: [
            { path: "/workspace/docs/part.adoc", source: "Included.\n" },
          ],
        },
        renderResult: {
          sourceTextBlocks: [],
          sourceSelectionBlocks: [
            {
              id: "selection-paragraph-1",
              kind: "paragraph",
              startLine: 1,
              endLine: 1,
            },
            {
              id: "selection-paragraph-2",
              kind: "paragraph",
              startLine: 1,
              endLine: 1,
              sourceLocation: {
                sourcePath: "/workspace/docs/part.adoc",
                line: 1,
              },
            },
          ],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/main.adoc:1\nOriginal text:\nRoot.\n\nFile: /workspace/docs/part.adoc:1\nOriginal text:\nIncluded.",
    );
    article.remove();
  });

  it("rejects repeated partial text but resolves a fully selected marked block", () => {
    const article = document.createElement("article");
    article.innerHTML = `<p data-source-text-block-id="text-1">same same</p>`;
    const paragraph = article.querySelector("p")!;
    document.body.append(article);
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 4);
    window.getSelection()?.addRange(range);
    expect(
      originalTextReferenceForSelection({
        article,
        document: { ...documentPayload, source: "same same\n" },
        renderResult: {
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
          ],
        },
      }),
    ).toBeUndefined();

    window.getSelection()?.removeAllRanges();
    paragraph.textContent = "marked";
    const markedRange = document.createRange();
    markedRange.selectNodeContents(paragraph);
    window.getSelection()?.addRange(markedRange);
    expect(
      originalTextReferenceForSelection({
        article,
        document: { ...documentPayload, source: "*marked*\n" },
        renderResult: {
          sourceTextBlocks: [
            { id: "text-1", kind: "paragraph", startLine: 1, endLine: 1 },
          ],
        },
      })?.value,
    ).toBe(
      "File: /workspace/docs/main.adoc:1\nOriginal text:\n*marked*",
    );
    article.remove();
  });
});
