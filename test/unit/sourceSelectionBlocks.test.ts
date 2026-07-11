import { describe, expect, it } from "vitest";

import { extractSourceSelectionBlocks } from "../../src/core/sourceSelectionBlocks";

describe("source selection blocks", () => {
  it("maps Markdown heading, list, table, code, and diagram ranges", () => {
    expect(
      extractSourceSelectionBlocks(
        "# Title\n\n- one\n- two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```\n\n```mermaid\ngraph TD\n```\n",
        "markdown",
      ).map((block) => [block.kind, block.startLine, block.endLine]),
    ).toEqual([
      ["heading", 1, 1],
      ["list", 3, 4],
      ["table", 6, 8],
      ["code", 10, 12],
      ["diagram", 14, 16],
    ]);
  });

  it("maps AsciiDoc delimited blocks and table ranges", () => {
    expect(
      extractSourceSelectionBlocks(
        "== Title\n\n* one\n* two\n\n|===\n|A |B\n|===\n\n[source,c]\n----\nint x;\n----\n\n[mermaid]\n----\ngraph TD\n----\n",
        "asciidoc",
      ).map((block) => [block.kind, block.startLine, block.endLine]),
    ).toEqual([
      ["heading", 1, 1],
      ["list", 3, 4],
      ["table", 6, 8],
      ["code", 10, 13],
      ["diagram", 15, 18],
    ]);
  });
});
