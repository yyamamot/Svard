import { describe, expect, it } from "vitest";

import { renderMarkdownDocument } from "../../src/core/markdown/render";
import { extractAsciiDocParagraphSourceBlocks } from "../../src/core/sourceTextBlocks";

describe("source text blocks", () => {
  it("maps Markdown top-level paragraphs to their source line ranges", () => {
    const result = renderMarkdownDocument(
      "# Title\n\nA *source* paragraph with [a link](https://example.com).\ncontinued.\n\n- excluded list item\n",
    );

    expect(result.sourceTextBlocks).toEqual([
      { id: "text-1", kind: "paragraph", startLine: 3, endLine: 4 },
    ]);
    expect(result.html).not.toContain("data-source-text-block-id");
    const paragraphProvenance = result.markdownRendererProvenance?.find(
      (record) => record.kind === "paragraph",
    );
    expect(paragraphProvenance).toMatchObject({
      kind: "paragraph",
      sourceTextBlockId: "text-1",
    });
    expect(result.html).toContain(
      `data-source-renderer-id="${paragraphProvenance?.id}"`,
    );
  });

  it("keeps a contiguous included AsciiDoc paragraph at its origin", () => {
    const source =
      "= Title\n\nRoot paragraph.\n\nIncluded *paragraph*.\ncontinued.\n\nimage::diagram.svg[]\n";
    const origins = source
      .split("\n")
      .map((_, index) =>
        index < 4
          ? { sourcePath: "/workspace/docs/main.adoc", line: index + 1 }
          : { sourcePath: "/workspace/docs/part.adoc", line: index - 3 },
      );

    expect(extractAsciiDocParagraphSourceBlocks(source, origins)).toEqual([
      {
        id: "text-1",
        kind: "paragraph",
        startLine: 3,
        endLine: 3,
        sourceLocation: {
          sourcePath: "/workspace/docs/main.adoc",
          line: 3,
          column: 1,
        },
      },
      {
        id: "text-2",
        kind: "paragraph",
        startLine: 1,
        endLine: 2,
        sourceLocation: {
          sourcePath: "/workspace/docs/part.adoc",
          line: 1,
          column: 1,
        },
      },
    ]);
  });
});
